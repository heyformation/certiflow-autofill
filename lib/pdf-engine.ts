import PDFDocument from 'pdfkit';
import { getJuryRules } from './jury-rules';
import { CandidateEvaluationResult, CandidateRow } from './types';

export interface GeneratedPdfFile {
  filename: string;
  relativePath: string;
  category: string;
  buffer: Buffer;
}

export async function generateCandidatePdfFiles(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult
): Promise<GeneratedPdfFile[]> {
  const juryRules = getJuryRules(candidate.organisme);
  const candidateFolder = `${candidate.organisme}/${candidate.code_certif} - ${getModuleShortName(candidate.code_certif)}`;

  const isProforma = candidate.organisme === 'Proforma Institut';
  const brandColor = isProforma ? '#6E1F14' : '#0B3D3D';
  const accentColor = isProforma ? '#A8442B' : '#168F82';
  const lightBg = isProforma ? '#FBEEE9' : '#E8F5F3';

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const pdfFiles: GeneratedPdfFile[] = [];

  // Helper to build PDF document buffer
  const buildPdfBuffer = (
    title: string,
    category: string,
    renderContent: (doc: InstanceType<typeof PDFDocument>) => void
  ): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header Banner
      doc
        .rect(0, 0, 595.28, 70)
        .fill(brandColor);

      doc
        .fillColor('#FFFFFF')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(title.toUpperCase(), 40, 20, { width: 515, align: 'left' });

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`${candidate.organisme} — Certification ${candidate.code_certif}`, 40, 42, {
          width: 515,
          align: 'left',
        });

      doc.y = 85;

      // Candidate Header Box
      doc
        .rect(40, doc.y, 515.28, 55)
        .fill(lightBg);

      const headerY = doc.y + 8;
      doc
        .fillColor('#1E293B')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Candidat : ${candidate.civilite || 'M.'} ${candidate.prenom} ${candidate.nom}`, 50, headerY);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`E-mail : ${candidate.mail || candidate.mail_wedof || candidate.mail_crm || 'N/A'} | Tel : ${candidate.numero_tel || 'N/A'}`, 50, headerY + 14)
        .text(`Certification : ${candidate.formation} (${candidate.code_certif})`, 50, headerY + 28);

      doc.y = 150;
      doc.fillColor('#0F172A');

      // Custom Content
      renderContent(doc);

      // Footer
      const pageHeight = 841.89;
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#64748B')
        .text(
          `Document certifié par ${candidate.organisme} — Fait le ${currentDate} à Paris. Mention : ADMIS`,
          40,
          pageHeight - 35,
          { width: 515, align: 'center' }
        );

      doc.end();
    });
  };

  // 1. CV Candidate PDF
  const cvBuf = await buildPdfBuffer('CV Candidat', 'Category A — CV', (doc) => {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(brandColor).text('PARCOURS ET EXPÉRIENCE PROFESSIONNELLE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#334155').text(candidate.experience_pro || 'Expérience et pratique professionnelle adaptées aux opérations TPE.');
    
    doc.moveDown(1.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(brandColor).text('SYNTHÈSE DU PROFIL IA ET COMPÉTENCES', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#334155').text(evalResult.additionalAiTexts?.parcoursSummary || 'Parcours professionnel riche avec expérience significative en gestion et opérations TPE.');

    doc.moveDown(1.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(brandColor).text('PROJET D’ENTREPRISE ET CERTIFICATION VISÉE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#334155').text(evalResult.additionalAiTexts?.projetSummary || 'Projet d’entreprise structuré axé sur le développement d’activité TPE.');
  });
  pdfFiles.push({
    filename: `CV - ${candidate.prenom} ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/CV - ${candidate.prenom} ${candidate.nom}.pdf`,
    category: 'Category A — CV (PDF)',
    buffer: cvBuf,
  });

  // 2. Recueil des Besoins PDF
  const recueilBuf = await buildPdfBuffer('Recueil des Besoins', 'Category B — Pedagogique', (doc) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('1. AUTO-ÉVALUATION DES THÉMATIQUES DE COMPÉTENCES (ÉCHELLE 1 À 5)');
    doc.moveDown(0.5);

    evalResult.themeProfiles.forEach((t) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text(`- ${t.themeTitle} : `, { continued: true });
      doc.font('Helvetica').fillColor(accentColor).text(`Niveau ${t.level} / 5`);
    });

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('2. OBJECTIFS D’APPRENTISSAGE ET BESOINS EXPRIMÉS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#334155').text('Approfondissement ciblé des thématiques fondamentales afin d’optimiser l’organisation et le rendement opérationnel de la TPE.');
  });
  pdfFiles.push({
    filename: `Recueil_des_Besoins - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/Recueil_des_Besoins - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    category: 'Category B — Pedagogique (PDF)',
    buffer: recueilBuf,
  });

  // 3. Test de Positionnement PDF
  const testPosBuf = await buildPdfBuffer('Test de Positionnement', 'Category B — Pedagogique', (doc) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('RÉSULTAT GLOBAL DU POSITIONNEMENT');
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor).text(`Score Global : ${evalResult.testPositionnement.totalScore} / 20  (${evalResult.testPositionnement.scorePercentage}% de réussite)`);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text('*Score d\'évaluation diagnostique informatif (non éliminatoire)');

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('DÉTAIL PAR DOMAINE DE COMPÉTENCE');
    doc.moveDown(0.5);

    evalResult.themeProfiles.forEach((t) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text(`${t.themeTitle}`);
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`Niveau diagnostiqué : ${t.level}/5 — Assimilation conforme aux prérequis de la certification.`);
      doc.moveDown(0.3);
    });
  });
  pdfFiles.push({
    filename: `Test_de_Positionnement - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/Test_de_Positionnement - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    category: 'Category B — Pedagogique (PDF)',
    buffer: testPosBuf,
  });

  // 4. Grille d'Évaluation Certifiante PDF
  const grilleBuf = await buildPdfBuffer('Grille d\'Évaluation Certifiante', 'Category B — Jury', (doc) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('SYNTHÈSE DES NOTES CERTIFIANTES (EXAM DAY)');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E293B').text(`Note Totale / 60 : ${evalResult.grilleEvaluation.totalScore60} / 60`);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(accentColor).text(`Note Convertie / 20 : ${evalResult.grilleEvaluation.convertedScore20} / 20`);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text(`Décision du Jury : ${evalResult.grilleEvaluation.juryMention}`);

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('EVALUATION DÉTAILLÉE DES CRITÈRES');
    doc.moveDown(0.5);

    evalResult.competencies.forEach((c) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text(`${c.title} — ${c.score}/${c.maxScore}`);
      doc.fontSize(9).font('Helvetica').fillColor('#334155').text(`Observation : ${c.appreciation}`);
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(brandColor).text(`Appréciation du Président du Jury (${juryRules.presidentName}) :`);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#1E293B').text(`"${evalResult.grilleEvaluation.presidentAppreciation}"`);
  });
  pdfFiles.push({
    filename: `Grille_Evaluation - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/Grille_Evaluation - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    category: 'Category B — Jury (PDF)',
    buffer: grilleBuf,
  });

  // 5. PV de Jury PDF
  const pvBuf = await buildPdfBuffer('Procès-Verbal de Jury', 'Category B — Jury', (doc) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('COMPOSITION DU JURY D’ÉVALUATION');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#1E293B')
      .text(`Président(e) du Jury : ${juryRules.presidentName}`)
      .text(`Membre du Jury : ${juryRules.memberName}`)
      .text(`Contact Administratif : ${juryRules.contact}`);

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('DÉLIBÉRATION ET RÉSULTAT FINAL');
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(accentColor).text(`Note d'Évaluation Globale : ${evalResult.grilleEvaluation.convertedScore20} / 20`);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#059669').text('MENTION DE LA CERTIFICATION : ADMIS');

    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E293B').text('Signatures officieuses des membres du Jury :');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').text(`- ${juryRules.presidentName} (Président)`);
    doc.text(`- ${juryRules.memberName} (Membre)`);
  });
  pdfFiles.push({
    filename: `PV_Jury - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/PV_Jury - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    category: 'Category B — Jury (PDF)',
    buffer: pvBuf,
  });

  // 6. Évaluation Finale PDF
  const evalFinaleBuf = await buildPdfBuffer('Évaluation Finale', 'Category C — Isolé', (doc) => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(brandColor).text('SYNTHÈSE DE L’ÉVALUATION FINALE');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').fillColor('#1E293B').text(`L’apprenant(e) ${candidate.prenom} ${candidate.nom} a complété avec succès l’ensemble des évaluations finales et cas pratiques pour la certification ${candidate.code_certif}.`);
    doc.moveDown(1);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#059669').text(`Statut Final : ADMIS (${evalResult.grilleEvaluation.convertedScore20}/20)`);
  });
  pdfFiles.push({
    filename: `Evaluation_Finale - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    relativePath: `${candidateFolder}/Evaluation_Finale - ${candidate.code_certif} - ${candidate.nom}.pdf`,
    category: 'Category C — Isolé (PDF)',
    buffer: evalFinaleBuf,
  });

  return pdfFiles;
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
