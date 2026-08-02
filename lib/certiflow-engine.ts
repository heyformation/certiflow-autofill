import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PizZip from 'pizzip';
import { CandidateRow, CandidateEvaluationResult } from './types';
import { getJuryRules } from './jury-rules';
import { getDeterministicProduction, getDeterministicQuestionResponse } from './ai-fill-planner';

const TEMPLATES_ROOT = 'F:\\Office\\Input -output\\CertiFlow_Verified_Document_Templates_v1';

export interface TemplateMappingField {
  semantic_field: string;
  source_path: string;
  target: Record<string, any>;
  required: boolean;
  example_value: any;
  evidence: string;
}

export interface TemplateMapping {
  template_id: string;
  template_path: string;
  template_hash: string;
  organization: string;
  certification: string;
  format: 'DOCX' | 'XLSX' | 'PPTX';
  fields: TemplateMappingField[];
  production_readiness?: { status: string };
}

export interface AvailableTemplate {
  templateId: string;
  filename: string;
  format: string;
  mappingPath: string;
  templatePath: string;
}

const paragraphPattern = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const textPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function encodeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraphText(paragraph: string): string {
  return [...paragraph.matchAll(textPattern)].map((match) => decodeXml(match[1])).join('');
}

function replaceParagraphAt(
  xml: string,
  index: number,
  replacement: (paragraph: string) => string
): string {
  let current = -1;
  let found = false;
  const output = xml.replace(paragraphPattern, (paragraph) => {
    current++;
    if (current !== index) return paragraph;
    found = true;
    return replacement(paragraph);
  });
  if (!found) throw new Error(`DOCX paragraph target ${index} does not exist.`);
  return output;
}

function verifyTextHash(paragraph: string, expected?: string) {
  if (!expected) return;
  const actual = crypto.createHash('sha256').update(paragraphText(paragraph), 'utf8').digest('hex');
  if (actual !== expected) throw new Error('DOCX target text hash mismatch.');
}

function setParagraphValue(
  paragraph: string,
  value: unknown,
  expectedHash?: string,
  fixedPrefix = ''
): string {
  verifyTextHash(paragraph, expectedHash);
  // Ensure value is always a clean string — never serialize objects
  let strValue: string;
  if (value === null || value === undefined) {
    strValue = '';
  } else if (Array.isArray(value)) {
    // Arrays of objects: join member names
    strValue = value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? (item.name || Object.values(item).join(' '))
          : String(item)
      )
      .join(', ');
  } else if (typeof value === 'object') {
    // Single object: try .name, then stringify sensibly
    const obj = value as Record<string, any>;
    strValue = obj.name || obj.label || obj.value || JSON.stringify(obj);
  } else {
    strValue = String(value);
  }

  const encoded = encodeXml(`${fixedPrefix}${strValue}`);
  const matches = [...paragraph.matchAll(textPattern)];
  if (!matches.length || paragraphText(paragraph) === '') {
    return paragraph.replace(/<\/w:p>$/, `<w:r><w:t xml:space="preserve">${encoded}</w:t></w:r></w:p>`);
  }
  let first = true;
  return paragraph.replace(textPattern, (whole) => {
    if (!first) return whole.replace(/>([^<]*)<\/w:t>$/, '></w:t>');
    first = false;
    return whole.replace(/>[\s\S]*<\/w:t>$/, `>${encoded}</w:t>`);
  });
}

function toggleCheckbox(
  paragraph: string,
  checked: boolean,
  option: Record<string, any>
): string {
  verifyTextHash(paragraph, String(option.template_text_sha256 || ''));
  const on = String(option.on_symbol || '☒');
  const off = String(option.off_symbol || '☐');
  const desired = checked ? on : off;
  const pattern = new RegExp(`[${on}${off}]`);
  if (!pattern.test(paragraphText(paragraph))) {
    throw new Error('Checkbox symbol not found at mapped target.');
  }
  let changed = false;
  return paragraph.replace(textPattern, (whole, content: string) => {
    if (changed || !pattern.test(decodeXml(content))) return whole;
    changed = true;
    return whole.replace(content, encodeXml(decodeXml(content).replace(pattern, desired)));
  });
}

