import { Anthropic } from '@anthropic-ai/sdk';
import { getJuryRules } from './jury-rules';
import { getThemeConfig } from './theme-config';
import {
  CandidateEvaluationResult,
  CandidateRow,
  CompetencyScore,
  ThemeScoreProfile,
} from './types';

export function isAnthropicQuotaOrAuthError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 401 || status === 403 || status === 429) return true;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('credit') ||
    msg.includes('balance') ||
    msg.includes('quota') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('over_quota') ||
    msg.includes('insufficient_quota') ||
    msg.includes('invalid_api_key') ||
    msg.includes('authentication_error') ||
    msg.includes('invalid api key')
  );
}

// Deterministic seed PRNG for variance consistency
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = Math.imul(1597334677, h ^ (h >>> 16));
    h = Math.imul(3812015801, h ^ (h >>> 13));
    return ((h >>> 0) % 1000000) / 1000000;
  };
}

export async function generateCandidateEvaluation(
  candidate: CandidateRow,
  userApiKey?: string
): Promise<CandidateEvaluationResult> {
  const effectiveApiKey = userApiKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  const juryRules = getJuryRules(candidate.organisme);
  const themeConfig = getThemeConfig(candidate.code_certif);

  const seed = `${candidate.id}-${candidate.nom}-${candidate.code_certif}`;
  const rng = seededRandom(seed);

  let baselineLevel = 3;
  const expUpper = (candidate.experience_pro || '').toUpperCase();
  if (expUpper.includes('SENIOR') || expUpper.includes('CHEF') || expUpper.includes('10 ANS') || expUpper.includes('EXPERT')) {
    baselineLevel = 4;
  } else if (expUpper.includes('DEBUTANT') || expUpper.includes('NOTION') || expUpper.includes('STAGIAIRE')) {
    baselineLevel = 2;
  }

  // Generate score levels 1..5 for each theme
  const themeProfiles: ThemeScoreProfile[] = themeConfig.themes.map((t) => {
    const delta = Math.floor(rng() * 3) - 1; // -1, 0, or +1
    const level = Math.min(5, Math.max(2, baselineLevel + delta));
    return {
      themeId: t.id,
      themeTitle: t.title,
      level,
    };
  });

  const avgLevel = themeProfiles.reduce((acc, t) => acc + t.level, 0) / themeProfiles.length;

  // Convert 1..5 scale to 20 point scale (Enforcing Section 8.5: Always >= 10/20)
  const convertedScore20 = Math.min(20, Math.max(12, Math.round((avgLevel / 5) * 16 + (rng() * 3))));
  const totalScore60 = convertedScore20 * 3;

  const testPosTotal = Math.min(20, Math.max(11, Math.round(convertedScore20 + (rng() * 2 - 1))));
  const testPosPercentage = Math.round((testPosTotal / 20) * 100);

  const competencies: CompetencyScore[] = themeConfig.competencies.map((c, i) => {
    const rawNote = Math.min(15, Math.max(9, Math.round(totalScore60 / 4 + (rng() * 2 - 1))));
    return {
      id: c.id,
      title: c.title,
      score: rawNote,
      maxScore: 15,
      appreciation: `Très bon niveau de maîtrise pour la compétence ${i + 1}.`,
    };
  });

  let claudeAppreciation = '';
  let candidateBackgroundSummary = '';
  let entrepreneurialProjectSummary = '';

  if (effectiveApiKey) {
    try {
      const anthropic = new Anthropic({ apiKey: effectiveApiKey });
      const prompt = `Vous êtes le Président du Jury d'Évaluation Certifiante (${juryRules.presidentName}) pour l'organisme ${candidate.organisme}.
Le candidat est ${candidate.civilite} ${candidate.prenom} ${candidate.nom}, inscrit à la certification ${candidate.code_certif} (${candidate.formation}).

Son expérience professionnelle est : "${candidate.experience_pro || 'Expérience pratique en TPE'}".
Sa note globale d'évaluation est de ${convertedScore20}/20 (Mention ADMIS).

Consignes :
1. Rédigez l'appréciation détaillée synthétique du Président du Jury (environ 4 à 6 phrases professionnelles, bienveillantes et précises en français Qualiopi).
2. Résumez la présentation du parcours professionnel du candidat en 2 phrases claires.
3. Résumez le projet entrepreneurial de sa TPE en 2 phrases concrètes.

Format de réponse STRICT JSON :
{
  "appreciationPresident": "...",
  "parcoursSummary": "...",
  "projetSummary": "..."
}`;

      const candidateModels = [
        'claude-sonnet-4-5-20250929',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307',
      ];

      let quotaError: string | null = null;

      for (const modelName of candidateModels) {
        try {
          const response = await anthropic.messages.create({
            model: modelName,
            max_tokens: 600,
            messages: [{ role: 'user', content: prompt }],
          });

          const resContent = response.content[0];
          if (resContent && resContent.type === 'text') {
            const parsed = JSON.parse(resContent.text);
            claudeAppreciation = parsed.appreciationPresident;
            candidateBackgroundSummary = parsed.parcoursSummary;
            entrepreneurialProjectSummary = parsed.projetSummary;
            quotaError = null;
            break;
          }
        } catch (e: any) {
          if (isAnthropicQuotaOrAuthError(e)) {
            quotaError = `Erreur API Anthropic: Crédits/Tokens épuisés ou clé API invalide (${e.message || 'Quota dépassé'}). Veuillez recharger vos crédits Claude.`;
            break;
          }
        }
      }

      if (quotaError) {
        throw new Error(quotaError);
      }
    } catch (err: any) {
      if (isAnthropicQuotaOrAuthError(err) || err.message?.includes('Crédits/Tokens épuisés')) {
        throw err;
      }
      console.warn('Claude API call failed, using deterministic fallbacks:', err);
    }
  }

  // Fallback text if Claude API call failed or key not supplied
  if (!claudeAppreciation) {
    claudeAppreciation = `Le candidat ${candidate.prenom} ${candidate.nom} a fait preuve d'une excellente maîtrise des compétences requises pour la certification ${candidate.code_certif}. Les mises en situation pratiques témoignent d'une parfaite compréhension des enjeux administratifs et opérationnels pour la TPE. Le jury valide la certification à l'unanimité.`;
  }
  if (!candidateBackgroundSummary) {
    candidateBackgroundSummary = `${candidate.prenom} ${candidate.nom} possède une solide expérience pratique adaptée aux besoins opérationnels des TPE/PME.`;
  }
  if (!entrepreneurialProjectSummary) {
    entrepreneurialProjectSummary = `Projet d'optimisation et de structuration administrative pour le développement de l'activité TPE.`;
  }

  return {
    testPositionnement: {
      totalScore: testPosTotal,
      maxScore: 20,
      scorePercentage: testPosPercentage,
    },
    grilleEvaluation: {
      totalScore60,
      convertedScore20,
      juryMention: 'ADMIS',
      presidentAppreciation: claudeAppreciation,
    },
    competencies,
    themeProfiles,
    additionalAiTexts: {
      parcoursSummary: candidateBackgroundSummary,
      projetSummary: entrepreneurialProjectSummary,
    },
  };
}

