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
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
  'claude-3-7-sonnet-20250219',
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
 * Generates context-aware realistic advice/production content in French.
 * Generalizes across different certification codes (RS7200, RS6485, RS7311, RS7344) and modules.
 */
export function getDeterministicProduction(rsCode: string, label: string, heading: string): string {
  const rs = rsCode.toUpperCase();
  const text = (label + ' ' + heading).toLowerCase();
  
  // Extract specific occurrence number at the end of the text label/heading
  const numMatch = text.match(/production\s+(\d+)/) || text.match(/\b(\d+)\b/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;
  
  if (rs === 'RS7200') {
    if (num === 1) {
      return "Pour structurer la présence en ligne, il est essentiel d'analyser l'audience cible de chaque réseau. Pour Facebook et Instagram, les publications interactives sous forme de stories favorisent la visibilité locale, tandis que LinkedIn doit être réservé aux relations B2B professionnelles.";
    }
    if (num === 2) {
      return "Mise en place d'une charte graphique harmonieuse et d'un ton chaleureux et professionnel. Utilisation de la règle des 80/20 : 80% de contenus informatifs ou conseils pratiques liés aux véhicules, et seulement 20% d'offres promotionnelles pour éviter de lasser l'audience.";
    }
    if (num === 3) {
      return "Plan de création de contenu : alterner entre des photos 'avant/après' des réparations, des courtes vidéos de conseils d'entretien et des témoignages clients. Cela permettra d'augmenter le taux d'engagement de manière organique de plus de 15% en trois mois.";
    }
    if (num === 4) {
      return "Utilisation d'outils de planification comme Meta Business Suite ou Buffer pour programmer les publications un mois à l'avance. Cela permet de libérer du temps opérationnel tout en maintenant une régularité de publication (3 fois par semaine).";
    }
    if (num === 5) {
      return "Suivi mensuel des indicateurs clés (KPI) : portée des publications, taux d'engagement, et nombre de demandes de devis reçues par message privé. Ajustement de la stratégie selon les retours statistiques pour maximiser le ROI.";
    }
    if (num === 6) {
      return "Plan d'action pour le mois 4 : doubler la portée organique en ciblant des mots-clés locaux, publier 2 vidéos Reels par semaine pour capter de nouveaux prospects, et viser un objectif de 110 abonnés (+25%) et 6 demandes de devis.";
    }
    if (num === 7) {
      return "Analyse de la portée organique et payante : le ciblage local a permis d'obtenir 15 contacts qualifiés en 30 jours, confirmant l'importance d'une stratégie de contenu géo-localisée pour un commerce de proximité.";
    }
    if (num === 8) {
      return "Calendrier éditorial optimisé avec planification automatique. Les visuels créés sous Canva respectent la charte graphique définie, renforçant l'identité de marque et le taux de mémorisation des messages.";
    }
    if (num === 9) {
      return "Bilan de la campagne digitale : le format vidéo (Reels) génère 3 fois plus d'interactions que les images statiques. Recommandation d'augmenter la part de contenu vidéo dans les futures publications.";
    }
    if (num === 10) {
      return "Plan d'action correctif : ajustement des heures de publication selon les pics d'activité de l'audience constatés dans les insights Meta, et mise en place d'un budget publicitaire ciblé de 50 €/mois.";
    }
    return "Proposition de stratégie digitale complète : définir la ligne éditoriale du garage, planifier 3 posts par semaine (conseils techniques, vie de l'atelier) et utiliser Meta Business Suite pour centraliser et automatiser les publications.";
  }
  
  if (rs === 'RS6485') {
    if (num === 1) {
      return "Le montant des capitaux propres est calculé par la formule : Capitaux Propres = Actif Total - Dettes (Fournisseurs + Emprunts). Soit : 96 000 € - (11 000 € + 27 000 €) = 58 000 €. Ce résultat indique une excellente solidité financière : l'entreprise finance plus de 60% de ses actifs par ses fonds propres, ce qui garantit une forte autonomie financière vis-à-vis des tiers.";
    }
    if (num === 2) {
      return "Calculs de TVA pour février : \n1) TVA collectée (ventes) : 14 800 € * 10% = 1 480 €. \n2) TVA déductible (achats) : (2 600 € + 950 € + 310 €) * 20% = 3 860 € * 20% = 772 €. \n3) TVA à reverser à l'État : TVA Collectée - TVA Déductible = 1 480 € - 772 € = 708 €. L'entreprise devra donc déclarer et télétransmettre un montant net de 708 € de TVA pour le mois de février.";
    }
    if (num === 3) {
      return "L'achat du véhicule (amorti sur 5 ans soit 3 300 €/an) et le coût de l'alternant (8 640 €/an) augmentent les charges fixes de 11 940 €/an. Le taux de marge actuel est de 25% (43 000 € de résultat / 172 000 € de CA). Pour autofinancer cet investissement sans dégrader le résultat de l'entreprise, un chiffre d'affaires supplémentaire de 47 760 € par an est nécessaire (calcul : 11 940 € / 25% de marge).";
    }
    if (num === 4) {
      return "Le résultat net mensuel s'élève à : 16 400 € (CA) - (6 100 € + 4 300 € + 3 800 €) = 2 200 €. La marge brute est de 6 000 € (CA - Fournitures - Main d'œuvre), soit un taux de marge brute de 36.58%. On constate un écart défavorable de -2 600 € sur le CA (-13.7% par rapport à l'objectif). Bien que le résultat reste positif, il convient de surveiller la baisse du chiffre d'affaires et d'agir commercialement.";
    }
    if (num === 5) {
      return "EI : Avantages (gestion très simple, coût de création nul), Inconvénient (responsabilité juridique illimitée sur le patrimoine personnel). SARL : Avantages (partage des risques à plusieurs associés, crédibilité bancaire), Inconvénient (formalités de gestion plus lourdes). SASU : Avantages (protection du patrimoine personnel, président assimilé-salarié), Inconvénient (charges sociales de 78% sur salaire brut). Choix recommandé : la SASU pour la protection du patrimoine.";
    }
    if (num === 6) {
      return "Pour régulariser la facture impayée de 1 980 € TTC : 1) Enregistrer immédiatement la facture d'achat dans le journal des achats (débit 607 pour le HT, débit 44566 pour la TVA, crédit 401 pour le TTC). 2) Effectuer le rapprochement avec le fournisseur. 3) Procéder au paiement par virement et enregistrer le flux bancaire.";
    }
    if (num === 7) {
      return "Solde banque initial (19 500 €) + Encaissements (2 800 € + 5 200 €) - Charges fixes (3 900 €) = 23 600 € au 31 juillet. La fermeture de 2 semaines en juillet est donc tout à fait réalisable financièrement, car la trésorerie reste largement positive avec une marge de sécurité confortable.";
    }
    if (num === 8) {
      return "Taux de marge nette = (31 000 / 182 000) * 100 = 17.03%. ROE = (31 000 / 54 000) * 100 = 57.4%. BFR = (Stocks 3 900 + Créances 15 200) - Dettes 5 400 = 13 700 €. L'entreprise présente une excellente rentabilité financière (ROE élevé) et une gestion saine du besoin en fonds de roulement.";
    }
    if (num === 9) {
      return "En EI : Cotisations = 49 000 * 45% = 22 050 €. En SASU : Charges sociales sur salaire = 22 000 * 78% = 17 160 € ; flat tax sur dividendes = 18 000 * 30% = 5 400 € ; total SASU = 22 560 €. La différence financière est minime (510 €), mais la SASU offre une responsabilité limitée et une meilleure protection sociale.";
    }
    if (num === 10) {
      return "La comparaison montre que la SASU est préférable à l'EI pour ce niveau d'activité, car elle permet de sécuriser le patrimoine personnel du dirigeant tout en offrant la flexibilité nécessaire pour les futures embauches ou l'intégration d'associés.";
    }
    return "L'évaluation montre une compréhension rigoureuse des équilibres financiers de la TPE. Les propositions d'optimisation de trésorerie et le plan d'action commercial sont réalistes et adaptés à la structure étudiée.";
  }
  
  if (rs === 'RS7311') {
    if (num === 1) {
      return "Mise en place d'une politique interne interdisant la saisie de données clients identifiables ou confidentielles dans les outils de GenAI. Sensibilisation des équipes à l'utilisation des versions professionnelles avec protection des données.";
    }
    if (num === 2) {
      return "Application du framework de prompting structuré : définition du rôle (expert marketing), du contexte de la TPE, de la tâche précise (rédaction de newsletter) et du format attendu (HTML court). Itérations successives pour affiner le ton.";
    }
    if (num === 3) {
      return "Utilisation d'assistants IA pour nettoyer une base de données de ventes et identifier les segments de clientèle les plus rentables. Visualisation sous forme de graphiques de corrélation pour guider la stratégie commerciale.";
    }
    if (num === 4) {
      return "Création d'un workflow Make reliant le formulaire de contact du site web à un LLM pour qualifier la demande, puis transfert automatique de l'alerte sur Slack avec une suggestion de réponse personnalisée.";
    }
    if (num === 5) {
      return "Définition d'une charte d'éthique et d'usage de l'IA au sein de l'entreprise, encadrant les domaines autorisés (aide à la rédaction, brainstorming) et ceux nécessitant une validation humaine systématique.";
    }
    if (num === 6) {
      return "Audit de sécurité des outils d'IA : validation des licences d'utilisation, paramétrage de la non-conservation des données de prompt pour l'entraînement, et mise en conformité avec la réglementation européenne AI Act.";
    }
    if (num === 7) {
      return "Création d'une bibliothèque de prompts partagée pour l'équipe commerciale, standardisant les demandes de préparation de rendez-vous client et de rédaction de propositions commerciales de premier niveau.";
    }
    if (num === 8) {
      return "Intégration de l'IA pour l'analyse de fichiers de reporting financier complexes, permettant d'extraire rapidement les écarts budgétaires et de rédiger une synthèse des points de vigilance.";
    }
    if (num === 9) {
      return "Déploiement d'un agent conversationnel de niveau 1 sur le site internet pour répondre aux questions fréquentes des clients et planifier des rendez-vous automatiquement dans l'agenda des commerciaux.";
    }
    if (num === 10) {
      return "Plan d'accompagnement au changement pour l'adoption des outils IA : sessions de partage d'expérience bimensuelles et identification de 'champions IA' internes pour guider leurs collègues.";
    }
    return "Déploiement opérationnel des outils d'IA générative au sein de la TPE en conformité avec le RGPD. Les prompts et automatisations testés permettent un gain de productivité estimé à 20% sur les tâches administratives.";
  }
  
  if (rs === 'RS7344') {
    if (num === 1) {
      return "Cartographie détaillée du processus de traitement des commandes : identification d'un goulot d'étranglement de 48h lors de la validation manuelle des paiements. Proposition d'automatisation via passerelle de paiement sécurisée.";
    }
    if (num === 2) {
      return "Plan de conduite du changement : sessions de formation hebdomadaires de 30 minutes pour rassurer l'équipe, et désignation d'un référent interne pour centraliser les questions sur les nouveaux outils d'IA.";
    }
    if (num === 3) {
      return "Rédaction des spécifications fonctionnelles pour le projet d'automatisation : définition du périmètre, des flux d'intégration de données (CRM vers outil d'envoi), et des critères de validation de la solution.";
    }
    if (num === 4) {
      return "Scénarios de test de recette : validation de la synchronisation des données, vérification de l'absence de doublons, et test de montée en charge avec simulation de 100 envois simultanés.";
    }
    if (num === 5) {
      return "Calcul du ROI prévisionnel du projet de digitalisation : estimation d'un gain de temps de 12h/semaine pour l'équipe administrative et un amortissement des coûts d'intégration sur 6 mois.";
    }
    if (num === 6) {
      return "Analyse des risques du projet de migration cloud : identification des points de vulnérabilité de transfert de données et définition de mesures barrières (chiffrement de bout en bout, sauvegardes quotidiennes).";
    }
    if (num === 7) {
      return "Élaboration d'une charte de gouvernance des données opérationnelles, définissant les rôles d'accès et les responsabilités de mise à jour des informations clients dans le nouvel outil.";
    }
    if (num === 8) {
      return "Mise en place d'indicateurs de performance clés (KPI) pour le suivi opérationnel après déploiement, mesurant le taux d'adoption par les utilisateurs et le temps moyen de traitement des tâches.";
    }
    if (num === 9) {
      return "Plan d'animation de la communauté interne pour pérenniser l'usage des nouveaux outils : ateliers de partage de bonnes pratiques et création d'une foire aux questions dynamique.";
    }
    if (num === 10) {
      return "Revue finale post-déploiement : confrontation des résultats obtenus aux objectifs initiaux, et rédaction des recommandations d'optimisation pour la phase de maintenance active.";
    }
    return "Plan de transformation digitale complet pour la TPE. Les propositions d'automatisation des tâches et d'accompagnement au changement sont structurées et adaptées aux ressources de l'entreprise.";
  }

  // General fallback text
  return "Analyse approfondie de la situation : définition des objectifs stratégiques, identification des canaux prioritaires et mise en place d'un plan d'action structuré avec des livrables opérationnels mesurables.";
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
  const localOcc = new Map<string, number>();

  for (const slot of structure.fieldSlots) {
    const l = slot.label.toLowerCase();
    const count = (localOcc.get(l) || 0) + 1;
    localOcc.set(l, count);

    // Create unique occurrence-suffixed label for repeated text fields
    const uniqueLabel = `${slot.label} ${count}`;

    if ((l.includes('nom') && l.includes('prénom')) || l.includes('nom et pr') || l.includes('candidat') || l.includes('stagiaire'))
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
    else if (l.includes('questions ouvertes') || l.includes('partie 2') || l.includes('question ouverte'))
      fields[slot.id] = getDeterministicQuestionResponse(candidate.code_certif, uniqueLabel);
    else if (l.includes('production') || l.includes('réponse') || l.includes('conseil') || l.includes('travail') || l.includes('avis'))
      fields[slot.id] = getDeterministicProduction(candidate.code_certif, uniqueLabel, uniqueLabel);
    else if (l.includes('naissance'))
      fields[slot.id] = formatDate(candidate.date_naissance || '');
    else if (l.includes("date de l'entretien") || l.includes("date de l'analyse") || l.includes("date examen") || l.includes("date d'examen") || l.includes("date du jury"))
      fields[slot.id] = formatDate(candidate.date_examen || candidate.date_fin_session || '');
    else if (l.includes("date début") || l.includes("début session") || l.includes("période"))
      fields[slot.id] = formatDate(candidate.date_debut_session || candidate.dates_session || '');
    else if (l.includes("date fin") || l.includes("fin session"))
      fields[slot.id] = formatDate(candidate.date_fin_session || candidate.dates_session || '');
    else if (l.includes('date'))
      fields[slot.id] = formatDate(candidate.date_examen || candidate.date_fin_session || '');
  }

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return dateStr;
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

/**
 * Generates context-aware realistic responses for intermediate evaluation open questions in French.
 */
export function getDeterministicQuestionResponse(rsCode: string, label: string): string {
  const rs = rsCode.toUpperCase();
  const text = label.toLowerCase();
  
  // Extract specific occurrence number at the end of the text label/heading
  const numMatch = text.match(/questions ouvertes\s+(\d+)/) || text.match(/\b(\d+)\b/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;
  
  if (rs === 'RS7200') {
    if (num === 1) {
      return "Pour un artisan indépendant, les réseaux sociaux permettent de développer sa visibilité locale, de valoriser son savoir-faire par des photos de ses chantiers ou créations, et de créer une relation de proximité et de confiance avec ses clients actuels et prospects.";
    }
    if (num === 2) {
      return "Facebook cible une audience plus large et plus mûre (35 ans et plus), idéale pour les partages d'articles et la visibilité locale. Instagram est axé sur le visuel (Reels, Stories) et convient mieux pour valoriser les réalisations et cibler une audience plus jeune.";
    }
    if (num === 3) {
      return "Il est recommandé de publier 3 fois par semaine de façon régulière. La régularité signale la pertinence de la page aux algorithmes des plateformes, sans saturer le fil d'actualité des abonnés pour maintenir leur intérêt.";
    }
    if (num === 4) {
      return "La charte graphique garantit l'harmonie visuelle et la reconnaissance immédiate de l'entreprise. Elle se compose d'un logo lisible, d'une palette de 3 couleurs clés maximum et de polices de caractères cohérentes.";
    }
    if (num === 5) {
      return "Canva permet de concevoir rapidement des visuels de qualité professionnelle sans compétences en design, grâce à ses nombreux modèles pré-formatés, ses banques d'images et ses fonctionnalités intuitives.";
    }
    if (num === 6) {
      return "Pour réussir une photo de chantier au smartphone : nettoyer la lentille, soigner l'éclairage en privilégiant la lumière naturelle, et utiliser la règle des tiers pour structurer et équilibrer la prise de vue.";
    }
    if (num === 7) {
      return "Meta Business Suite permet de programmer à l'avance les publications sur Facebook et Instagram, de centraliser la messagerie et les commentaires des deux plateformes, et d'analyser les indicateurs de performance depuis un seul tableau de bord.";
    }
    if (num === 8) {
      return "Le batching de contenu consiste à regrouper la création de plusieurs publications sur une seule session de travail. Cela permet de rester concentré, de gagner en productivité et d'assurer une meilleure cohérence éditoriale.";
    }
    if (num === 9) {
      return "Les indicateurs clés de performance (KPI) prioritaires sont la portée (nombre de personnes uniques atteintes), le taux d'engagement (likes, partages, commentaires) et le nombre de conversions directes (demandes de devis).";
    }
    if (num === 10) {
      return "L'analyse régulière des insights permet d'identifier les formats de publication qui performent le mieux afin d'ajuster le calendrier éditorial pour maximiser la visibilité et le retour sur investissement.";
    }
    return "Réponse argumentée montrant une compréhension des mécanismes d'animation et de promotion sur les réseaux sociaux pour une petite structure.";
  }

  if (rs === 'RS6485') {
    if (num === 1) {
      return "Le bilan comptable présente le patrimoine de l'entreprise à une date donnée (actif et passif), tandis que le compte de résultat retrace l'activité de l'exercice (produits et charges) pour dégager le bénéfice ou la perte.";
    }
    if (num === 2) {
      return "Un tableau de trésorerie prévisionnel permet d'anticiper les décalages de cash, de s'assurer de la solvabilité de l'entreprise à court terme et d'alerter le dirigeant sur d'éventuels besoins de financement.";
    }
    // Add additional question responses if document has more open questions
    if (num === 3) {
      return "Le fonds de roulement net global (FRNG) représente l'excédent des capitaux stables sur les emplois durables, garantissant que les investissements à long terme sont financés par des ressources stables.";
    }
    if (num === 4) {
      return "Pour analyser la rentabilité d'un investissement, le dirigeant calcule le délai de récupération du capital investi (payback) et la valeur actuelle nette (VAN) des flux de trésorerie futurs générés.";
    }
    return "Analyse financière rigoureuse montrant la maîtrise des principaux indicateurs de gestion comptable et d'équilibre financier de la TPE.";
  }
  
  if (rs === 'RS7311') {
    if (num === 1) {
      return "La mise en conformité RGPD lors de l'usage des IA génératives impose de ne jamais soumettre de données personnelles, de secrets industriels ou d'informations confidentielles dans les prompts des outils en accès public.";
    }
    if (num === 2) {
      return "Un bon prompt structuré doit définir le rôle (qui parle), le contexte (pourquoi on le fait), la tâche précise (l'instruction claire) et les contraintes (le format, le ton, la longueur de la réponse attendue).";
    }
    return "Application pratique des concepts d'IA générative et de prompt engineering en conformité avec la réglementation sur les données.";
  }
  
  if (rs === 'RS7344') {
    if (num === 1) {
      return "La cartographie des processus permet d'avoir une vue d'ensemble des flux opérationnels, d'identifier les tâches redondantes ou à faible valeur ajoutée, et de repérer les opportunités d'optimisation par l'automatisation.";
    }
    if (num === 2) {
      return "Pour réussir la conduite du changement lors de l'intégration de l'IA : impliquer les collaborateurs dès le départ, proposer des formations pratiques progressives, et définir une charte d'utilisation claire.";
    }
    return "Proposition d'optimisation de processus et d'intégration de l'IA dans l'organisation de la TPE pour améliorer la performance.";
  }

  return "Réponse rédigée démontrant l'assimilation des compétences clés de la certification et leur application concrète en contexte professionnel.";
}
