/**
 * docx-filler.ts
 * -------------------------------------------------------------
 * Deterministic, AI-agnostic DOCX structure engine.
 *
 * Responsibilities:
 *  1. Extract the "fillable structure" from a template's word/document.xml:
 *       - TAG slots        ([NOM], [NOTE_20], ...)
 *       - CHECKBOX groups  (Word content-control checkboxes ☐ + option label)
 *       - FIELD slots      (a label paragraph followed by an empty table cell)
 *  2. Apply a FillPlan (produced by the AI layer or the deterministic fallback)
 *     back onto the XML, returning the modified XML plus a fill report.
 *
 * This module performs ZERO business logic and calls NO AI. It only knows how
 * to read and write OOXML. All "what to fill" decisions come from a FillPlan.
 */

export const GLYPH_UNCHECKED = '\u2610'; // ☐
export const GLYPH_CHECKED = '\u2612'; // ☒

export interface CheckboxOption {
  /** Stable id for this checkbox within the document (index-based). */
  id: string;
  /** Visible label text of the option (e.g. "A. Le bilan"). */
  label: string;
  /** Char offset of the <w:sdt> opening tag in the raw XML. */
  sdtStart: number;
  /** Char offset just past the matching </w:sdt>. */
  sdtEnd: number;
}

export interface CheckboxGroup {
  /** Stable id for the group (index-based). */
  id: string;
  /** The question / prompt text preceding the options (best-effort). */
  question: string;
  options: CheckboxOption[];
}

export interface FieldSlot {
  /** Stable id (index-based). */
  id: string;
  /** The label text that precedes the empty cell (e.g. "Nom et Prénom"). */
  label: string;
  /** Char offset where injected text should be written (inside an empty cell run). */
  insertAt: number;
  /** The raw empty cell block, used to build a replacement. */
  cellBlock: string;
  cellStart: number;
  cellEnd: number;
}

export interface DocxStructure {
  tags: string[];
  checkboxGroups: CheckboxGroup[];
  fieldSlots: FieldSlot[];
}

export interface FillPlan {
  /** Map of raw tag (including brackets) -> replacement value. */
  tags?: Record<string, string>;
  /** Map of checkbox option id -> boolean (true = check it). */
  checkboxes?: Record<string, boolean>;
  /** Map of field slot id -> text to insert. */
  fields?: Record<string, string>;
}

export interface FillReport {
  tagsReplaced: number;
  tagsTotal: number;
  checkboxesChecked: number;
  checkboxesTotal: number;
  fieldsFilled: number;
  fieldsTotal: number;
  /** true when the doc had no fillable structure at all. */
  isStatic: boolean;
}

/** Strip all XML tags from a run of OOXML to recover visible text. */
function visibleText(xmlFragment: string): string {
  return xmlFragment
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize OOXML paragraphs so that bracketed tags like [NOM] split across
 * multiple <w:r> runs by Word formatting are consolidated into a single run.
 */
export function normalizeDocxXml(xml: string): string {
  if (!xml) return '';
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    if (para.includes('[') && para.includes(']')) {
      return para.replace(/\[([\s\S]*?)\]/g, (fullMatch) => {
        if (/<[^>]+>/.test(fullMatch)) {
          const cleanInside = fullMatch.replace(/<[^>]+>/g, '').trim();
          if (/^[A-Z0-9_ÉÈÀÊÂÇa-zéèàêâç]+$/i.test(cleanInside)) {
            return `[${cleanInside}]`;
          }
        }
        return fullMatch;
      });
    }
    return para;
  });
}

/**
 * Extract the fillable structure from a document.xml string.
 */
