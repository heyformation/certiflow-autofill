/**
 * md-template-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Template-based Markdown fill engine.
 *
 * Instead of generating documents from hardcoded strings (old md-engine.ts),
 * this engine:
 *   1. Loads the actual .md template from Templates_MD/
 *   2. Walks every {{FILL: label}}, {{FILL}}, and {{CHECKBOX}} placeholder
 *   3. Resolves each one using the per-document resolver config
 *   4. Produces the "Filled" version of the document
 *
 * This implements the 9-step fill pipeline described in the spec §5-§8.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getJuryConfig } from './jury-rules';
import {
  DocumentResolverConfig,
  FieldConfig,
  FieldResolverRule,
  resolveDerivedField,
} from './resolver-config-schema';
import { getResolverConfig, parseTemplateFilename } from './resolver-configs';
import { getThemeConfig } from './theme-config';
import { getDeterministicProduction, getDeterministicQuestionResponse } from './ai-fill-planner';
import {
  CandidateEvaluationResult,
  CandidateRow,
  Organization,
  RSCertificationCode,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(process.cwd(), 'Templates_MD');

const FILL_REGEX = /\{\{FILL(?::\s*([^}]+))?\}\}/g;
const CHECKBOX_REGEX = /\{\{CHECKBOX\}\}/g;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilledMdDocument {
  filename: string;
  documentType: string;
  rsCode: string;
  institute: string;
  category: string;
  content: string;
  /** Whether AI was used to fill any field */
  usedAi: boolean;
  /** Count of placeholders resolved */
  resolvedCount: number;
  /** Count of placeholders left unresolved */
  unresolvedCount: number;
}

export interface FillContext {
  candidate: CandidateRow;
  evalResult: CandidateEvaluationResult;
  /** Optional: pre-computed AI fill values keyed by tag label */
  aiFillValues?: Record<string, string>;
  /** Optional: pre-computed AI checkbox selections keyed by section */
  aiCheckboxSelections?: Record<string, number[]>;
}

// ─── Template Loading ────────────────────────────────────────────────────────

/**
 * List all available template files in the Templates_MD directory.
 */
export function listTemplateFiles(): string[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'DEVELOPER_GUIDE.md' && !f.endsWith('.ps1')
  );
}

/**
 * Load a specific template file by its components.
 */
export function loadTemplate(
  docType: string,
  rsCode: string,
  institute: string
): string | null {
  const filename = `${docType} - ${rsCode} - ${institute}.md`;
  const filepath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Load a template by its exact filename.
 */
export function loadTemplateByFilename(filename: string): string | null {
  const filepath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return fs.readFileSync(filepath, 'utf-8');
}

// ─── Tag Extraction ──────────────────────────────────────────────────────────

export interface ExtractedTag {
  type: 'fill' | 'checkbox';
  label: string;           // empty for {{FILL}} and {{CHECKBOX}}
  lineNumber: number;
  fullMatch: string;
  /** Nearest bold heading above this tag */
  sectionHeading: string;
}

/**
 * Extract all placeholder tags from a template's content.
 */
export function extractTags(content: string): ExtractedTag[] {
  const lines = content.split('\n');
  const tags: ExtractedTag[] = [];
  let currentHeading = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track the nearest bold heading (e.g. "**Question 1.** ..." or "**Nom et prénom *")
    const headingMatch = line.match(/^\*\*(.+?)\*\*/);
    if (headingMatch) {
      currentHeading = headingMatch[1].replace(/\\?\*$/, '').trim();
    }

    // Find {{FILL...}} tags
    let fillMatch;
    const fillRe = /\{\{FILL(?::\s*([^}]+))?\}\}/g;
    while ((fillMatch = fillRe.exec(line)) !== null) {
      tags.push({
        type: 'fill',
        label: fillMatch[1]?.trim() || '',
        lineNumber: i + 1,
        fullMatch: fillMatch[0],
        sectionHeading: currentHeading,
      });
    }

    // Find {{CHECKBOX}} tags
    let cbMatch;
    const cbRe = /\{\{CHECKBOX\}\}/g;
    while ((cbMatch = cbRe.exec(line)) !== null) {
      tags.push({
        type: 'checkbox',
        label: '',
        lineNumber: i + 1,
        fullMatch: cbMatch[0],
        sectionHeading: currentHeading,
      });
    }
  }

  return tags;
}

// ─── Single-Tag Resolution ──────────────────────────────────────────────────

/**
 * Resolve a single field value using its resolver rule.
 */
