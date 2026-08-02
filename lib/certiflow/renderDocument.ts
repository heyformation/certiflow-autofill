import JSZip from 'jszip';
import { XMLSerializer } from '@xmldom/xmldom';

/**
 * Step 7: Packaging & Re-assembly
 * Serializes the modified XML DOM back into word/document.xml (and rels if updated),
 * updates the JSZip package, and generates the final .docx binary buffer.
 */
export function serializeXml(doc: Document): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc as any);
}

export async function renderDocument(
  doc: Document,
  zip: JSZip,
  relsDoc?: Document
): Promise<Buffer> {
  // 1. Serialize main document XML
  const updatedXml = serializeXml(doc);
  zip.file('word/document.xml', updatedXml);

  // 2. Serialize relationships XML if present
  if (relsDoc) {
    const updatedRelsXml = serializeXml(relsDoc);
    zip.file('word/_rels/document.xml.rels', updatedRelsXml);
  }

  // 3. Generate final output DOCX buffer in memory
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return outputBuffer;
}
