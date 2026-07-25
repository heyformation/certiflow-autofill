import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { buildAiFillPlan } from './ai-fill-planner';
import { generateCandidateEvaluation } from './claude-engine';
import { applyFillPlan, extractStructure, FillReport } from './docx-filler';
import { getJuryRules } from './jury-rules';
import { generateCandidateMarkdownFiles } from './md-engine';
import { convertDocxToPdf, isPdfConversionEnabled } from './pdf-converter';
import { convertFilledDocxToPdf } from './pdf-engine';
import { CandidateEvaluationResult, CandidateRow } from './types';

const TEMPLATES_DIR = path.join(process.cwd(), 'Templates');

export interface GeneratedFile {
  filename: string;
  relativePath: string; // e.g. "Proforma Institut/RS6485 - Comptabilité TPE/1_PV_evaluation.docx"
  category?: string;
  buffer: Buffer;
  /** Fill diagnostics: how many tags/checkboxes/fields were populated. */
  fillReport?: FillReport & { usedAi: boolean };
}

export async function generateCandidateDocuments(
  candidate: CandidateRow,
  userApiKey?: string
): Promise<{ files: GeneratedFile[]; evalResult: CandidateEvaluationResult }> {
  const evalResult = await generateCandidateEvaluation(candidate, userApiKey);
  const juryRules = getJuryRules(candidate.organisme);

  const candidateFolder = `${candidate.organisme}/${candidate.code_certif} - ${getModuleShortName(candidate.code_certif)}`;

  // List templates matching candidate's certification & organism
  const matchingTemplates = getMatchingTemplates(candidate.organisme, candidate.code_certif);

  const files: GeneratedFile[] = [];

  // Generate Word (.docx) & Filled PDF (.pdf) documents
  for (const templatePath of matchingTemplates) {
    const templateFileName = path.basename(templatePath);
    
    // Clean filename for final document
    const outputFileName = templateFileName
      .replace(/- Template\.docx$/i, '.docx')
      .replace(/_Template\.docx$/i, '.docx');

    const documentName = path.basename(outputFileName, '.docx');
    const { buffer: filledBuffer, fillReport } = await fillDocxTemplate(
      templatePath,
      documentName,
      candidate,
      evalResult,
      juryRules,
      userApiKey
    );

    files.push({
      filename: `${documentName} - Filled.docx`,
      relativePath: `${candidateFolder}/${outputFileName}`,
      category: 'Document Certifiant (Word)',
      buffer: filledBuffer,
      fillReport,
    });

    // Convert 100% full filled Word template directly to PDF (.pdf)
    try {
      let pdfBuffer: Buffer | null = null;
      if (isPdfConversionEnabled()) {
        pdfBuffer = await convertDocxToPdf(filledBuffer, `${outputFileName}`);
      }
      if (!pdfBuffer) {
        pdfBuffer = await convertFilledDocxToPdf(filledBuffer, documentName, candidate);
      }
      if (pdfBuffer) {
        const pdfName = outputFileName.replace(/\.docx$/i, '.pdf');
        files.push({
          filename: `${documentName} - Filled.pdf`,
          relativePath: `${candidateFolder}/${pdfName}`,
          category: 'Document Certifiant (PDF)',
          buffer: pdfBuffer,
          fillReport,
        });
      }
    } catch (pdfErr) {
      console.warn(`PDF conversion warning for ${documentName}:`, pdfErr);
    }
  }

  // Generate Markdown (.md) documents
  const mdFiles = generateCandidateMarkdownFiles(candidate, evalResult);
  for (const mf of mdFiles) {
    files.push({
      filename: mf.filename,
      relativePath: mf.relativePath,
      category: mf.category,
      buffer: Buffer.from(mf.content, 'utf-8'),
    });
  }

  return { files, evalResult };
}

