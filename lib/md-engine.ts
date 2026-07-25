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
  const candidateMail = candidate.mail || candidate.mail_wedof || candidate.mail_crm || '';
  const candidatePhone = candidate.numero_tel || '';
  const candidateAddress = candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '';

  // 1. Category A — CV Candidate
  const cvContent = `# CV — ${candidate.civilite || ''} ${candidate.prenom} ${candidate.nom}

**Identité & Coordonnées**
- **Nom complet** : ${candidate.prenom} ${candidate.nom}
- **Titre / Civilité** : ${candidate.civilite || ''}
- **E-mail** : ${candidateMail}
- **Téléphone** : ${candidatePhone}
- **Adresse** : ${candidateAddress}
- **Organisme de formation** : ${candidate.organisme}
- **Certification visée** : ${candidate.code_certif} — ${candidate.formation}

---

## Parcours & Expérience Professionnelle
${candidate.experience_pro || ''}

### Synthèse du Parcours
${evalResult.additionalAiTexts?.parcoursSummary || ''}

---

## Compétences & Projet d'Entreprise
- Projet d'entreprise : ${evalResult.additionalAiTexts?.projetSummary || ''}
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
- **Expérience déclarée** : ${candidate.experience_pro || ''}

### 2. Auto-évaluation des Thématiques de Compétences (Échelle 1 à 5)
${evalResult.themeProfiles
  .map((t) => `- **${t.themeTitle}** : Niveau ${t.level}/5`)
  .join('\n')}

---

### 3. Objectifs d'Apprentissage & Attentes
- Approfondissement cibles des compétences de la certification ${candidate.code_certif}.
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
**Candidat** : ${candidate.civilite || ''} ${candidate.prenom} ${candidate.nom}  
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

  // 5. Category B — Procès-Verbal (PV) de Jury
  const pvContent = `# Procès-Verbal de Délibération du Jury — ${candidate.code_certif}

**Organisme Certificateur** : ${candidate.organisme}  
**Date de tenue du Jury** : ${candidate.date_examen || currentDate}  
**Lieu** : Siège Administratif / Distanciel  

---

## Composition du Jury d'Évaluation (Spec §7)
- **Président(e) du Jury** : ${juryRules.presidentName}
- **Membre du Jury** : ${juryRules.memberName}
- **Contact Email Officiel** : ${juryRules.contact}

---

## Candidat Évalué
- **Nom & Prénom** : ${candidate.prenom} ${candidate.nom}
- **Civilité** : ${candidate.civilite || ''}
- **E-mail** : ${candidateMail}
- **Certification** : ${candidate.formation} (${candidate.code_certif})

---

## Délibération & Décision Finale
Après examen des prestations du candidat, de la grille d'évaluation et du cas pratique :
- **Note Convertie** : **${evalResult.grilleEvaluation.convertedScore20} / 20**
- **Décision Générale** : **ADMIS (Certification Accordée)**

---

**Signatures des membres du Jury**  
- *${juryRules.presidentName} (Président)*  
- *${juryRules.memberName} (Membre)*  
`;

  files.push({
    filename: `PV_Jury - ${candidate.code_certif} - ${candidate.nom}.md`,
    relativePath: `${candidateFolder}/PV_Jury - ${candidate.code_certif} - ${candidate.nom}.md`,
    category: 'Category B — Jury',
    content: pvContent,
  });

  // 6. Category C — Évaluation Finale Isolée
  const evalFinaleContent = `# Évaluation Finale — ${candidate.code_certif}

**Candidat** : ${candidate.prenom} ${candidate.nom}  
**Organisme** : ${candidate.organisme}  
**Statut Final** : **ADMIS (${evalResult.grilleEvaluation.convertedScore20}/20)**  

L'apprenant(e) ${candidate.prenom} ${candidate.nom} a validé l'ensemble des modules d'évaluation et cas pratiques pour la certification ${candidate.code_certif}.
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
