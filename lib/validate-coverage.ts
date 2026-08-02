/**
 * validate-coverage.ts
 * Quick validation script to check that resolver configs cover
 * all labeled {{FILL}} tags in all templates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseTemplateFilename, getResolverConfig } from './resolver-configs';
import { extractTags, validateCoverage, listTemplateFiles, loadTemplateByFilename } from './md-template-engine';

const TEMPLATES_DIR = path.join(process.cwd(), 'Templates_MD');

function run() {
  const files = listTemplateFiles();
  let totalCovered = 0;
  let totalUncovered = 0;
  let totalCheckboxes = 0;
  let totalFillEmpty = 0;
  const allUncovered: { file: string; label: string }[] = [];

  console.log(`\n📂 Scanning ${files.length} template files...\n`);

  for (const file of files) {
    const parsed = parseTemplateFilename(file);
    if (!parsed) continue;

    const content = loadTemplateByFilename(file);
    if (!content) continue;

    const config = getResolverConfig(parsed.type);
    const tags = extractTags(content);

    const fillLabeled = tags.filter(t => t.type === 'fill' && t.label);
    const fillEmpty = tags.filter(t => t.type === 'fill' && !t.label);
    const checkboxes = tags.filter(t => t.type === 'checkbox');

    totalCheckboxes += checkboxes.length;
    totalFillEmpty += fillEmpty.length;

    if (!config) {
      console.log(`⚠️  ${file} — No resolver config found for type "${parsed.type}"`);
      totalUncovered += fillLabeled.length;
      continue;
    }

    if (config.skip_fill) {
      console.log(`⏭️  ${file} — Skipped (no placeholders to fill)`);
      continue;
    }

    const { covered, uncovered } = validateCoverage(content, config);
    totalCovered += covered.length;
    totalUncovered += uncovered.length;

    if (uncovered.length > 0) {
      console.log(`❌ ${file}`);
      console.log(`   Covered: ${covered.length} | Uncovered: ${uncovered.length} | Checkboxes: ${checkboxes.length} | Empty: ${fillEmpty.length}`);
      for (const u of uncovered) {
        allUncovered.push({ file, label: u });
        console.log(`   ⚠ Missing: "${u}"`);
      }
    } else {
      console.log(`✅ ${file} — ${covered.length} fields covered, ${checkboxes.length} checkboxes, ${fillEmpty.length} empty fills`);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  Templates scanned:     ${files.length}`);
  console.log(`  Labeled tags covered:  ${totalCovered}`);
  console.log(`  Labeled tags missing:  ${totalUncovered}`);
  console.log(`  Unlabeled {{FILL}}:    ${totalFillEmpty} (resolved contextually)`);
  console.log(`  {{CHECKBOX}} tags:     ${totalCheckboxes} (resolved by group)`);
  console.log(`  Coverage rate:         ${totalCovered + totalUncovered > 0 ? ((totalCovered / (totalCovered + totalUncovered)) * 100).toFixed(1) : 100}%`);
  console.log(`${'═'.repeat(70)}\n`);

  if (allUncovered.length > 0) {
    console.log(`\n🔍 All uncovered labels (unique):`);
    const uniqueLabels = [...new Set(allUncovered.map(u => u.label))];
    uniqueLabels.forEach(l => console.log(`  - "${l}"`));
  }
}

run();
