export type Organization = 'Proforma Institut' | 'Proskills Institut';

export type RSCertificationCode = 'RS6485' | 'RS7200' | 'RS7311' | 'RS7344';

export interface CandidateRow {
  id: string;
  nom: string;
  prenom: string;
  civilite?: string;
  organisme: Organization;
  apporteur?: string;
  statuts_edof?: string;
  formation: string;
  code_certif: RSCertificationCode;
  dates_session?: string;
  date_debut_session?: string;
  date_fin_session?: string;
  date_examen?: string;
  adresse?: string;
  adresse_wedof?: string;
  adresse_postale?: string;
  mail?: string;
  mail_wedof?: string;
  mail_crm?: string;
  numero_tel?: string;
  date_naissance?: string;
  experience_pro: string;
  cv_recu?: boolean;
  cin_ok?: boolean;
  six_dossiers_admin_ok?: boolean;
  lien_signature?: string;
  budget?: string;
  duree?: string;
  pret_pour_generation: boolean;
  generer_maintenant: boolean;
  missing_fields: string[];
}

export interface CompetencyTheme {
  id: string;
  title: string;
  description: string;
}

export interface JuryConfig {
  organisme: Organization;
  chair: string;
  member: string;
  contact: string;
  examOfficer: string;
  pedagogicalOfficer: string;
}

export interface ThemeScoreProfile {
  themeId: string;
  themeTitle: string;
  level: number; // 1-5 scale
}

export interface CompetencyScore {
  id: string;
  title: string;
  score: number;
  maxScore: number;
  appreciation: string;
}

export interface CandidateEvaluationResult {
  candidateId?: string;
  themeProfiles: ThemeScoreProfile[];
  testPositionnement: {
    totalScore: number; // e.g. 16/20
    maxScore?: number;
    scorePercentage: number;
    summary?: string;
  };
  grilleEvaluation: {
    totalScore60: number; // e.g. 48/60
    convertedScore20: number; // e.g. 16/20
    juryMention: 'ADMIS';
    presidentAppreciation: string;
  };
  competencies: CompetencyScore[];
  additionalAiTexts?: {
    parcoursSummary: string;
    projetSummary: string;
  };
}

export interface GenerationLog {
  id: string;
  timestamp: string;
  candidateId: string;
  candidateName: string;
  certification: string;
  organisme: Organization;
  documentsProduced: string[];
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}
