import fs from 'fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { WORD_NS, RELS_NS, R_NS, DRAWING_NS, WP_NS, A_NS, PIC_NS } from './loadTemplate';
import { SignatureTarget } from './types';

const CM_TO_EMU = 360000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function embedSignature(
  doc: Document,
  zip: JSZip,
  relsDoc: Document | undefined,
  cellNode: Element,
  signatureSource: string | Buffer,
  config: SignatureTarget
): Promise<string> {
  // 1. Download & Validate Signature Image
  let imageBuffer: Buffer;
  if (Buffer.isBuffer(signatureSource)) {
    imageBuffer = signatureSource;
  } else if (signatureSource.startsWith('data:image/')) {
    const base64Data = signatureSource.split(',')[1];
    imageBuffer = Buffer.from(base64Data, 'base64');
  } else if (signatureSource.startsWith('http://') || signatureSource.startsWith('https://')) {
    const res = await fetch(signatureSource);
    if (!res.ok) {
      throw new Error(`Failed to download signature from ${signatureSource}: ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuf);
  } else if (fs.existsSync(signatureSource)) {
    imageBuffer = fs.readFileSync(signatureSource);
  } else {
    throw new Error(`Invalid signature source or path: ${signatureSource}`);
  }

  if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Signature image exceeds maximum size of 5MB (${imageBuffer.length} bytes).`);
  }

  // Detect image extension by magic bytes
  let ext = 'png';
  if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
    ext = 'jpeg';
  } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
    ext = 'png';
  }

  const sigId = Math.floor(100000 + Math.random() * 900000);
  const mediaPath = `word/media/image_sig_${sigId}.${ext}`;
  const mediaRelTarget = `media/image_sig_${sigId}.${ext}`;

  // 2. Add to ZIP archive
  zip.file(mediaPath, imageBuffer);

  // 3. Register Relationship in word/_rels/document.xml.rels
  let rId = `rIdSig${sigId}`;
  if (relsDoc) {
    const relsElem = relsDoc.getElementsByTagName('Relationships').item(0) ||
                     relsDoc.getElementsByTagNameNS(RELS_NS, 'Relationships').item(0);
    if (relsElem) {
      const rel = relsDoc.createElementNS(RELS_NS, 'Relationship');
      rel.setAttribute('Id', rId);
      rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
      rel.setAttribute('Target', mediaRelTarget);
      relsElem.appendChild(rel);
    }
  }

  // 4. Insert Drawing XML into cell node
  const widthCm = config.max_width_cm || 4.5;
  const heightCm = config.max_height_cm || 2.0;
  const widthEmu = Math.round(widthCm * CM_TO_EMU);
  const heightEmu = Math.round(heightCm * CM_TO_EMU);

  const drawingXml = `
<w:drawing xmlns:w="${WORD_NS}" xmlns:r="${R_NS}">
  <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${WP_NS}">
    <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
    <wp:docPr id="${sigId}" name="Signature ${sigId}"/>
    <wp:cNvGraphicFramePr>
      <a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/>
    </wp:cNvGraphicFramePr>
    <a:graphic xmlns:a="${A_NS}">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="${PIC_NS}">
          <pic:nvPicPr>
            <pic:cNvPr id="${sigId}" name="Signature ${sigId}"/>
            <pic:cNvPicPr/>
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${rId}"/>
            <a:stretch>
              <a:fillRect/>
            </a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm>
              <a:off x="0" y="0"/>
              <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
            </a:xfrm>
            <a:prstGeom prst="rect">
              <a:avLst/>
            </a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>
`.trim();

  const parser = new DOMParser();
  const drawingDoc = parser.parseFromString(drawingXml, 'text/xml');
  const drawingNode = doc.importNode(drawingDoc.documentElement as any, true);

  const p = doc.createElementNS(WORD_NS, 'w:p');
  const r = doc.createElementNS(WORD_NS, 'w:r');
  r.appendChild(drawingNode);
  p.appendChild(r);

  // Clear existing text before appending signature image
  const texts = cellNode.getElementsByTagNameNS(WORD_NS, 't');
  for (let i = 0; i < texts.length; i++) {
    texts.item(i)!.textContent = '';
  }
  cellNode.appendChild(p);

  return rId;
}
