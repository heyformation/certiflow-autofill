import fs from 'fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
export const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface LoadedTemplate {
  zip: JSZip;
  doc: Document;
  originalDocXml: string;
  relsDoc?: Document;
  relsXml?: string;
}

/**
 * Step 1: Loading the Template into Memory
 * Reads binary buffer from template file/buffer, unzips in memory using JSZip,
 * and parses word/document.xml (and word/_rels/document.xml.rels) into XML DOM.
 */
export async function loadTemplate(templateSource: string | Buffer): Promise<LoadedTemplate> {
  const buffer = typeof templateSource === 'string'
    ? fs.readFileSync(templateSource)
    : templateSource;

  const zip = await new JSZip().loadAsync(buffer);
  
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid DOCX template: word/document.xml not found.');
  }

  const originalDocXml = await docXmlFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalDocXml, 'text/xml') as unknown as Document;

  let relsDoc: Document | undefined;
  let relsXml: string | undefined;
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    relsXml = await relsFile.async('string');
    relsDoc = parser.parseFromString(relsXml, 'text/xml') as unknown as Document;
  }

  return {
    zip,
    doc,
    originalDocXml,
    relsDoc,
    relsXml,
  };
}
