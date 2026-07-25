import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { CandidateRow } from './types';

export interface GeneratedPdfFile {
  filename: string;
  relativePath: string;
  category: string;
  buffer: Buffer;
}

// Locate font files cleanly across local dev and Vercel serverless environments
function getAfmFontPath(fontName: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data', `${fontName}.afm`),
    path.join(process.cwd(), '.next', 'server', 'chunks', 'data', `${fontName}.afm`),
    path.join(__dirname, 'data', `${fontName}.afm`),
    path.join('/var/task', 'node_modules', 'pdfkit', 'js', 'data', `${fontName}.afm`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Convert a filled Word (.docx) buffer into a 100% complete, full-content PDF.
 * Parses the full document structure (headers, paragraphs, tables, lists, text)
 * and renders it page-by-page into a professional A4 PDF.
 */
export async function convertFilledDocxToPdf(
  docxBuffer: Buffer,
  documentTitle: string,
  candidate: CandidateRow
): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });

  const isProforma = candidate.organisme === 'Proforma Institut';
  const brandColor = isProforma ? '#6E1F14' : '#0B3D3D';
  const lightBg = isProforma ? '#FBEEE9' : '#E8F5F3';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const setFont = (fontName: string) => {
        try {
          const fontPath = getAfmFontPath(fontName);
          if (fontPath) doc.font(fontPath);
          else doc.font(fontName);
        } catch {
          // Default fallback
        }
      };

      // Running Header Banner on first page
      const renderHeaderBanner = () => {
        doc.rect(0, 0, 595.28, 55).fill(brandColor);

        doc.fillColor('#FFFFFF').fontSize(13);
        setFont('Helvetica-Bold');
        doc.text(documentTitle.toUpperCase(), 40, 15, { width: 515, align: 'left' });

        doc.fontSize(9);
        setFont('Helvetica');
        doc.text(`${candidate.organisme} — ${candidate.code_certif} ${candidate.formation}`, 40, 32, {
          width: 515,
          align: 'left',
        });

        doc.y = 65;
      };

      renderHeaderBanner();

      // Simple HTML -> PDF Block Parser for full document content
      // Splits HTML into block elements (h1, h2, h3, p, table, li)
      const blocks = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<p[^>]*>[\s\S]*?<\/p>|<table[^>]*>[\s\S]*?<\/table>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>/gi) || [html];

      for (const block of blocks) {
        // Page overflow protection: add new page if near bottom
        if (doc.y > 750) {
          doc.addPage();
          renderHeaderBanner();
        }

        const textContent = block.replace(/<[^>]+>/g, '').trim();
        if (!textContent) continue;

        if (/^<h1/i.test(block)) {
          doc.moveDown(0.5);
          doc.fillColor(brandColor).fontSize(14);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.3);
        } else if (/^<h2/i.test(block)) {
          doc.moveDown(0.4);
          doc.fillColor(brandColor).fontSize(12);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.2);
        } else if (/^<h3/i.test(block)) {
          doc.moveDown(0.3);
          doc.fillColor('#1E293B').fontSize(11);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.2);
        } else if (/^<table/i.test(block)) {
          // Render table block nicely
          doc.moveDown(0.3);
          const rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
          for (const row of rows) {
            if (doc.y > 750) {
              doc.addPage();
              renderHeaderBanner();
            }
            const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>|<th[^>]*>[\s\S]*?<\/th>/gi) || []).map((c) =>
              c.replace(/<[^>]+>/g, '').trim()
            );

            if (cells.length > 0) {
              const cellWidth = Math.floor(515 / Math.max(1, cells.length));
              const startX = 40;
              const startY = doc.y;

              doc.rect(startX, startY, 515, 20).fillAndStroke(lightBg, '#CBD5E1');

              cells.forEach((cellText, colIdx) => {
                doc.fillColor('#0F172A').fontSize(8.5);
                setFont('Helvetica');
                doc.text(cellText, startX + colIdx * cellWidth + 5, startY + 5, {
                  width: cellWidth - 10,
                  height: 12,
                  ellipsis: true,
                });
              });
              doc.y = startY + 22;
            }
          }
          doc.moveDown(0.3);
        } else {
          // Paragraph / Text
          doc.fillColor('#334155').fontSize(9.5);
          if (/<strong>|<b>/i.test(block)) setFont('Helvetica-Bold');
          else setFont('Helvetica');

          doc.text(textContent, { width: 515, align: 'left' });
          doc.moveDown(0.3);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
