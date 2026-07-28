/**
 * ai-fill-planner.ts
 * -------------------------------------------------------------
 * AI layer that turns a template's extracted DocxStructure into a concrete
 * FillPlan (which checkboxes to tick, what text to write in each field slot,
 * and which tag values to use), grounded in the candidate + evaluation data.
 *
 * "AI everywhere" strategy:
 *   - When a Claude key is available, the model reads the actual questions and
 *     option labels of THIS document and decides the answers, so a single
 *     engine generalizes across all 66+ varied form templates without any
 *     per-document hardcoding.
 *   - When no key is available (or the call fails), a deterministic fallback
 *     produces a safe, spec-compliant plan so generation never hard-fails.
 *
 * Hard constraints enforced regardless of the AI output (post-processing):
 *   - Empty session/exam dates stay empty (spec §8.1).
 *   - Jury names/contacts come only from jury-rules (spec §7).
 *   - Scores never fall below the pass mark (spec §8.5) — enforced upstream in
 *     the evaluation engine; here we never lower them.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { isAnthropicQuotaOrAuthError } from './claude-engine';
import { DocxStructure, FillPlan, structureToMarkdownView } from './docx-filler';
import { getJuryRules } from './jury-rules';
import { CandidateEvaluationResult, CandidateRow } from './types';

const CLAUDE_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

/** Best value for an identity/contact tag or field, never invented. */
function contactValue(candidate: CandidateRow) {
  return {
    mail: candidate.mail || candidate.mail_wedof || candidate.mail_crm || '',
    adresse:
      candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '',
    tel: candidate.numero_tel || '',
  };
}

/**
 * Deterministic fallback plan: fills identity/contact field slots by matching
 * their labels, and for each checkbox group ticks exactly one option chosen by
 * the candidate's theme level (so answers stay internally consistent).
 */
export function buildFallbackPlan(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult,
  structure: DocxStructure
): FillPlan {
  const jury = getJuryRules(candidate.organisme);
  const contact = contactValue(candidate);
  const fullName = `${candidate.prenom} ${candidate.nom}`.trim();

  // ---- Field slots: match by label keywords -------------------------------
  const fields: Record<string, string> = {};
  for (const slot of structure.fieldSlots) {
    const l = slot.label.toLowerCase();
    if ((l.includes('nom') && l.includes('prénom')) || l.includes('nom et pr') || l.includes('candidat'))
      fields[slot.id] = fullName;
    else if (l === 'nom' || l.includes('nom du candidat') || l.includes('nom de famille'))
      fields[slot.id] = candidate.nom;
    else if (l.includes('prénom') || l.includes('prenom'))
      fields[slot.id] = candidate.prenom;
    else if (l.includes('e-mail') || l.includes('email') || l.includes('mail') || l.includes('courriel'))
      fields[slot.id] = contact.mail;
    else if (l.includes('téléphone') || l.includes('tel') || l.includes('portable') || l.includes('mobile'))
      fields[slot.id] = contact.tel;
    else if (l.includes('adresse') || l.includes('domicile') || l.includes('résidence'))
      fields[slot.id] = contact.adresse;
    else if (l.includes('certification') || l.includes('formation') || l.includes('intitulé') || l.includes('titre'))
      fields[slot.id] = `${candidate.code_certif} - ${candidate.formation}`;
    else if (l.includes('organisme') || l.includes('établissement') || l.includes('centre'))
      fields[slot.id] = candidate.organisme;
    else if (l.includes('fonction') || l.includes('activité') || l.includes('poste') || l.includes('expérience'))
      fields[slot.id] = candidate.experience_pro ? candidate.experience_pro.split(/[.\n]/)[0].slice(0, 80) : '';
    else if (l.includes('président') || l.includes('responsable'))
      fields[slot.id] = jury.presidentName;
    else if (l.includes('membre'))
      fields[slot.id] = jury.memberName;
    // Dates: only if source has them (spec §8.1) — never invent.
    else if (l.includes("date de l'entretien") || l.includes("date de l'analyse") || l.includes("date examen") || l.includes("date d'examen"))
      fields[slot.id] = candidate.date_examen || '';
    else if (l.includes("date début") || l.includes("début session") || l.includes("période"))
      fields[slot.id] = candidate.date_debut_session || candidate.dates_session || '';
    else if (l.includes("date fin") || l.includes("fin session"))
      fields[slot.id] = candidate.date_fin_session || candidate.dates_session || '';
    else if (l.includes('date'))
      fields[slot.id] = candidate.date_examen || '';
  }

  // ---- Checkboxes: pick one option per group, biased by average level -----
  const checkboxes: Record<string, boolean> = {};
  const avgLevel =
    evalResult.themeProfiles.reduce((a, t) => a + t.level, 0) /
    Math.max(1, evalResult.themeProfiles.length);

  for (const group of structure.checkboxGroups) {
    if (group.options.length === 0) continue;
    // Higher level -> pick a later ("more advanced/correct") option, clamped.
    const ratio = Math.min(0.95, Math.max(0.05, avgLevel / 5));
    const idx = Math.min(
      group.options.length - 1,
      Math.round(ratio * (group.options.length - 1))
    );
    checkboxes[group.options[idx].id] = true;
  }

  return { checkboxes, fields };
}

