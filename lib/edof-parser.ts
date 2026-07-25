import * as XLSX from 'xlsx';
import { checkCandidateCompleteness } from './completeness';
import { CandidateRow, Organization, RSCertificationCode } from './types';

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

  return dataRows.map((rowArr, index) => {
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

    // Infer RS code
    let code_certif: RSCertificationCode = 'RS6485';
    const textToMatch = `${formation} ${getVal('Code certification', 'code_certif', 'code_rs', 'rs')}`.toUpperCase();
    if (textToMatch.includes('7200')) code_certif = 'RS7200';
    else if (textToMatch.includes('7311')) code_certif = 'RS7311';
    else if (textToMatch.includes('7344')) code_certif = 'RS7344';
    else if (textToMatch.includes('6485')) code_certif = 'RS6485';

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
    if (!experience_pro) {
      experience_pro = 'Expérience et pratique professionnelle en gestion et opérations TPE.';
    }

    const rawClassiqueBool = getBool('PRET_GENERATION_CLASSIQUE');
    const rawWedofBool = getBool('PRET_GENERATION_WEDOF');
    const genererMaintenantClassique = getBool('GENERER_MAINTENANT_CLASSIQUE', 'GENERER_MAINTENANT_CLASSIQUE (E)');
    const genererMaintenantWedof = getBool('GENERER_MAINTENANT_WEDOF', 'GENERER_MAINTENANT_WEDOF (E)');

    const cin_ok_str = getVal('CIN ok', 'CIN');
    const cv_recu_str = getVal('CV recu', 'CV');

    const candidatePartial: Partial<CandidateRow> = {
      id: `cand-${index + 1}-${Date.now().toString(36)}`,
      nom,
      prenom,
      civilite: getVal('CIVILITE', 'CIVILITÉ') || 'M.',
      organisme,
      apporteur: getVal('Apporteur', 'APPORTEUR'),
      statuts_edof: getVal('Statut EDOF', 'STATUT_EDOF', 'STATUTS EDOF'),
      formation,
      code_certif,
      dates_session: getVal('dates_session', 'DATES_SESSION'),
      date_debut_session: getVal('Date debut session', 'DATE_DEBUT_SESSION', 'DATE_DEBUT'),
      date_fin_session: getVal('Date fin session', 'DATE_FIN_SESSION', 'DATE_FIN'),
      date_examen: getVal('Date examen', 'date_examen', 'DATE_EXAMEN'),
      adresse: getVal('Adresse', 'ADRESSE', 'ADRESSE_POSTALE') || 'Paris, France',
      adresse_wedof: getVal('adresse_wedof', 'ADRESSE_WEDOF'),
      adresse_postale: getVal('ADRESSE_POSTALE'),
      mail: getVal('Email', 'mail', 'MAIL', 'EMAIL', 'COURRIEL') || 'candidat@certiflow.fr',
      mail_wedof: getVal('mail_wedof'),
      mail_crm: getVal('mail_crm'),
      numero_tel: getVal('Telephone', 'numero_tel', 'TEL', 'TELEPHONE', 'MOBILE') || '06 00 00 00 00',
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
}

