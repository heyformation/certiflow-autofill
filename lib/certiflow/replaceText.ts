import { WORD_NS } from './loadTemplate';

/**
 * Step 4: Text Field Filling
 * Finds existing text nodes (<w:t>) inside the targeted cell node (<w:tc>),
 * sets text on the first text run element, and clears any subsequent split text runs
 * to avoid duplicated or mangled text formatting.
 */
export function setCellText(cellNode: Element, textValue: string): void {
  const texts = cellNode.getElementsByTagNameNS(WORD_NS, 't');
  if (texts && texts.length > 0) {
    // Set text on first text run element
    const firstText = texts.item(0)!;
    firstText.textContent = textValue;
    // Clear any subsequent split text runs in cell to avoid duplicate text
    for (let i = 1; i < texts.length; i++) {
      texts.item(i)!.textContent = '';
    }
  } else {
    // If cell contains no <w:t> elements yet, create <w:p><w:r><w:t>
    const doc = cellNode.ownerDocument;
    const p = doc.createElementNS(WORD_NS, 'w:p');
    const r = doc.createElementNS(WORD_NS, 'w:r');
    const t = doc.createElementNS(WORD_NS, 'w:t');
    t.textContent = textValue;
    r.appendChild(t);
    p.appendChild(r);
    cellNode.appendChild(p);
  }
}