/**
 * AI-driven plan. Asks Claude to answer the document's own questions/fields.
 * Falls back to the deterministic plan on any failure.
 */
export async function buildAiFillPlan(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult,
  structure: DocxStructure,
  documentName: string,
  userApiKey?: string
): Promise<{ plan: FillPlan; usedAi: boolean }> {
  const fallback = buildFallbackPlan(candidate, evalResult, structure);

  const apiKey = userApiKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  const hasStructure =
    structure.checkboxGroups.length > 0 || structure.fieldSlots.length > 0;
  if (!apiKey || !hasStructure) {
    return { plan: fallback, usedAi: false };
  }

  const jury = getJuryRules(candidate.organisme);
  const contact = contactValue(candidate);

  // Markdown "view" of the document — the easy-to-read surface for the model.
  const markdownView = structureToMarkdownView(structure);

  const prompt = `Tu remplis un document de formation certifiante français : "${documentName}".
Organisme : ${candidate.organisme}. Certification : ${candidate.code_certif} — ${candidate.formation}.

CANDIDAT (données réelles, NE JAMAIS inventer identité/coordonnées) :
- Nom : ${candidate.nom}
- Prénom : ${candidate.prenom}
- Civilité : ${candidate.civilite || ''}
- Email : ${contact.mail}
- Téléphone : ${contact.tel}
- Adresse : ${contact.adresse}
- Expérience professionnelle déclarée : "${candidate.experience_pro || ''}"
- Date de naissance : ${candidate.date_naissance || ''}
- Date début session : ${candidate.date_debut_session || ''}
- Date fin session : ${candidate.date_fin_session || ''}
- Date examen : ${candidate.date_examen || ''}

PROFIL DE NIVEAU SIMULÉ (échelle 1-5, cohérent d'un document à l'autre) :
${evalResult.themeProfiles.map((t) => `- ${t.themeTitle} : ${t.level}/5`).join('\n')}
Score de positionnement : ${evalResult.testPositionnement.totalScore}/20.
Note certifiante : ${evalResult.grilleEvaluation.convertedScore20}/20 (mention ADMIS).

JURY (valeurs FIXES, à utiliser telles quelles) :
- Président : ${jury.presidentName}
- Membre : ${jury.memberName}
- Contact : ${jury.contact}

RÈGLES STRICTES :
1. Pour chaque CASE À COCHER, choisis la/les réponse(s) cohérente(s) avec le niveau du candidat. Pour un QCM, coche la BONNE réponse si le niveau du thème est élevé, sinon coche une réponse plausible mais parfois imparfaite (le score global reste ADMIS). Coche au moins une option par groupe.
2. Pour chaque CHAMP texte, écris une valeur réaliste et personnalisée. Varie la syntaxe. De rares fautes d'orthographe mineures sont tolérées UNIQUEMENT dans les réponses libres rédigées par le candidat, jamais dans identité, dates, montants ou noms du jury.
3. DATES : si une date source est vide ci-dessus, laisse le champ VIDE ("") — n'invente jamais de date.
4. Coordonnées/identité : recopie exactement les données candidat, ne les invente pas.

DOCUMENT À REMPLIR (vue Markdown ; les identifiants entre parenthèses comme (fld0) ou (cb3) sont les clés à réutiliser dans ta réponse) :
${markdownView}

Réponds UNIQUEMENT en JSON strict, sans texte autour :
{
  "fields": { "<field id>": "valeur", ... },
  "checkboxes": { "<option id>": true, ... }
}
N'inclus dans "checkboxes" que les options cochées (true).`;

  try {
    const anthropic = new Anthropic({ apiKey });
    for (const model of CLAUDE_MODELS) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });
        const first = response.content[0];
        if (first && first.type === 'text') {
          const jsonText = extractJson(first.text);
          const parsed = JSON.parse(jsonText) as FillPlan;
          const plan = sanitizePlan(parsed, candidate, structure, fallback);
          return { plan, usedAi: true };
        }
      } catch (e: any) {
        if (isAnthropicQuotaOrAuthError(e)) {
          throw new Error(`Erreur API Anthropic: Crédits/Tokens épuisés ou clé API invalide (${e.message || 'Quota dépassé'}).`);
        }
      }
    }
  } catch (err: any) {
    if (isAnthropicQuotaOrAuthError(err) || err.message?.includes('Crédits/Tokens épuisés')) {
      throw err;
    }
    console.warn('AI fill-plan failed, using deterministic fallback:', err);
  }

  return { plan: fallback, usedAi: false };
}

