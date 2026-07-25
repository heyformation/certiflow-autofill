import { getCandidatesFromDb } from '@/lib/db';
import { parseEdofExcelBuffer } from '@/lib/edof-parser';
import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET() {
  try {
    // First try querying Neon PostgreSQL database
    let candidates = await getCandidatesFromDb();

    // Fallback to local EDOF file if DB is empty or unpopulated
    if (!candidates || candidates.length === 0) {
      const filePath = path.join(process.cwd(), 'Developer of EDOF_restructure_v9.xlsx');
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        candidates = parseEdofExcelBuffer(buffer);
      }
    }

    const counts = {
      RS6485: candidates.filter((c) => c.code_certif === 'RS6485').length,
      RS7200: candidates.filter((c) => c.code_certif === 'RS7200').length,
      RS7311: candidates.filter((c) => c.code_certif === 'RS7311').length,
      RS7344: candidates.filter((c) => c.code_certif === 'RS7344').length,
    };

    return NextResponse.json({
      success: true,
      totalRows: candidates.length,
      readyCount: candidates.filter((c) => c.pret_pour_generation).length,
      readyClassiqueCount: candidates.filter((c) => c.pret_generation_classique).length,
      readyWedofCount: candidates.filter((c) => c.pret_generation_wedof).length,
      certificationCounts: counts,
      candidates,
    });
  } catch (err: any) {
    console.error('Error fetching candidates:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors du chargement des candidats.' },
      { status: 500 }
    );
  }
}
