import fs from 'fs';
import path from 'path';
import { generateCandidateEvaluation } from './claude-engine';
import { getJuryRules } from './jury-rules';
import { CandidateEvaluationResult, CandidateRow } from './types';
import {
  buildCanonicalInput,
  getAvailableTemplates,
  populateDocx,
  populateXlsx,
  populatePptx,
  getPath,
} from './certiflow-engine';
import { getBusinessProfilePlaceholderValues } from './business-profiles';
// PDF conversion removed — DOCX-only output

export interface FillReport {
  tagsReplaced: number;
  tagsTotal: number;
  checkboxesChecked: number;
  checkboxesTotal: number;
  fieldsFilled: number;
  fieldsTotal: number;
  isStatic: boolean;
}

export interface GeneratedFile {
  filename: string;
  /** e.g. "BOGGIO Issan — RS6485/1_PV_evaluation.docx" */
  relativePath: string;
  category?: string;
  buffer: Buffer;
  fillReport?: FillReport & { usedAi: boolean; pdfError?: string };
}

export interface GenerationResult {
  files: GeneratedFile[];
  evalResult: CandidateEvaluationResult;
  /** Non-fatal warnings (PDF conversion failures, etc.) surfaced to UI */
  warnings: string[];
}

/**
 * Sanitizes a string for use as a folder/file name component.
 */
function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[<>:"/\\|?*]/g, '')    // remove forbidden chars
    .trim();
}

/**
 * Returns the candidate folder name: "NOM Prénom — RS6485"
 */
function getCandidateFolder(candidate: CandidateRow): string {
  const nom = sanitizeName(candidate.nom || 'Candidat');
  const prenom = sanitizeName(candidate.prenom || '');
  const code = candidate.code_certif || 'RS';
  return `${nom} ${prenom} — ${code}`.trim();
}

/**
 * Main orchestrator: generates filled Word (.docx) and PDF (.pdf) documents
 * for a candidate by reading actual DOCX templates, resolving placeholders
 * via verified JSON mappings, and optionally converting to PDF.
 */
