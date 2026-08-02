import * as XLSX from 'xlsx';
import { checkCandidateCompleteness } from './completeness';
import { CandidateRow, Organization, RSCertificationCode } from './types';

export function cleanTitle(str: string): { civilite?: string; cleanName: string } {
  if (!str) return { cleanName: '' };
  let s = str.trim();
  let civilite: string | undefined = undefined;

  const match = s.match(/^(Mr\.|Mr|Ms\.|Ms|Mme\.|Mme|M\.|Mrs\.|Mrs|Dr\.|Dr)\s+/i);
  if (match) {
    const rawTitle = match[1].toLowerCase();
    if (rawTitle.startsWith('mr') || rawTitle === 'm.') civilite = 'M.';
    else if (rawTitle.startsWith('ms') || rawTitle.startsWith('mme') || rawTitle.startsWith('mrs')) civilite = 'Mme';
    s = s.substring(match[0].length).trim();
  }
  return { civilite, cleanName: s };
}

export function getPersonKey(nom: string, prenom: string, organisme: string): string {
  const full = `${nom || ''} ${prenom || ''}`
    .replace(/^(Mr\.|Mr|Ms\.|Ms|Mme\.|Mme|M\.|Mrs\.|Mrs|Dr\.|Dr)\s+/i, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join('_');

  const normOrg = (organisme || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  return `${full}__${normOrg}`;
}

export function generateDeterministicCandidateId(
  nom: string,
  prenom: string,
  organisme: string,
  code_certif: string
): string {
  const personKey = getPersonKey(nom, prenom, organisme);
  const normCode = (code_certif || '').trim().toLowerCase();
  return `cand-${personKey}-${normCode}`;
}

export function isValidEmail(email?: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (
    !e ||
    e === 'no email' ||
    e === 'no_email' ||
    e === 'sans email' ||
    e === 'n/a' ||
    e === 'none' ||
    e === 'null' ||
    e === 'undefined'
  ) {
    return false;
  }
  return e.includes('@');
}

export function enrichAndDeduplicateCandidates(candidates: CandidateRow[]): CandidateRow[] {
  if (!candidates || candidates.length === 0) return [];

  // Step 1: Map best contact details for each unique person
  const personContacts = new Map<
    string,
    { mail?: string; numero_tel?: string; adresse?: string; date_naissance?: string; experience_pro?: string }
  >();

  for (const c of candidates) {
    const { cleanName: cleanNom } = cleanTitle(c.nom);
    const { cleanName: cleanPrenom } = cleanTitle(c.prenom);
    const pNom = cleanNom || c.nom;
    const pPrenom = cleanPrenom || c.prenom;
    const key = getPersonKey(pNom, pPrenom, c.organisme);

    const existing = personContacts.get(key) || {};
    const validMail = isValidEmail(c.mail)
      ? c.mail!.trim()
      : isValidEmail(c.mail_wedof)
      ? c.mail_wedof!.trim()
      : isValidEmail(c.mail_crm)
      ? c.mail_crm!.trim()
      : undefined;

    const validTel =
      c.numero_tel && c.numero_tel.trim() && !c.numero_tel.toLowerCase().includes('n/a')
        ? c.numero_tel.trim()
        : undefined;
    const validAdresse =
      c.adresse && c.adresse.trim() && !c.adresse.toLowerCase().includes('n/a')
        ? c.adresse.trim()
        : undefined;
    const validDob = c.date_naissance && c.date_naissance.trim() ? c.date_naissance.trim() : undefined;
    const validExp = c.experience_pro && c.experience_pro.trim() ? c.experience_pro.trim() : undefined;

    personContacts.set(key, {
      mail: validMail || existing.mail || '',
      numero_tel: validTel || existing.numero_tel || '',
      adresse: validAdresse || existing.adresse || '',
      date_naissance: validDob || existing.date_naissance || '',
      experience_pro: validExp || existing.experience_pro || '',
    });
  }

  // Step 2: Enrich candidate rows & collapse duplicate entries for same (person, code_certif)
  const deduplicatedMap = new Map<string, CandidateRow>();

  for (const c of candidates) {
    let { cleanName: cleanNom, civilite: titleNom } = cleanTitle(c.nom);
    let { cleanName: cleanPrenom, civilite: titlePrenom } = cleanTitle(c.prenom);

    let nom = cleanNom || c.nom;
    let prenom = cleanPrenom || c.prenom;
    let civilite = c.civilite || titleNom || titlePrenom || 'M.';

    const personKey = getPersonKey(nom, prenom, c.organisme);
    const detId = generateDeterministicCandidateId(nom, prenom, c.organisme, c.code_certif);
    const contact = personContacts.get(personKey) || {};

    const rawMail = isValidEmail(c.mail) ? c.mail!.trim() : '';
    const mail = rawMail || contact.mail || '';

    const rawTel =
      c.numero_tel && !c.numero_tel.toLowerCase().includes('n/a') ? c.numero_tel.trim() : '';
    const numero_tel = rawTel || contact.numero_tel || '';

    const rawAdr =
      c.adresse && !c.adresse.toLowerCase().includes('n/a') ? c.adresse.trim() : '';
    const adresse = rawAdr || contact.adresse || '';

    const date_naissance = (c.date_naissance && c.date_naissance.trim()) || contact.date_naissance || '';
    const experience_pro = (c.experience_pro && c.experience_pro.trim()) || contact.experience_pro || '';

    const existing = deduplicatedMap.get(detId);

    const merged: CandidateRow = {
      ...c,
      id: detId,
      nom,
      prenom,
      civilite,
      mail: mail || existing?.mail || '',
      numero_tel: numero_tel || existing?.numero_tel || '',
      adresse: adresse || existing?.adresse || '',
      date_naissance: date_naissance || existing?.date_naissance || '',
      experience_pro: experience_pro || existing?.experience_pro || '',
      cv_recu: c.cv_recu || existing?.cv_recu || false,
      cin_ok: c.cin_ok || existing?.cin_ok || false,
      pret_generation_classique: c.pret_generation_classique || existing?.pret_generation_classique || false,
      pret_generation_wedof: c.pret_generation_wedof || existing?.pret_generation_wedof || false,
      pret_pour_generation: c.pret_pour_generation || existing?.pret_pour_generation || false,
    };

    const completeness = checkCandidateCompleteness(merged);
    merged.pret_generation_classique = merged.pret_generation_classique || completeness.pretClassique;
    merged.pret_generation_wedof = merged.pret_generation_wedof || completeness.pretWedof;
    merged.pret_pour_generation = merged.pret_generation_classique || merged.pret_generation_wedof;
    merged.missing_fields = completeness.missingFields;

    deduplicatedMap.set(detId, merged);
  }

  return Array.from(deduplicatedMap.values());
}

export function parseEdofExcelBuffer(buffer: Buffer): CandidateRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // Look for AUTOMATISATION tab (case-insensitive)
  const targetSheetName = workbook.SheetNames.find(
    (name) => name.trim().toUpperCase() === 'AUTOMATISATION'
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error('La feuille AUTOMATISATION est introuvable dans le fichier Excel.');
  }

  // Parse raw 2D array to dynamically find header row
  const raw2D = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (!raw2D || raw2D.length === 0) return [];

  // Locate the header row containing 'Nom', 'Organisme', or 'PRET_GENERATION'
  let headerIdx = raw2D.findIndex((row) =>
    Array.isArray(row) &&
    row.some((cell) => {
      const clean = String(cell || '').trim().toUpperCase();
      return clean === 'NOM' || clean === 'ORGANISME';
    }) &&
    row.some((cell) => {
      const clean = String(cell || '').trim().toUpperCase();
      return clean.includes('PRET_GENERATION') || clean.includes('FORMATION') || clean.includes('EDOF');
    })
  );

  if (headerIdx === -1) {
    // Fallback: look for any row with 'Nom'
    headerIdx = raw2D.findIndex((row) =>
      Array.isArray(row) && row.some((cell) => String(cell || '').trim().toUpperCase() === 'NOM')
    );
  }

  if (headerIdx === -1) headerIdx = 0;

  const headerRow = raw2D[headerIdx] || [];
  const headers = headerRow.map((cell) => String(cell || '').trim());

  // Data rows are after the header row
  const dataRows = raw2D.slice(headerIdx + 1).filter((row) => {
    if (!Array.isArray(row) || row.length === 0) return false;
    // Keep row if at least first column (Nom) is non-empty
    const firstCell = String(row[0] || '').trim();
    return firstCell !== '' && !firstCell.toUpperCase().startsWith('NOTES');
  });

  const parsedCandidates = dataRows.map((rowArr, index) => {
    // Convert row array into key-value map using detected headers
    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      if (h) {
        rowObj[h] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
      }
    });

    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rowKey of Object.keys(rowObj)) {
          const cleanRowKey = rowKey.trim().toUpperCase().replace(/É|È|Ê/g, 'E').replace(/À|Â/g, 'A');
          const cleanK = k.trim().toUpperCase().replace(/É|È|Ê/g, 'E').replace(/À|Â/g, 'A');

          if (cleanRowKey === cleanK || cleanRowKey.includes(cleanK)) {
            const v = rowObj[rowKey];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              return String(v).trim();
            }
          }
        }
      }
      return '';
    };

    const getBool = (...keys: string[]): boolean => {
      const v = getVal(...keys).toUpperCase();
      return v === 'TRUE' || v === '1' || v === 'OUI' || v === 'YES' || v === 'X' || v === 'FAIT';
    };

    let rawNom = getVal('Nom', 'NOM', 'NOM_CANDIDAT', 'LASTNAME', 'FAMILY_NAME') || 'CANDIDAT';
    let prenom = getVal('Prenom', 'PRENOM', 'PRÉNOM', 'PRENOM_CANDIDAT', 'FIRSTNAME', 'STAGIAIRE');
    let nom = rawNom;

    if (!prenom && rawNom && rawNom.includes(' ')) {
      const parts = rawNom.trim().split(/\s+/);
      prenom = parts[0];
      nom = parts.slice(1).join(' ');
    }
    if (!prenom) prenom = 'Candidat';

    const formation = getVal('Formation', 'FORMATION', 'CODE_CERTIF', 'TITRE_CERTIF', 'INTITULE') || 'Formation Certifiante';

    // Infer RS code by RS number and official title keywords
    let code_certif: RSCertificationCode = 'RS6485';
    const textToMatch = `${formation} ${getVal('Code certification', 'code_certif', 'code_rs', 'rs')}`.toUpperCase();

    if (textToMatch.includes('7200') || textToMatch.includes('RESEAUX SOCIAUX') || textToMatch.includes('RÉSEAUX SOCIAUX')) {
      code_certif = 'RS7200';
    } else if (textToMatch.includes('7311') || textToMatch.includes('EFFICACITE') || textToMatch.includes('EFFICACITÉ')) {
      code_certif = 'RS7311';
    } else if (textToMatch.includes('7344') || textToMatch.includes('DEVELOPPER') || textToMatch.includes('DÉVELOPPER')) {
      code_certif = 'RS7344';
    } else if (textToMatch.includes('6485') || textToMatch.includes('COMPTABLE') || textToMatch.includes('COMPTABILITE')) {
      code_certif = 'RS6485';
    }

    // Infer Organization
    let organisme: Organization = 'Proforma Institut';
    const orgRaw = getVal('Organisme', 'ORGANISME', 'CENTRE', 'ECOLE', 'INSTITUT').toUpperCase();
    if (orgRaw.includes('PROSKILLS')) {
      organisme = 'Proskills Institut';
    }

    let experience_pro = getVal(
      'Experience',
      'EXPERIENCE',
      'EXPÉRIENCE',
      'PARCOURS',
      'PARCOURS_PRO',
      'CV',
      'DESCRIPTION'
    );

    const rawClassiqueBool = getBool('PRET_GENERATION_CLASSIQUE');
    const rawWedofBool = getBool('PRET_GENERATION_WEDOF');
    const genererMaintenantClassique = getBool('GENERER_MAINTENANT_CLASSIQUE', 'GENERER_MAINTENANT_CLASSIQUE (E)');
    const genererMaintenantWedof = getBool('GENERER_MAINTENANT_WEDOF', 'GENERER_MAINTENANT_WEDOF (E)');

    const cin_ok_str = getVal('CIN ok', 'CIN');
    const cv_recu_str = getVal('CV recu', 'CV');

    const candidatePartial: Partial<CandidateRow> = {
      id: generateDeterministicCandidateId(nom, prenom, organisme, code_certif),
      nom,
      prenom,
      civilite: getVal('CIVILITE', 'CIVILITÉ'),
      organisme,
      apporteur: getVal('Apporteur', 'APPORTEUR'),
      statuts_edof: getVal('Statut EDOF', 'STATUT_EDOF', 'STATUTS EDOF'),
      formation,
      code_certif,
      dates_session: getVal('dates_session', 'DATES_SESSION'),
      date_debut_session: getVal('Date debut session', 'DATE_DEBUT_SESSION', 'DATE_DEBUT'),
      date_fin_session: getVal('Date fin session', 'DATE_FIN_SESSION', 'DATE_FIN'),
      date_examen: getVal('Date examen', 'date_examen', 'DATE_EXAMEN'),
      adresse: getVal('Adresse', 'ADRESSE', 'ADRESSE_POSTALE'),
      adresse_wedof: getVal('adresse_wedof', 'ADRESSE_WEDOF'),
      adresse_postale: getVal('ADRESSE_POSTALE'),
      mail: getVal('Email', 'mail', 'MAIL', 'EMAIL', 'COURRIEL'),
      mail_wedof: getVal('mail_wedof'),
      mail_crm: getVal('mail_crm'),
      numero_tel: getVal('Telephone', 'numero_tel', 'TEL', 'TELEPHONE', 'MOBILE'),
      date_naissance: getVal('Date de naissance', 'date_naissance', 'DATE_NAISSANCE'),
      experience_pro,
      cv_recu: getBool('CV recu', 'cv_recu'),
      cin_ok: getBool('CIN ok', 'cin_ok'),
      cin_ok_str,
      cv_recu_str,
      six_dossiers_admin_ok: getBool('6 dossiers admin ok', 'six_dossiers_admin_ok'),
      lien_signature: getVal('Lien signature', 'lien_signature'),
      budget: getVal('Budget dossier', 'budget'),
      duree: getVal('duree', 'DUREE'),
      inscription_confirmee: getVal('Inscription confirmee', 'inscription_confirmee'),
    };

    const completeness = checkCandidateCompleteness(candidatePartial);

    const pret_generation_classique = rawClassiqueBool || completeness.pretClassique;
    const pret_generation_wedof = rawWedofBool || completeness.pretWedof;
    const pret_pour_generation = pret_generation_classique || pret_generation_wedof;
    const generer_maintenant = genererMaintenantClassique || genererMaintenantWedof;

    return {
      ...candidatePartial,
      pret_generation_classique,
      pret_generation_wedof,
      generer_maintenant_classique: genererMaintenantClassique,
      generer_maintenant_wedof: genererMaintenantWedof,
      pret_pour_generation,
      generer_maintenant,
      missing_fields: completeness.missingFields,
    } as CandidateRow;
  });

  return enrichAndDeduplicateCandidates(parsedCandidates);
}


