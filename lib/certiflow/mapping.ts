import { WORD_NS } from './loadTemplate';
import { setCellText } from './replaceText';

/**
 * Step 3: Dynamic Table Row Extension
 * If the template candidate table doesn't have enough rows for all mapped fields,
 * ensureTableRows clones baseline table row elements (<w:tr>) using DOM methods.
 */
export function ensureTableRows(
  doc: Document,
  requiredMaxRowIndex: number,
  tableIndex: number = 0
): void {
  const tables = doc.getElementsByTagNameNS(WORD_NS, 'tbl');
  if (!tables || tables.length <= tableIndex) {
    return;
  }
  const table = tables.item(tableIndex)!;
  const rows = table.getElementsByTagNameNS(WORD_NS, 'tr');
  if (!rows || rows.length === 0) {
    return;
  }

  // Use second row as template if available, else first row
  const templateRow = (rows.length > 1 ? rows.item(1) : rows.item(0))!;

  while (table.getElementsByTagNameNS(WORD_NS, 'tr').length < requiredMaxRowIndex + 1) {
    const clonedRow = templateRow.cloneNode(true) as Element;
    // Clear cell text in cloned row
    const cells = clonedRow.getElementsByTagNameNS(WORD_NS, 'tc');
    for (let i = 0; i < cells.length; i++) {
      setCellText(cells.item(i)!, '');
    }
    table.appendChild(clonedRow);
  }
}

/**
 * Helper to fetch a specific cell Element (<w:tc>) by table, row, and column index.
 */
export function getTableCell(
  doc: Document,
  tableIndex: number,
  rowIndex: number,
  columnIndex: number
): Element | null {
  const tables = doc.getElementsByTagNameNS(WORD_NS, 'tbl');
  if (!tables || tables.length <= tableIndex) return null;

  const table = tables.item(tableIndex)!;
  ensureTableRows(doc, rowIndex, tableIndex);

  const rows = table.getElementsByTagNameNS(WORD_NS, 'tr');
  if (!rows || rows.length <= rowIndex) return null;

  const row = rows.item(rowIndex)!;
  const cells = row.getElementsByTagNameNS(WORD_NS, 'tc');
  if (!cells || cells.length <= columnIndex) return null;

  return cells.item(columnIndex)!;
}
