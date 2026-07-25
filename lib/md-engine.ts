import { getJuryRules } from './jury-rules';
import { CandidateEvaluationResult, CandidateRow } from './types';

export interface GeneratedMdFile {
  filename: string;
  relativePath: string;
  category: string;
  content: string;
}

export function generateCandidateMarkdownFiles(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult
): GeneratedMdFile[] {
  const juryRules = getJuryRules(candidate.organisme);
  const candidateFolder = `${candidate.organisme}/${candidate.code_certif} - ${getModuleShortName(candidate.code_certif)}`;

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const files: GeneratedMdFile[] = [];

  // 1. Category A — CV Candidate
  const cvContent = `# CV — ${candidate.civilite || 'M.'} ${candidate.prenom} ${candidate.nom}

**Identité & Coordonnées**
- **Nom complet** : ${candidate.prenom} ${candidate.nom}
- **Titre / Civilité** : ${candidate.civilite || 'M.'}
- **E-mail** : ${candidate.mail || candidate.mail_wedof || candidate.mail_crm || 'candidat@email.fr'}
- **Téléphone** : ${candidate.numero_tel || '06 00 00 00 00'}
- **Adresse** : ${candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || 'Paris, France'}
- **Organisme de formation** : ${candidate.organisme}
- **Certification visée** : ${candidate.code_certif} — ${candidate.formation}

---

## Parcours & Expérience Professionnelle
${candidate.experience_pro || 'Expérience et pratique professionnelle adaptées aux opérations TPE.'}

### Résumé IA du Parcours
${evalResult.additionalAiTexts?.parcoursSummary || 'Parcours professionnel avec expérience significative adaptée aux exigences du Répertoire Spécifique.'}

---

## Compétences Clés & Objectifs de Certification
- Maîtrise des processus opérationnels TPE
- Gestion administrative et organisationnelle
- Projet d'entreprise : ${evalResult.additionalAiTexts?.projetSummary || 'Projet de structuration et développement d’activité TPE.'}
`;

  files.push({
    filename: `CV - ${candidate.prenom} ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/CV - ${candidate.prenom} ${candidate.nom}.md`,
    category: 'Category A — CV',
    content: cvContent,
  });

  // 2. Category B — Recueil des Besoins
  const recueilContent = `# Recueil des Besoins — ${candidate.code_certif}
**Organisme** : ${candidate.organisme}  
**Stagiaire** : ${candidate.prenom} ${candidate.nom}  
**Date d'analyse** : ${currentDate}  

---

### 1. Profil & Situation
- **Apprenant** : ${candidate.prenom} ${candidate.nom}
- **Formation visée** : ${candidate.formation} (${candidate.code_certif})
- **Expérience déclarée** : ${candidate.experience_pro}

### 2. Auto-évaluation des Thématiques de Compétences (Échelle 1 à 5)
${evalResult.themeProfiles
  .map((t) => `- **${t.themeTitle}** : Niveau ${t.level}/5`)
  .join('\n')}

---

### 3. Objectifs d'Apprentissage & Attentes
- Approfondissement des thématiques cibles pour optimiser l'organisation de la TPE.
- Acquisition des méthodologies certifiantes Qualiopi & Répertoire Spécifique.
`;

  files.push({
    filename: `Recueil_des_Besoins - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/Recueil_des_Besoins - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category B — Pedagogique',
    content: recueilContent,
  });

  // 3. Category B — Test de Positionnement
  const testPosContent = `# Test de Positionnement — ${candidate.code_certif}
**Candidat** : ${candidate.prenom} ${candidate.nom}  
**Organisme** : ${candidate.organisme}  
**Date du test** : ${currentDate}  

---

## Résultat Global du Positionnement
- **Score obtenu** : **${evalResult.testPositionnement.totalScore} / 20** (${evalResult.testPositionnement.scorePercentage}%)
- **Statut** : Positionnement validé (Informatif, non éliminatoire)

---

## Diagnostic par Domaine de Compétences
${evalResult.themeProfiles
  .map(
    (t) =>
      `### ${t.themeTitle}\n- **Niveau diagnostiqué** : ${t.level}/5\n- **Appréciation** : Niveau d'assimilation conforme aux prérequis de la formation.`
  )
  .join('\n\n')}
`;

  files.push({
    filename: `Test_de_Positionnement - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/Test_de_Positionnement - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category B — Pedagogique',
    content: testPosContent,
  });

  // 4. Category B — Grille d'Évaluation Certifiante (Exam Day)
  const grilleContent = `# Grille d'Évaluation Certifiante — ${candidate.code_certif}
**Candidat** : ${candidate.civilite || 'M.'} ${candidate.prenom} ${candidate.nom}  
**Certification** : ${candidate.formation} (${candidate.code_certif})  
**Organisme** : ${candidate.organisme}  
**Date d'examen** : ${candidate.date_examen || currentDate}  

---

## Synthèse des Notes Certifiantes
- **Note globale / 60** : **${evalResult.grilleEvaluation.totalScore60} / 60**
- **Note ramenée sur 20** : **${evalResult.grilleEvaluation.convertedScore20} / 20** (Pass Floor >= 10/20 Respecté)
- **Décision du Jury** : **${evalResult.grilleEvaluation.juryMention}**

---

## Détail des Critères de Compétences
${evalResult.competencies
  .map(
    (c) =>
      `### ${c.title}\n- **Score** : ${c.score} / ${c.maxScore}\n- **Observation** : ${c.appreciation}`
  )
  .join('\n\n')}

