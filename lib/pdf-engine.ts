import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { CandidateRow } from './types';

export interface GeneratedPdfFile {
  filename: string;
  relativePath: string;
  category: string;
  buffer: Buffer;
}

// ─── Font Helper ─────────────────────────────────────────────────────────────

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

// ─── Inline Formatting Parser ────────────────────────────────────────────────

/**
 * Render text supporting inline bold (**bold**) formatting.
 * Uses manual horizontal cursor advancement for short inline segments,
 * and safely wraps long paragraphs to prevent PDFKit continued-line overlapping.
 */
function renderTextWithBold(
  doc: any,
  text: string,
  x?: number,
  y?: number,
  options: any = {}
) {
  // Store original cursor position
  const startX = x !== undefined ? x : doc.x;
  const startY = y !== undefined ? y : doc.y;

  if (x !== undefined && y !== undefined) {
    doc.x = x;
    doc.y = y;
  }

  const hasBold = text.includes('**') || text.includes('__');
  // For long paragraphs with width constraints, continued + width is buggy in PDFKit.
  // We render it as plain text (stripping bold markers) to ensure perfect wrapping.
  if (!hasBold || (text.length > 80 && options.width)) {
    const cleanText = text.replace(/\*\*|__/g, '');
    doc.text(cleanText, options);
    doc.x = startX; // Reset X
    return;
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  let currentX = doc.x;
  const currentY = doc.y;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const isBold = part.startsWith('**') && part.endsWith('**');
    const displayText = isBold ? part.slice(2, -2) : part;
    if (!displayText) continue;

    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
    const textWidth = doc.widthOfString(displayText);

    doc.text(displayText, currentX, currentY, {
      ...options,
      width: undefined, // Safe since length <= 80
      continued: false,
      lineBreak: false,
    });

    currentX += textWidth;
  }

  doc.x = startX;
  doc.y = currentY + doc.currentLineHeight();
}

// ─── Main Markdown to PDF Converter ──────────────────────────────────────────

/**
 * Converts a filled Markdown document to a beautifully formatted PDF.
 * Implements modern typography, colors matching the candidate's institute branding,
 * and high-fidelity layouts (banners, footers, vector checkboxes, lists, quotes, tables).
 */
