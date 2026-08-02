/**
 * pdf-converter-local.ts
 * -------------------------------------------------------------
 * Direct DOCX -> PDF conversion using libreoffice-convert
 * 
 * This works locally and on servers with LibreOffice installed.
 * For Vercel, you'll need to use the CloudConvert version (pdf-converter.ts)
 * 
 * Usage:
 *   import { convertDocxToPdfLocal } from './pdf-converter-local';
 *   const pdfBuffer = await convertDocxToPdfLocal(docxBuffer, 'document.docx');
 */

import { promisify } from 'util';

let libre: any;
try {
  // Try to load libreoffice-convert (may fail on Vercel)
  libre = require('libreoffice-convert');
} catch (err) {
  console.warn('libreoffice-convert not available, PDF conversion will be disabled');
  libre = null;
}

const convertAsync = libre ? promisify(libre.convert) : null;

/**
 * Check if local PDF conversion is available
 */
export function isLocalPdfAvailable(): boolean {
  return convertAsync !== null;
}

/**
 * Convert a DOCX buffer to a PDF buffer using LibreOffice
 * Returns null if conversion fails or is not available
 */
export async function convertDocxToPdfLocal(
  docxBuffer: Buffer,
  filename: string
): Promise<Buffer | null> {
  if (!convertAsync) {
    console.warn('PDF conversion not available: libreoffice-convert not loaded');
    return null;
  }

  try {
    console.log(`Converting ${filename} to PDF using LibreOffice...`);
    
    const pdfBuffer = await convertAsync(docxBuffer, '.pdf', undefined);
    
    console.log(`✓ Successfully converted ${filename} to PDF (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
    
  } catch (err: any) {
    console.error(`Failed to convert ${filename} to PDF:`, err.message);
    return null;
  }
}

/**
 * Convert multiple DOCX files to PDF
 */
export async function convertMultipleDocxToPdf(
  files: Array<{ buffer: Buffer; filename: string }>
): Promise<Array<{ filename: string; pdfBuffer: Buffer | null }>> {
  const results = [];
  
  for (const file of files) {
    const pdfBuffer = await convertDocxToPdfLocal(file.buffer, file.filename);
    results.push({
      filename: file.filename.replace('.docx', '.pdf'),
      pdfBuffer,
    });
  }
  
  return results;
}
