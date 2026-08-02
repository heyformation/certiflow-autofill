import { generateCandidateDocuments } from '@/lib/docx-engine';
import { CandidateRow } from '@/lib/types';
import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';

// Batch generation of multiple candidates; allow a long duration.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidates, apiKey }: { candidates: CandidateRow[]; apiKey?: string } = body;

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: 'Aucun candidat sélectionné.' }, { status: 400 });
    }

    const zip = new JSZip();

    for (const candidate of candidates) {
      const { files } = await generateCandidateDocuments(candidate, apiKey);
      // Filter for filled PDF files (.pdf) as requested by user
      const pdfFiles = files.filter((f) => f.filename.toLowerCase().endsWith('.pdf'));
      const filesToPack = pdfFiles.length > 0 ? pdfFiles : files;

      for (const file of filesToPack) {
        // Use relativePath directly without extra prefix
        zip.file(file.relativePath, file.buffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const base64Zip = zipBuffer.toString('base64');

    const zipFileName =
      candidates.length === 1
        ? `Documents_${candidates[0].nom}_${candidates[0].code_certif}.zip`
        : `Dossiers_Certification_Generation_${Date.now()}.zip`;

    return NextResponse.json({
      success: true,
      filename: zipFileName,
      base64Zip,
      sizeBytes: zipBuffer.length,
    });
  } catch (err: any) {
    console.error('Error generating download ZIP package:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors de la préparation du fichier ZIP.' },
      { status: 500 }
    );
  }
}
