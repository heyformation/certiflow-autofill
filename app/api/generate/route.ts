import { generateCandidateDocuments } from '@/lib/docx-engine';
import { CandidateRow, GenerationLog } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate, apiKey }: { candidate: CandidateRow; apiKey?: string } = body;

    if (!candidate) {
      return NextResponse.json({ error: 'Données candidat manquantes' }, { status: 400 });
    }

    if (!candidate.pret_pour_generation && !candidate.generer_maintenant) {
      return NextResponse.json(
        { error: 'Le candidat n’a pas tous les champs requis remplis.' },
        { status: 400 }
      );
    }

    const { files, evalResult } = await generateCandidateDocuments(candidate, apiKey);

    const logEntry: GenerationLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      candidateId: candidate.id,
      candidateName: `${candidate.prenom} ${candidate.nom}`,
      certification: candidate.formation,
      organisme: candidate.organisme,
      documentsProduced: files.map((f) => f.filename),
      status: 'SUCCESS',
    };

    return NextResponse.json({
      success: true,
      log: logEntry,
      evalResult,
      producedCount: files.length,
      filesSummary: files.map((f) => ({
        filename: f.filename,
        relativePath: f.relativePath,
        category: f.category,
        sizeBytes: f.buffer.length,
      })),
    });
  } catch (err: any) {
    console.error('Error generating documents:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors de la génération des documents.' },
      { status: 500 }
    );
  }
}
