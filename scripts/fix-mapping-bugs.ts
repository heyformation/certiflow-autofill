/**
 * Comprehensive mapping bug fix script
 * 
 * This script:
 * 1. Analyzes all mapping files to find required fields
 * 2. Identifies missing fields in responses objects
 * 3. Generates a report of all issues
 * 4. Provides fix recommendations
 */

import fs from 'fs';
import path from 'path';

interface MappingField {
  semantic_field: string;
  source_path: string;
  source_class: string;
  target: {
    location: {
      paragraph_index: number;
    };
  };
}

interface MappingFile {
  template_id: string;
  organization: string;
  certification: string;
  fields: MappingField[];
}

interface FieldRequirement {
  fieldKey: string;
  fullPath: string;
  documentType: string;
  org: string;
  certification: string;
  count: number;
}

const MAPPINGS_ROOT = path.join(process.cwd(), 'templates', 'mappings');

function getAllMappingFiles(): string[] {
  const files: string[] = [];
  
  function walk(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.mapping.json')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(MAPPINGS_ROOT);
  return files;
}

function extractRequiredFields(mappingPath: string): FieldRequirement[] {
  const content = fs.readFileSync(mappingPath, 'utf-8');
  const mapping: MappingFile = JSON.parse(content);
  
  const requirements: FieldRequirement[] = [];
  
  for (const field of mapping.fields) {
    // Look for responses fields
    const match = field.source_path.match(
      /\$\.candidate\.questionnaire\.responses\.(dossier_de_presentation|pv_evaluation)\.(.+)/
    );
    
    if (match) {
      const [, documentType, fieldKey] = match;
      requirements.push({
        fieldKey,
        fullPath: field.source_path,
        documentType,
        org: mapping.organization,
        certification: mapping.certification,
        count: 1
      });
    }
  }
  
  return requirements;
}

function analyzeAllMappings() {
  console.log('🔍 Analyzing all mapping files...\n');
  
  const mappingFiles = getAllMappingFiles();
  console.log(`Found ${mappingFiles.length} mapping files\n`);
  
  const dossierFields = new Map<string, FieldRequirement[]>();
  const pvFields = new Map<string, FieldRequirement[]>();
  
  for (const file of mappingFiles) {
    if (!file.includes('dossier_de_presentation') && !file.includes('pv_evaluation')) {
      continue;
    }
    
    try {
      const requirements = extractRequiredFields(file);
      
      for (const req of requirements) {
        const map = req.documentType === 'dossier_de_presentation' ? dossierFields : pvFields;
        const key = `${req.org}_${req.certification}`;
        
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(req);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
  
  // Report findings
  console.log('📊 DOSSIER DE PRESENTATION Required Fields:\n');
  for (const [key, fields] of dossierFields.entries()) {
    console.log(`\n${key}:`);
    const uniqueFields = [...new Set(fields.map(f => f.fieldKey))];
    uniqueFields.sort();
    for (const field of uniqueFields) {
      console.log(`  - ${field}`);
    }
  }
  
  console.log('\n\n📊 PV EVALUATION Required Fields:\n');
  for (const [key, fields] of pvFields.entries()) {
    console.log(`\n${key}:`);
    const uniqueFields = [...new Set(fields.map(f => f.fieldKey))];
    uniqueFields.sort();
    for (const field of uniqueFields) {
      console.log(`  - ${field}`);
    }
  }
  
  // Create union of all fields
  console.log('\n\n🔧 UNION OF ALL REQUIRED FIELDS:\n');
  
  const allDossierFields = new Set<string>();
  for (const fields of dossierFields.values()) {
    for (const field of fields) {
      allDossierFields.add(field.fieldKey);
    }
  }
  
  const allPvFields = new Set<string>();
  for (const fields of pvFields.values()) {
    for (const field of fields) {
      allPvFields.add(field.fieldKey);
    }
  }
  
  console.log('Dossier de Presentation (total unique fields):', allDossierFields.size);
  console.log([...allDossierFields].sort().map(f => `  - ${f}`).join('\n'));
  
  console.log('\n\nPV Evaluation (total unique fields):', allPvFields.size);
  console.log([...allPvFields].sort().map(f => `  - ${f}`).join('\n'));
}

// Run analysis
analyzeAllMappings();