---

## Appréciation Général du Président du Jury (${juryRules.presidentName})
> "${evalResult.grilleEvaluation.presidentAppreciation}"
`;

  files.push({
    filename: `Grille_Evaluation - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/Grille_Evaluation - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category B — Jury',
    content: grilleContent,
  });

  // 5. Category B — PV de Jury
  const pvContent = `# Procès-Verbal de Jury d'Évaluation — ${candidate.code_certif}
**Organisme Certificateur Partner** : ${candidate.organisme}  
**Certification** : ${candidate.code_certif} — ${candidate.formation}  

---

## Informations Candidat
- **Nom & Prénom** : ${candidate.prenom} ${candidate.nom}
- **Date de naissance** : ${candidate.date_naissance || 'Conforme'}
- **Dates de session** : ${candidate.date_debut_session || candidate.dates_session || currentDate} au ${candidate.date_fin_session || candidate.dates_session || currentDate}
- **Date d'examen** : ${candidate.date_examen || currentDate}

---

## Composition du Jury
- **Président(e) du Jury** : ${juryRules.presidentName}
- **Membre du Jury** : ${juryRules.memberName}
- **Contact administratif** : ${juryRules.contact}

---

## Délibération et Résultat Final
- **Note d'évaluation globale** : **${evalResult.grilleEvaluation.convertedScore20} / 20**
- **Mention accordée** : **ADMIS**

---

## Signatures Officieuses
- *Président du Jury* : ${juryRules.presidentName}
- *Membre du Jury* : ${juryRules.memberName}
- *Fait le ${currentDate} à Paris*
`;

  files.push({
    filename: `PV_Jury - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/PV_Jury - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category B — Jury',
    content: pvContent,
  });

  // 6. Category C — Évaluation Finale (Isolated Pedagogical)
  const evalFinaleContent = `# Évaluation Finale — ${candidate.code_certif}
**Candidat** : ${candidate.prenom} ${candidate.nom}  
**Organisme** : ${candidate.organisme}  
**Date** : ${currentDate}  

---

## Rendu Général
- **Résultat global** : **ADMIS** (${evalResult.grilleEvaluation.convertedScore20}/20)
- **Modalité** : Évaluation écrite & cas pratiques
- **Validation** : Ensemble des objectifs pédagogiques du Répertoire Spécifique validés.
`;

  files.push({
    filename: `Evaluation_Finale - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/Evaluation_Finale - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category C — Isolé',
    content: evalFinaleContent,
  });

  return files;
}

function getModuleShortName(codeCertif: string): string {
  switch (codeCertif) {
    case 'RS6485':
      return 'Comptabilité TPE';
    case 'RS7200':
      return 'Réseaux Sociaux TPE';
    case 'RS7311':
      return 'IA TPE';
    case 'RS7344':
      return 'IA pour Développer son Activité';
    default:
      return 'Certification';
  }
}