export function resolveField(
  resolver: FieldResolverRule,
  ctx: FillContext,
  tagLabel: string,
  rsCode: RSCertificationCode
): string {
  const { candidate, evalResult } = ctx;

  switch (resolver.type) {
    case 1: {
      // Type 1: Direct field copy
      const directResolver = resolver;
      let value = resolveDerivedField(directResolver.source, candidate);

      // Try fallback sources
      if (!value && directResolver.fallback_sources) {
        for (const src of directResolver.fallback_sources) {
          value = resolveDerivedField(src, candidate);
          if (value) break;
        }
      }

      // §8.1: If allow_empty and source is empty, leave empty — never invent
      if (!value && directResolver.allow_empty) return '';
      return value;
    }

    case 2: {
      // Type 2: AI-generated (or deterministic fallback)
      const aiResolver = resolver;

      // Check if pre-computed AI value exists
      if (ctx.aiFillValues && tagLabel && ctx.aiFillValues[tagLabel]) {
        return ctx.aiFillValues[tagLabel];
      }

      // Deterministic fallback based on content_type
      switch (aiResolver.content_type) {
        case 'score': {
          // Use evalResult scores
          if (tagLabel.toLowerCase().includes('positionnement') || tagLabel.toLowerCase().includes('test')) {
            return String(evalResult.testPositionnement.totalScore);
          }
          if (tagLabel.includes('NOTE_60') || tagLabel.includes('note_60')) {
            return String(evalResult.grilleEvaluation.totalScore60);
          }
          if (tagLabel.includes('NOTE_GLOBALE') || tagLabel.includes('NOTE_QCM')) {
            return String(evalResult.grilleEvaluation.convertedScore20);
          }
          if (tagLabel.includes('NB_TOTAL')) return '1';
          if (tagLabel.includes('NB_H') || tagLabel.includes('NB_F')) {
            const isFemale = candidate.civilite?.toLowerCase().includes('mme') ||
                             candidate.civilite?.toLowerCase().includes('madame');
            if (tagLabel.includes('RECUS') || tagLabel.includes('RECUES')) {
              return isFemale ? (tagLabel.includes('F') ? '1' : '0') : (tagLabel.includes('H') ? '1' : '0');
            }
            return isFemale ? (tagLabel.includes('F') ? '1' : '0') : (tagLabel.includes('H') ? '1' : '0');
          }
          return '';
        }
        case 'appreciation': {
          // Deterministic jury appreciation
          const themeConfig = getThemeConfig(rsCode);
          const avgLevel = evalResult.themeProfiles.reduce((a, t) => a + t.level, 0) /
            Math.max(1, evalResult.themeProfiles.length);
          if (avgLevel >= 4) return 'Excellent niveau de maîtrise. Candidat très motivé et rigoureux.';
          if (avgLevel >= 3) return 'Bon niveau général. Le candidat démontre une compréhension solide des enjeux.';
          return 'Niveau satisfaisant. Des axes de progression ont été identifiés.';
        }
        case 'free_text': {
          // Deterministic fallback for free text fields
          if (tagLabel.includes('production') || tagLabel.includes('réponse') || tagLabel.includes('travail') || tagLabel.includes('conseil')) {
            return getDeterministicProduction(rsCode, tagLabel, tagLabel);
          }
          if (tagLabel.includes('Questions ouvertes') || tagLabel.includes('questions ouvertes') || tagLabel.includes('PARTIE 2') || tagLabel.includes('Question 1') || tagLabel.includes('Question 2')) {
            return getDeterministicQuestionResponse(rsCode, tagLabel);
          }
          if (tagLabel.includes('objectif') || tagLabel.includes('attente')) {
            return `Approfondir les compétences liées à la certification ${rsCode} en lien avec son activité professionnelle.`;
          }
          if (tagLabel.includes('point fort') || tagLabel.includes('POINT_FORT')) {
            return `Maîtrise démontée en ${evalResult.themeProfiles.find(t => t.level >= 4)?.themeTitle || 'compétences générales'}`;
          }
          if (tagLabel.includes('ADMIS')) {
            return evalResult.grilleEvaluation.convertedScore20 >= 10 ? 'Admis' : '';
          }
          if (tagLabel.includes('AJOURNE')) {
            return evalResult.grilleEvaluation.convertedScore20 < 10 ? 'Ajourné' : '';
          }
          // Generic fallback
          return '';
        }
        default:
          return '';
      }
    }

    case 3: {
      // Type 3: Static / fixed value
      const staticResolver = resolver;

      if (staticResolver.static_value !== undefined) {
        return staticResolver.static_value;
      }

      if (staticResolver.static_source) {
        const juryConfig = getJuryConfig(candidate.organisme);
        switch (staticResolver.static_source) {
          case 'jury_chair': return juryConfig.chair;
          case 'jury_member': return juryConfig.member;
          case 'jury_contact': return juryConfig.contact;
          case 'exam_officer': return juryConfig.examOfficer;
          case 'ped_officer': return juryConfig.pedagogicalOfficer;
          case 'organisme': return candidate.organisme;
        }
      }

      return '';
    }
  }
}

