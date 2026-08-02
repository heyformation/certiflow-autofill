/**
 * pdf-converter-word.ts
 * -------------------------------------------------------------
 * Direct DOCX -> PDF conversion using Microsoft Word via COM automation
 * 
 * This works on Windows with Microsoft Office installed.
 * 100% FREE - uses your existing Word installation.
 * 
 * Usage:
 *   import { convertDocxToPdfWord } from './pdf-converter-word';
 *   const pdfBuffer = await convertDocxToPdfWord(docxBuffer, 'document.docx');
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if Microsoft Word is available (Windows only)
 */
export function isWordAvailable(): boolean {
  return process.platform === 'win32';
}

/**
 * Convert a DOCX buffer to a PDF buffer using Microsoft Word
 * Returns null if conversion fails or is not available
 */
export async function convertDocxToPdfWord(
  docxBuffer: Buffer,
  filename: string
): Promise<Buffer | null> {
  if (!isWordAvailable()) {
    console.warn('Word PDF conversion only works on Windows');
    return null;
  }

  const tempDir = os.tmpdir();
  const docxPath = path.join(tempDir, `temp_${Date.now()}_${filename}`);
  const pdfPath = docxPath.replace('.docx', '.pdf');

  try {
    console.log(`Converting ${filename} to PDF using Microsoft Word...`);
    
    // Write DOCX to temp file
    fs.writeFileSync(docxPath, docxBuffer);

    // PowerShell script to convert using Word COM
    const psScript = `
      $Word = New-Object -ComObject Word.Application
      $Word.Visible = $false
      $Doc = $Word.Documents.Open('${docxPath.replace(/\\/g, '\\\\')}')
      $pdfPath = '${pdfPath.replace(/\\/g, '\\\\')}'
      $Doc.SaveAs([ref]$pdfPath, [ref]17)
      $Doc.Close()
      $Word.Quit()
      [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Word) | Out-Null
      [System.GC]::Collect()
      [System.GC]::WaitForPendingFinalizers()
    `;

    // Execute PowerShell script
    await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, {
      timeout: 30000, // 30 second timeout
    });

    // Read PDF buffer
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Cleanup temp files
      try {
        fs.unlinkSync(docxPath);
        fs.unlinkSync(pdfPath);
      } catch (err) {
        // Ignore cleanup errors
      }

      console.log(`✓ Successfully converted ${filename} to PDF (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    }

    return null;

  } catch (err: any) {
    console.error(`Failed to convert ${filename} to PDF using Word:`, err.message);
    
    // Cleanup on error
    try {
      if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    return null;
  }
}
