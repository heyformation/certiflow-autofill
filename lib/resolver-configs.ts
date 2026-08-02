/**
 * resolver-configs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry of per-document resolver configurations.
 *
 * Each entry maps a document type to its resolver config, describing how every
 * {{FILL: label}}, {{FILL}}, and {{CHECKBOX}} placeholder resolves to a value.
 *
 * This is the "Configuration file for the per-certification theme reference
 * list" the spec asks for in §11 — and it's exactly what turns the placeholder
 * tags from Templates_MD/ into a working fill engine.
 */

import { DocumentResolverConfig, ResolverConfigRegistry } from './resolver-config-schema';

// ─── Individual Document Configs ─────────────────────────────────────────────

const recueilDesBesoins: DocumentResolverConfig = {
  document: 'Recueil des Besoins',
  category: 'B',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'Nom et prénom', resolver: { type: 1, source: 'fullName' } },
    // RS6485-specific fields
    { tag: 'Microsoft Word', resolver: { type: 2, ai_prompt_hint: 'Self-assessed skill level for Microsoft Word (1 phrase)', content_type: 'free_text' } },
    { tag: 'Microsoft Excel', resolver: { type: 2, ai_prompt_hint: 'Self-assessed skill level for Microsoft Excel (1 phrase)', content_type: 'free_text' } },
    { tag: 'Utilisation d\'un ordinateur (fichiers dossiers navigation)', resolver: { type: 2, ai_prompt_hint: 'Self-assessed computer usage level (1 phrase)', content_type: 'free_text' } },
    { tag: 'Utilisation d\'Internet et des emails professionnels', resolver: { type: 2, ai_prompt_hint: 'Self-assessed internet/email proficiency (1 phrase)', content_type: 'free_text' } },
    { tag: 'Validation', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    { tag: 'Commentaires ou précisions complémentaires (facultatif)', resolver: { type: 2, ai_prompt_hint: 'Optional additional comments from candidate about training needs', content_type: 'free_text' } },
    // RS7200-specific fields
    { tag: 'Votre fonction actuelle au sein de l\'entreprise', resolver: { type: 1, source: 'experience_pro' } },
    { tag: 'Êtes-vous familiarisé(e) avec l\'outil de création graphique Canva', resolver: { type: 2, ai_prompt_hint: 'Free-text answer about content production difficulty or training expectations for social media', content_type: 'free_text' } },
    // RS7311-specific fields
    { tag: 'SECTION 1 Accessibilité et Prérequis', resolver: { type: 2, ai_prompt_hint: 'Free-text accessibility and prerequisites info', content_type: 'free_text' } },
    // RS7344-specific fields
    { tag: 'Merci de préciser toute difficulté ou besoin particulier', resolver: { type: 2, ai_prompt_hint: 'Free-text specific needs or difficulties', content_type: 'free_text' } },
    // Case-variant: "Nom et Prénom" (capitalized differently per RS)
    { tag: 'Nom et Prénom', resolver: { type: 1, source: 'fullName' } },
  ],
  checkbox_groups: [
    // Common across RS codes
    { section: 'Statut actuel', resolver: { type: 2, ai_prompt_hint: 'Select candidate professional status matching their experience_pro', content_type: 'checkbox_selection' }, option_count: 5 },
    { section: 'Travaillez-vous actuellement dans une TPE / PME', resolver: { type: 2, ai_prompt_hint: 'Yes/No based on experience_pro context', content_type: 'checkbox_selection' }, option_count: 2 },
    // RS6485-specific checkbox groups
    { section: 'Avez-vous déjà réalisé des tâches comptables', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Frequency of accounting tasks, correlated to theme level', content_type: 'checkbox_selection' }, option_count: 3 },
    { section: 'Comment évaluez-vous votre niveau en comptabilité', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Self-assessed accounting level, correlated to overall theme', content_type: 'checkbox_selection' }, option_count: 3 },
    { section: 'Quelles opérations maîtrisez-vous déjà', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Select operations mastered, more selections at higher theme levels', content_type: 'checkbox_selection' }, option_count: 6 },
    { section: 'Pourquoi souhaitez-vous suivre cette formation', resolver: { type: 2, ai_prompt_hint: 'Training motivation - select 1-2 realistic goals', content_type: 'checkbox_selection' }, option_count: 4 },
    { section: 'Quels sont vos objectifs professionnels', resolver: { type: 2, ai_prompt_hint: 'Professional goals - select 1-2 matching candidate profile', content_type: 'checkbox_selection' }, option_count: 5 },
    { section: 'Cette formation est-elle en lien direct', resolver: { type: 2, ai_prompt_hint: 'Almost always Oui for enrolled candidates', content_type: 'checkbox_selection' }, option_count: 2 },
    { section: 'Disposez-vous du matériel nécessaire', resolver: { type: 2, ai_prompt_hint: 'Almost always Oui for distance-learning candidates', content_type: 'checkbox_selection' }, option_count: 2 },
    { section: 'Avez-vous déjà suivi une formation à distance', resolver: { type: 2, ai_prompt_hint: 'Yes/No based on experience context', content_type: 'checkbox_selection' }, option_count: 2 },
    { section: 'Avez-vous des besoins spécifiques', resolver: { type: 2, ai_prompt_hint: 'Usually Non for standard candidates', content_type: 'checkbox_selection' }, option_count: 3 },
    { section: 'Confirmez-vous que cette formation correspond', resolver: { type: 2, ai_prompt_hint: 'Always Oui for enrolled candidates', content_type: 'checkbox_selection' }, option_count: 2 },
    // RS7200-specific checkbox groups
    { section: 'Quels sont les principaux réseaux sociaux', resolver: { type: 2, theme: 'c2', ai_prompt_hint: 'Select social platforms matching business type', content_type: 'checkbox_selection' }, option_count: 8 },
    { section: 'Quels sont vos principaux objectifs en participant', resolver: { type: 2, ai_prompt_hint: 'Select 2-3 training objectives for social media', content_type: 'checkbox_selection' }, option_count: 8 },
    { section: 'Niveau de maîtrise', resolver: { type: 2, ai_prompt_hint: 'Self-assessed level 1-5 matching overall theme profile', content_type: 'checkbox_selection' }, option_count: 5 },
    { section: 'Définition des objectifs et identification des cibles', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Level 1-5 per theme row in assessment table', content_type: 'checkbox_selection' }, option_count: 5 },
    { section: 'Canva', resolver: { type: 2, theme: 'c3', ai_prompt_hint: 'Canva familiarity level', content_type: 'checkbox_selection' }, option_count: 3 },
  ],
};

const testDePositionnement: DocumentResolverConfig = {
  document: 'Test de Positionnement',
  category: 'B',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'Nom et Prénom', resolver: { type: 1, source: 'fullName' } },
  ],
  checkbox_groups: [
    // All MCQ questions (20 per RS code, 4 options each = 80 checkboxes typically)
    // These are resolved as Type 2: AI selects correct/incorrect answers based on theme level
    // The fill engine groups consecutive {{CHECKBOX}} blocks under their question heading
    { section: 'PARTIE 1', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'MCQ answer selection: pick correct answer if theme level >= 3, occasionally wrong if level 1-2. Must result in overall score matching testPositionnement.totalScore', content_type: 'mcq_answer' } },
    { section: 'PARTIE 2', resolver: { type: 2, theme: 'c2', ai_prompt_hint: 'MCQ answer selection correlated to theme c2 level', content_type: 'mcq_answer' } },
    { section: 'PARTIE 3', resolver: { type: 2, theme: 'c3', ai_prompt_hint: 'MCQ answer selection correlated to theme c3 level', content_type: 'mcq_answer' } },
    { section: 'PARTIE 4', resolver: { type: 2, theme: 'c4', ai_prompt_hint: 'MCQ answer selection correlated to theme c4 level', content_type: 'mcq_answer' } },
    { section: 'PARTIE 5', resolver: { type: 2, theme: 'c5', ai_prompt_hint: 'MCQ answer selection correlated to theme c5 level', content_type: 'mcq_answer' } },
  ],
};