export function extractStructure(rawDocXml: string): DocxStructure {
  const docXml = normalizeDocxXml(rawDocXml);
  // ---- 1. TAG slots -------------------------------------------------------
  const tagSet = new Set<string>();
  const tagRegex = /\[[A-Z0-9_ÉÈÀÊÂÇa-zéèàêâç]+\]/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(docXml)) !== null) {
    tagSet.add(m[0]);
  }

  // ---- 2. CHECKBOX options ------------------------------------------------
  // Each Word content-control checkbox is a <w:sdt> that contains a
  // <w14:checkbox> element. The option label lives in the run(s) AFTER the
  // </w:sdt>, up to the end of that paragraph (</w:p>).
  const options: CheckboxOption[] = [];
  const sdtRegex = /<w:sdt\b[\s\S]*?<\/w:sdt>/g;
  let sdtMatch: RegExpExecArray | null;
  let optIdx = 0;
  while ((sdtMatch = sdtRegex.exec(docXml)) !== null) {
    const block = sdtMatch[0];
    if (block.indexOf('w14:checkbox') === -1) continue; // not a checkbox sdt

    const sdtStart = sdtMatch.index;
    const sdtEnd = sdtMatch.index + block.length;

    // Label = visible text from end of sdt up to the next </w:p>.
    const afterSlice = docXml.slice(sdtEnd, sdtEnd + 1200);
    const pEnd = afterSlice.indexOf('</w:p>');
    const labelFragment = pEnd === -1 ? afterSlice : afterSlice.slice(0, pEnd);
    const label = visibleText(labelFragment);

    options.push({
      id: `cb${optIdx}`,
      label,
      sdtStart,
      sdtEnd,
    });
    optIdx++;
  }

  // ---- Group checkboxes by their preceding question paragraph -------------
  const checkboxGroups: CheckboxGroup[] = [];
  let currentGroup: CheckboxGroup | null = null;
  let lastOptionEnd = -1;

  for (const opt of options) {
    // The question is the visible text between the previous option's paragraph
    // and this checkbox, i.e. the nearest non-empty paragraph before sdtStart.
    const gapStart = lastOptionEnd === -1 ? Math.max(0, opt.sdtStart - 3000) : lastOptionEnd;
    const gap = docXml.slice(gapStart, opt.sdtStart);
    // Collect visible text of paragraphs in the gap.
    const paraTexts = gap
      .split('</w:p>')
      .map((p) => visibleText(p))
      .filter((t) => t.length > 0 && t !== GLYPH_UNCHECKED && t !== GLYPH_CHECKED);

    // Find a true Question paragraph in the gap (not an option text starting with A), B), C), D))
    const questionCandidate = paraTexts.slice().reverse().find((t) => {
      const isOptionText = /^[A-E1-9][\).\s-]/i.test(t.trim());
      return !isOptionText;
    }) || '';

    // Start a new group ONLY when a genuine question heading/paragraph is detected
    const isNewQuestion = questionCandidate.length > 0 && currentGroup && currentGroup.question !== questionCandidate;
    if (!currentGroup || (isNewQuestion && currentGroup.options.length > 0)) {
      currentGroup = {
        id: `grp${checkboxGroups.length}`,
        question: questionCandidate || `Groupe ${checkboxGroups.length + 1}`,
        options: [],
      };
      checkboxGroups.push(currentGroup);
    }
    currentGroup.options.push(opt);
    lastOptionEnd = opt.sdtEnd;
  }

  // ---- 3. FIELD slots (label paragraph -> next empty table cell) ----------
  const fieldSlots: FieldSlot[] = [];
  // Find empty cells: <w:tc> ... </w:tc> whose visible text is empty.
  const tcRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
  let tcMatch: RegExpExecArray | null;
  let fieldIdx = 0;
  while ((tcMatch = tcRegex.exec(docXml)) !== null) {
    const cellBlock = tcMatch[0];
    if (visibleText(cellBlock).length > 0) continue; // not empty
    // Only consider cells that actually contain a paragraph we can write into.
    if (cellBlock.indexOf('<w:p') === -1) continue;

    const cellStart = tcMatch.index;
    const cellEnd = tcMatch.index + cellBlock.length;

    // Label = nearest non-empty visible text BEFORE this cell (within 1500 chars).
    const before = docXml.slice(Math.max(0, cellStart - 1500), cellStart);
    const beforeParas = before
      .split(/<\/w:p>|<\/w:tc>/)
      .map((p) => visibleText(p))
      .filter((t) => t.length > 0 && t !== GLYPH_UNCHECKED);
    const label = beforeParas.length ? beforeParas[beforeParas.length - 1] : '';
    if (!label) continue;

    fieldSlots.push({
      id: `fld${fieldIdx}`,
      label,
      insertAt: cellStart,
      cellBlock,
      cellStart,
      cellEnd,
    });
    fieldIdx++;
  }

  return {
    tags: Array.from(tagSet),
    checkboxGroups,
    fieldSlots,
  };
}

/**
 * Produce a clean Markdown "view" of the fillable structure so an AI can read
 * the whole document the easy way (user's requested MD approach) while keeping
 * a 1:1 link back to the DOCX via the stable field/checkbox ids.
 *
 * The view is NOT the output document — it is only the model's reading surface.
 */