// ─── Checkbox Resolution ─────────────────────────────────────────────────────

interface LocalCheckboxGroup {
  heading: string;
  startLine: number;
  checkboxCount: number;
  /** Lines containing the {{CHECKBOX}} tags */
  lines: { lineIndex: number; optionText: string }[];
}

/**
 * Extract checkbox groups from template content.
 * Groups consecutive {{CHECKBOX}} lines under their nearest heading.
 */
function extractCheckboxGroups(content: string): LocalCheckboxGroup[] {
  const lines = content.split('\n');
  const groups: LocalCheckboxGroup[] = [];
  let currentHeading = '';
  let currentGroup: LocalCheckboxGroup | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track headings
    const headingMatch = line.match(/^\*\*(.+?)\*\*/);
    if (headingMatch) {
      currentHeading = headingMatch[1].replace(/\\?\*$/, '').trim();
    }

    if (CHECKBOX_REGEX.test(line)) {
      CHECKBOX_REGEX.lastIndex = 0; // reset
      if (!currentGroup || currentGroup.heading !== currentHeading) {
        currentGroup = {
          heading: currentHeading,
          startLine: i,
          checkboxCount: 0,
          lines: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.checkboxCount++;
      const optionText = line.replace(/\{\{CHECKBOX\}\}\s*/, '').trim();
      currentGroup.lines.push({ lineIndex: i, optionText });
    } else if (line.trim() !== '' && !line.startsWith('>') && currentGroup) {
      // Non-empty, non-blockquote line breaks the current group
      // But only if it's not a continuation of a checkbox option
      if (!line.match(/^\s/) && !line.startsWith('>')) {
        currentGroup = null;
      }
    }
  }

  return groups;
}

/**
 * Resolve which checkboxes to check in a group, using the resolver config and eval data.
 */
function resolveCheckboxGroup(
  group: LocalCheckboxGroup,
  config: DocumentResolverConfig,
  ctx: FillContext,
  rsCode: RSCertificationCode
): Set<number> {
  const selected = new Set<number>();
  const { evalResult } = ctx;

  // Pre-computed AI selections
  if (ctx.aiCheckboxSelections && ctx.aiCheckboxSelections[group.heading]) {
    return new Set(ctx.aiCheckboxSelections[group.heading]);
  }

  // Find matching checkbox group config
  const groupConfig = config.checkbox_groups.find(
    (cg) => group.heading.toLowerCase().includes(cg.section.toLowerCase()) ||
            cg.section.toLowerCase().includes(group.heading.toLowerCase().slice(0, 20))
  );

  // Deterministic fallback: pick based on average theme level
  const avgLevel = evalResult.themeProfiles.reduce((a, t) => a + t.level, 0) /
    Math.max(1, evalResult.themeProfiles.length);

  if (group.checkboxCount <= 5 && group.lines.some(l => ['1', '2', '3', '4', '5'].includes(l.optionText.trim()))) {
    // This is a level selection (1-5 scale) — pick the level matching avgLevel
    const levelIdx = Math.min(group.checkboxCount - 1, Math.max(0, Math.round(avgLevel) - 1));
    selected.add(levelIdx);
  } else if (group.checkboxCount === 2) {
    // Binary yes/no — default to first option (usually positive)
    selected.add(0);
  } else if (group.checkboxCount <= 4) {
    // MCQ (4 options) — pick based on level
    const ratio = Math.min(0.95, Math.max(0.05, avgLevel / 5));
    const idx = Math.min(group.checkboxCount - 1, Math.round(ratio * (group.checkboxCount - 1)));
    selected.add(idx);
  } else {
    // Multi-select: pick 1-3 options biased by level
    const numToSelect = Math.min(3, Math.max(1, Math.floor(avgLevel / 2) + 1));
    for (let i = 0; i < numToSelect && i < group.checkboxCount; i++) {
      selected.add(i);
    }
  }

  // Guarantee at least one selection
  if (selected.size === 0 && group.checkboxCount > 0) {
    selected.add(0);
  }

  return selected;
}

// ─── Main Fill Engine ────────────────────────────────────────────────────────

/**
 * Fill a single template with candidate data.
 *
 * This is the core of the pipeline:
 *   1. Load the template .md file
 *   2. Load its resolver config
 *   3. Walk top-to-bottom, resolve each placeholder
 *   4. Apply score floor rule (§8.5)
 *   5. Return the filled content
 */
export function fillTemplate(
  templateContent: string,
  config: DocumentResolverConfig,
  ctx: FillContext,
  rsCode: RSCertificationCode
): { content: string; resolvedCount: number; unresolvedCount: number } {
  let content = templateContent;
  let resolvedCount = 0;
  let unresolvedCount = 0;

  // ── Step 1: Resolve {{FILL: label}} and {{FILL}} tags ──────────────────

  // Build a lookup map from config fields
  const fieldMap = new Map<string, FieldConfig>();
  for (const field of config.fields) {
    fieldMap.set(field.tag, field);
  }

  const lines = content.split('\n');
  const localOcc = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('{{FILL')) {
      lines[i] = line.replace(FILL_REGEX, (fullMatch, label?: string) => {
        const tag = label?.trim() || '';

        let uniqueTag = tag;
        if (tag) {
          const ltag = tag.toLowerCase();
          const count = (localOcc.get(ltag) || 0) + 1;
          localOcc.set(ltag, count);
          uniqueTag = `${tag} ${count}`;
        }

        // Look up resolver config for this tag
        const fieldConfig = fieldMap.get(tag);

        if (fieldConfig) {
          const value = resolveField(fieldConfig.resolver, ctx, uniqueTag || tag, rsCode);
          if (value !== undefined && value !== null) {
            resolvedCount++;
            return value;
          }
        }

        // Try matching by label keywords even if not in config
        // (handles unlabeled {{FILL}} and tags not explicitly configured)
        if (!tag) {
          // Unlabeled {{FILL}} — try contextual resolution based on the current line
          const unlabeledValue = resolveUnlabeledFill(ctx, rsCode, line);
          if (unlabeledValue !== null) {
            resolvedCount++;
            return unlabeledValue;
          }
        }

        // Unresolved — leave the tag as-is for transparency
        unresolvedCount++;
        return fullMatch;
      });
    }
  }
  content = lines.join('\n');

  // ── Step 2: Resolve {{CHECKBOX}} tags ──────────────────────────────────

  const cbGroups = extractCheckboxGroups(templateContent);
  const cbLines = content.split('\n');

  for (const group of cbGroups) {
    const selectedIndices = resolveCheckboxGroup(group, config, ctx, rsCode);

    let cbIndex = 0;
    for (const cbLine of group.lines) {
      const lineIdx = cbLine.lineIndex;
      if (lineIdx < cbLines.length) {
        const isSelected = selectedIndices.has(cbIndex);
        if (isSelected) {
          cbLines[lineIdx] = cbLines[lineIdx].replace('{{CHECKBOX}}', '☑');
          resolvedCount++;
        } else {
          cbLines[lineIdx] = cbLines[lineIdx].replace('{{CHECKBOX}}', '☐');
          resolvedCount++;
        }
      }
      cbIndex++;
    }
  }

  // Handle any remaining {{CHECKBOX}} tags not captured in groups
  content = cbLines.join('\n');
  content = content.replace(CHECKBOX_REGEX, () => {
    resolvedCount++;
    return '☐';
  });

  return { content, resolvedCount, unresolvedCount };
}