export function getPath(root: Record<string, any>, pathStr: string): any {
  const clean = pathStr.replace(/^\$\.?/, '');
  return clean
    .split('.')
    .filter(Boolean)
    .reduce<any>(
      (value, key) => (value && typeof value === 'object' ? value[key] : undefined),
      root
    );
}

export function setPath(root: Record<string, any>, pathStr: string, value: any): void {
  const keys = pathStr.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let cursor = root;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
    } else {
      cursor = (cursor[key] ??= {}) as Record<string, any>;
    }
  });
}

export interface DocumentQa {
  passed: boolean;
  partCount: number;
  populatedFields: number;
  missingRequired: string[];
  errors: string[];
}

// ─── Precise path matchers ──────────────────────────────────────────────────
// These test against the normalized dotted path (without $. prefix)

/** Returns true only if the path ends exactly with one of the given suffixes. */
function pathEndsWith(p: string, ...suffixes: string[]): boolean {
  return suffixes.some((s) => p === s || p.endsWith(`.${s}`));
}

/** Returns true if the path contains a segment exactly matching any of the words. */
function pathHasSegment(p: string, ...segments: string[]): boolean {
  const parts = new Set(p.split('.'));
  return segments.some((s) => parts.has(s));
}

/**
 * getFallbackValue — resolves a meaningful value for a mapping field
 * when the canonical data payload does not already contain one.
 *
 * RULES:
 *  - Never use example_value (documentation text, not real data).
 *  - Narrow each match to specific path patterns to avoid cross-contamination.
 *  - Never fill grille_controle or fiche_dysfonctionnement fields.
 */
