import { CandidateRow, GenerationLog } from './types';
import { enrichAndDeduplicateCandidates } from './edof-parser';
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('connect', (client) => {
      client.query('SET search_path TO public').catch((err) => {
        console.error('Failed to set search_path to public on connect:', err);
      });
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

let isInitialized = false;

export async function initDbSchema(): Promise<boolean> {
  if (isInitialized) return true;
  const db = getDbPool();
  if (!db) return false;

  try {
    const client = await db.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS candidates (
          id VARCHAR(120) PRIMARY KEY,
          nom TEXT NOT NULL,
          prenom TEXT NOT NULL,
          civilite VARCHAR(20),
          organisme VARCHAR(100),
          apporteur TEXT,
          statuts_edof TEXT,
          formation TEXT,
          code_certif VARCHAR(20),
          dates_session TEXT,
          date_debut_session TEXT,
          date_fin_session TEXT,
          date_examen TEXT,
          adresse TEXT,
          mail TEXT,
          numero_tel TEXT,
          date_naissance TEXT,
          experience_pro TEXT,
          cv_recu BOOLEAN DEFAULT false,
          cin_ok BOOLEAN DEFAULT false,
          cin_ok_str TEXT,
          cv_recu_str TEXT,
          pret_generation_classique BOOLEAN DEFAULT false,
          pret_generation_wedof BOOLEAN DEFAULT false,
          pret_pour_generation BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS generation_logs (
          id VARCHAR(120) PRIMARY KEY,
          candidate_id VARCHAR(120),
          candidate_name TEXT,
          certification TEXT,
          organisme TEXT,
          documents_produced TEXT[],
          status VARCHAR(20),
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      isInitialized = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('PostgreSQL database initialization skipped/failed:', err);
    return false;
  }
}

export async function saveCandidatesToDb(candidates: CandidateRow[]): Promise<number> {
  const db = getDbPool();
  if (!db || candidates.length === 0) return 0;
  await initDbSchema();

  let saved = 0;
  const client = await db.connect();
  try {
    for (const c of candidates) {
      await client.query(
        `
        INSERT INTO candidates (
          id, nom, prenom, civilite, organisme, apporteur, statuts_edof,
          formation, code_certif, dates_session, date_debut_session, date_fin_session,
          date_examen, adresse, mail, numero_tel, date_naissance, experience_pro,
          cv_recu, cin_ok, cin_ok_str, cv_recu_str, pret_generation_classique,
          pret_generation_wedof, pret_pour_generation, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          nom = EXCLUDED.nom,
          prenom = EXCLUDED.prenom,
          civilite = EXCLUDED.civilite,
          organisme = EXCLUDED.organisme,
          apporteur = EXCLUDED.apporteur,
          statuts_edof = EXCLUDED.statuts_edof,
          formation = EXCLUDED.formation,
          code_certif = EXCLUDED.code_certif,
          dates_session = EXCLUDED.dates_session,
          date_debut_session = EXCLUDED.date_debut_session,
          date_fin_session = EXCLUDED.date_fin_session,
          date_examen = EXCLUDED.date_examen,
          adresse = EXCLUDED.adresse,
          mail = EXCLUDED.mail,
          numero_tel = EXCLUDED.numero_tel,
          date_naissance = EXCLUDED.date_naissance,
          experience_pro = EXCLUDED.experience_pro,
          cv_recu = EXCLUDED.cv_recu,
          cin_ok = EXCLUDED.cin_ok,
          cin_ok_str = EXCLUDED.cin_ok_str,
          cv_recu_str = EXCLUDED.cv_recu_str,
          pret_generation_classique = EXCLUDED.pret_generation_classique,
          pret_generation_wedof = EXCLUDED.pret_generation_wedof,
          pret_pour_generation = EXCLUDED.pret_pour_generation,
          updated_at = CURRENT_TIMESTAMP;
      `,
        [
          c.id,
          c.nom,
          c.prenom,
          c.civilite || 'M.',
          c.organisme,
          c.apporteur || '',
          c.statuts_edof || '',
          c.formation,
          c.code_certif,
          c.dates_session || '',
          c.date_debut_session || '',
          c.date_fin_session || '',
          c.date_examen || '',
          c.adresse || '',
          c.mail || '',
          c.numero_tel || '',
          c.date_naissance || '',
          c.experience_pro || '',
          Boolean(c.cv_recu),
          Boolean(c.cin_ok),
          c.cin_ok_str || '',
          c.cv_recu_str || '',
          Boolean(c.pret_generation_classique),
          Boolean(c.pret_generation_wedof),
          Boolean(c.pret_pour_generation),
        ]
      );
      saved += 1;
    }
  } catch (err) {
    console.error('Failed to save candidates to PostgreSQL:', err);
  } finally {
    client.release();
  }
  return saved;
}

export async function logGenerationToDb(log: GenerationLog): Promise<boolean> {
  const db = getDbPool();
  if (!db) return false;
  await initDbSchema();

  try {
    await db.query(
      `
      INSERT INTO generation_logs (
        id, candidate_id, candidate_name, certification, organisme, documents_produced, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING;
    `,
      [
        log.id,
        log.candidateId,
        log.candidateName,
        log.certification,
        log.organisme,
        log.documentsProduced,
        log.status,
        log.errorMessage || null,
      ]
    );
    return true;
  } catch (err) {
    console.warn('Failed to insert generation log in PostgreSQL:', err);
    return false;
  }
}

export async function clearCandidatesFromDb(): Promise<boolean> {
  const db = getDbPool();
  if (!db) return false;
  try {
    await db.query('DELETE FROM candidates;');
    return true;
  } catch (err) {
    console.error('Failed to clear candidates from PostgreSQL DB:', err);
    return false;
  }
}

export async function getCandidatesFromDb(): Promise<CandidateRow[]> {
  const db = getDbPool();
  if (!db) return [];
  await initDbSchema();

  try {
    const res = await db.query(`SELECT * FROM candidates ORDER BY created_at DESC;`);
    const rawList: CandidateRow[] = res.rows.map((r: any) => ({
      id: r.id,
      nom: r.nom,
      prenom: r.prenom,
      civilite: r.civilite,
      organisme: r.organisme,
      apporteur: r.apporteur,
      statuts_edof: r.statuts_edof,
      formation: r.formation,
      code_certif: r.code_certif,
      dates_session: r.dates_session,
      date_debut_session: r.date_debut_session,
      date_fin_session: r.date_fin_session,
      date_examen: r.date_examen,
      adresse: r.adresse,
      mail: r.mail,
      numero_tel: r.numero_tel,
      date_naissance: r.date_naissance,
      experience_pro: r.experience_pro,
      cv_recu: r.cv_recu,
      cin_ok: r.cin_ok,
      cin_ok_str: r.cin_ok_str,
      cv_recu_str: r.cv_recu_str,
      pret_generation_classique: r.pret_generation_classique,
      pret_generation_wedof: r.pret_generation_wedof,
      generer_maintenant_classique: false,
      generer_maintenant_wedof: false,
      pret_pour_generation: r.pret_pour_generation,
      generer_maintenant: false,
      missing_fields: [],
    }));

    return enrichAndDeduplicateCandidates(rawList);
  } catch (err) {
    console.warn('Failed to query candidates from PostgreSQL:', err);
    return [];
  }
}