export function structureToMarkdownView(structure: DocxStructure): string {
  const lines: string[] = [];

  if (structure.fieldSlots.length > 0) {
    lines.push('## Champs à remplir');
    for (const f of structure.fieldSlots) {
      lines.push(`- (${f.id}) ${f.label}: ____`);
    }
    lines.push('');
  }

  if (structure.checkboxGroups.length > 0) {
    lines.push('## Questions à cocher');
    for (const g of structure.checkboxGroups) {
      lines.push(`### ${g.question}`);
      for (const o of g.options) {
        lines.push(`- [ ] (${o.id}) ${o.label}`);
      }
      lines.push('');
    }
  }

  if (structure.tags.length > 0) {
    lines.push('## Balises');
    lines.push(structure.tags.join(', '));
  }

  return lines.join('\n').trim();
}

/** Build a run of OOXML that renders the given plain text. */
function buildTextRun(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
}

/** Inject a text run into an empty cell's first paragraph. */
function fillEmptyCell(cellBlock: string, text: string): string {
  const run = buildTextRun(text);
  // Insert the run right before the first </w:p> inside the cell.
  const pClose = cellBlock.indexOf('</w:p>');
  if (pClose === -1) {
    // No paragraph? Wrap one before </w:tc>.
    return cellBlock.replace('</w:tc>', `<w:p>${run}</w:p></w:tc>`);
  }
  return cellBlock.slice(0, pClose) + run + cellBlock.slice(pClose);
}

/** Mark a single checkbox sdt block as checked (glyph + checked flag). */
function checkSdtBlock(block: string): string {
  let out = block;
  // Flip the checked flag.
  out = out.replace(
    /(<w14:checked\s+w14:val=")0("\s*\/>)/,
    `$11$2`
  );
  // Replace the visible glyph inside sdtContent.
  out = out.replace(
    new RegExp(GLYPH_UNCHECKED, 'g'),
    GLYPH_CHECKED
  );
  return out;
}

/**
 * Apply a FillPlan to a document.xml string.
 * Returns the modified XML and a fill report.
 */
export function applyFillPlan(
  docXml: string,
  structure: DocxStructure,
  plan: FillPlan
): { xml: string; report: FillReport } {
  let xml = normalizeDocxXml(docXml);

  // ---- Fields & checkboxes must be applied by descending offset so earlier
  // ---- edits do not shift later offsets. Collect edits then sort.
  interface Edit {
    start: number;
    end: number;
    replacement: string;
  }
  const edits: Edit[] = [];

  let checkboxesChecked = 0;
  const checkboxesTotal = structure.checkboxGroups.reduce(
    (acc, g) => acc + g.options.length,
    0
  );
  if (plan.checkboxes) {
    for (const group of structure.checkboxGroups) {
      for (const opt of group.options) {
        if (plan.checkboxes[opt.id]) {
          const block = xml.slice(opt.sdtStart, opt.sdtEnd);
          edits.push({
            start: opt.sdtStart,
            end: opt.sdtEnd,
            replacement: checkSdtBlock(block),
          });
          checkboxesChecked++;
        }
      }
    }
  }

  let fieldsFilled = 0;
  if (plan.fields) {
    for (const slot of structure.fieldSlots) {
      const value = plan.fields[slot.id];
      if (value && value.trim().length > 0) {
        edits.push({
          start: slot.cellStart,
          end: slot.cellEnd,
          replacement: fillEmptyCell(slot.cellBlock, value.trim()),
        });
        fieldsFilled++;
      }
    }
  }

  // Apply offset-based edits (descending) — dedupe overlapping ranges.
  edits.sort((a, b) => b.start - a.start);
  let lastStart = Number.POSITIVE_INFINITY;
  for (const e of edits) {
    if (e.end > lastStart) continue; // overlaps a later-applied edit; skip
    xml = xml.slice(0, e.start) + e.replacement + xml.slice(e.end);
    lastStart = e.start;
  }

  // ---- Tag replacement (offset-independent, do last) ----------------------
  let tagsReplaced = 0;
  const tagsTotal = structure.tags.length;
  if (plan.tags) {
    for (const [tag, rawValue] of Object.entries(plan.tags)) {
      const value = rawValue ?? '';
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escapedTag, 'g');
      if (re.test(xml)) {
        const escVal = value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        xml = xml.replace(new RegExp(escapedTag, 'g'), escVal);
        tagsReplaced++;
      }
    }
  }

  const report: FillReport = {
    tagsReplaced,
    tagsTotal,
    checkboxesChecked,
    checkboxesTotal,
    fieldsFilled,
    fieldsTotal: structure.fieldSlots.length,
    isStatic:
      tagsTotal === 0 && checkboxesTotal === 0 && structure.fieldSlots.length === 0,
  };

  return { xml, report };
}
