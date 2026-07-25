import { CandidateRow } from './types';

export interface CompletenessCheckResult {
  isReady: boolean;
  pretClassique: boolean;
  pretWedof: boolean;
  missingFields: string[];
}

export function checkCandidateCompleteness(candidate: Partial<CandidateRow>): CompletenessCheckResult {
  const missingFields: string[] = [];

  // 1. Nom & Prenom
  if (!candidate.nom || candidate.nom.trim().length === 0 || candidate.nom === 'CANDIDAT') {
    missingFields.push('NOM');
  }
  if (!candidate.prenom || candidate.prenom.trim().length === 0) {
    missingFields.push('PRENOM');
  }

  // 2. Classique condition: Formation, Date debut session, Date fin session
  const hasFormation = Boolean(candidate.formation && candidate.formation.trim().length > 0);
  const hasDateDebut = Boolean(candidate.date_debut_session && candidate.date_debut_session.trim().length > 0);
  const hasDateFin = Boolean(candidate.date_fin_session && candidate.date_fin_session.trim().length > 0);
  const hasDatesSession = Boolean(candidate.dates_session && candidate.dates_session.trim().length > 0);

  const pretClassique = hasFormation && (hasDatesSession || (hasDateDebut && hasDateFin));

  // 3. WeDOF condition: CIN ok = "Fait" AND (CV recu = "Fait" OR Experience non-empty)
  const isCinOk = Boolean(
    candidate.cin_ok ||
      (candidate.cin_ok_str && candidate.cin_ok_str.trim().toLowerCase() === 'fait')
  );
  const isCvRecu = Boolean(
    candidate.cv_recu ||
      (candidate.cv_recu_str && candidate.cv_recu_str.trim().toLowerCase() === 'fait')
  );
  const hasExperience = Boolean(candidate.experience_pro && candidate.experience_pro.trim().length > 0);

  const pretWedof = isCinOk && (isCvRecu || hasExperience);

  // Overall readiness: Either Classique or WeDOF is ready
  const isReady = pretClassique || pretWedof;

  if (!pretClassique) {
    if (!hasFormation) missingFields.push('Formation');
    if (!hasDateDebut && !hasDatesSession) missingFields.push('Date début session');
    if (!hasDateFin && !hasDatesSession) missingFields.push('Date fin session');
  }

  if (!pretWedof) {
    if (!isCinOk) missingFields.push('CIN ok');
    if (!isCvRecu && !hasExperience) missingFields.push('CV / Expérience');
  }

  return {
    isReady,
    pretClassique,
    pretWedof,
    missingFields: isReady ? [] : Array.from(new Set(missingFields)),
  };
}

