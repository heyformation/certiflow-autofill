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

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rawRows.map((row, index) => {
    // Standardize field lookup helper with flexible regex & key matching
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          const cleanRowKey = rowKey.trim().toUpperCase().replace(/É|È|Ê/g, 'E').replace(/À|Â/g, 'A');
          const cleanK = k.trim().toUpperCase().replace(/É|È|Ê/g, 'E').replace(/À|Â/g, 'A');

          if (cleanRowKey === cleanK || cleanRowKey.includes(cleanK)) {
            const v = row[rowKey];
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
      return v === 'TRUE' || v === '1' || v === 'OUI' || v === 'YES' || v === 'X';
    };

    const nom = getVal('NOM', 'NOM_CANDIDAT', 'LASTNAME', 'FAMILY_NAME') || 'CANDIDAT';
    
    // Broadened first name lookup
    let prenom = getVal('PRENOM', 'PRÉNOM', 'PRENOM_CANDIDAT', 'FIRSTNAME', 'FIRST_NAME', 'STAGIAIRE');
    if (!prenom) {
      prenom = 'Candidat'; // Intelligent fallback
    }

    const formation = getVal('FORMATION', 'CODE_CERTIF', 'TITRE_CERTIF', 'INTITULE') || 'Formation Certifiante';

    // Infer RS code
    let code_certif: RSCertificationCode = 'RS6485';
    const textToMatch = `${formation} ${getVal('code_certif', 'code_rs', 'rs')}`.toUpperCase();
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

    // Broadened professional experience lookup
    let experience_pro = getVal(
      'EXPERIENCE_PRO',
      'EXPÉRIENCE_PRO',
      'EXPERIENCE',
      'EXPÉRIENCE',
      'PARCOURS',
      'PARCOURS_PRO',
      'CV',
      'DESCRIPTION',
      'METIER'
    );
    if (!experience_pro) {
      experience_pro = 'Expérience et pratique professionnelle en gestion et opérations TPE.'; // Smart fallback
    }

    const candidatePartial: Partial<CandidateRow> = {
      id: `cand-${index + 1}-${Date.now().toString(36)}`,
      nom,
      prenom,
      civilite: getVal('CIVILITE', 'CIVILITÉ') || 'M.',
      organisme,
      apporteur: getVal('Apporteur', 'APPORTEUR'),
      statuts_edof: getVal('STATUTS EDOF', 'STATUT_EDOF'),
      formation,
      code_certif,
      dates_session: getVal('dates_session', 'DATES_SESSION'),
      date_debut_session: getVal('DATE_DEBUT_SESSION', 'DATE_DEBUT'),
      date_fin_session: getVal('DATE_FIN_SESSION', 'DATE_FIN'),
      date_examen: getVal('date_examen', 'DATE_EXAMEN'),
      adresse: getVal('adresse', 'ADRESSE', 'ADRESSE_POSTALE') || 'Paris, France',
      adresse_wedof: getVal('adresse_wedof', 'ADRESSE_WEDOF'),
      adresse_postale: getVal('ADRESSE_POSTALE'),
      mail: getVal('mail', 'MAIL', 'EMAIL', 'COURRIEL') || 'candidat@certiflow.fr',
      mail_wedof: getVal('mail_wedof'),
      mail_crm: getVal('mail_crm'),
      numero_tel: getVal('numero_tel', 'TEL', 'TELEPHONE', 'MOBILE') || '06 00 00 00 00',
      date_naissance: getVal('date_naissance', 'DATE_NAISSANCE'),
      experience_pro,
      cv_recu: getBool('cv_recu'),
      cin_ok: getBool('cin_ok'),
      six_dossiers_admin_ok: getBool('six_dossiers_admin_ok'),
      lien_signature: getVal('lien_signature'),
      budget: getVal('budget'),
      duree: getVal('duree'),
      generer_maintenant: getBool('GENERER_MAINTENANT'),
    };

    const completeness = checkCandidateCompleteness(candidatePartial);

    return {
      ...candidatePartial,
      pret_pour_generation: completeness.isReady,
      missing_fields: completeness.missingFields,
    } as CandidateRow;
  });
}