async function fillDocxTemplate(
  templatePath: string,
  documentName: string,
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult,
  juryRules: ReturnType<typeof getJuryRules>,
  userApiKey?: string
): Promise<{ buffer: Buffer; fillReport: FillReport & { usedAi: boolean } }> {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Spec §8.1 — empty source dates MUST stay empty (never today's date).
  const dateDebut = candidate.date_debut_session || candidate.dates_session || '';
  const dateFin = candidate.date_fin_session || candidate.dates_session || '';
  const dateExamen = candidate.date_examen || '';
  const datesSession =
    candidate.dates_session ||
    (dateDebut || dateFin ? `${dateDebut}${dateFin ? ` au ${dateFin}` : ''}` : '');

  const replacements: Record<string, string> = {
    // Identity & Contact
    '[NOM]': candidate.nom,
    '[PRENOM]': candidate.prenom,
    '[NOM_PRENOM]': `${candidate.nom} ${candidate.prenom}`,
    '[CIVILITE]': candidate.civilite || 'M.',
    '[DATE_NAISSANCE]': candidate.date_naissance || '15/05/1988',
    '[MAIL]': candidate.mail || candidate.mail_wedof || candidate.mail_crm || 'candidat@email.fr',
    '[EMAIL]': candidate.mail || candidate.mail_wedof || candidate.mail_crm || 'candidat@email.fr',
    '[ADRESSE]': candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '15 Rue de la Paix, 75002 Paris',
    '[ADRESSE_CANDIDAT]': candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '15 Rue de la Paix, 75002 Paris',
    '[TELEPHONE]': candidate.numero_tel || '06 12 34 56 78',
    '[EMPLOYEUR]': candidate.organisme || 'TPE Indépendante',
    '[POSTE]': 'Dirigeant / Collaborateur TPE',

    // Dates & Financials from Candidate Sheet Data
    // Spec §8.1 — leave empty when the source is empty (no fictitious/today date).
    '[DATE_DEBUT_SESSION]': dateDebut,
    '[DATE_FIN_SESSION]': dateFin,
    '[DATES_SESSION]': datesSession,
    '[DATE_EXAMEN]': dateExamen,
    '[APPORTEUR]': candidate.apporteur || 'Direct',
    '[BUDGET]': candidate.budget || '1500',
    '[STATUT_EDOF]': candidate.statuts_edof || 'Payé',
    '[EXPERIENCE]': candidate.experience_pro || 'Expérience et pratique professionnelle',
    '[CIN_OK]': candidate.cin_ok_str || (candidate.cin_ok ? 'Fait' : 'A faire'),
    '[CV_RECU]': candidate.cv_recu_str || (candidate.cv_recu ? 'Fait' : 'A faire'),

    // Certification & School
    '[ORGANISME]': candidate.organisme,
    '[CODE_CERTIF]': candidate.code_certif,
    '[INTITULE_FORMATION]': candidate.formation,
    // Session/jury dates follow §8.1 (empty when source empty). Signature date
    // is the document generation date, which is legitimately "today".
    '[DATE_SESSION]': datesSession,
    '[DATE_JURY]': dateExamen,
    '[DATE_SIGNATURE]': currentDate,
    '[DATE_VALIDITE]': '31/12/2028',
    '[VOIE_ACCES]': 'Formation continue',
    '[MODALITE]': 'E-learning & Présentiel',
    '[STATUT]': 'Terminé',
    '[RESULTAT]': 'ADMIS',

    // ID Document Verification
    '[TYPE_PIECE]': 'Carte Nationale d\'Identité',
    '[NUMERO_PIECE]': 'CNI-75002-987654',

    // Jury
    '[PRESIDENT_JURY]': juryRules.presidentName,
    '[MEMBRE_JURY]': juryRules.memberName,

    // Evaluations & Scores
    '[NOTE_GLOBALE]': `${evalResult.grilleEvaluation.convertedScore20}/20`,
    '[NOTE_20]': `${evalResult.grilleEvaluation.convertedScore20}`,
    '[NOTE_60]': `${evalResult.grilleEvaluation.totalScore60}`,
    '[NOTE_ORAL]': '15/20',
    '[NOTE_QCM]': '14/20',
    '[NOTE_POS_TOTAL]': `${evalResult.testPositionnement.totalScore}`,
    '[ADMIS]': 'ADMIS',
    '[MENTION]': 'ADMIS',

    // AI Generated Text Summaries
    '[APPRECIATION_DETAILLEE_PRESIDENT]': evalResult.grilleEvaluation.presidentAppreciation,
    '[APPRECIATION_DETAILLEE_MEMBRE]': `Le candidat a démontré une excellente capacité d'adaptation et de maîtrise des outils abordés lors des cas pratiques.`,
    '[OBSERVATION_PRESIDENT]': `Candidat très engagé et assidu tout au long du parcours.`,
    '[OBSERVATION_MEMBRE]': `Excellente restitution des compétences lors des simulations.`,
    '[PRESENTATION_PARCOURS_PROFESSIONNEL_DU_CANDIDAT]': evalResult.additionalAiTexts?.parcoursSummary || 'Parcours professionnel riche avec expérience significative en gestion de TPE.',
    '[PRESENTATION_DU_PROJET_ENTREPRENEURIAL]': evalResult.additionalAiTexts?.projetSummary || 'Projet de développement et de modernisation de l’activité TPE.',

    // Theme Scores & Competencies
    '[COMPETENCE_1]': evalResult.competencies[0]?.title || 'Maîtrise des processus',
    '[COMPETENCE_2]': evalResult.competencies[1]?.title || 'Application pratique',
    '[COMPETENCE_3]': evalResult.competencies[2]?.title || 'Analyse & Synthèse',
    '[COMPETENCE_4]': evalResult.competencies[3]?.title || 'Organisation TPE',

    '[THEMATIQUE_1]': `${evalResult.themeProfiles[0]?.level || 4}/5`,
    '[THEMATIQUE_2]': `${evalResult.themeProfiles[1]?.level || 4}/5`,
    '[THEMATIQUE_3]': `${evalResult.themeProfiles[2]?.level || 3}/5`,
    '[THEMATIQUE_4]': `${evalResult.themeProfiles[3]?.level || 4}/5`,
    '[THEMATIQUE_5]': `${evalResult.themeProfiles[4]?.level || 4}/5`,

    '[CONTENU_DEVELOPPE_1]': 'Mise en application des principes fondamentaux et structuration des dossiers.',
    '[CONTENU_DEVELOPPE_2]': 'Réalisation des cas pratiques de mise en situation professionnelle.',
    '[CONTENU_DEVELOPPE_3]': 'Analyse approfondie des besoins opérationnels et préconisations.',
    '[CONTENU_DEVELOPPE_4]': 'Mise en place du suivi et des indicateurs de contrôle.',
    '[CONTENU_DEVELOPPE_5]': 'Validation finale des acquis et livrables de synthèse.',

    '[ELEMENT_CLE_PROJET_1]': 'Optimisation des temps de gestion administrative',
    '[ELEMENT_CLE_PROJET_2]': 'Amélioration du suivi de trésorerie',
    '[ELEMENT_CLE_PROJET_3]': 'Déploiement des outils numériques adaptés',

    '[POINT_FORT_1]': 'Rigueur d\'exécution',
    '[POINT_FORT_2]': 'Excellente compréhension des enjeux TPE',
    '[POINT_FORT_3]': 'Autonomie pratique',
    '[NOM_PROJET_TPE]': `Projet TPE ${candidate.prenom} ${candidate.nom}`,
  };

  // ---- 3-mode fill --------------------------------------------------------
  // Extract the document's fillable structure (tags, checkboxes, empty cells),
  // then let the AI layer decide checkbox/field answers grounded in the
  // candidate + evaluation profile. Tags are always applied from the map above.
  const structure = extractStructure(docXml);

  const { plan, usedAi } = await buildAiFillPlan(
    candidate,
    evalResult,
    structure,
    documentName,
    userApiKey
  );

  // Merge the deterministic tag map into the plan (tags take the known values).
  plan.tags = { ...replacements, ...(plan.tags || {}) };

  const { xml: filledXml, report } = applyFillPlan(docXml, structure, plan);

  zip.file('word/document.xml', filledXml);
  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  return { buffer, fillReport: { ...report, usedAi } };
}

function getTemplatesDir(): string {
  const primary = path.join(process.cwd(), 'Templates');
  if (fs.existsSync(primary)) return primary;
  const secondary = path.join(__dirname, '..', '..', 'Templates');
  if (fs.existsSync(secondary)) return secondary;
  return primary;
}

function getMatchingTemplates(organisme: string, codeCertif: string): string[] {
  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir);
  return files
    .filter((f) => {
      const lower = f.toLowerCase();
      const orgMatch =
        organisme === 'Proforma Institut' ? lower.includes('proforma') : lower.includes('proskills');
      const certifMatch = lower.includes(codeCertif.toLowerCase());
      return orgMatch && certifMatch && f.endsWith('.docx') && !f.startsWith('~$');
    })
    .map((f) => path.join(dir, f));
}

function getModuleShortName(codeCertif: string): string {
  switch (codeCertif) {
    case 'RS6485':
      return 'Comptabilité TPE';
    case 'RS7200':
      return 'Réseaux Sociaux TPE';
    case 'RS7311':
      return 'IA TPE';
    case 'RS7344':
      return 'IA pour Développer son Activité';
    default:
      return 'Certification';
  }
}