/**
 * Attempt to resolve an unlabeled {{FILL}} by context.
 * Returns null if no resolution is possible.
 */
function resolveUnlabeledFill(
  ctx: FillContext,
  rsCode: RSCertificationCode,
  lineContent: string
): string | null {
  const { candidate } = ctx;
  const lowerLine = lineContent.toLowerCase();

  if (lowerLine.includes('stagiaire')) {
    return `${candidate.civilite || 'M.'} ${candidate.prenom} ${candidate.nom}`;
  }
  if (lowerLine.includes('organisme')) {
    return candidate.organisme || '';
  }
  if (lowerLine.includes('date')) {
    return candidate.date_examen || candidate.date_debut_session || '';
  }

  return '';
}

// ─── High-Level API ──────────────────────────────────────────────────────────

/**
 * Generate a filled document from a template.
 *
 * @param docType - Document type (e.g. "Recueil des Besoins")
 * @param rsCode - Certification code (e.g. "RS6485")
 * @param institute - Institute name (e.g. "Proforma Institut")
 * @param candidate - Candidate data from EDOF
 * @param evalResult - Pre-computed evaluation result
 * @param aiFillValues - Optional pre-computed AI fill values
 * @param aiCheckboxSelections - Optional pre-computed AI checkbox selections
 */
