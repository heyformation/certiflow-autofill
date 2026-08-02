import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PizZip from 'pizzip';
import { buildCanonicalInput, populateDocx } from './certiflow-engine';
import { CandidateRow, CandidateEvaluationResult } from './types';

const TEMPLATES_ROOT = path.resolve(process.cwd(), 'templates');
const MAP_DIR = path.join(TEMPLATES_ROOT, 'mappings');
const FINAL_DIR = path.join(TEMPLATES_ROOT, 'final-templates');

const PARA_REGEX = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const TEXT_REGEX = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function getParaText(pXml: string): string {
  return [...pXml.matchAll(TEXT_REGEX)].map(m => m[1]).join('');
}

function findFiles(dir: string, ext: string): string[] {
  let res: string[] = [];
  if (!fs.existsSync(dir)) return res;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      res = res.concat(findFiles(full, ext));
    } else if (f.endsWith(ext)) {
      res.push(full);
    }
  }
  return res;
}

const mockCandidate: CandidateRow = {
  id: 'cand-test-1',
  nom: 'Dupont',
  prenom: 'Jean',
  civilite: 'M.',
  organisme: 'Proskills Institut',
  formation: 'Développer son activité TPE avec l\'IA',
  code_certif: 'RS7311',
  dates_session: '01/03/2026 au 15/03/2026',
  date_debut_session: '2026-03-01',
  date_fin_session: '2026-03-15',
  date_examen: '2026-03-15',
  adresse: '10 Rue de la Paix',
  adresse_postale: '10 Rue de la Paix 75002 Paris',
  mail: 'jean.dupont@example.com',
  numero_tel: '0612345678',
  date_naissance: '1985-05-20',
  experience_pro: 'Gérant de TPE depuis 8 ans',
  pret_generation_classique: true,
  pret_generation_wedof: true,
  generer_maintenant_classique: true,
  generer_maintenant_wedof: true,
  pret_pour_generation: true,
  generer_maintenant: true,
  missing_fields: [],
};

const mockEvalResult: CandidateEvaluationResult = {
  themeProfiles: [{ themeId: '1', themeTitle: 'Besoins TPE & IA', level: 4 }],
  testPositionnement: { totalScore: 16, scorePercentage: 80 },
  grilleEvaluation: { totalScore60: 48, convertedScore20: 16, juryMention: 'ADMIS', presidentAppreciation: 'Très bon dossier et très bonne prestation orale.' },
  competencies: [
    { id: 'C1', title: 'Analyser les besoins', score: 12, maxScore: 15, appreciation: 'Très bien' },
    { id: 'C2', title: 'Mettre en place l\'IA', score: 12, maxScore: 15, appreciation: 'Bien' },
  ],
};

console.log('=== RUNNING COVERAGE & FILL VERIFICATION ===\n');

const mappingFiles = findFiles(MAP_DIR, '.mapping.json');
let unmappedCount = 0;
let emptyFillCount = 0;

for (const mapFile of mappingFiles) {
  const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
  const templateName = path.basename(mapping.template_path || '');
  
  // Find docx
  const allDocs = findFiles(FINAL_DIR, '.docx');
  const docxFile = allDocs.find(d => path.basename(d) === templateName);
  
  if (!docxFile) continue;
  
  const zip = new PizZip(fs.readFileSync(docxFile));
  const docXml = zip.file('word/document.xml')?.asText() || '';
  const paragraphs = [...docXml.matchAll(PARA_REGEX)].map(m => m[0]);
  
  // Check unmapped placeholder-like paragraphs
  const mappedIndices = new Set<number>();
  for (const f of mapping.fields) {
    if (f.target?.location?.paragraph_index !== undefined) {
      mappedIndices.add(f.target.location.paragraph_index);
    }
  }
  
  paragraphs.forEach((pXml, idx) => {
    const text = getParaText(pXml).trim();
    if (!text) return;
    if ((text.includes('[') && text.includes(']')) || (text.includes('//') && text.includes('//'))) {
      if (!mappedIndices.has(idx)) {
        console.log(`[UNMAPPED PLACEHOLDER] ${path.basename(mapFile)} | Para ${idx}: "${text.slice(0, 60)}"`);
        unmappedCount++;
      }
    }
  });

  // Check empty fills
  const canonicalData = buildCanonicalInput(mockCandidate, mockEvalResult);
  try {
    const { qa } = populateDocx(fs.readFileSync(docxFile), mapping, canonicalData);
    if (qa.missingRequired.length > 0) {
      console.log(`[EMPTY REQUIRED] ${path.basename(mapFile)}: missing ${qa.missingRequired.join(', ')}`);
      emptyFillCount += qa.missingRequired.length;
    }
  } catch (err: any) {
    console.log(`[ERROR POPULATING] ${path.basename(mapFile)}: ${err.message}`);
  }
}

console.log(`\nVerification Complete.`);
console.log(`Unmapped placeholders: ${unmappedCount}`);
console.log(`Empty required fills: ${emptyFillCount}`);