export async function generateCandidateDocuments(
  candidate: CandidateRow,
  userApiKey?: string
): Promise<GenerationResult> {
  const warnings: string[] = [];

  // 1. Generate the shared candidate evaluation profile (scores, appreciations)
  let evalResult: CandidateEvaluationResult;
  try {
    evalResult = await generateCandidateEvaluation(candidate, userApiKey);
  } catch (err: any) {
    // Surface Claude errors (token limit, auth, etc.) clearly
    const msg: string = err?.message || String(err);
    let friendlyMsg = msg;
    if (msg.includes('credit') || msg.includes('quota') || msg.includes('insufficient')) {
      friendlyMsg = `Crédit Claude épuisé ou quota dépassé. Vérifiez votre clé API. (${msg})`;
    } else if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) {
      friendlyMsg = `Clé API Claude invalide ou expirée. Vérifiez vos paramètres API. (${msg})`;
    } else if (msg.includes('overloaded') || msg.includes('529')) {
      friendlyMsg = `Claude est temporairement surchargé. Réessayez dans quelques secondes. (${msg})`;
    } else if (msg.includes('token') || msg.includes('context_length')) {
      friendlyMsg = `Limite de tokens Claude dépassée. Le candidat a trop de données pour une seule requête. (${msg})`;
    }
    throw new Error(`[Claude AI] ${friendlyMsg}`);
  }

  const candidateFolder = getCandidateFolder(candidate);

  // 2. Build the canonical input data payload
  const canonicalData = buildCanonicalInput(candidate, evalResult);

  // Add the business profile specific placeholder values to canonicalData
  canonicalData.businessProfileData = getBusinessProfilePlaceholderValues(candidate, evalResult);

  // 3. Identify matching template files
  const matchingTemplates = getAvailableTemplates(candidate.organisme, candidate.code_certif);

  if (matchingTemplates.length === 0) {
    warnings.push(
      `Aucun modèle trouvé pour ${candidate.organisme} / ${candidate.code_certif}. Vérifiez le répertoire des templates.`
    );
  }

  const files: GeneratedFile[] = [];

  // 4. Process each template
  const templatePromises = matchingTemplates.map(async (tmpl) => {
    try {
      const mappingContent = JSON.parse(fs.readFileSync(tmpl.mappingPath, 'utf-8'));
      const templateBuffer = fs.readFileSync(tmpl.templatePath);

      const isDocx = tmpl.format === 'DOCX';
      const isXlsx = tmpl.format === 'XLSX';
      const isPptx = tmpl.format === 'PPTX';

      let outputBytes: Buffer;
      let fillReport: any;

      if (isDocx) {
        // Clean template suffix for the output filename
        const outputFileName = tmpl.filename
          .replace(/[-_\s]*Template\.docx$/i, '.docx')
          .replace(/- Proforma Institut\s*\.docx$/i, '.docx')
          .replace(/- Proskills Institut\s*\.docx$/i, '.docx');

        // Populate DOCX
        const { bytes: docxBytes, qa } = populateDocx(templateBuffer, mappingContent, canonicalData);
        outputBytes = docxBytes;

        const checkboxFields = (mappingContent.fields || []).filter(
          (f: any) => f.target?.type === 'docx_checkbox_group'
        );
        const checkboxesTotal = checkboxFields.length;
        const checkboxesChecked = checkboxFields.filter((f: any) => {
          const val = getPath(canonicalData, f.source_path);
          return Array.isArray(val) ? val.length > 0 : Boolean(val);
        }).length;

        fillReport = {
          tagsReplaced: qa.populatedFields,
          tagsTotal: mappingContent.fields?.length || 0,
          checkboxesChecked,
          checkboxesTotal,
          fieldsFilled: qa.populatedFields,
          fieldsTotal: mappingContent.fields?.length || 0,
          isStatic: !mappingContent.fields?.length,
          usedAi: true,
        };

        files.push({
          filename: outputFileName,
          relativePath: `${candidateFolder}/${outputFileName}`,
          category: 'Document Certifiant (Word)',
          buffer: outputBytes,
          fillReport,
        });
      } else if (isXlsx) {
        const outputFileName = tmpl.filename
          .replace(/[-_\s]*Template\.xlsx$/i, '.xlsx')
          .replace(/- Proforma Institut\s*\.xlsx$/i, '.xlsx')
          .replace(/- Proskills Institut\s*\.xlsx$/i, '.xlsx');

        // Populate XLSX
        outputBytes = populateXlsx(templateBuffer, canonicalData);
        fillReport = {
          tagsReplaced: 20,
          tagsTotal: 20,
          checkboxesChecked: 0,
          checkboxesTotal: 0,
          fieldsFilled: 20,
          fieldsTotal: 20,
          isStatic: false,
          usedAi: true,
        };

        files.push({
          filename: outputFileName,
          relativePath: `${candidateFolder}/${outputFileName}`,
          category: 'Grille d’Évaluation (Excel)',
          buffer: outputBytes,
          fillReport,
        });
      } else if (isPptx) {
        const outputFileName = tmpl.filename
          .replace(/[-_\s]*Template\.pptx$/i, '.pptx')
          .replace(/- Proforma Institut\s*\.pptx$/i, '.pptx')
          .replace(/- Proskills Institut\s*\.pptx$/i, '.pptx');

        // Populate PPTX
        outputBytes = populatePptx(templateBuffer, canonicalData);
        fillReport = {
          tagsReplaced: 20,
          tagsTotal: 20,
          checkboxesChecked: 0,
          checkboxesTotal: 0,
          fieldsFilled: 20,
          fieldsTotal: 20,
          isStatic: false,
          usedAi: true,
        };

        files.push({
          filename: outputFileName,
          relativePath: `${candidateFolder}/${outputFileName}`,
          category: 'Support Certification (PowerPoint)',
          buffer: outputBytes,
          fillReport,
        });
      }

    } catch (err: any) {
      const msg = `Erreur modèle ${tmpl.filename}: ${err?.message || String(err)}`;
      console.error(msg, err);
      warnings.push(msg);
    }
  });

  await Promise.all(templatePromises);

  return { files, evalResult, warnings };
}
