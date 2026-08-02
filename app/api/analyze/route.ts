import { analyzeExcelSheetData } from '@/lib/claude-engine';
import { CandidateRow } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

// Calls Claude for sheet analysis; allow more than the 10s default.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidates, apiKey }: { candidates: CandidateRow[]; apiKey?: string } = body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Aucune donnée candidat disponible pour analyse.' }, { status: 400 });
    }

    const analysis = await analyzeExcelSheetData(candidates, apiKey);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error('Error analyzing Excel sheet with Anthropic AI:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors de l’analyse IA du fichier EDOF.' },
      { status: 500 }
    );
  }
}
