import { Anthropic } from '@anthropic-ai/sdk';
import { getJuryRules } from './jury-rules';
import { getThemeConfig } from './theme-config';
import {
  CandidateEvaluationResult,
  CandidateRow,
  CompetencyScore,
  ThemeScoreProfile,
} from './types';

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
  const effectiveApiKey = userApiKey || process.env.CLAUDE_API_KEY;
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
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307',
      ];

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
            break;
          }
        } catch (e) {
          // Try next model
        }
      }
    } catch (err) {
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
