import { logGenerationToDb } from '@/lib/db';
import { generateCandidateDocuments } from '@/lib/docx-engine';
import { CandidateRow, GenerationLog } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

// Generation calls Claude + optional PDF conversion; needs more than the 10s default.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate, apiKey }: { candidate: CandidateRow; apiKey?: string } = body;

    if (!candidate) {
      return NextResponse.json({ error: 'Données candidat manquantes' }, { status: 400 });
    }

    const isEligible =
      candidate.pret_pour_generation ||
      candidate.pret_generation_classique ||
      candidate.pret_generation_wedof ||
      candidate.generer_maintenant ||
      candidate.generer_maintenant_classique ||
      candidate.generer_maintenant_wedof;

    if (!isEligible) {
      return NextResponse.json(
        { error: "Le candidat n\u2019a pas au moins un mode de g\u00e9n\u00e9ration pr\u00eat (Classique ou WeDOF)." },
        { status: 400 }
      );
    }

    const { files, evalResult, warnings } = await generateCandidateDocuments(candidate, apiKey);

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

    // Log generation to Neon PostgreSQL
    logGenerationToDb(logEntry).catch((dbErr) =>
      console.warn('Neon DB log warning:', dbErr)
    );

    const fillStats = {
      documents: files.filter((f) => f.filename.endsWith('.docx')).length,
      pdfs: files.filter((f) => f.filename.endsWith('.pdf')).length,
      checkboxesChecked: files.reduce(
        (a, f) => a + (f.fillReport?.checkboxesChecked || 0),
        0
      ),
      fieldsFilled: files.reduce((a, f) => a + (f.fillReport?.fieldsFilled || 0), 0),
      aiFilledDocs: files.filter((f) => f.fillReport?.usedAi).length,
    };

    // Collect PDF-specific errors from fill reports
    const pdfErrors = files
      .filter((f) => f.fillReport?.pdfError)
      .map((f) => ({ file: f.filename, reason: f.fillReport!.pdfError! }));

    return NextResponse.json({
      success: true,
      log: logEntry,
      evalResult,
      producedCount: files.length,
      fillStats,
      warnings: warnings || [],
      pdfErrors,
      filesSummary: files.map((f) => ({
        filename: f.filename,
        relativePath: f.relativePath,
        category: f.category,
        sizeBytes: f.buffer.length,
        fillReport: f.fillReport,
      })),
    });
  } catch (err: any) {
    console.error('Error generating documents:', err);
    const message: string = err?.message || 'Erreur lors de la génération des documents.';
    const isClaudeError = message.startsWith('[Claude AI]');
    return NextResponse.json(
      {
        error: message,
        errorType: isClaudeError ? 'claude_api' : 'generation',
      },
      { status: 500 }
    );
  }
}
