import { CandidateRow } from './types';

export interface CompletenessCheckResult {
  isReady: boolean;
  missingFields: string[];
}

export function checkCandidateCompleteness(candidate: Partial<CandidateRow>): CompletenessCheckResult {
  const missingFields: string[] = [];

  // 1. Nom & Prenom
  if (!candidate.nom || candidate.nom.trim().length === 0) {
    missingFields.push('NOM');
  }
  if (!candidate.prenom || candidate.prenom.trim().length === 0) {
    missingFields.push('PRENOM');
  }

  // 2. Formation
  if (!candidate.formation || candidate.formation.trim().length === 0) {
    missingFields.push('formation');
  }

  // 3. Email (at least one valid email)
  const hasEmail = Boolean(
    (candidate.mail && candidate.mail.trim()) ||
    (candidate.mail_wedof && candidate.mail_wedof.trim()) ||
    (candidate.mail_crm && candidate.mail_crm.trim())
  );
  if (!hasEmail) {
    missingFields.push('Adresse e-mail');
  }

  // 4. Postal Address (at least one valid address)
  const hasAddress = Boolean(
    (candidate.adresse && candidate.adresse.trim()) ||
    (candidate.adresse_wedof && candidate.adresse_wedof.trim()) ||
    (candidate.adresse_postale && candidate.adresse_postale.trim())
  );
  if (!hasAddress) {
    missingFields.push('Adresse postale');
  }

  // 5. Professional experience
  if (!candidate.experience_pro || candidate.experience_pro.trim().length === 0) {
    missingFields.push('experience_pro');
  }

  return {
    isReady: missingFields.length === 0,
    missingFields,
  };
}