export async function convertMdToPdf(
  mdContent: string,
  documentTitle: string,
  candidate: CandidateRow
): Promise<Buffer> {
  const isProforma = candidate.organisme === 'Proforma Institut';
  const brandColor = isProforma ? '#6E1F14' : '#0B3D3D'; // Burgundy vs Dark Teal
  const lightBg = isProforma ? '#FBEEE9' : '#E8F5F3';    // Warm Ivory vs Pale Mint
  const textDark = '#1E293B';                            // Slate 800
  const textMuted = '#64748B';                           // Slate 500
  const borderCol = '#CBD5E1';                           // Slate 300

  const bannerHeight = 55;
  const titleText = documentTitle.toUpperCase();
  const subTitleText = `${candidate.organisme} — ${candidate.code_certif} ${candidate.formation}`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
      });
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
          doc.font('Helvetica');
        }
      };

      // Header Banner and Footer Renderer
      let pageNum = 1;
      let isDrawingDecorations = false;
      const renderPageDecorations = (currentP: number) => {
        // Guard to prevent re-entry / infinite loops during page break triggers
        if (isDrawingDecorations) return;
        isDrawingDecorations = true;

        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // Temporarily disable bottom margin page breaks

        // 1. Draw elegant outer page frame border
        doc.strokeColor('#E2E8F0').lineWidth(0.5);
        doc.rect(20, 20, 555.28, 802.28).stroke();

        // 2. Draw colored header banner
        doc.rect(20, 20, 555.28, bannerHeight - 20).fill(brandColor);

        // 3. Draw thin dual-tone accent bar underneath the banner
        const accentColor = isProforma ? '#D97706' : '#0D9488'; // Gold Amber vs Bright Teal
        doc.rect(20, bannerHeight, 555.28, 3).fill(accentColor);

        // Header Title
        doc.fillColor('#FFFFFF');
        setFont('Helvetica-Bold');
        doc.fontSize(10.5);
        doc.text(titleText, 40, 25, { width: 515, align: 'left' });

        // Header Subtitle
        setFont('Helvetica');
        doc.fontSize(8);
        doc.text(subTitleText, 40, 39, { width: 515, align: 'left' });

        // Footer line
        doc.strokeColor(borderCol).lineWidth(0.5);
        doc.moveTo(40, 800).lineTo(555, 800).stroke();

        // Footer Text
        doc.fillColor(textMuted).fontSize(7.5);
        doc.text(`Document de certification officiel — ${candidate.organisme}`, 40, 805, { width: 350 });
        doc.text(`Page ${currentP}`, 40, 805, { width: 515, align: 'right' });

        doc.page.margins.bottom = oldBottomMargin; // Restore original bottom margin
        isDrawingDecorations = false;
      };

      // Listen for page additions to draw background and decorations
      doc.on('pageAdded', () => {
        pageNum++;
        renderPageDecorations(pageNum);
        doc.y = bannerHeight + 20; // Start content below banner
        doc.x = 40;
      });

      // Render decorations on first page
      renderPageDecorations(1);
      doc.y = bannerHeight + 20;
      doc.x = 40;

      // Clean Markdown Content and Split into Blocks
      const cleanMd = mdContent.replace(/\r\n/g, '\n');
      const rawBlocks = cleanMd.split(/\n\n+/);
      const blocks: string[] = [];

      // Group table rows into a single block
      let currentTable: string[] = [];
      for (const block of rawBlocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('|')) {
          currentTable.push(trimmed);
        } else {
          if (currentTable.length > 0) {
            blocks.push(currentTable.join('\n'));
            currentTable = [];
          }
          blocks.push(trimmed);
        }
      }
      if (currentTable.length > 0) {
        blocks.push(currentTable.join('\n'));
      }

      // Render Block by Block
      for (const block of blocks) {
        // Page break safety check
        if (doc.y > 760) {
          doc.addPage();
        }

        // H1 Heading (# Heading)
        if (block.startsWith('# ')) {
          const heading = block.replace(/^#\s+/, '').trim();
          doc.moveDown(0.5);
          setFont('Helvetica-Bold');
          doc.fontSize(13).fillColor(brandColor);
          renderTextWithBold(doc, heading);
          doc.moveDown(0.3);
          continue;
        }

        // H2 Heading (## Heading)
        if (block.startsWith('## ')) {
          const heading = block.replace(/^##\s+/, '').trim();
          doc.moveDown(0.4);
          setFont('Helvetica-Bold');
          doc.fontSize(11.5).fillColor(brandColor);
          renderTextWithBold(doc, heading);
          doc.moveDown(0.2);
          continue;
        }

        // H3 Heading (### Heading)
        if (block.startsWith('### ')) {
          const heading = block.replace(/^###\s+/, '').trim();
          doc.moveDown(0.3);
          setFont('Helvetica-Bold');
          doc.fontSize(10).fillColor(textDark);
          renderTextWithBold(doc, heading);
          doc.moveDown(0.15);
          continue;
        }

        // H4 Heading (#### Heading)
        if (block.startsWith('#### ')) {
          const heading = block.replace(/^####\s+/, '').trim();
          doc.moveDown(0.2);
          setFont('Helvetica-Bold');
          doc.fontSize(9.5).fillColor(textDark);
          renderTextWithBold(doc, heading);
          doc.moveDown(0.1);
          continue;
        }

        // Table Block
        if (block.startsWith('|')) {
          doc.moveDown(0.3);
          const rawRows = block.split('\n');
          const rows: string[][] = [];

          for (const rawRow of rawRows) {
            const trimmedRow = rawRow.trim();
            // Skip separating rows (e.g. |---|---|)
            if (trimmedRow.startsWith('|') && (trimmedRow.includes('---') || trimmedRow.includes(':---'))) {
              continue;
            }
            if (trimmedRow.startsWith('|')) {
              // Split cells, removing first and last empty elements from border pipe splits
              const cells = trimmedRow.split('|').map((c) => c.trim());
              if (cells.length > 1) {
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();
                rows.push(cells);
              }
            }
          }

          if (rows.length > 0) {
            const colCount = Math.max(...rows.map((r) => r.length));
            const colWidth = Math.floor(515 / colCount);
            const innerWidth = colWidth - 12;
            const tableStartX = 40; // Ensure consistent left margin

            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
              const row = rows[rIdx];
              const isHeaderRow = rIdx === 0;

              // Calculate max height for cells in this row to avoid vertical clipping
              setFont(isHeaderRow ? 'Helvetica-Bold' : 'Helvetica');
              doc.fontSize(8);
              let maxCellHeight = 12;
              for (const cellText of row) {
                const h = doc.heightOfString(cellText || ' ', { width: innerWidth });
                if (h > maxCellHeight) maxCellHeight = h;
              }
              const rowHeight = maxCellHeight + 8;

              // Page overflow check
              if (doc.y + rowHeight > 780) {
                doc.addPage();
              }

              const startY = doc.y;

              const bgFill = isHeaderRow ? brandColor : (rIdx % 2 === 1 ? lightBg : '#FFFFFF');
              const cellTextColor = isHeaderRow ? '#FFFFFF' : textDark;

              // Draw filled row background and boundary border
              doc.rect(tableStartX, startY, 515, rowHeight).fillAndStroke(bgFill, borderCol);

              // Render cell contents
              row.forEach((cellText, colIdx) => {
                const cellX = tableStartX + colIdx * colWidth + 6;
                const cellY = startY + 4;

                const savedX = doc.x;

                doc.fillColor(cellTextColor).fontSize(8);
                if (isHeaderRow) setFont('Helvetica-Bold');
                else setFont('Helvetica');

                renderTextWithBold(doc, cellText, cellX, cellY, {
                  width: innerWidth,
                  align: 'left',
                });

                doc.x = savedX;
              });

              doc.y = startY + rowHeight;
              doc.x = tableStartX; // Reset X position
            }
          }
          doc.moveDown(0.3);
          continue;
        }

        // Blockquote Block (> Quote text)
        if (block.startsWith('>')) {
          doc.moveDown(0.2);
          const rawLines = block.split('\n');
          const cleanQuote = rawLines.map((l) => l.replace(/^>\s*/, '').trim()).join(' ');

          const quoteStartX = 40; // Ensure consistent left margin
          const startY = doc.y;

          setFont('Helvetica-Oblique');
          doc.fontSize(8.5);
          const quoteHeight = doc.heightOfString(cleanQuote, { width: 495 });

          // Draw rounded quote callout container
          doc.fillColor(lightBg).roundedRect(quoteStartX, startY, 515, quoteHeight + 8, 3).fill();
          // Accent left bar
          doc.fillColor(brandColor).rect(quoteStartX, startY, 4, quoteHeight + 8).fill();

          // Draw quote text
          doc.fillColor(textDark);
          renderTextWithBold(doc, cleanQuote, quoteStartX + 12, startY + 4, {
            width: 495,
          });

          doc.y = startY + quoteHeight + 12;
          doc.x = quoteStartX; // Reset X position
          doc.moveDown(0.2);
          continue;
        }

        // Unordered List (- List item) or Checked List Item (☑ Item)
        const lines = block.split('\n');
        let isList = false;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Checkbox Items (☑ or ☐)
          const isChecked = trimmedLine.startsWith('☑') || trimmedLine.startsWith('[x]') || trimmedLine.startsWith('[X]');
          const isUnchecked = trimmedLine.startsWith('☐') || trimmedLine.startsWith('[ ]');

          if (isChecked || isUnchecked) {
            isList = true;
            if (doc.y > 760) {
              doc.addPage();
            }

            const listStartX = 40; // Ensure consistent left margin
            const checkboxX = listStartX;
            const checkboxY = doc.y;

            // Draw checkbox square with rounded corners
            doc.strokeColor(brandColor).lineWidth(1);
            doc.roundedRect(checkboxX, checkboxY + 1.5, 9, 9, 1.5).stroke();

            if (isChecked) {
              // Draw filled checkbox background
              doc.fillColor(brandColor).roundedRect(checkboxX + 1, checkboxY + 2.5, 7, 7, 1).fill();
              // Draw white checkmark lines
              doc.strokeColor('#FFFFFF').lineWidth(1.2);
              doc.moveTo(checkboxX + 2.8, checkboxY + 6)
                 .lineTo(checkboxX + 4.5, checkboxY + 7.7)
                 .lineTo(checkboxX + 7.2, checkboxY + 4.2)
                 .stroke();
            }

            // Draw option text
            const cleanedText = trimmedLine.replace(/^[☑☐]|\[[ xX]\]/, '').trim();
            doc.fillColor(textDark).fontSize(8.5);
            doc.x = checkboxX + 15;
            renderTextWithBold(doc, cleanedText, doc.x, doc.y, {
              width: 500,
            });
            doc.y += 4;
            doc.x = listStartX; // Reset X position
            continue;
          }

          // Unordered Bullet List Item
          if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            isList = true;
            if (doc.y > 760) {
              doc.addPage();
            }

            const listStartX = 40; // Ensure consistent left margin
            const bulletY = doc.y;

            // Draw circular vector bullet point
            doc.fillColor(brandColor);
            doc.circle(listStartX + 8, bulletY + 5.5, 2.2).fill();

            const cleanedText = trimmedLine.replace(/^[-*]\s+/, '').trim();
            doc.fillColor(textDark);
            doc.x = listStartX + 15;
            renderTextWithBold(doc, cleanedText, doc.x, doc.y, {
              width: 500,
            });
            doc.y += 2;
            doc.x = listStartX; // Reset X position
            continue;
          }

          // Numbered List Item
          const numMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
          if (numMatch) {
            isList = true;
            if (doc.y > 760) {
              doc.addPage();
            }

            const listStartX = 40; // Ensure consistent left margin
            const listY = doc.y;
            const num = numMatch[1];
            const cleanedText = numMatch[2].trim();

            doc.fillColor(brandColor).fontSize(8.5);
            setFont('Helvetica-Bold');
            doc.text(`${num}.`, listStartX, listY);

            doc.fillColor(textDark);
            doc.x = listStartX + 18;
            renderTextWithBold(doc, cleanedText, doc.x, doc.y, {
              width: 497,
            });
            doc.y += 2;
            doc.x = listStartX; // Reset X position
            continue;
          }

          // Fallback line inside block: treat as standard text line
          if (doc.y > 760) {
            doc.addPage();
          }
          const listStartX = 40;
          doc.fillColor(textDark).fontSize(8.5);
          renderTextWithBold(doc, trimmedLine, listStartX, doc.y, {
            width: 515,
          });
          doc.x = listStartX;
          doc.moveDown(0.15);
        }

        if (isList) {
          doc.moveDown(0.2);
        } else {
          doc.moveDown(0.25);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Preserve the existing Word to PDF conversion signature, routing to
 * convertMdToPdf internally or keeping it as is.
 */
export async function convertFilledDocxToPdf(
  docxBuffer: Buffer,
  documentTitle: string,
  candidate: CandidateRow
): Promise<Buffer> {
  // Pure JS fast engine: Mammoth + PDFKit (fallback option for DOCX files)
  const mammoth = require('mammoth');
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
          doc.font('Helvetica');
        }
      };

      const renderHeaderBanner = () => {
        setFont('Helvetica-Bold');
        doc.fontSize(11);
        const titleText = documentTitle.toUpperCase();
        const titleHeight = doc.heightOfString(titleText, { width: 515 });

        setFont('Helvetica');
        doc.fontSize(8.5);
        const subTitleText = `${candidate.organisme} — ${candidate.code_certif} ${candidate.formation}`;
        const subHeight = doc.heightOfString(subTitleText, { width: 515 });

        const bannerHeight = Math.max(54, titleHeight + subHeight + 18);

        doc.rect(0, 0, 595.28, bannerHeight).fill(brandColor);

        doc.fillColor('#FFFFFF');
        setFont('Helvetica-Bold');
        doc.fontSize(11);
        doc.text(titleText, 40, 10, { width: 515, align: 'left' });

        setFont('Helvetica');
        doc.fontSize(8.5);
        doc.text(subTitleText, 40, 12 + titleHeight, { width: 515, align: 'left' });

        doc.y = bannerHeight + 15;
      };

      renderHeaderBanner();

      const cleanHtmlText = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/[“„”«»]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/ð/g, '')
          .replace(/\s+([A-D][\)\.:])\s+/g, '\n   • $1 ')
          .trim();
      };

      const blocks = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<p[^>]*>[\s\S]*?<\/p>|<table[^>]*>[\s\S]*?<\/table>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>/gi) || [html];

      for (const block of blocks) {
        if (doc.y > 740) {
          doc.addPage();
          renderHeaderBanner();
        }

        const textContent = cleanHtmlText(block.replace(/<[^>]+>/g, ''));
        if (!textContent) continue;

        if (/^<h1/i.test(block)) {
          doc.moveDown(0.4);
          doc.fillColor(brandColor).fontSize(13);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.2);
        } else if (/^<h2/i.test(block)) {
          doc.moveDown(0.3);
          doc.fillColor(brandColor).fontSize(11.5);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.2);
        } else if (/^<h3/i.test(block)) {
          doc.moveDown(0.2);
          doc.fillColor('#1E293B').fontSize(10.5);
          setFont('Helvetica-Bold');
          doc.text(textContent);
          doc.moveDown(0.15);
        } else if (/^<table/i.test(block)) {
          doc.moveDown(0.3);
          const rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
          for (const row of rows) {
            const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>|<th[^>]*>[\s\S]*?<\/th>/gi) || []).map((c: string) =>
              cleanHtmlText(c.replace(/<[^>]+>/g, ''))
            );

            if (cells.length > 0) {
              const cellWidth = Math.floor(515 / Math.max(1, cells.length));
              const innerWidth = cellWidth - 10;

              setFont('Helvetica');
              doc.fontSize(8.5);
              let maxCellHeight = 14;
              for (const cellText of cells) {
                const textH = doc.heightOfString(cellText || ' ', { width: innerWidth });
                if (textH > maxCellHeight) maxCellHeight = textH;
              }

              const rowHeight = maxCellHeight + 8;

              if (doc.y + rowHeight > 740) {
                doc.addPage();
                renderHeaderBanner();
              }

              const startX = 40;
              const startY = doc.y;

              const isHeaderRow = row.toLowerCase().includes('<th');
              const fillBg = isHeaderRow ? brandColor : lightBg;
              const textColor = isHeaderRow ? '#FFFFFF' : '#0F172A';

              doc.rect(startX, startY, 515, rowHeight).fillAndStroke(fillBg, '#CBD5E1');

              cells.forEach((cellText: string, colIdx: number) => {
                doc.fillColor(textColor).fontSize(8.5);
                if (isHeaderRow) setFont('Helvetica-Bold');
                else setFont('Helvetica');

                doc.text(cellText, startX + colIdx * cellWidth + 5, startY + 4, {
                  width: innerWidth,
                  align: 'left',
                });
              });
              doc.y = startY + rowHeight;
            }
          }
          doc.moveDown(0.3);
        } else {
          doc.fillColor('#334155').fontSize(9);
          if (/<strong>|<b>/i.test(block)) setFont('Helvetica-Bold');
          else setFont('Helvetica');

          const lines = textContent.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            if (doc.y > 740) {
              doc.addPage();
              renderHeaderBanner();
            }
            doc.text(line, { width: 515, align: 'left' });
            doc.moveDown(0.15);
          }
          doc.moveDown(0.2);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Native PDF converter fallback (kept for compatibility) */