function getFallbackValue(field: TemplateMappingField, data: Record<string, any>): string {
  // Normalise path for matching
  const p = field.source_path.replace(/^\$\.?/, '').toLowerCase();

  // ── Block grille de contrôle / fiche dysfonctionnement fields completely ──
  if (
    p.includes('grille_controle') ||
    p.includes('grille_de_controle') ||
    p.includes('fiche_dysfonctionnement') ||
    p.includes('dysfonctionnement')
  ) {
    return '';
  }

  // ── Jury members serialized as formatted string ──
  if (pathEndsWith(p, 'members') && p.includes('jury')) {
    const members: any[] = data.jury?.members || [];
    return members.map((m) => `${m.name} (${m.role})`).join(', ');
  }

  // ── Jury president / signature ──
  if (
    pathEndsWith(p, 'president_jury') ||
    pathEndsWith(p, 'president') && p.includes('jury') ||
    pathEndsWith(p, 'signature_jury')
  ) {
    return data.jury?.president || '';
  }

  // ── Jury member (juré) ──
  if (
    pathEndsWith(p, 'membre_jury') ||
    pathEndsWith(p, 'membre') && p.includes('jury')
  ) {
    return data.jury?.membre || '';
  }

  // ── Stagiaire field — ONLY the exact "stagiaire" leaf in answers ──
  if (pathEndsWith(p, 'stagiaire')) {
    return `${data.candidate?.identity?.first_name || ''} ${data.candidate?.identity?.last_name || ''}`.trim();
  }

  // ── Candidate name fields ──
  if (pathEndsWith(p, 'full_name') || pathEndsWith(p, 'nom_prenom')) {
    return data.candidate?.identity?.full_name || '';
  }
  if (pathEndsWith(p, 'last_name') || pathEndsWith(p, 'nom')) {
    return data.candidate?.identity?.last_name || '';
  }
  if (pathEndsWith(p, 'first_name') || pathEndsWith(p, 'prenom')) {
    return data.candidate?.identity?.first_name || '';
  }

  // ── Contact ──
  if (pathEndsWith(p, 'email') || pathEndsWith(p, 'mail')) {
    return data.candidate?.contact?.email || '';
  }
  if (pathEndsWith(p, 'phone') || pathEndsWith(p, 'telephone') || pathEndsWith(p, 'tel')) {
    return data.candidate?.contact?.phone || '';
  }

  // ── Address ──
  if (pathEndsWith(p, 'line_1') || pathEndsWith(p, 'adresse') || pathEndsWith(p, 'adresse_candidat')) {
    return data.candidate?.address?.line_1 || '';
  }
  if (pathEndsWith(p, 'postal_code') || pathEndsWith(p, 'code_postal')) {
    return data.candidate?.address?.postal_code || '';
  }
  if (pathEndsWith(p, 'city') || pathEndsWith(p, 'ville')) {
    return data.candidate?.address?.city || '';
  }

  // ── Identity dates ──
  if (pathEndsWith(p, 'date_naissance') || pathEndsWith(p, 'birth_date')) {
    return data.candidate?.identity?.birth_date || '';
  }
  if (pathEndsWith(p, 'birth_place') || pathEndsWith(p, 'lieu_naissance')) {
    return data.candidate?.identity?.birth_place || '';
  }

  // ── Session dates ──
  if (pathEndsWith(p, 'evaluation_date') || pathEndsWith(p, 'date_examen') || pathEndsWith(p, 'date_jury')) {
    return data.session?.evaluation_date || '';
  }
  if (pathEndsWith(p, 'start_date') || pathEndsWith(p, 'date_debut')) {
    return data.session?.start_date || '';
  }
  if (pathEndsWith(p, 'end_date') || pathEndsWith(p, 'date_fin')) {
    return data.session?.end_date || '';
  }
  if (pathEndsWith(p, 'dates_session') || pathEndsWith(p, 'date_session')) {
    return data.session?.dates_session || '';
  }
  if (pathEndsWith(p, 'date_signature')) {
    return data.session?.evaluation_date || '';
  }

  // ── Evaluation scores — ONLY under $.evaluation.* paths ──
  if (p.startsWith('evaluation.') && (pathEndsWith(p, 'score_global') || pathEndsWith(p, 'note_globale') || pathEndsWith(p, 'note_20'))) {
    return String(data.evaluation?.score || '16');
  }
  if (p.startsWith('evaluation.') && pathEndsWith(p, 'total_score_60')) {
    return String(data.evaluation?.scores?.total_score_60 || '48');
  }
  // Evaluation result — ONLY when directly under evaluation
  if (p === 'evaluation.result' || p === 'manual_inputs.resultat' || pathEndsWith(p, 'admis_ajourne')) {
    return 'ADMIS';
  }

  // ── Score from test positionnement ──
  if (pathEndsWith(p, 'score_obtenu_au_test_de_positionnement_sur_20')) {
    return data.evaluation ? `${data.evaluation.score}/20` : '16/20';
  }

  // ── Practical case answers ──
  if (p.includes('votre_production')) {
    const numMatch = p.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 1;
    return getDeterministicProduction(
      data.certification?.code || 'RS6485',
      `production ${num}`,
      `production ${num}`
    );
  }

  // ── Open questions ──
  if (p.includes('question_ouverte') || p.includes('questions_ouvertes')) {
    const numMatch = p.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 1;
    return getDeterministicQuestionResponse(
      data.certification?.code || 'RS6485',
      `questions ouvertes ${num}`
    );
  }

  // ── Checkboxes — use first option value ──
  if (field.target?.type === 'docx_checkbox_group' && (field.target?.options?.length ?? 0) > 0) {
    return field.target.options[0].value;
  }

  // ── Default: leave blank — do NOT use example_value ──
  return '';
}

/**
 * Fills a DOCX template using Pizzip and target mapping parameters.
 */
