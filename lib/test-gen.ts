import path from 'path';
import fs from 'fs';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}

import { getDbPool } from './db';
import { getAvailableTemplates, buildCanonicalInput } from './certiflow-engine';
import { populateDocx } from './certiflow-engine';
import { generateCandidateEvaluation } from './claude-engine';

async function main() {
  const pool = getDbPool()!;
  const result = await pool.query(
    `SELECT * FROM candidates WHERE nom ILIKE '%BOGGIO%' OR nom ILIKE '%MAECHA%' LIMIT 1`
  );

  if (result.rows.length === 0) {
    console.log('No candidate found. Trying any candidate...');
    const any = await pool.query('SELECT * FROM candidates LIMIT 1');
    if (any.rows.length === 0) {
      console.error('No candidates in DB.');
      process.exit(1);
    }
    result.rows.push(any.rows[0]);
  }

  const candidate = result.rows[0] as any;
  console.log(`\n=== Testing generation for: ${candidate.prenom} ${candidate.nom} (${candidate.code_certif}) ===\n`);

  // 1. Get templates
  const templates = getAvailableTemplates(candidate.organisme, candidate.code_certif);
  console.log(`Found ${templates.length} templates`);

  if (templates.length === 0) {
    console.error('No templates found. Check organisme/code_certif match.');
    await pool.end();
    return;
  }

  // 2. Build evaluation (skip Claude to avoid costs)
  const mockEval = {
    testPositionnement: { totalScore: 16, scorePercentage: 80 },
    grilleEvaluation: {
      totalScore60: 48,
      convertedScore20: 16,
      presidentAppreciation: 'Candidat sérieux avec une bonne maîtrise des compétences clés.',
    },
    themeProfiles: [
      { themeId: '1', themeTitle: 'Gestion Administrative', level: 4 },
      { themeId: '2', themeTitle: 'Comptabilité', level: 4 },
      { themeId: '3', themeTitle: 'Fiscalité', level: 3 },
    ],
    competencies: [
      { title: 'Documents comptables', appreciation: 'Bonne maîtrise' },
      { title: 'Déclarations fiscales', appreciation: 'Maîtrise satisfaisante' },
      { title: 'Suivi de trésorerie', appreciation: 'Compétences solides' },
      { title: 'Analyse financière', appreciation: 'Résultats probants' },
    ],
    additionalAiTexts: {
      projetSummary: 'Développement des compétences comptables de la TPE.',
      parcoursSummary: 'Dirigeant de TPE avec expérience en gestion opérationnelle.',
    },
  } as any;

  // 3. Build canonical input
  const canonicalData = buildCanonicalInput(candidate, mockEval);

  // Quick sanity checks
  const candidateName = `${candidate.prenom} ${candidate.nom}`.trim();
  const stagiaire = canonicalData.candidate.questionnaire.responses.fiche_eligibilite?.stagiaire;
  console.log(`\nSanity checks:`);
  console.log(`  stagiaire header: "${stagiaire}" (expected: "${candidateName}")`);
  console.log(`  jury.members:`, JSON.stringify(canonicalData.jury.members));
  console.log(`  jury.members_formatted: "${canonicalData.jury.members_formatted}"`);
  console.log(`  evaluation.result: "${canonicalData.evaluation.result}"`);

  const outDir = path.resolve(process.cwd(), 'output_test');
  fs.mkdirSync(outDir, { recursive: true });

  // 4. Process first template
  const tmpl = templates[0];
  console.log(`\nProcessing template: ${tmpl.filename}`);
  const mappingContent = JSON.parse(fs.readFileSync(tmpl.mappingPath, 'utf-8'));
  const templateBuffer = fs.readFileSync(tmpl.templatePath);

  const { bytes, qa } = populateDocx(templateBuffer, mappingContent, canonicalData);

  const outFile = path.join(outDir, tmpl.filename.replace(/Template/, 'FILLED'));
  fs.writeFileSync(outFile, bytes);

  console.log(`\nFill Report:`);
  console.log(`  Populated: ${qa.populatedFields} / ${mappingContent.fields?.length || '?'} fields`);
  console.log(`  Missing required: ${qa.missingRequired.length ? qa.missingRequired.join(', ') : 'none'}`);
  if (qa.errors.length) {
    console.log(`  Errors (${qa.errors.length}):`);
    qa.errors.slice(0, 5).forEach((e: string) => console.log(`    - ${e}`));
    if (qa.errors.length > 5) console.log(`    ... and ${qa.errors.length - 5} more`);
  } else {
    console.log(`  No errors!`);
  }
  console.log(`\nOutput: ${outFile} (${(bytes.length / 1024).toFixed(1)} KB)`);

  await pool.end();
}

main().catch(console.error);