export async function convertFilledDocxToPdfNative(
  docxBuffer: Buffer
): Promise<Buffer | null> {
  const { execSync } = require('child_process');
  if (process.platform !== 'win32') return null;

  const tempDir = path.join(process.cwd(), '.next', 'cache', 'pdf-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const id = Math.random().toString(36).substring(2, 9);
  const tempDocx = path.join(tempDir, `input_${id}.docx`);
  const tempPdf = path.join(tempDir, `output_${id}.pdf`);
  const tempPs1 = path.join(tempDir, `script_${id}.ps1`);

  try {
    fs.writeFileSync(tempDocx, docxBuffer);

    const psScript = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$docx = [System.IO.Path]::GetFullPath("${tempDocx.replace(/\\/g, '/')}")
$pdf = [System.IO.Path]::GetFullPath("${tempPdf.replace(/\\/g, '/')}")
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open($docx)
$doc.ExportAsFixedFormat($pdf, 17)
$doc.Close(0)
$word.Quit()
`;

    fs.writeFileSync(tempPs1, '\uFEFF' + psScript, 'utf8');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, {
      stdio: 'pipe',
      timeout: 25000,
    });

    if (fs.existsSync(tempPdf)) {
      const pdfBuffer = fs.readFileSync(tempPdf);
      return pdfBuffer;
    }
  } catch (err) {
    console.warn('Native Word PDF conversion fallback triggered:', err);
  } finally {
    try {
      if (fs.existsSync(tempDocx)) fs.unlinkSync(tempDocx);
      if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
      if (fs.existsSync(tempPs1)) fs.unlinkSync(tempPs1);
    } catch {}
  }
  return null;
}