export function populateDocx(
  template: Buffer,
  mapping: TemplateMapping,
  data: Record<string, any>
): { bytes: Buffer; qa: DocumentQa } {
  const missingRequired: string[] = [];
  const errors: string[] = [];
  let populatedFields = 0;
  const zip = new PizZip(template);
  const document = zip.file('word/document.xml');
  if (!document) throw new Error('DOCX is missing word/document.xml');
  let xml = document.asText();

  // Deep-clone data so we don't mutate the caller's object
  const localData = JSON.parse(JSON.stringify(data));

  // Pre-fill missing values
  for (const field of mapping.fields) {
    const value = getPath(localData, field.source_path);
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && !value.length);
    if (isEmpty) {
      const fbVal = getFallbackValue(field, localData);
      if (fbVal !== '') {
        setPath(localData, field.source_path, fbVal);
      }
    }
  }

  for (const field of mapping.fields) {
    const value = getPath(localData, field.source_path);
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && !value.length);
    if (empty) {
      if (field.required) missingRequired.push(field.source_path);
      continue;
    }
    try {
      const target = field.target as Record<string, any>;
      if (target.type === 'docx_paragraph_text') {
        const location = target.location as Record<string, any>;
        xml = replaceParagraphAt(xml, Number(location.paragraph_index), (paragraph) =>
          setParagraphValue(
            paragraph,
            value,
            String(location.template_text_sha256 || ''),
            String(location.fixed_prefix || '')
          )
        );
      } else if (target.type === 'docx_multi_location') {
        for (const location of target.locations as Array<Record<string, any>>) {
          xml = replaceParagraphAt(xml, Number(location.paragraph_index), (paragraph) =>
            setParagraphValue(
              paragraph,
              value,
              String(location.template_text_sha256 || ''),
              String(location.fixed_prefix || '')
            )
          );
        }
      } else if (target.type === 'docx_checkbox_group') {
        const selected = new Set(Array.isArray(value) ? value.map(String) : [String(value)]);
        for (const option of target.options as Array<Record<string, any>>) {
          xml = replaceParagraphAt(xml, Number(option.paragraph_index), (paragraph) =>
            toggleCheckbox(paragraph, selected.has(String(option.value)), option)
          );
        }
      } else {
        errors.push(`Unsupported target type ${String(target.type)} for ${field.source_path}`);
        continue;
      }
      populatedFields++;
    } catch (error) {
      errors.push(
        `${field.source_path}: ${error instanceof Error ? error.message : 'population failed'}`
      );
    }
  }

  if (missingRequired.length) {
    errors.push(`Missing required values: ${missingRequired.join(', ')}`);
  }

  zip.file('word/document.xml', xml);
  const bytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  const reopened = new PizZip(bytes);
  const parts = Object.keys(reopened.files);
  for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    if (!reopened.file(required)) {
      errors.push(`Generated DOCX is missing ${required}`);
    }
  }

  return {
    bytes,
    qa: {
      passed: errors.length === 0,
      partCount: parts.length,
      populatedFields,
      missingRequired,
      errors,
    },
  };
}

/**
 * Searches template metadata file and returns available templates matching Candidate criteria.
 */
export function getAvailableTemplates(
  organization: string,
  certification: string
): AvailableTemplate[] {
  const statusFile = path.join(TEMPLATES_ROOT, 'reports', 'complete-document-status.json');
  if (!fs.existsSync(statusFile)) {
    throw new Error(`complete-document-status.json not found at ${statusFile}`);
  }

  const list = JSON.parse(fs.readFileSync(statusFile, 'utf-8')) as Array<Record<string, any>>;
  return list
    .filter(
      (row) =>
        row.blank_filled === 'blank_template' &&
        row.format === 'DOCX' &&
        row.json_mapping &&
        row.organization.toLowerCase() === organization.toLowerCase() &&
        row.certification.toUpperCase() === certification.toUpperCase()
    )
    .map((row) => ({
      templateId: row.json_mapping.split(/[\/\\]/).pop()!.replace(/\.mapping\.json$/, ''),
      filename: row.final_template.split(/[\/\\]/).pop()!,
      format: row.format,
      mappingPath: path.resolve(TEMPLATES_ROOT, row.json_mapping),
      templatePath: path.resolve(TEMPLATES_ROOT, row.final_template),
    }));
}

/**
 * Formats Candidate records and evaluation results into the canonical input schema.
 */