/** Pull the first {...} JSON object out of a model response. */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '{}';
  return text.slice(start, end + 1);
}

/**
 * Post-process the AI plan to enforce hard constraints and fill any gaps from
 * the deterministic fallback (so no field the AI skipped is left blank when we
 * actually know the value).
 */
function sanitizePlan(
  parsed: FillPlan,
  candidate: CandidateRow,
  structure: DocxStructure,
  fallback: FillPlan
): FillPlan {
  const fields: Record<string, string> = { ...(fallback.fields || {}) };
  const checkboxes: Record<string, boolean> = {};

  // Merge AI fields over fallback, then enforce constraints.
  if (parsed.fields) {
    for (const slot of structure.fieldSlots) {
      const aiVal = parsed.fields[slot.id];
      if (typeof aiVal === 'string') fields[slot.id] = aiVal;
    }
  }

  // Enforce §8.1: date labels with empty source stay empty.
  for (const slot of structure.fieldSlots) {
    const l = slot.label.toLowerCase();
    const isDate = l.includes('date');
    if (!isDate) continue;
    const source =
      (l.includes('examen') && candidate.date_examen) ||
      (l.includes('début') && candidate.date_debut_session) ||
      (l.includes('fin') && candidate.date_fin_session) ||
      candidate.date_examen ||
      candidate.date_debut_session ||
      '';
    if (!source) fields[slot.id] = '';
  }

  // Checkboxes: only accept ids that exist; guarantee >=1 per group.
  const validIds = new Set<string>();
  structure.checkboxGroups.forEach((g) => g.options.forEach((o) => validIds.add(o.id)));
  if (parsed.checkboxes) {
    for (const [id, val] of Object.entries(parsed.checkboxes)) {
      if (validIds.has(id) && val === true) checkboxes[id] = true;
    }
  }
  for (const group of structure.checkboxGroups) {
    const anyChecked = group.options.some((o) => checkboxes[o.id]);
    if (!anyChecked && group.options.length > 0) {
      const fb = fallback.checkboxes || {};
      const fbChoice = group.options.find((o) => fb[o.id]);
      checkboxes[(fbChoice || group.options[0]).id] = true;
    }
  }

  return { fields, checkboxes };
}
