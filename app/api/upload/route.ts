import { saveCandidatesToDb } from '@/lib/db';
import { parseEdofExcelBuffer } from '@/lib/edof-parser';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier Excel n’a été fourni.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const candidates = parseEdofExcelBuffer(buffer);

    // Persist parsed candidates into Neon PostgreSQL
    saveCandidatesToDb(candidates).catch((dbErr) =>
      console.warn('Neon DB persistence background warning:', dbErr)
    );

    return NextResponse.json({
      success: true,
      totalRows: candidates.length,
      readyCount: candidates.filter((c) => c.pret_pour_generation).length,
      readyClassiqueCount: candidates.filter((c) => c.pret_generation_classique).length,
      readyWedofCount: candidates.filter((c) => c.pret_generation_wedof).length,
      candidates,
    });
  } catch (err: any) {
    console.error('Error parsing EDOF Excel upload:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors du traitement du fichier EDOF.xlsx' },
      { status: 500 }
    );
  }
}
