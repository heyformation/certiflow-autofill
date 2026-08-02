/**
 * pdf-converter.ts
 * -------------------------------------------------------------
 * DOCX -> PDF conversion for a Vercel serverless deployment.
 *
 * Strategy:
 * 1. Try Microsoft Word (Windows only, 100% FREE)
 * 2. Try local conversion using libreoffice-convert (works in dev/local)
 * 3. Fall back to CloudConvert API (works on Vercel/production)
 * 4. If all fail, return null and deliver DOCX only
 *
 * Configuration (env vars, never committed):
 *   CLOUDCONVERT_API_KEY  - CloudConvert API token (optional).
 *   PDF_CONVERSION        - "off" to globally disable PDF conversion.
 */

import { convertDocxToPdfLocal, isLocalPdfAvailable } from './pdf-converter-local';
import { convertDocxToPdfWord, isWordAvailable } from './pdf-converter-word';

const CLOUDCONVERT_BASE = 'https://api.cloudconvert.com/v2';

export function isPdfConversionEnabled(): boolean {
  if (process.env.PDF_CONVERSION === 'off') return false;
  // Enable if any method is available
  return isWordAvailable() || isLocalPdfAvailable() || Boolean(process.env.CLOUDCONVERT_API_KEY);
}

/**
 * Convert a DOCX buffer to a PDF buffer. Returns null if conversion is disabled
 * or fails for any reason (caller should fall back to the DOCX).
 * 
 * Tries methods in order: Word (fastest) → LibreOffice → CloudConvert
 */
export async function convertDocxToPdf(
  docxBuffer: Buffer,
  filename: string
): Promise<Buffer | null> {
  if (process.env.PDF_CONVERSION === 'off') return null;

  // Try Microsoft Word first (Windows only, 100% FREE)
  if (isWordAvailable()) {
    console.log('Using Microsoft Word for PDF conversion...');
    const wordPdf = await convertDocxToPdfWord(docxBuffer, filename);
    if (wordPdf) {
      console.log('✓ Word PDF conversion successful');
      return wordPdf;
    }
    console.warn('Word PDF conversion failed, trying LibreOffice...');
  }

  // Try LibreOffice conversion (if available)
  if (isLocalPdfAvailable()) {
    console.log('Using local LibreOffice conversion...');
    const localPdf = await convertDocxToPdfLocal(docxBuffer, filename);
    if (localPdf) {
      console.log('✓ Local PDF conversion successful');
      return localPdf;
    }
    console.warn('Local PDF conversion failed, trying CloudConvert...');
  }

  // Fall back to CloudConvert API
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    console.log('No CloudConvert API key, PDF conversion disabled');
    return null;
  }

  return convertViaCloudConvert(docxBuffer, filename, apiKey);
}

async function convertViaCloudConvert(
  docxBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<Buffer | null> {
  try {
    console.log('Using CloudConvert API for PDF conversion...');
    
    // 1. Create a job: import (base64) -> convert -> export url.
    const jobRes = await fetch(`${CLOUDCONVERT_BASE}/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/base64',
            file: docxBuffer.toString('base64'),
            filename,
          },
          'convert-file': {
            operation: 'convert',
            input: 'import-file',
            input_format: 'docx',
            output_format: 'pdf',
          },
          'export-file': {
            operation: 'export/url',
            input: 'convert-file',
          },
        },
      }),
    });

    if (!jobRes.ok) {
      console.warn('CloudConvert job creation failed:', jobRes.status);
      return null;
    }

    const job = await jobRes.json();
    const jobId: string = job?.data?.id;
    if (!jobId) return null;

    // 2. Poll the job until finished (bounded, to respect function timeout).
    const exportTask = await waitForExportTask(apiKey, jobId);
    if (!exportTask) return null;

    const fileUrl: string | undefined = exportTask?.result?.files?.[0]?.url;
    if (!fileUrl) return null;

    // 3. Download the produced PDF.
    const pdfRes = await fetch(fileUrl);
    if (!pdfRes.ok) return null;
    const arrayBuf = await pdfRes.arrayBuffer();
    
    console.log('✓ CloudConvert PDF conversion successful');
    return Buffer.from(arrayBuf);
  } catch (err) {
    console.warn('CloudConvert DOCX->PDF conversion error, falling back to DOCX:', err);
    return null;
  }
}

async function waitForExportTask(
  apiKey: string,
  jobId: string,
  maxAttempts = 20,
  intervalMs = 1500
): Promise<any | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${CLOUDCONVERT_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const status: string = data?.data?.status;
    const tasks: any[] = data?.data?.tasks || [];
    const exportTask = tasks.find((t) => t.operation === 'export/url');

    if (status === 'error') return null;
    if (exportTask && exportTask.status === 'finished') return exportTask;

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