export function generateFilledDocument(
  docType: string,
  rsCode: RSCertificationCode,
  institute: Organization,
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult,
  aiFillValues?: Record<string, string>,
  aiCheckboxSelections?: Record<string, number[]>
): FilledMdDocument | null {
  // 1. Load template
  const templateContent = loadTemplate(docType, rsCode, institute);
  if (!templateContent) {
    console.warn(`Template not found: ${docType} - ${rsCode} - ${institute}`);
    return null;
  }

  // 2. Load resolver config
  const config = getResolverConfig(docType);
  if (!config) {
    console.warn(`No resolver config for document type: ${docType}`);
    return null;
  }

  // 3. Skip if document has no placeholders
  if (config.skip_fill) {
    return {
      filename: `${docType} - ${rsCode} - ${institute}.md`,
      documentType: docType,
      rsCode,
      institute,
      category: config.category,
      content: templateContent,
      usedAi: false,
      resolvedCount: 0,
      unresolvedCount: 0,
    };
  }

  // 4. Build fill context
  const ctx: FillContext = {
    candidate,
    evalResult,
    aiFillValues,
    aiCheckboxSelections,
  };

  // 5. Fill the template
  const { content, resolvedCount, unresolvedCount } = fillTemplate(
    templateContent,
    config,
    ctx,
    rsCode
  );

  return {
    filename: `${docType} - ${rsCode} - ${institute} - Filled.md`,
    documentType: docType,
    rsCode,
    institute,
    category: config.category,
    content,
    usedAi: !!aiFillValues,
    resolvedCount,
    unresolvedCount,
  };
}

/**
 * Generate ALL filled documents for a candidate across all available templates.
 */
export function generateAllFilledDocuments(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult,
  aiFillValues?: Record<string, string>,
  aiCheckboxSelections?: Record<string, number[]>
): FilledMdDocument[] {
  const results: FilledMdDocument[] = [];
  const files = listTemplateFiles();

  for (const file of files) {
    const parsed = parseTemplateFilename(file);
    if (!parsed || !parsed.rsCode || !parsed.institute) continue;

    // Only generate for this candidate's certification and institute
    if (parsed.rsCode !== candidate.code_certif) continue;
    if (parsed.institute !== candidate.organisme) continue;

    const doc = generateFilledDocument(
      parsed.type,
      candidate.code_certif,
      candidate.organisme,
      candidate,
      evalResult,
      aiFillValues,
      aiCheckboxSelections
    );

    if (doc) results.push(doc);
  }

  return results;
}

// ─── Validation / Diagnostics ────────────────────────────────────────────────

/**
 * Validate that all placeholder tags in a template have resolver config entries.
 * Returns a list of uncovered tags.
 */
export function validateCoverage(
  templateContent: string,
  config: DocumentResolverConfig
): { covered: string[]; uncovered: string[] } {
  const tags = extractTags(templateContent);
  const covered: string[] = [];
  const uncovered: string[] = [];

  const configLabels = new Set(config.fields.map((f) => f.tag));

  for (const tag of tags) {
    if (tag.type === 'fill') {
      if (tag.label && configLabels.has(tag.label)) {
        covered.push(tag.label);
      } else if (tag.label) {
        uncovered.push(tag.label);
      }
      // Unlabeled fills are handled by the engine contextually
    }
    // Checkboxes are resolved by group, not individually
  }

  return { covered, uncovered };
}

// ─── AI Compatibility Helpers ────────────────────────────────────────────────

import { DocxStructure, CheckboxGroup, CheckboxOption, FieldSlot, FillPlan } from './docx-filler';

/**
 * Parses Markdown template content to extract a DocxStructure object.
 * This maps {{FILL: label}}, {{FILL}}, and {{CHECKBOX}} placeholders to
 * structured elements so the existing Anthropic buildAiFillPlan can be reused.
 */