const ficheEligibilite: DocumentResolverConfig = {
  document: 'Fiche Eligibilite',
  category: 'B',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'Nom et Prénom', resolver: { type: 1, source: 'fullName' } },
    { tag: 'Date de l\'entretien / de l\'analyse', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    { tag: 'Fonction / activité actuelle du candidat', resolver: { type: 1, source: 'experience_pro' } },
    { tag: 'Principaux objectifs et attentes exprimés par le candidat', resolver: { type: 2, ai_prompt_hint: 'Candidate objectives and expectations for this certification, 2-3 sentences', content_type: 'free_text' } },
    { tag: 'Score obtenu au test de positionnement (sur 20)', resolver: { type: 2, ai_prompt_hint: 'Use evalResult.testPositionnement.totalScore value', content_type: 'score' } },
    { tag: 'Date de passation du test', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    { tag: 'Thèmes ou notions maîtrisés (points forts identifiés)', resolver: { type: 2, ai_prompt_hint: 'List strong themes based on high-level theme profiles', content_type: 'free_text' } },
    { tag: 'Thèmes ou notions à renforcer (lacunes identifiées)', resolver: { type: 2, ai_prompt_hint: 'List themes needing improvement based on low-level theme profiles', content_type: 'free_text' } },
    { tag: 'Adaptations à prévoir (cocher toutes les options pertinentes)', resolver: { type: 2, ai_prompt_hint: 'Free-text adaptation details if any adaptations were checked', content_type: 'free_text' } },
    { tag: 'Nom du formateur / évaluateur certificateur ayant réalisé l\'analyse', resolver: { type: 3, static_source: 'jury_chair' } },
    { tag: 'Date et signature', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    // RS7311 variant
    { tag: '3 Résultat du Test de Positionnement', resolver: { type: 2, ai_prompt_hint: 'Test positioning result summary', content_type: 'score' } },
  ],
  checkbox_groups: [
    { section: 'Niveau déclaré', resolver: { type: 2, ai_prompt_hint: 'Select level 1-5 matching average theme profile', content_type: 'checkbox_selection' }, option_count: 5 },
    { section: 'Analyse croisée', resolver: { type: 2, ai_prompt_hint: 'Select coherence assessment: usually "Oui, cohérent" or "Écart mineur"', content_type: 'checkbox_selection' }, option_count: 3 },
    { section: 'Statut d\'éligibilité', resolver: { type: 2, ai_prompt_hint: 'Almost always "Éligible sans réserve" for accepted candidates', content_type: 'checkbox_selection' }, option_count: 4 },
    { section: 'Adaptations à prévoir', resolver: { type: 2, ai_prompt_hint: 'Usually "Aucune adaptation nécessaire" for standard candidates', content_type: 'checkbox_selection' }, option_count: 7 },
  ],
};

const dossierDePresentation: DocumentResolverConfig = {
  document: 'Dossier de Presentation',
  category: 'B',
  rs_codes: ['RS6485', 'RS7200', 'RS7311'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'NOM', resolver: { type: 1, source: 'nom' } },
    { tag: 'PRÉNOM', resolver: { type: 1, source: 'prenom' } },
    { tag: 'PRENOM', resolver: { type: 1, source: 'prenom' } },
    { tag: 'DATE_NAISSANCE', resolver: { type: 1, source: 'date_naissance', allow_empty: true } },
    { tag: 'TYPE_PIECE', resolver: { type: 2, ai_prompt_hint: 'ID document type: CNI or Passeport', content_type: 'free_text' } },
    { tag: 'NUMERO_PIECE', resolver: { type: 2, ai_prompt_hint: 'ID number placeholder — leave as generated format', content_type: 'free_text' } },
    { tag: 'DATE_VALIDITE', resolver: { type: 2, ai_prompt_hint: 'ID validity date placeholder', content_type: 'free_text' } },
    { tag: 'ADRESSE_CANDIDAT', resolver: { type: 1, source: 'address' } },
    { tag: 'TELEPHONE', resolver: { type: 1, source: 'phone' } },
    { tag: 'EMAIL', resolver: { type: 1, source: 'email' } },
    { tag: 'DATE_SESSION', resolver: { type: 1, source: 'dateSession', allow_empty: true } },
    { tag: 'MODALITE', resolver: { type: 3, static_value: 'À distance' } },
    { tag: 'VOIE_ACCES', resolver: { type: 3, static_value: 'FPC (Formation Professionnelle Continue)' } },
    { tag: 'NOTE_GLOBALE', resolver: { type: 2, ai_prompt_hint: 'Use evalResult.grilleEvaluation.convertedScore20', content_type: 'score' } },
    { tag: 'PERIODE', resolver: { type: 2, ai_prompt_hint: 'Professional experience period from experience_pro', content_type: 'free_text' } },
    { tag: 'POSTE', resolver: { type: 2, ai_prompt_hint: 'Job title extracted from experience_pro', content_type: 'free_text' } },
    { tag: 'EMPLOYEUR', resolver: { type: 2, ai_prompt_hint: 'Employer name extracted from experience_pro', content_type: 'free_text' } },
    { tag: 'COMPETENCE_1', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Key competency demonstrated, linked to theme c1', content_type: 'free_text' } },
    { tag: 'COMPETENCE_2', resolver: { type: 2, theme: 'c2', ai_prompt_hint: 'Key competency demonstrated, linked to theme c2', content_type: 'free_text' } },
    { tag: 'COMPETENCE_3', resolver: { type: 2, theme: 'c3', ai_prompt_hint: 'Key competency demonstrated, linked to theme c3', content_type: 'free_text' } },
    { tag: 'COMPETENCE_4', resolver: { type: 2, theme: 'c4', ai_prompt_hint: 'Key competency demonstrated, linked to theme c4', content_type: 'free_text' } },
    { tag: 'PRESENTATION_DU_PROJET_ENTREPRENEURIAL', resolver: { type: 2, ai_prompt_hint: 'Entrepreneurial project presentation paragraph', content_type: 'free_text' } },
    { tag: 'ELEMENT_CLE_PROJET_1', resolver: { type: 2, ai_prompt_hint: 'Key element 1 of entrepreneurial project', content_type: 'free_text' } },
    { tag: 'ELEMENT_CLE_PROJET_2', resolver: { type: 2, ai_prompt_hint: 'Key element 2 of entrepreneurial project', content_type: 'free_text' } },
    { tag: 'ELEMENT_CLE_PROJET_3', resolver: { type: 2, ai_prompt_hint: 'Key element 3 of entrepreneurial project', content_type: 'free_text' } },
    { tag: 'NOTE_QCM', resolver: { type: 2, ai_prompt_hint: 'QCM score out of 60 from evalResult.grilleEvaluation.totalScore60', content_type: 'score' } },
    { tag: 'RESULTAT', resolver: { type: 2, ai_prompt_hint: 'ADMIS or AJOURNÉ based on score', content_type: 'free_text' } },
    { tag: 'STATUT', resolver: { type: 2, ai_prompt_hint: 'Document status: Transmis / Validé', content_type: 'free_text' } },
    { tag: 'OBSERVATION_PRESIDENT', resolver: { type: 2, ai_prompt_hint: 'Jury president observation about the candidate performance', content_type: 'appreciation' } },
    { tag: 'OBSERVATION_MEMBRE', resolver: { type: 2, ai_prompt_hint: 'Jury member observation about the candidate', content_type: 'appreciation' } },
    { tag: 'APPRECIATION_DETAILLEE_PRESIDENT', resolver: { type: 2, ai_prompt_hint: 'Detailed jury president appreciation', content_type: 'appreciation' } },
    { tag: 'APPRECIATION_DETAILLEE_MEMBRE', resolver: { type: 2, ai_prompt_hint: 'Detailed jury member appreciation', content_type: 'appreciation' } },
    { tag: 'NOM_PROJET_TPE', resolver: { type: 2, ai_prompt_hint: 'Name of the TPE project presented by candidate', content_type: 'free_text' } },
    { tag: 'THEMATIQUE_1', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Theme title for competency 1 from theme-config', content_type: 'free_text' } },
    { tag: 'THEMATIQUE_2', resolver: { type: 2, theme: 'c2', ai_prompt_hint: 'Theme title for competency 2', content_type: 'free_text' } },
    { tag: 'THEMATIQUE_3', resolver: { type: 2, theme: 'c3', ai_prompt_hint: 'Theme title for competency 3', content_type: 'free_text' } },
    { tag: 'THEMATIQUE_4', resolver: { type: 2, theme: 'c4', ai_prompt_hint: 'Theme title for competency 4', content_type: 'free_text' } },
    { tag: 'THEMATIQUE_5', resolver: { type: 2, theme: 'c5', ai_prompt_hint: 'Theme title for competency 5', content_type: 'free_text' } },
    { tag: 'CONTENU_DEVELOPPE_1', resolver: { type: 2, theme: 'c1', ai_prompt_hint: 'Content developed by candidate for theme 1', content_type: 'free_text' } },
    { tag: 'CONTENU_DEVELOPPE_2', resolver: { type: 2, theme: 'c2', ai_prompt_hint: 'Content developed by candidate for theme 2', content_type: 'free_text' } },
    { tag: 'CONTENU_DEVELOPPE_3', resolver: { type: 2, theme: 'c3', ai_prompt_hint: 'Content developed by candidate for theme 3', content_type: 'free_text' } },
    { tag: 'CONTENU_DEVELOPPE_4', resolver: { type: 2, theme: 'c4', ai_prompt_hint: 'Content developed by candidate for theme 4', content_type: 'free_text' } },
    { tag: 'CONTENU_DEVELOPPE_5', resolver: { type: 2, theme: 'c5', ai_prompt_hint: 'Content developed by candidate for theme 5', content_type: 'free_text' } },
    { tag: 'POINT_FORT_1', resolver: { type: 2, ai_prompt_hint: 'Strong point 1 identified in the dossier', content_type: 'free_text' } },
    { tag: 'POINT_FORT_2', resolver: { type: 2, ai_prompt_hint: 'Strong point 2 identified in the dossier', content_type: 'free_text' } },
    { tag: 'POINT_FORT_3', resolver: { type: 2, ai_prompt_hint: 'Strong point 3 identified in the dossier', content_type: 'free_text' } },
    { tag: 'DATE_SIGNATURE', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    // RS7200 Dossier de Presentation has NOTE_ORAL
    { tag: 'NOTE_ORAL', resolver: { type: 2, ai_prompt_hint: 'Oral presentation score', content_type: 'score' } },
  ],
  checkbox_groups: [],
};

const pvEvaluation: DocumentResolverConfig = {
  document: 'PV Evaluation',
  category: 'B',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'DATE_JURY', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
    { tag: 'NOM', resolver: { type: 1, source: 'nom' } },
    { tag: 'PRENOM', resolver: { type: 1, source: 'prenom' } },
    { tag: 'VOIE_ACCES', resolver: { type: 3, static_value: 'FPC' } },
    { tag: 'NOTE_60', resolver: { type: 2, ai_prompt_hint: 'Score /60 from evalResult.grilleEvaluation.totalScore60', content_type: 'score' } },
    { tag: 'ADMIS', resolver: { type: 2, ai_prompt_hint: '"Admis" if score >= 30/60 (i.e. 10/20), else empty', content_type: 'free_text' } },
    { tag: 'AJOURNE', resolver: { type: 2, ai_prompt_hint: '"Ajourné" only if score < 30/60, else empty', content_type: 'free_text' } },
    { tag: 'NB_H', resolver: { type: 2, ai_prompt_hint: 'Number of male candidates (default 0 or 1)', content_type: 'score' } },
    { tag: 'NB_F', resolver: { type: 2, ai_prompt_hint: 'Number of female candidates (default 0 or 1)', content_type: 'score' } },
    { tag: 'NB_TOTAL', resolver: { type: 2, ai_prompt_hint: 'Total candidates (usually 1)', content_type: 'score' } },
    { tag: 'NB_H_RECUS', resolver: { type: 2, ai_prompt_hint: 'Number of male candidates who passed', content_type: 'score' } },
    { tag: 'NB_F_RECUES', resolver: { type: 2, ai_prompt_hint: 'Number of female candidates who passed', content_type: 'score' } },
    { tag: 'NB_TOTAL_RECUS', resolver: { type: 2, ai_prompt_hint: 'Total candidates who passed (usually 1)', content_type: 'score' } },
    // RS7344-specific PV fields
    { tag: 'COMPTE-RENDU DU RESPONSABLE DE l ORGANISATION DES ÉPREUVES 1', resolver: { type: 3, static_value: '' }, position_hint: 'PV RS7344 table header column 1' },
    { tag: 'COMPTE-RENDU DU RESPONSABLE DE l ORGANISATION DES ÉPREUVES 2', resolver: { type: 3, static_value: '' }, position_hint: 'PV RS7344 table header column 2' },
    { tag: 'COMPTE-RENDU DU RESPONSABLE DE l ORGANISATION DES ÉPREUVES 3', resolver: { type: 3, static_value: '' }, position_hint: 'PV RS7344 table header column 3' },
    { tag: 'COMPTE-RENDU DU RESPONSABLE DE l ORGANISATION DES ÉPREUVES 4', resolver: { type: 3, static_value: '' }, position_hint: 'PV RS7344 table header column 4' },
    { tag: 'COMPTE-RENDU DU RESPONSABLE DE l ORGANISATION DES ÉPREUVES 5', resolver: { type: 3, static_value: '' }, position_hint: 'PV RS7344 table header column 5' },
    { tag: 'FICHE DE DYSFONCTIONNEMENT 1', resolver: { type: 3, static_value: '' }, position_hint: 'Dysfonctionnement table header 1' },
    { tag: 'FICHE DE DYSFONCTIONNEMENT 2', resolver: { type: 3, static_value: '' }, position_hint: 'Dysfonctionnement table header 2' },
  ],
  checkbox_groups: [],
};

const evaluationFinale: DocumentResolverConfig = {
  document: 'Evaluation Finale',
  category: 'C',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    // Module header fields (repeated per module): "Module X ... 1" and "Module X ... 2" are table headers
    // These are structural — the "1" and "2" columns of the header row
    { tag: 'Module 1 Documents Comptables Fondamentaux 1', resolver: { type: 3, static_value: '' }, position_hint: 'Module 1 header col1' },
    { tag: 'Module 1 Documents Comptables Fondamentaux 2', resolver: { type: 3, static_value: '' }, position_hint: 'Module 1 header col2' },
    { tag: 'Module 2 Opérations Comptables Courantes 1', resolver: { type: 3, static_value: '' }, position_hint: 'Module 2 header col1' },
    { tag: 'Module 2 Opérations Comptables Courantes 2', resolver: { type: 3, static_value: '' }, position_hint: 'Module 2 header col2' },
    { tag: 'Module 3 Pilotage Prévisionnel 1', resolver: { type: 3, static_value: '' }, position_hint: 'Module 3 header col1' },
    { tag: 'Module 3 Pilotage Prévisionnel 2', resolver: { type: 3, static_value: '' }, position_hint: 'Module 3 header col2' },
    { tag: 'Module 4 Tableau de Bord et Contrôle de Gestion 1', resolver: { type: 3, static_value: '' }, position_hint: 'Module 4 header col1' },
    { tag: 'Module 4 Tableau de Bord et Contrôle de Gestion 2', resolver: { type: 3, static_value: '' }, position_hint: 'Module 4 header col2' },
    { tag: 'Module 5 Statuts Juridiques et Organisation 1', resolver: { type: 3, static_value: '' }, position_hint: 'Module 5 header col1' },
    { tag: 'Module 5 Statuts Juridiques et Organisation 2', resolver: { type: 3, static_value: '' }, position_hint: 'Module 5 header col2' },
    // RS7200 module headers
    { tag: 'Module 1 Les Fondamentaux des Réseaux Sociaux 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 1 Les Fondamentaux des Réseaux Sociaux 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 Stratégie RS et Ligne Éditoriale 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 Stratégie RS et Ligne Éditoriale 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Création de Contenu 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Création de Contenu 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Planification et Outils 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Planification et Outils 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 5 Mesure et Optimisation 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 5 Mesure et Optimisation 2', resolver: { type: 3, static_value: '' } },
    // RS7311 module headers
    { tag: 'Module 1 Fondamentaux IA Diagnostic TPE RGPD et Éthique 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 1 Fondamentaux IA Diagnostic TPE RGPD et Éthique 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 LLM Prompt Engineering et Création de Contenu IA 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 LLM Prompt Engineering et Création de Contenu IA 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Analyse de Données Tableaux de Bord et IA Prédictive 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Analyse de Données Tableaux de Bord et IA Prédictive 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Automatisation Make Chatbots et Workflows 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Automatisation Make Chatbots et Workflows 2', resolver: { type: 3, static_value: '' } },
    // RS7344 module headers ("Module" naming variant)
    { tag: 'Module 1 Diagnostiquer et Cartographier ses Processus 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 1 Diagnostiquer et Cartographier ses Processus 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 Stratégie IA Marketing et Relation Client 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 2 Stratégie IA Marketing et Relation Client 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Prompting RGPD et Workflows 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 3 Prompting RGPD et Workflows 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Conduite du Changement Charte IA et Éthique 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 4 Conduite du Changement Charte IA et Éthique 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 5 KPIs IA ROI et Optimisation Continue 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Module 5 KPIs IA ROI et Optimisation Continue 2', resolver: { type: 3, static_value: '' } },
    // RS7344 competency header fields ("Compétence" naming variant)
    { tag: 'Compétence 1 Diagnostiquer et Cartographier ses Processus 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 1 Diagnostiquer et Cartographier ses Processus 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 2 Stratégie IA Marketing et Relation Client 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 2 Stratégie IA Marketing et Relation Client 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 3 Prompting RGPD et Workflows 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 3 Prompting RGPD et Workflows 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 4 Conduite du Changement Charte IA et Éthique 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 4 Conduite du Changement Charte IA et Éthique 2', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 5 KPIs IA ROI et Optimisation Continue 1', resolver: { type: 3, static_value: '' } },
    { tag: 'Compétence 5 KPIs IA ROI et Optimisation Continue 2', resolver: { type: 3, static_value: '' } },
    // Open question answer fields
    { tag: 'PARTIE 2 Questions ouvertes (5 points chacune)', resolver: { type: 2, ai_prompt_hint: 'Written answer to open question, personalized to candidate experience and theme level. 3-6 sentences.', content_type: 'free_text' } },
    // Cas pratique answer
    { tag: 'Votre production', resolver: { type: 2, ai_prompt_hint: 'Written answer to the practical case study scenario. Show calculations and reasoning. 4-8 sentences.', content_type: 'free_text' } },
  ],
  checkbox_groups: [
    // All MCQ answers across 5 modules × 5 questions each
    { section: 'QCM', resolver: { type: 2, ai_prompt_hint: 'MCQ answer: pick correct answer at high theme level, occasionally wrong at low level. Total score must stay >= 10/20.', content_type: 'mcq_answer' } },
  ],
};

const evaluationIntermediaire: DocumentResolverConfig = {
  document: 'Evaluation Intermediaire',
  category: 'C',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  // Same structure as Evaluation Finale — shares the same field/checkbox patterns
  fields: [...evaluationFinale.fields],
  checkbox_groups: [...evaluationFinale.checkbox_groups],
};

const casPratiques: DocumentResolverConfig = {
  document: 'Cas Pratiques',
  category: 'C',
  rs_codes: ['RS6485', 'RS7200', 'RS7311', 'RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  // Reuse all module header fields from evaluationFinale + add cas pratique production
  fields: [
    ...evaluationFinale.fields.filter(f => !f.tag.includes('Questions ouvertes')),
    { tag: 'Votre production', resolver: { type: 2, ai_prompt_hint: 'Written practical case answer. Show calculations and reasoning. 4-8 sentences.', content_type: 'free_text' } },
  ],
  checkbox_groups: [],
};

const membresJury: DocumentResolverConfig = {
  document: 'Membres du Jury',
  category: 'C',
  rs_codes: ['RS6485', 'RS7200'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  // No {{FILL}} or {{CHECKBOX}} placeholders — entirely static content
  fields: [],
  checkbox_groups: [],
  skip_fill: true,
};

const ficheDeMission: DocumentResolverConfig = {
  document: 'Fiche de Mission',
  category: 'C',
  rs_codes: ['RS6485', 'RS7200'],
  institutes: ['Proskills Institut', 'Proforma Institut'],
  fields: [
    { tag: 'NOM_PRENOM_1', resolver: { type: 1, source: 'fullName' } },
    { tag: 'NOM_PRENOM_2', resolver: { type: 2, ai_prompt_hint: 'Second candidate name if batch, else empty', content_type: 'free_text' } },
    { tag: 'DATE_JURY', resolver: { type: 1, source: 'dateExamen', allow_empty: true } },
  ],
  checkbox_groups: [],
};

const qcm: DocumentResolverConfig = {
  document: 'QCM',
  category: 'C',
  rs_codes: ['RS6485'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  // QCM files have NO placeholders — they're answer keys with ✓ marks
  fields: [],
  checkbox_groups: [],
  skip_fill: true,
};

const dossierInscription: DocumentResolverConfig = {
  document: 'Dossier Inscription',
  category: 'C',
  rs_codes: ['RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    // Table header structural fields
    { tag: 'DOSSIER D\'INSCRIPTION À L\'EXAMEN DE CERTIFICATION (MODÈLE VIERGE) 1', resolver: { type: 3, static_value: '' }, position_hint: 'Table header column 1' },
    { tag: 'DOSSIER D\'INSCRIPTION À L\'EXAMEN DE CERTIFICATION (MODÈLE VIERGE) 2', resolver: { type: 3, static_value: '' }, position_hint: 'Table header column 2' },
  ],
  checkbox_groups: [
    { section: 'ENGAGEMENT DU CANDIDAT', resolver: { type: 2, ai_prompt_hint: 'Both checkboxes should be checked for enrolled candidates', content_type: 'checkbox_selection' }, option_count: 2 },
  ],
};

const trameDossierCertification: DocumentResolverConfig = {
  document: 'Trame Dossier Certification',
  category: 'B',
  rs_codes: ['RS7200', 'RS7311'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    { tag: 'CHAMP', resolver: { type: 3, static_value: '' }, position_hint: 'Header table structural cell' },
    { tag: 'CHAMP 1', resolver: { type: 3, static_value: '' }, position_hint: 'Identity table header col1' },
    { tag: 'CHAMP 2', resolver: { type: 3, static_value: '' }, position_hint: 'Identity table header col2' },
  ],
  checkbox_groups: [],
};

const renduEcrit: DocumentResolverConfig = {
  document: 'Rendu Ecrit',
  category: 'C',
  rs_codes: ['RS7344'],
  institutes: ['Proforma Institut', 'Proskills Institut'],
  fields: [
    // Header table structural fields
    { tag: 'RENDU ÉCRIT CAS PRATIQUE (MODÈLE VIERGE) 1', resolver: { type: 3, static_value: '' }, position_hint: 'Header row col1' },
    { tag: 'RENDU ÉCRIT CAS PRATIQUE (MODÈLE VIERGE) 2', resolver: { type: 3, static_value: '' }, position_hint: 'Header row col2' },
    // Feuille de route table headers
    { tag: 'Sources identifiées 1', resolver: { type: 3, static_value: '' }, position_hint: 'Roadmap table header col1' },
    { tag: 'Sources identifiées 2', resolver: { type: 3, static_value: '' }, position_hint: 'Roadmap table header col2' },
    { tag: 'Sources identifiées 3', resolver: { type: 3, static_value: '' }, position_hint: 'Roadmap table header col3' },
    { tag: 'Sources identifiées 4', resolver: { type: 3, static_value: '' }, position_hint: 'Roadmap table header col4' },
    // Charte table headers
    { tag: 'Ressources financières 1', resolver: { type: 3, static_value: '' }, position_hint: 'Charter table header col1' },
    { tag: 'Ressources financières 2', resolver: { type: 3, static_value: '' }, position_hint: 'Charter table header col2' },
  ],
  checkbox_groups: [],
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const RESOLVER_CONFIG_REGISTRY: ResolverConfigRegistry = {
  'Recueil des Besoins': recueilDesBesoins,
  'Test de Positionnement': testDePositionnement,
  'Fiche Eligibilite': ficheEligibilite,
  'Dossier de Presentation': dossierDePresentation,
  'PV Evaluation': pvEvaluation,
  'Evaluation Finale': evaluationFinale,
  'Evaluation Intermediaire': evaluationIntermediaire,
  'Evaluations Intermediaires': evaluationIntermediaire, // alternate naming
  'Cas Pratiques': casPratiques,
  'Membres du Jury': membresJury,
  'Fiche de Mission': ficheDeMission,
  'QCM': qcm,
  'Dossier Inscription': dossierInscription,
  'Trame Dossier Certification': trameDossierCertification,
  'Rendu Ecrit': renduEcrit,
  '1_PV_evaluation': pvEvaluation, // legacy file
};

/**
 * Look up the resolver config for a document type.
 * Returns undefined if no config exists (document should be skipped or has no placeholders).
 */
export function getResolverConfig(documentType: string): DocumentResolverConfig | undefined {
  return RESOLVER_CONFIG_REGISTRY[documentType];
}

/**
 * Parse a template filename into its components.
 * E.g. "Fiche Eligibilite - RS6485 - Proforma Institut.md" →
 *   { type: "Fiche Eligibilite", rsCode: "RS6485", institute: "Proforma Institut" }
 */
export function parseTemplateFilename(filename: string): {
  type: string;
  rsCode: string;
  institute: string;
} | null {
  const base = filename.replace(/\.md$/, '');
  const parts = base.split(' - ');
  if (parts.length !== 3) {
    // Handle legacy file like "1_PV_evaluation.md"
    return { type: base, rsCode: '', institute: '' };
  }
  return {
    type: parts[0].trim(),
    rsCode: parts[1].trim(),
    institute: parts[2].trim(),
  };
}
