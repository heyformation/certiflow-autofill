/**
 * Deduplicate candidates in the database
 * 
 * Groups candidates by: nom + prenom + code_certif + organisme
 * Keeps the most recent entry, deletes duplicates
 */

import { getDbPool, closePool } from '../lib/db';

interface CandidateRow {
  id: string;
  nom: string;
  prenom: string;
  code_certif: string;
  organisme: string;
  mail?: string;
  created_at?: Date;
}

async function deduplicateCandidates() {
  const pool = getDbPool();
  if (!pool) {
    console.error('❌ Database not configured (DATABASE_URL missing)');
    process.exit(1);
  }

  try {
    console.log('🔍 Finding duplicates...\n');

    // Find all candidates with their creation dates
    const result = await pool.query(`
      SELECT 
        id, 
        nom, 
        prenom, 
        code_certif, 
        organisme,
        mail,
        created_at
      FROM candidates
      ORDER BY nom, prenom, code_certif, organisme, created_at DESC
    `);

    const candidates = result.rows as CandidateRow[];
    console.log(`Found ${candidates.length} total candidates\n`);

    // Group by unique key
    const groups = new Map<string, CandidateRow[]>();
    
    for (const candidate of candidates) {
      const key = `${candidate.nom}|${candidate.prenom}|${candidate.code_certif}|${candidate.organisme}`.toLowerCase();
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(candidate);
    }

    // Find duplicates
    let totalDuplicates = 0;
    const idsToDelete: string[] = [];

    for (const [key, group] of groups.entries()) {
      if (group.length > 1) {
        const [nom, prenom, code_certif, organisme] = key.split('|');
        console.log(`\n📋 ${nom.toUpperCase()} ${prenom} - ${code_certif} (${organisme})`);
        console.log(`   Found ${group.length} duplicates`);
        
        // Keep the first one (most recent due to ORDER BY created_at DESC)
        const toKeep = group[0];
        const toDelete = group.slice(1);
        
        console.log(`   ✅ Keeping: ${toKeep.id} ${toKeep.mail ? `(${toKeep.mail})` : '(no email)'}`);
        
        for (const dup of toDelete) {
          console.log(`   ❌ Deleting: ${dup.id} ${dup.mail ? `(${dup.mail})` : '(no email)'}`);
          idsToDelete.push(dup.id);
          totalDuplicates++;
        }
      }
    }

    if (idsToDelete.length === 0) {
      console.log('\n✅ No duplicates found!');
      return;
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total candidates: ${candidates.length}`);
    console.log(`   Unique candidates: ${groups.size}`);
    console.log(`   Duplicates to delete: ${totalDuplicates}`);
    console.log(`   After cleanup: ${candidates.length - totalDuplicates}`);

    // Ask for confirmation (in production, you'd want user input)
    console.log('\n⚠️  PROCEEDING WITH DELETION...');

    // Delete duplicates in batches
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
      
      await pool.query(
        `DELETE FROM candidates WHERE id IN (${placeholders})`,
        batch
      );
      
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(idsToDelete.length / batchSize)}`);
    }

    console.log('\n✅ Deduplication complete!');
    console.log(`   Deleted ${totalDuplicates} duplicate entries`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run if called directly
if (require.main === module) {
  deduplicateCandidates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { deduplicateCandidates };
