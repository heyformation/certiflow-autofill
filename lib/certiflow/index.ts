import pilotMappingJson from './pilot-mapping.json';
import { loadTemplate, LoadedTemplate } from './loadTemplate';
import { ensureTableRows, getTableCell } from './mapping';
import { setCellText } from './replaceText';
import { fillCheckboxCell } from './replaceCheckboxes';
import { embedSignature } from './signature';
import { renderDocument } from './renderDocument';
import { FieldMapping, TableCellTarget, CheckboxTarget, SignatureTarget } from './types';
import { WORD_NS } from './loadTemplate';

export * from './loadTemplate';
export * from './mapping';
export * from './replaceText';
export * from './replaceCheckboxes';
export * from './signature';
export * from './renderDocument';
export * from './types';

/** Helper to extract nested properties by dot notation path (e.g. "candidate.fullName") */
function getNestedValue(obj: any, pathStr: string): any {
  if (!obj || !pathStr) return undefined;
  const parts = pathStr.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export interface CertiFlowFillOptions {
  templateSource: string | Buffer;
  candidateData: Record<string, any>;
  mappings?: FieldMapping[];
  tagReplacements?: Record<string, string>;
  signatureSource?: string | Buffer;
}

/**
 * High-level orchestration for CertiFlow Document Generation & Form Filling
 * Implements the 7-step OOXML DOM manipulation process:
 * 1. Loading the Template into Memory (JSZip + DOMParser)
 * 2. Mapping Configuration (pilot-mapping.json / mappings)
 * 3. Dynamic Table Row Extension (ensureTableRows)
 * 4. Text Field Filling (setCellText)
 * 5. Checkbox Option Rendering (fillCheckboxCell ☒ / ☐)
 * 6. Signature Embedding (embedSignature)
 * 7. Packaging & Re-assembly (renderDocument)
 */
export async function generateCertiflowDocument(options: CertiFlowFillOptions): Promise<Buffer> {
  const { templateSource, candidateData, tagReplacements, signatureSource } = options;
  const mappings: FieldMapping[] = options.mappings || (pilotMappingJson as FieldMapping[]);

  // Step 1: Load template in memory
  const loaded = await loadTemplate(templateSource);
  const { doc, zip, relsDoc } = loaded;

  // Step 2 & 3: Ensure table rows exist for all mapped fields
  const tableMaxRows: Record<number, number> = {};
  for (const mapItem of mappings) {
    const { table_index, row_index } = mapItem.target;
    if (tableMaxRows[table_index] === undefined || row_index > tableMaxRows[table_index]) {
      tableMaxRows[table_index] = row_index;
    }
  }

  for (const [tblIdxStr, maxRow] of Object.entries(tableMaxRows)) {
    const tableIndex = parseInt(tblIdxStr, 10);
    ensureTableRows(doc, maxRow, tableIndex);
  }

  // Step 4, 5, 6: Process mapped fields
  for (const mapItem of mappings) {
    const value = getNestedValue(candidateData, mapItem.source_path) ??
                  getNestedValue(candidateData, mapItem.field_key) ??
                  candidateData[mapItem.field_key];

    const target = mapItem.target;
    const cellNode = getTableCell(doc, target.table_index, target.row_index, target.column_index);
    if (!cellNode) continue;

    if (target.type === 'table_cell') {
      const textVal = value !== undefined && value !== null ? String(value) : '';
      setCellText(cellNode, textVal);
    } else if (target.type === 'checkbox') {
      fillCheckboxCell(cellNode, value, target as CheckboxTarget);
    } else if (target.type === 'signature') {
      const sigInput = signatureSource || value;
      if (sigInput) {
        try {
          await embedSignature(doc, zip, relsDoc, cellNode, sigInput, target as SignatureTarget);
        } catch (sigErr) {
          console.warn(`Signature embedding warning for ${mapItem.field_key}:`, sigErr);
        }
      }
    }
  }

  // Handle standard tag replacements ([NOM], [PRENOM], etc.) across the DOM
  if (tagReplacements && Object.keys(tagReplacements).length > 0) {
    const textNodes = doc.getElementsByTagNameNS(WORD_NS, 't');
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes.item(i)!;
      let text = node.textContent || '';
      if (!text.includes('[')) continue;

      for (const [tag, val] of Object.entries(tagReplacements)) {
        if (text.includes(tag)) {
          text = text.replaceAll(tag, val ?? '');
        }
      }
      node.textContent = text;
    }
  }

  // Step 7: Packaging & Re-assembly
  return await renderDocument(doc, zip, relsDoc);
}