export interface SheetAiAnalysisResult {
  executiveSummary: string;
  qualityScore: number;
  classiqueReadinessSummary: string;
  wedofReadinessSummary: string;
  documentAudit: {
    missingCinCount: number;
    missingCvCount: number;
    missingDatesCount: number;
    notes: string;
  };
  recommendations: string[];
  certificationsBreakdown: Array<{ code: string; total: number; ready: number }>;
}

export async function analyzeExcelSheetData(
  candidates: CandidateRow[],
  userApiKey?: string
): Promise<SheetAiAnalysisResult> {
  const effectiveApiKey = userApiKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

  const total = candidates.length;
  const proformaCount = candidates.filter((c) => c.organisme === 'Proforma Institut').length;
  const proskillsCount = candidates.filter((c) => c.organisme === 'Proskills Institut').length;

  const readyClassique = candidates.filter((c) => c.pret_generation_classique).length;
  const readyWedof = candidates.filter((c) => c.pret_generation_wedof).length;
  const readyAny = candidates.filter((c) => c.pret_pour_generation).length;

  const missingCinCount = candidates.filter(
    (c) => !c.cin_ok && (!c.cin_ok_str || c.cin_ok_str.toLowerCase() !== 'fait')
  ).length;
  const missingCvCount = candidates.filter(
    (c) => !c.cv_recu && (!c.cv_recu_str || c.cv_recu_str.toLowerCase() !== 'fait')
  ).length;
  const missingDatesCount = candidates.filter(
    (c) => !c.date_debut_session || !c.date_fin_session
  ).length;

  // Certifications breakdown
  const certMap: Record<string, { total: number; ready: number }> = {};
  candidates.forEach((c) => {
    const code = c.code_certif || 'AUTRE';
    if (!certMap[code]) certMap[code] = { total: 0, ready: 0 };
    certMap[code].total += 1;
    if (c.pret_pour_generation) certMap[code].ready += 1;
  });

  const certificationsBreakdown = Object.entries(certMap).map(([code, stat]) => ({
    code,
    total: stat.total,
    ready: stat.ready,
  }));

  const calculatedQualityScore = total > 0 ? Math.round((readyAny / total) * 100) : 0;

  let executiveSummary = '';
  let classiqueReadinessSummary = '';
  let wedofReadinessSummary = '';
  let auditNotes = '';
  let recommendations: string[] = [];

  if (effectiveApiKey) {
    try {
      const anthropic = new Anthropic({ apiKey: effectiveApiKey });
      const prompt = `Vous êtes un Expert en Audit de Données EDOF et Conformation Qualiopi pour Proforma et Proskills Institut.
Vous devez analyser les données extraites de l'onglet AUTOMATISATION d'un fichier EDOF.xlsx.

Statistiques globales :
- Total candidats inscrits : ${total}
- Organismes : Proforma Institut (${proformaCount}), Proskills Institut (${proskillsCount})
- Éligibles Génération Classique (PRET_GENERATION_CLASSIQUE) : ${readyClassique} / ${total} (${Math.round((readyClassique/total)*100)}%)
- Éligibles Génération WeDOF (PRET_GENERATION_WEDOF) : ${readyWedof} / ${total} (${Math.round((readyWedof/total)*100)}%)
- Total éligibles au moins un mode : ${readyAny} / ${total}
- Candidats sans CIN valide : ${missingCinCount}
- Candidats sans CV fourni : ${missingCvCount}
- Candidats sans dates de session : ${missingDatesCount}
- Distribution des certifs : ${JSON.stringify(certificationsBreakdown)}

Consignes :
Fournissez une analyse d'expert au format STRICT JSON :
{
  "executiveSummary": "...",
  "classiqueReadinessSummary": "...",
  "wedofReadinessSummary": "...",
  "auditNotes": "...",
  "recommendations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"]
}`;

      const candidateModels = [
        'claude-sonnet-4-5-20250929',
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307',
      ];

      let quotaError: string | null = null;

      for (const modelName of candidateModels) {
        try {
          const response = await anthropic.messages.create({
            model: modelName,
            max_tokens: 700,
            messages: [{ role: 'user', content: prompt }],
          });

          const resContent = response.content[0];
          if (resContent && resContent.type === 'text') {
            const parsed = JSON.parse(resContent.text);
            executiveSummary = parsed.executiveSummary;
            classiqueReadinessSummary = parsed.classiqueReadinessSummary;
            wedofReadinessSummary = parsed.wedofReadinessSummary;
            auditNotes = parsed.auditNotes;
            recommendations = parsed.recommendations;
            quotaError = null;
            break;
          }
        } catch (e: any) {
          if (isAnthropicQuotaOrAuthError(e)) {
            quotaError = `Erreur API Anthropic: Crédits/Tokens épuisés ou clé API invalide (${e.message || 'Quota dépassé'}). Veuillez recharger vos crédits Claude.`;
            break;
          }
        }
      }

      if (quotaError) {
        throw new Error(quotaError);
      }
    } catch (err: any) {
      if (isAnthropicQuotaOrAuthError(err) || err.message?.includes('Crédits/Tokens épuisés')) {
        throw err;
      }
      console.warn('Claude AI Sheet Analysis failed:', err);
    }
  }

  // Fallbacks if AI API call is absent or fails
  if (!executiveSummary) {
    executiveSummary = `Le fichier contient ${total} apprenants. ${readyAny} candidats (${calculatedQualityScore}%) sont éligibles à la génération immédiate de leurs documents de certification.`;
  }
  if (!classiqueReadinessSummary) {
    classiqueReadinessSummary = `${readyClassique} apprenants (${Math.round((readyClassique / Math.max(1, total)) * 100)}%) disposent d'une formation et de dates de session complètes pour la génération Classique.`;
  }
  if (!wedofReadinessSummary) {
    wedofReadinessSummary = `${readyWedof} apprenants (${Math.round((readyWedof / Math.max(1, total)) * 100)}%) répondent aux critères d'examen WeDOF (CIN validée et CV ou Expérience renseignée).`;
  }
  if (!auditNotes) {
    auditNotes = `${missingCinCount} candidats nécessitent une validation CIN, ${missingCvCount} n'ont pas encore déposé de CV.`;
  }
  if (recommendations.length === 0) {
    recommendations = [
      `Prioriser le remplissage des CIN pour les ${missingCinCount} candidats éligibles à l'examen WeDOF.`,
      `Vérifier les dates de session pour les ${missingDatesCount} dossiers incomplets en génération Classique.`,
      `Lancer la génération groupée ZIP pour les ${readyAny} dossiers certifiants validés.`,
    ];
  }

  return {
    executiveSummary,
    qualityScore: calculatedQualityScore,
    classiqueReadinessSummary,
    wedofReadinessSummary,
    documentAudit: {
      missingCinCount,
      missingCvCount,
      missingDatesCount,
      notes: auditNotes,
    },
    recommendations,
    certificationsBreakdown,
  };
}