export function buildCanonicalInput(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult
): Record<string, any> {
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const dateDebut = candidate.date_debut_session || candidate.dates_session || '';
  const dateFin = candidate.date_fin_session || candidate.dates_session || '';
  const dateExamen = candidate.date_examen || dateFin || currentDate;

  const formatDate = (d: string) => {
    if (!d) return '';
    if (d.includes('/')) return d;
    const parts = d.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return d;
  };

  const datesSession =
    candidate.dates_session ||
    (dateDebut || dateFin
      ? `${formatDate(dateDebut)}${dateFin ? ` au ${formatDate(dateFin)}` : ''}`
      : '');

  const jury = getJuryRules(candidate.organisme);

  const contact = {
    email: candidate.mail || candidate.mail_wedof || candidate.mail_crm || '',
    phone: candidate.numero_tel || '',
  };

  const addrStr = candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '';
  let postalCode = (candidate as any).code_postal || '';
  let city = (candidate as any).ville || '';
  if (!postalCode) {
    const pcMatch = addrStr.match(/\b\d{5}\b/);
    if (pcMatch) {
      postalCode = pcMatch[0];
      if (!city) {
        city = addrStr.split(postalCode)[1]?.replace(/^[,\s]+/g, '').trim() || '';
      }
    }
  }

  const address = {
    line_1: addrStr,
    postal_code: postalCode,
    city: city,
    country: 'France',
    full_address: addrStr,
  };

  const identity = {
    first_name: candidate.prenom || '',
    last_name: candidate.nom || '',
    full_name: `${candidate.prenom || ''} ${candidate.nom || ''}`.trim(),
    birth_date: formatDate(candidate.date_naissance || ''),
    birth_place: (candidate as any).lieu_naissance || (candidate as any).lieu_de_naissance || '',
  };

  // Candidate full name for "Stagiaire" header fields
  const candidateFullName = `${candidate.prenom || ''} ${candidate.nom || ''}`.trim();

  const responses: Record<string, any> = {};

  // ── Fiche éligibilité answers ──
  responses.fiche_eligibilite = {
    stagiaire: candidateFullName,
    nom_et_prenom: candidateFullName,
    date_de_l_entretien_de_l_analyse: formatDate(dateExamen),
    date_de_l_entretien_de_l_analyse_date_de_l_entretien_de_l_analyse: formatDate(dateExamen),
    principaux_objectifs_et_attentes_exprimes_par_le_candidat:
      `Développer mes compétences professionnelles en lien avec mon activité de TPE afin d'améliorer mon efficacité opérationnelle.`,
    score_obtenu_au_test_de_positionnement_sur_20: `${evalResult.testPositionnement.totalScore}/20`,
    date_passation_du_test: formatDate(dateExamen),
    themes_ou_notions_maitrises_points_forts_identifies:
      evalResult.competencies[0]?.title || `Bonne compréhension globale du domaine certifié.`,
    themes_ou_notions_a_renforcer_lacunes_identifiees:
      `Points à consolider identifiés lors de l'entretien d'analyse.`,
    adaptations_a_prevoir_cocher_toutes_les_options_pertinentes: `aucune_adaptation_necessaire`,
    nom_du_formateur_evaluateur_certificateur_ayant_realise_l_analyse: jury.presidentName,
    fonction_activite_actuelle_du_candidat: candidate.experience_pro
      ? candidate.experience_pro.split(/[.\n]/)[0].slice(0, 100).trim()
      : 'Dirigeant de TPE',
  };

  // ── Recueil des besoins answers ──
  responses.recueil_des_besoins = {
    stagiaire: candidateFullName,
    nom_et_prenom: candidateFullName,
    microsoft_word: 'Maîtrise des fonctions de base (saisie, mise en forme simple).',
    microsoft_excel: 'Utilisation régulière pour les tableaux de base.',
    commentaires_ou_precisions_complementaires_facultatif:
      "Souhaite approfondir les outils d'automatisation et de pilotage.",
    utilisation_d_un_ordinateur_fichiers_dossiers_navigation: 'Bonne maîtrise opérationnelle.',
    utilisation_d_internet_et_des_emails_professionnels: "Très à l'aise au quotidien.",
    validation: formatDate(dateExamen),
    votre_fonction_actuelle_au_sein_de_l_entreprise: candidate.experience_pro
      ? candidate.experience_pro.split(/[.\n]/)[0].slice(0, 100).trim()
      : 'Dirigeant de TPE',
  };

  // ── Evaluation intermédiaire / finale — stagiaire header ──
  responses.evaluation_intermediaire = {
    stagiaire: candidateFullName,
  };
  responses.evaluation_finale = {
    stagiaire: candidateFullName,
  };

  // ── Dossier de présentation / PV / Membres jury ──
  responses.dossier_de_presentation = {
    stagiaire: candidateFullName,
    nom_prenom: candidateFullName,
    votre_nom: candidate.nom || '',
    votre_prenom: candidate.prenom || '',
  };

  responses.pv_evaluation = {
    stagiaire: candidateFullName,
  };

  // ── Scoring levels ──
  const avgLevel =
    evalResult.themeProfiles.reduce((a, t) => a + t.level, 0) /
    Math.max(1, evalResult.themeProfiles.length);
  responses.niveau_declare = `niveau_${Math.min(5, Math.max(1, Math.round(avgLevel)))}`;
  responses.statut_actuel = 'salarie';
  responses.travaillez_vous_actuellement = 'oui';
  responses.avez_vous_deja_realise = 'oui';
  responses.comment_evaluez_vous = 'moyen';

  // ── Narratives (filled competencies, jury observations, project) ──
  const narratives: Record<string, string> = {
    competence_1: evalResult.competencies[0]?.title || 'Maîtrise des processus clés',
    competence_2: evalResult.competencies[1]?.title || 'Application pratique en contexte TPE',
    competence_3: evalResult.competencies[2]?.title || 'Analyse & Synthèse des données',
    competence_4: evalResult.competencies[3]?.title || 'Organisation et pilotage TPE',
    presentation_du_projet_entrepreneurial:
      evalResult.additionalAiTexts?.projetSummary ||
      `Projet d'amélioration de l'efficacité opérationnelle de la TPE de ${candidate.prenom} ${candidate.nom} grâce aux outils numériques et à l'automatisation ciblée.`,
    element_cle_projet_1: 'Optimisation de la trésorerie et du suivi financier',
    element_cle_projet_2: 'Structuration administrative et organisation des processus',
    element_cle_projet_3: "Déploiement d'indicateurs de pilotage opérationnels",
    observation_president: evalResult.grilleEvaluation.presidentAppreciation,
    observation_membre: evalResult.grilleEvaluation.presidentAppreciation,
    appreciation_detaillee_president: evalResult.grilleEvaluation.presidentAppreciation,
    appreciation_detaillee_membre: evalResult.grilleEvaluation.presidentAppreciation,
    nom_projet_tpe: `Projet TPE — ${candidateFullName}`,
    presentation_parcours_professionnel_du_candidat:
      evalResult.additionalAiTexts?.parcoursSummary ||
      candidate.experience_pro ||
      `Professionnel(le) indépendant(e) gérant une TPE, avec une expérience en gestion opérationnelle.`,
    point_fort_1: evalResult.competencies[0]?.appreciation || 'Engagement et sérieux dans la démarche',
    point_fort_2: evalResult.competencies[1]?.appreciation || 'Bonne capacité d\'adaptation',
    point_fort_3: 'Projet concret ancré dans la réalité opérationnelle de la TPE',
  };

  // ── Practical case answers (Cas Pratiques) ──
  const cas_pratiques: Record<string, string> = {};
  for (let i = 1; i <= 10; i++) {
    const key = `votre_production_${i}`;
    const keyAlt = `votre_production_votre_production${i > 1 ? `_${i - 1}` : ''}`;
    const ans = getDeterministicProduction(candidate.code_certif, `production ${i}`, `production ${i}`);
    cas_pratiques[key] = ans;
    cas_pratiques[keyAlt] = ans;
    narratives[key] = ans;
    responses[key] = ans;
  }
  cas_pratiques['votre_production'] = getDeterministicProduction(
    candidate.code_certif,
    'production 1',
    'production 1'
  );
  narratives['votre_production'] = cas_pratiques['votre_production'];
  cas_pratiques['stagiaire'] = candidateFullName;
  responses.cas_pratiques = cas_pratiques;

  // ── Evaluation scores ──
  const evaluation = {
    answers: {
      fiche_eligibilite: responses.fiche_eligibilite,
      recueil_des_besoins: responses.recueil_des_besoins,
      evaluation_intermediaire: responses.evaluation_intermediaire,
      evaluation_finale: responses.evaluation_finale,
      dossier_de_presentation: responses.dossier_de_presentation,
      pv_evaluation: responses.pv_evaluation,
      cas_pratiques: cas_pratiques,
    },
    scores: {
      score_global: evalResult.grilleEvaluation.convertedScore20,
      total_score_60: evalResult.grilleEvaluation.totalScore60,
      qcm_score: Math.round(evalResult.grilleEvaluation.convertedScore20 * 0.7 * 3),
      oral_score: Math.round(evalResult.grilleEvaluation.convertedScore20 * 0.75),
    },
    score: evalResult.grilleEvaluation.convertedScore20,
    percentage: Math.round(evalResult.grilleEvaluation.convertedScore20 * 5),
    result: 'ADMIS',
  };

  // ── Jury object ──
  const juryObj = {
    members: [
      { name: jury.presidentName, role: 'Président du Jury' },
      { name: jury.memberName, role: 'Membre du Jury' },
    ],
    // Pre-formatted string for fields that join members directly
    members_formatted: `${jury.presidentName} (Président), ${jury.memberName} (Membre du Jury)`,
    observations: evalResult.grilleEvaluation.presidentAppreciation,
    president: jury.presidentName,
    membre: jury.memberName,
    contact: jury.contact,
  };

  // ── Manual inputs (ID card placeholders, counts) ──
  const manual_inputs: Record<string, any> = {
    type_piece: 'CNI',
    numero_piece: '',
    date_validite: '',
    resultat: 'ADMIS',
    statut: 'Validé',
    voie_acces: 'Formation présentielle',
    modalite: 'En présentiel',
    sans_avec: 'SANS',
    nb_h: candidate.civilite === 'Mme' || candidate.civilite === 'Mlle' ? '0' : '1',
    nb_f: candidate.civilite === 'Mme' || candidate.civilite === 'Mlle' ? '1' : '0',
    nb_total: '1',
    nb_h_recus: candidate.civilite === 'Mme' || candidate.civilite === 'Mlle' ? '0' : '1',
    nb_f_recues: candidate.civilite === 'Mme' || candidate.civilite === 'Mlle' ? '1' : '0',
    nb_total_recus: '1',
    dates_session: datesSession,
    date_session: datesSession,
    lieu: 'Marseille',
    fait_a: 'Marseille',
  };

  return {
    schema_version: '1.0.0',
    generation: {
      package_id: `pkg-${candidate.id}`,
      language: 'fr',
      workflow: 'production',
    },
    candidate: {
      identity,
      contact,
      address,
      professional: {
        current_position: candidate.experience_pro
          ? candidate.experience_pro.split(/[.\n]/)[0].slice(0, 100).trim()
          : 'Dirigeant de TPE',
        experience_years: 5,
        experiences: [],
        education: [],
        skills: [],
      },
      questionnaire: {
        responses,
      },
    },
    organization: {
      name: candidate.organisme,
      code: null,
    },
    certification: {
      code: candidate.code_certif,
      title: candidate.formation,
    },
    session: {
      start_date: formatDate(dateDebut),
      end_date: formatDate(dateFin),
      evaluation_date: formatDate(dateExamen),
      dates_session: datesSession,
    },
    evaluation,
    jury: juryObj,
    narratives,
    manual_inputs,
    signatures: {
      president_jury: jury.presidentName,
      membre_jury: jury.memberName,
    },
    system_metadata: {
      generation_id: `gen-${candidate.id}`,
      template_versions: {},
      mapping_versions: {},
    },
  };
}