export function extractMdStructure(content: string): DocxStructure {
  const lines = content.split('\n');
  const fieldSlots: FieldSlot[] = [];
  const checkboxGroups: CheckboxGroup[] = [];
  
  let currentHeading = 'Informations générales';
  let currentGroup: CheckboxGroup | null = null;
  let fieldIndex = 0;
  let checkboxIndex = 0;
  let groupIndex = 0;
  
  const tagSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for bold headings (markdown section headers)
    const headingMatch = line.match(/^\*\*(.+?)\*\*/);
    if (headingMatch) {
      currentHeading = headingMatch[1].replace(/\\?\*$/, '').trim();
    }
    
    // Find {{FILL: label}} or {{FILL}}
    let fillMatch;
    const fillRe = /\{\{FILL(?::\s*([^}]+))?\}\}/g;
    while ((fillMatch = fillRe.exec(line)) !== null) {
      let label = fillMatch[1]?.trim() || '';
      if (!label) {
        // Try to infer a label from the preceding text on the same line
        const beforeTag = line.substring(0, fillMatch.index).trim();
        // Look for pattern like **Label :** or **Label** or Label:
        const colonMatch = beforeTag.match(/\*\*([^*:]+)\s*:\s*\*\*$/) || 
                           beforeTag.match(/([A-Za-zÀ-ÿ0-9\s-]+)\s*:\s*$/) ||
                           beforeTag.match(/\*\*([^*]+)\*\*$/);
        if (colonMatch) {
          label = colonMatch[1].trim();
        } else {
          // Fallback: clean the preceding text
          const cleanBefore = beforeTag.replace(/^[|*#\s-]+|[|*#\s-:]+$/g, '').trim();
          if (cleanBefore) {
            label = cleanBefore;
          }
        }
      }
      const id = `fld${fieldIndex++}`;
      fieldSlots.push({
        id,
        label: label || `Champ sans libellé sous ${currentHeading}`,
        insertAt: 0,
        cellBlock: '',
        cellStart: 0,
        cellEnd: 0
      });
      if (label) tagSet.add(label);
    }
    
    // Find {{CHECKBOX}}
    if (line.includes('{{CHECKBOX}}')) {
      const optionText = line.replace(/\{\{CHECKBOX\}\}\s*/, '').trim();
      
      // If we don't have a current group or if the heading changed, start a new group
      if (!currentGroup || currentGroup.question !== currentHeading) {
        currentGroup = {
          id: `grp${groupIndex++}`,
          question: currentHeading,
          options: []
        };
        checkboxGroups.push(currentGroup);
      }
      
      const optId = `cb_${checkboxIndex++}`;
      currentGroup.options.push({
        id: optId,
        label: optionText,
        sdtStart: 0,
        sdtEnd: 0
      });
    } else if (line.trim() !== '' && !line.startsWith('>') && currentGroup) {
      // Break the group if it's a non-empty, non-blockquote line and not a checkbox
      if (!line.match(/^\s/) && !line.startsWith('>')) {
        currentGroup = null;
      }
    }
  }
  
  return {
    tags: Array.from(tagSet),
    checkboxGroups,
    fieldSlots
  };
}

/**
 * Fills a Markdown template using the generated FillPlan and its extracted structure.
 * Resolves fields and checkboxes in exact sequential order.
 */
export function fillTemplateWithAiPlan(
  templateContent: string,
  plan: FillPlan,
  structure: DocxStructure
): string {
  let content = templateContent;
  let fieldIdx = 0;
  let cbIdx = 0;
  
  // Replace FILLs in sequential order
  content = content.replace(/\{\{FILL(?::\s*([^}]+))?\}\}/g, (fullMatch, label) => {
    const id = `fld${fieldIdx++}`;
    
    // 1. Try resolving using AI plan fields
    const aiVal = plan.fields?.[id];
    if (typeof aiVal === 'string' && aiVal !== '') {
      return aiVal;
    }
    
    // 2. Try matching tag replacement (from replacements map)
    const tag = label?.trim() || '';
    if (tag) {
      if (plan.tags?.[`[${tag}]`] !== undefined) {
        return plan.tags[`[${tag}]`];
      }
      if (plan.tags?.[tag] !== undefined) {
        return plan.tags[tag];
      }
    }
    
    return '';
  });
  
  // Replace CHECKBOXes in sequential order
  content = content.replace(/\{\{CHECKBOX\}\}/g, () => {
    const id = `cb_${cbIdx++}`;
    const isChecked = plan.checkboxes?.[id];
    return isChecked ? '☑' : '☐';
  });
  
  return content;
}

