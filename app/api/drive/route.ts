import { generateCandidateDocuments } from '@/lib/docx-engine';
import { uploadFileToGoogleDrive } from '@/lib/google-drive';
import { CandidateRow } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

// Generation + Drive upload of the full document set; allow a long duration.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate, apiKey }: { candidate: CandidateRow; apiKey?: string } = body;

    if (!candidate) {
      return NextResponse.json({ error: 'Candidat manquant.' }, { status: 400 });
    }

    const { files } = await generateCandidateDocuments(candidate, apiKey);

    const uploadedFiles = [];
    for (const file of files) {
      try {
        const driveRes = await uploadFileToGoogleDrive({
          filename: file.filename,
          folderPath: file.relativePath,
          buffer: file.buffer,
        });
        uploadedFiles.push(driveRes);
      } catch (uploadErr: any) {
        if (uploadErr.message?.includes('storage quota') || uploadErr.message?.includes('403')) {
          throw new Error(
            `Le dossier Google Drive n'est pas encore partagé avec le robot. Veuillez partager le dossier avec certiflow-drive@certiflow-drive-integrator.iam.gserviceaccount.com (Rôle : Éditeur).`
          );
        }
        throw uploadErr;
      }
    }

    return NextResponse.json({
      success: true,
      count: uploadedFiles.length,
      uploadedFiles,
    });
  } catch (err: any) {
    console.error('Google Drive Sync Error:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors de la synchronisation vers Google Drive.' },
      { status: 500 }
    );
  }
}
