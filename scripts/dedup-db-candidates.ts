import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_eKpMxGc2JuF7@ep-purple-bird-ax7a3w6z-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export function generateDeterministicCandidateId(
  nom: string,
  prenom: string,
  organisme: string,
  code_certif: string
): string {
  const normNom = (nom || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normPrenom = (prenom || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normOrg = (organisme || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normCode = (code_certif || '').trim().toLowerCase();
  return `cand-${normOrg}-${normCode}-${normNom}-${normPrenom}`;
}

async function deduplicateDatabase() {
  const client = await pool.connect();
  try {
    console.log('Fetching all database candidates...');
    const res = await client.query('SELECT * FROM candidates ORDER BY created_at ASC;');
    console.log(`Total rows before cleanup: ${res.rows.length}`);

    // Map to collect best contact info for each person identity (nom + prenom + organisme)
    const personContacts = new Map<string, { mail?: string; numero_tel?: string; adresse?: string; date_naissance?: string }>();

    for (const r of res.rows) {
      const personKey = `${(r.nom || '').trim().toLowerCase()}_${(r.prenom || '').trim().toLowerCase()}_${(r.organisme || '').trim().toLowerCase()}`;
      const existing = personContacts.get(personKey) || {};
      personContacts.set(personKey, {
        mail: r.mail?.trim() || existing.mail || '',
        numero_tel: r.numero_tel?.trim() || existing.numero_tel || '',
        adresse: r.adresse?.trim() || existing.adresse || '',
        date_naissance: r.date_naissance?.trim() || existing.date_naissance || '',
      });
    }

    // Map to group records by deterministic candidate ID
    const mergedCandidates = new Map<string, any>();

    for (const r of res.rows) {
      const detId = generateDeterministicCandidateId(r.nom, r.prenom, r.organisme, r.code_certif);
      const personKey = `${(r.nom || '').trim().toLowerCase()}_${(r.prenom || '').trim().toLowerCase()}_${(r.organisme || '').trim().toLowerCase()}`;
      const contact = personContacts.get(personKey) || {};

      const existing = mergedCandidates.get(detId);

      const mergedRecord = {
        id: detId,
        nom: r.nom,
        prenom: r.prenom,
        civilite: r.civilite || existing?.civilite || 'M.',
        organisme: r.organisme,
        apporteur: r.apporteur || existing?.apporteur || '',
        statuts_edof: r.statuts_edof || existing?.statuts_edof || '',
        formation: r.formation,
        code_certif: r.code_certif,
        dates_session: r.dates_session || existing?.dates_session || '',
        date_debut_session: r.date_debut_session || existing?.date_debut_session || '',
        date_fin_session: r.date_fin_session || existing?.date_fin_session || '',
        date_examen: r.date_examen || existing?.date_examen || '',
        adresse: r.adresse?.trim() || existing?.adresse || contact.adresse || '',
        mail: r.mail?.trim() || existing?.mail || contact.mail || '',
        numero_tel: r.numero_tel?.trim() || existing?.numero_tel || contact.numero_tel || '',
        date_naissance: r.date_naissance?.trim() || existing?.date_naissance || contact.date_naissance || '',
        experience_pro: r.experience_pro || existing?.experience_pro || '',
        cv_recu: Boolean(r.cv_recu || existing?.cv_recu),
        cin_ok: Boolean(r.cin_ok || existing?.cin_ok),
        cin_ok_str: r.cin_ok_str || existing?.cin_ok_str || '',
        cv_recu_str: r.cv_recu_str || existing?.cv_recu_str || '',
        pret_generation_classique: Boolean(r.pret_generation_classique || existing?.pret_generation_classique),
        pret_generation_wedof: Boolean(r.pret_generation_wedof || existing?.pret_generation_wedof),
        pret_pour_generation: Boolean(r.pret_pour_generation || existing?.pret_pour_generation),
      };

      mergedCandidates.set(detId, mergedRecord);
    }

    console.log(`Unique candidate-certification records after deduplication & enrichment: ${mergedCandidates.size}`);

    // Begin transaction to replace database table contents cleanly
    await client.query('BEGIN;');
    await client.query('TRUNCATE TABLE candidates;');

    for (const c of mergedCandidates.values()) {
      await client.query(
        `INSERT INTO candidates (
          id, nom, prenom, civilite, organisme, apporteur, statuts_edof,
          formation, code_certif, dates_session, date_debut_session, date_fin_session,
          date_examen, adresse, mail, numero_tel, date_naissance, experience_pro,
          cv_recu, cin_ok, cin_ok_str, cv_recu_str, pret_generation_classique,
          pret_generation_wedof, pret_pour_generation, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP
        );`,
        [
          c.id,
          c.nom,
          c.prenom,
          c.civilite,
          c.organisme,
          c.apporteur,
          c.statuts_edof,
          c.formation,
          c.code_certif,
          c.dates_session,
          c.date_debut_session,
          c.date_fin_session,
          c.date_examen,
          c.adresse,
          c.mail,
          c.numero_tel,
          c.date_naissance,
          c.experience_pro,
          c.cv_recu,
          c.cin_ok,
          c.cin_ok_str,
          c.cv_recu_str,
          c.pret_generation_classique,
          c.pret_generation_wedof,
          c.pret_pour_generation,
        ]
      );
    }

    await client.query('COMMIT;');
    console.log('Database deduplication and contact enrichment successfully completed!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Deduplication failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

deduplicateDatabase();
