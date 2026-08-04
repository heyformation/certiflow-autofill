import { CandidateRow, CandidateEvaluationResult } from './types';

export interface ExcelJuryData {
  notesJ1: number[];
  commentsJ1: string[];
  notesJ2: number[];
  commentsJ2: string[];
  appreciationJ1: string;
  appreciationJ2: string;
}

export function generateExcelJuryData(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult
): ExcelJuryData {
  const exp = (candidate.experience_pro || '').toLowerCase();
  
  let profile = 'service';
  if (exp.includes('batiment') || exp.includes('btp') || exp.includes('levage') || exp.includes('travaux') || exp.includes('renovation') || exp.includes('macon')) {
    profile = 'btp';
  } else if (exp.includes('transport') || exp.includes('logistique') || exp.includes('livraison') || exp.includes('chauffeur') || exp.includes('entrepot')) {
    profile = 'logistique';
  }
  
  const notesJ1 = [0, 0, 0, 0, 0, 0, 0, 0];
  const notesJ2 = [0, 0, 0, 0, 0, 0, 0, 0];
  
  let seedNum = 0;
  const seed = `${candidate.id}-${candidate.nom}-excel-jury`;
  for (let i = 0; i < seed.length; i++) {
    seedNum = Math.imul(31, seedNum) + seed.charCodeAt(i) | 0;
  }
  const rng = () => {
    seedNum = Math.imul(1597334677, seedNum ^ (seedNum >>> 16));
    seedNum = Math.imul(3812015801, seedNum ^ (seedNum >>> 13));
    return ((seedNum >>> 0) % 1000000) / 1000000;
  };
  
  const targetScore20 = evalResult.grilleEvaluation.convertedScore20;
  const scale = targetScore20 / 20;
  
  for (let i = 0; i < 6; i++) {
    const rawNote = Math.min(2, Math.max(1, 1 + (rng() > 0.5 ? 0.5 : 0) + (scale > 0.8 ? 0.5 : 0)));
    notesJ1[i] = rawNote;
    notesJ2[i] = Math.min(2, Math.max(1, rawNote + (rng() > 0.7 ? -0.5 : (rng() > 0.7 ? 0.5 : 0))));
  }
  
  for (let i = 6; i < 8; i++) {
    const rawNote = Math.min(4, Math.max(2, Math.round(4 * scale + (rng() * 1.5 - 0.75))));
    notesJ1[i] = rawNote;
    notesJ2[i] = Math.min(4, Math.max(2, rawNote + (rng() > 0.7 ? -1 : (rng() > 0.7 ? 1 : 0))));
  }
  
  const commentsJ1: string[] = [];
  const commentsJ2: string[] = [];
  
  if (profile === 'btp') {
    commentsJ1.push(
      "L'organisation administrative en trois phases (réception, stockage numérique, transmission) is logique et opérationnelle pour le pilotage d'une TPE BTP.",
      "Le plan financier prévisionnel sur 3 ans présente des hypothèses de chiffre d'affaires cohérentes et progressives. Le calcul du BFR intègre bien les délais de paiement sectoriels.",
      "Maîtrise satisfaisante du traitement des factures fournisseurs et clients. Bonne compréhension du mécanisme d'autoliquidation de la TVA en sous-traitance BTP.",
      "Le processus de recouvrement proposé est structuré et progressif (relance amiable à J+2, mise en demeure à J+20). Il est adapté aux risques d'impayés du secteur BTP.",
      "Le suivi de la gestion des stocks de matériaux (bastaings, ciment) est rigoureux. L'alerte sur la vérification des EPI témoigne d'une bonne vigilance réglementaire.",
      "L'analyse des écarts du premier mois identifie précisément les dérives sur le poste carburant et propose des actions correctives concrètes.",
      "Soutenance orale dynamique et professionnelle. Le candidat démontre une excellente posture d'entrepreneur et maîtrise les indicateurs clés de son projet.",
      "Le résultat du QCM valide l'acquisition des compétences théoriques fondamentales en comptabilité TPE."
    );
    commentsJ2.push(
      "Le choix des indicateurs de contrôle (CA, trésorerie) est pertinent pour piloter l'activité au quotidien. L'archivage numérique structuré est un point fort.",
      "Le fonds de roulement initial de 20 000 € est correctement dimensionné. La trésorerie nette reste positive sur les 3 exercices.",
      "Les mentions obligatoires sur les factures (SIRET, assurance décennale, autoliquidation) sont rigoureusement respectées.",
      "La procédure d'injonction de payer est bien identifiée comme recours ultime. Le candidat démontre une bonne maîtrise des aspects légaux du recouvrement.",
      "Le tableau de suivi des approvisionnements est opérationnel. Attention cependant à prévoir un stock tampon suffisant pour éviter toute rupture de chantier.",
      "La démarche d'analyse de la marge brute par chantier est amorcée, ce qui est essentiel pour une TPE de sous-traitance BTP.",
      "Réponses précises et structurées aux questions du jury. Le candidat sait justifier ses choix de gestion administrative et financière.",
      "Validation du QCM conforme aux attentes réglementaires."
    );
  } else if (profile === 'logistique') {
    commentsJ1.push(
      "L'organisation administrative est adaptée aux flux logistiques rapides. La centralisation numérique des bons de livraison sécurise la facturation.",
      "Le plan financier prévisionnel intègre de manière cohérente les investissements matériels (achat de véhicules utilitaires). BFR bien évalué.",
      "Maîtrise des factures clients et fournisseurs. Application conforme de la TVA sur les prestations de transport national.",
      "Le processus de recouvrement en quatre étapes est formalisé et progressif. Il permet de limiter le délai moyen de paiement des clients professionnels.",
      "Gestion rigoureuse des consommables logistiques (palettes, film). Le suivi des stocks de carburant est un indicateur de contrôle clé.",
      "L'analyse des écarts met en évidence le dépassement des frais de maintenance véhicules et propose une négociation de contrat cadre.",
      "Soutenance claire et structurée. Le candidat démontre une bonne maîtrise du modèle économique de sa TPE de transport/manutention.",
      "QCM validé avec un score satisfaisant, confirmant l'acquisition des connaissances théoriques."
    );
    commentsJ2.push(
      "Indicateurs de contrôle pertinents (taux d'occupation des véhicules, coût au km). L'archivage dématérialisé est efficace.",
      "Le plan de trésorerie montre une gestion saine avec un solde positif constant. Les charges d'exploitation sont réalistes.",
      "Les mentions légales (licence de transport, conditions générales de vente) sont correctement intégrées aux documents commerciaux.",
      "Le candidat maîtrise les outils de relance et la procédure d'injonction de payer pour sécuriser sa trésorerie.",
      "Le tableau de gestion des stocks est opérationnel. Le suivi du stock de carburant permet d'anticiper les variations de trésorerie.",
      "Bonne réactivité face aux écarts de coûts constatés au premier mois d'activité.",
      "Le candidat répond de manière pertinente aux questions financières du jury.",
      "Le QCM est validé de manière satisfaisante."
    );
  } else {
    commentsJ1.push(
      "L'organisation administrative proposée pour la gestion de la TPE de services est claire, structurée et s'appuie sur des outils numériques adaptés.",
      "Le plan prévisionnel sur 3 ans est réaliste. Les hypothèses de chiffre d'affaires sont cohérentes avec le marché visé. Le BFR est maîtrisé.",
      "Maîtrise complète du traitement des pièces comptables et de la facturation. Déclarations de TVA conformes aux règles de prestations de services.",
      "Le processus de relance des impayés est bien défini. Le calendrier de recouvrement est progressif et respecte la législation en vigueur.",
      "Le tableau de bord permet de suivre efficacement les abonnements logiciels et les fournitures de bureau. Le stock de licences is sous contrôle.",
      "L'analyse du premier mois d'activité identifie correctement les écarts de charges de structure et propose des mesures de régulation.",
      "Le candidat présente son projet de services avec clarté et conviction. Posture entrepreneuriale solide.",
      "QCM validé avec succès, démontrant une bonne assimilation des notions de comptabilité courante."
    );
    commentsJ2.push(
      "Les indicateurs clés de performance retenus (CA facturé, taux de satisfaction) sont pertinents pour le pilotage de l'activité de service.",
      "Trésorerie équilibrée sur les 3 exercices. Le besoin de financement est couvert par des fonds propres suffisants au démarrage.",
      "Les devis et factures présentés comportent toutes les mentions obligatoires requises pour les prestations de services B2B.",
      "La procédure de relance intègre des étapes claires de relance téléphonique et écrite avant toute action contentieuse.",
      "La gestion des approvisionnements de consommables bureautiques est simple et opérationnelle.",
      "Le suivi budgétaire mensuel permet de réagir rapidement aux dérives de charges fixes.",
      "Le candidat répond de manière pertinente aux questions financières du jury.",
      "Le QCM est validé de manière satisfaisante."
    );
  }
  
  const appreciationJ1 = evalResult.grilleEvaluation.presidentAppreciation;
  const appreciationJ2 = evalResult.grilleEvaluation.presidentAppreciation.replace(/Président/g, 'Membre').slice(0, 300) + ' Admis.';
  
  return {
    notesJ1,
    commentsJ1,
    notesJ2,
    commentsJ2,
    appreciationJ1,
    appreciationJ2
  };
}

export function getBusinessProfilePlaceholderValues(
  candidate: CandidateRow,
  evalResult: CandidateEvaluationResult
): Record<string, string> {
  const exp = (candidate.experience_pro || '').toLowerCase();
  
  let profile = 'service';
  if (exp.includes('batiment') || exp.includes('btp') || exp.includes('levage') || exp.includes('travaux') || exp.includes('renovation') || exp.includes('macon')) {
    profile = 'btp';
  } else if (exp.includes('transport') || exp.includes('logistique') || exp.includes('livraison') || exp.includes('chauffeur') || exp.includes('entrepot')) {
    profile = 'logistique';
  }
  
  const dict: Record<string, string> = {};
  
  if (profile === 'btp') {
    dict['SECTEUR D’ACTIVITE'] = "Bâtiment et Gros Œuvre";
    dict['Zone d’implantation géographique'] = "Marseille et sa région (Bouches-du-Rhône)";
    dict['Description de l’activité principale'] = "Prestations de coffrage, maçonnerie générale, levage de structures lourdes et travaux publics en sous-traitance.";
    dict['Type de clientèle visée'] = "Entreprises générales du BTP, promoteurs immobiliers et maîtres d'ouvrage publics/privés (B2B).";
    dict['fréquence'] = "Hebdomadaire";
    dict['moyen'] = "Numérique (logiciel métier Batappli BTP)";
    dict['Indicateur 1'] = "Heures de levage facturées";
    dict['Val1 M1'] = "120";
    dict['Val1 M2'] = "110";
    dict['Val1 M3'] = "135";
    dict['Indicateur 2'] = "Taux de marge brute par chantier";
    dict['Val2 M1'] = "82%";
    dict['Val2 M2'] = "80%";
    dict['Val2 M3'] = "85%";
    dict['Indicateur 3'] = "Nombre d'incidents de sécurité";
    dict['Val3 M1'] = "0";
    dict['Val3 M2'] = "0";
    dict['Val3 M3'] = "0";
    dict['Indicateur 4'] = "Nombre de devis relancés";
    dict['Val4 M1'] = "4";
    dict['Val4 M2'] = "3";
    dict['Val4 M3'] = "5";
    dict['CA M1'] = "14 500 €";
    dict['CA M2'] = "17 200 €";
    dict['CA M3'] = "18 500 €";
    dict['Evol M2'] = "+18.6%";
    dict['Evol M3'] = "+7.5%";
    dict['Commentaire libre sur la tendance observée'] = "Activité en progression constante sur le premier trimestre, soutenue par une forte demande sur les chantiers de levage gros œuvre, avec une sécurité parfaite (zéro incident).";
    
    // Product CA forecasts N1, N2, N3
    dict['Valeur_P1_PrixMoyen_N1'] = "550 €";
    dict['Valeur_P1_PrixMoyen_N2'] = "570 €";
    dict['Valeur_P1_PrixMoyen_N3'] = "600 €";
    dict['Valeur_P1_Volume_N1'] = "100 j";
    dict['Valeur_P1_Volume_N2'] = "120 j";
    dict['Valeur_P1_Volume_N3'] = "140 j";
    dict['Valeur_P1_CA_N1'] = "55 000 €";
    dict['Valeur_P1_CA_N2'] = "68 400 €";
    dict['Valeur_P1_CA_N3'] = "84 000 €";
    
    dict['Valeur_P2_PrixMoyen_N1'] = "450 €";
    dict['Valeur_P2_PrixMoyen_N2'] = "460 €";
    dict['Valeur_P2_PrixMoyen_N3'] = "480 €";
    dict['Valeur_P2_Volume_N1'] = "150 j";
    dict['Valeur_P2_Volume_N2'] = "160 j";
    dict['Valeur_P2_Volume_N3'] = "180 j";
    dict['Valeur_P2_CA_N1'] = "67 500 €";
    dict['Valeur_P2_CA_N2'] = "73 600 €";
    dict['Valeur_P2_CA_N3'] = "86 400 €";
    
    dict['Valeur_P3_PrixMoyen_N1'] = "350 €";
    dict['Valeur_P3_PrixMoyen_N2'] = "360 €";
    dict['Valeur_P3_PrixMoyen_N3'] = "380 €";
    dict['Valeur_P3_Volume_N1'] = "130 j";
    dict['Valeur_P3_Volume_N2'] = "140 j";
    dict['Valeur_P3_Volume_N3'] = "150 j";
    dict['Valeur_P3_CA_N1'] = "45 500 €";
    dict['Valeur_P3_CA_N2'] = "50 400 €";
    dict['Valeur_P3_CA_N3'] = "57 000 €";
    
    dict['Valeur_Total_N1'] = "168 000 €";
    dict['Valeur_Total_N2'] = "192 400 €";
    dict['Valeur_Total_N3'] = "227 400 €";
    
    // Stocks
    dict['Référence produit 1'] = "Bastaings de coffrage (ml)";
    dict['Valeur_Prod1_Entrees'] = "40";
    dict['Valeur_Prod1_Sorties'] = "20";
    dict['Valeur_Prod1_StockInitial'] = "40";
    dict['Valeur_Prod1_Mouvements'] = "+ 20";
    dict['Valeur_Prod1_StockFinal'] = "60";
    dict['Valeur_Prod1_StockMini'] = "40";
    dict['Remarque_Prod1'] = "Flux tendu régulier";
    
    dict['Référence produit 2'] = "Ciment et agrégats (sacs)";
    dict['Valeur_Prod2_Entrees'] = "100";
    dict['Valeur_Prod2_Sorties'] = "80";
    dict['Valeur_Prod2_StockInitial'] = "50";
    dict['Valeur_Prod2_Mouvements'] = "+ 20";
    dict['Valeur_Prod2_StockFinal'] = "70";
    dict['Valeur_Prod2_StockMini'] = "30";
    dict['Remarque_Prod2'] = "Commandes hebdomadaires";
    
    dict['Référence produit 3'] = "Élingues et apparaux de levage";
    dict['Valeur_Prod3_Entrees'] = "10";
    dict['Valeur_Prod3_Sorties'] = "2";
    dict['Valeur_Prod3_StockInitial'] = "8";
    dict['Valeur_Prod3_Mouvements'] = "+ 8";
    dict['Valeur_Prod3_StockFinal'] = "16";
    dict['Valeur_Prod3_StockMini'] = "10";
    dict['Remarque_Prod3'] = "Contrôle périodique OK";
    
    // Écarts
    dict['Valeur_CA_Prevu'] = "16 000 €";
    dict['Valeur_CA_Realise'] = "14 500 €";
    dict['Valeur_CA_Ecart'] = "- 1 500 €";
    dict['Action_CA'] = "Intensifier la relance commerciale et élargir le portefeuille de sous-traitants.";
    dict['Valeur_Achats_Prevu'] = "4 200 €";
    dict['Valeur_Achats_Realise'] = "4 650 €";
    dict['Valeur_Achats_Ecart'] = "+ 450 €";
    dict['Action_Achats'] = "Négocier des tarifs de gros sur les matériaux et optimiser la logistique d'approvisionnement.";
    dict['Valeur_MargeBrute_Prevu'] = "11 800 €";
    dict['Valeur_MargeBrute_Realise'] = "9 850 €";
    dict['Valeur_MargeBrute_Ecart'] = "- 1 950 €";
    dict['Action_MargeBrute'] = "Surveiller les coûts variables par chantier de manière hebdomadaire.";
    dict['Valeur_Indic4_Prevu'] = "1 800 €";
    dict['Valeur_Indic4_Realise'] = "1 650 €";
    dict['Valeur_Indic4_Ecart'] = "- 150 €";
    dict['Action_Indic4'] = "Optimiser les périodes de location de matériel pour réduire les coûts fixes.";
  } else if (profile === 'logistique') {
    dict['SECTEUR D’ACTIVITE'] = "Transport et Logistique";
    dict['Zone d’implantation géographique'] = "Lyon et région Auvergne-Rhône-Alpes";
    dict['Description de l’activité principale'] = "Prestations de transport express régional de marchandises, manutention sur site et gestion de flux logistiques d'entrepôt.";
    dict['Type de clientèle visée'] = "Plateformes de distribution e-commerce, transitaires, et entreprises industrielles (B2B).";
    dict['fréquence'] = "Hebdomadaire";
    dict['moyen'] = "Numérique (logiciel de gestion de flotte et de facturation)";
    dict['Indicateur 1'] = "Nombre de livraisons effectuées";
    dict['Val1 M1'] = "320";
    dict['Val1 M2'] = "350";
    dict['Val1 M3'] = "390";
    dict['Indicateur 2'] = "Taux de ponctualité à la livraison";
    dict['Val2 M1'] = "98%";
    dict['Val2 M2'] = "97%";
    dict['Val2 M3'] = "99%";
    dict['Indicateur 3'] = "Consommation moyenne de carburant (L/100)";
    dict['Val3 M1'] = "7.8";
    dict['Val3 M2'] = "7.6";
    dict['Val3 M3'] = "7.5";
    dict['Indicateur 4'] = "Kilomètres facturés";
    dict['Val4 M1'] = "8 500";
    dict['Val4 M2'] = "9 200";
    dict['Val4 M3'] = "10 500";
    dict['CA M1'] = "15 200 €";
    dict['CA M2'] = "16 800 €";
    dict['CA M3'] = "19 100 €";
    dict['Evol M2'] = "+10.5%";
    dict['Evol M3'] = "+13.7%";
    dict['Commentaire libre sur la tendance observée'] = "Progression constante des volumes de livraison et amélioration de l'efficacité énergétique de la flotte grâce à l'éco-conduite.";
    
    // Product CA forecasts N1, N2, N3
    dict['Valeur_P1_PrixMoyen_N1'] = "45 €";
    dict['Valeur_P1_PrixMoyen_N2'] = "48 €";
    dict['Valeur_P1_PrixMoyen_N3'] = "50 €";
    dict['Valeur_P1_Volume_N1'] = "3 000";
    dict['Valeur_P1_Volume_N2'] = "3 500";
    dict['Valeur_P1_Volume_N3'] = "4 000";
    dict['Valeur_P1_CA_N1'] = "135 000 €";
    dict['Valeur_P1_CA_N2'] = "168 000 €";
    dict['Valeur_P1_CA_N3'] = "200 000 €";
    
    dict['Valeur_P2_PrixMoyen_N1'] = "65 €";
    dict['Valeur_P2_PrixMoyen_N2'] = "68 €";
    dict['Valeur_P2_PrixMoyen_N3'] = "70 €";
    dict['Valeur_P2_Volume_N1'] = "800";
    dict['Valeur_P2_Volume_N2'] = "900";
    dict['Valeur_P2_Volume_N3'] = "1 000";
    dict['Valeur_P2_CA_N1'] = "52 000 €";
    dict['Valeur_P2_CA_N2'] = "61 200 €";
    dict['Valeur_P2_CA_N3'] = "70 000 €";
    
    dict['Valeur_P3_PrixMoyen_N1'] = "120 €";
    dict['Valeur_P3_PrixMoyen_N2'] = "125 €";
    dict['Valeur_P3_PrixMoyen_N3'] = "130 €";
    dict['Valeur_P3_Volume_N1'] = "250";
    dict['Valeur_P3_Volume_N2'] = "300";
    dict['Valeur_P3_Volume_N3'] = "350";
    dict['Valeur_P3_CA_N1'] = "30 000 €";
    dict['Valeur_P3_CA_N2'] = "37 500 €";
    dict['Valeur_P3_CA_N3'] = "45 500 €";
    
    dict['Valeur_Total_N1'] = "217 000 €";
    dict['Valeur_Total_N2'] = "266 700 €";
    dict['Valeur_Total_N3'] = "315 500 €";
    
    // Stocks
    dict['Référence produit 1'] = "Palettes Europe (unités)";
    dict['Valeur_Prod1_Entrees'] = "200";
    dict['Valeur_Prod1_Sorties'] = "150";
    dict['Valeur_Prod1_StockInitial'] = "100";
    dict['Valeur_Prod1_Mouvements'] = "+ 50";
    dict['Valeur_Prod1_StockFinal'] = "150";
    dict['Valeur_Prod1_StockMini'] = "80";
    dict['Remarque_Prod1'] = "Rotation rapide";
    
    dict['Référence produit 2'] = "Film étirable (rouleaux)";
    dict['Valeur_Prod2_Entrees'] = "50";
    dict['Valeur_Prod2_Sorties'] = "40";
    dict['Valeur_Prod2_StockInitial'] = "20";
    dict['Valeur_Prod2_Mouvements'] = "+ 10";
    dict['Valeur_Prod2_StockFinal'] = "30";
    dict['Valeur_Prod2_StockMini'] = "15";
    dict['Remarque_Prod2'] = "Consommation stable";
    
    dict['Référence produit 3'] = "Carburant utilitaires (L)";
    dict['Valeur_Prod3_Entrees'] = "1500";
    dict['Valeur_Prod3_Sorties'] = "1400";
    dict['Valeur_Prod3_StockInitial'] = "300";
    dict['Valeur_Prod3_Mouvements'] = "+ 100";
    dict['Valeur_Prod3_StockFinal'] = "400";
    dict['Valeur_Prod3_StockMini'] = "200";
    dict['Remarque_Prod3'] = "Approvisionnement cuve OK";
    
    // Écarts
    dict['Valeur_CA_Prevu'] = "15 000 €";
    dict['Valeur_CA_Realise'] = "15 200 €";
    dict['Valeur_CA_Ecart'] = "+ 200 €";
    dict['Action_CA'] = "Poursuivre le développement commercial auprès des clients réguliers.";
    dict['Valeur_Achats_Prevu'] = "3 800 €";
    dict['Valeur_Achats_Realise'] = "4 100 €";
    dict['Valeur_Achats_Ecart'] = "+ 300 €";
    dict['Action_Achats'] = "Optimiser les itinéraires de livraison pour réduire la facture de carburant.";
    dict['Valeur_MargeBrute_Prevu'] = "11 200 €";
    dict['Valeur_MargeBrute_Realise'] = "11 100 €";
    dict['Valeur_MargeBrute_Ecart'] = "- 100 €";
    dict['Action_MargeBrute'] = "Vigilance sur l'évolution des prix du carburant.";
    dict['Valeur_Indic4_Prevu'] = "8 000";
    dict['Valeur_Indic4_Realise'] = "8 500";
    dict['Valeur_Indic4_Ecart'] = "+ 500";
    dict['Action_Indic4'] = "Planifier l'entretien périodique des véhicules pour éviter les pannes.";
  } else {
    dict['SECTEUR D’ACTIVITE'] = "Prestations de Services TPE";
    dict['Zone d’implantation géographique'] = "Région Parisienne (Île-de-France)";
    dict['Description de l’activité principale'] = "Accompagnement administratif, numérisation des processus comptables et conseil en pilotage opérationnel pour TPE et indépendants.";
    dict['Type de clientèle visée'] = "Professions libérales, artisans, commerçants locaux et dirigeants de TPE (B2B).";
    dict['fréquence'] = "Mensuelle";
    dict['moyen'] = "Numérique (logiciel de facturation QuickBooks)";
    dict['Indicateur 1'] = "Heures d'accompagnement facturées";
    dict['Val1 M1'] = "80";
    dict['Val1 M2'] = "95";
    dict['Val1 M3'] = "110";
    dict['Indicateur 2'] = "Taux de satisfaction des clients";
    dict['Val2 M1'] = "95%";
    dict['Val2 M2'] = "98%";
    dict['Val2 M3'] = "96%";
    dict['Indicateur 3'] = "Nombre de nouveaux clients acquis";
    dict['Val3 M1'] = "2";
    dict['Val3 M2'] = "3";
    dict['Val3 M3'] = "4";
    dict['Indicateur 4'] = "Rendez-vous qualifiés obtenus";
    dict['Val4 M1'] = "8";
    dict['Val4 M2'] = "10";
    dict['Val4 M3'] = "12";
    dict['CA M1'] = "12 400 €";
    dict['CA M2'] = "14 800 €";
    dict['CA M3'] = "16 500 €";
    dict['Evol M2'] = "+19.3%";
    dict['Evol M3'] = "+11.5%";
    dict['Commentaire libre sur la tendance observée'] = "Tendance très positive tirée par l'acquisition constante de nouveaux clients et la fidélisation par des contrats récurrents mensuels.";
    
    // Product CA forecasts N1, N2, N3
    dict['Valeur_P1_PrixMoyen_N1'] = "75 €";
    dict['Valeur_P1_PrixMoyen_N2'] = "80 €";
    dict['Valeur_P1_PrixMoyen_N3'] = "85 €";
    dict['Valeur_P1_Volume_N1'] = "1 000";
    dict['Valeur_P1_Volume_N2'] = "1 200";
    dict['Valeur_P1_Volume_N3'] = "1 400";
    dict['Valeur_P1_CA_N1'] = "75 000 €";
    dict['Valeur_P1_CA_N2'] = "96 000 €";
    dict['Valeur_P1_CA_N3'] = "119 000 €";
    
    dict['Valeur_P2_PrixMoyen_N1'] = "150 €";
    dict['Valeur_P2_PrixMoyen_N2'] = "160 €";
    dict['Valeur_P2_PrixMoyen_N3'] = "170 €";
    dict['Valeur_P2_Volume_N1'] = "300";
    dict['Valeur_P2_Volume_N2'] = "350";
    dict['Valeur_P2_Volume_N3'] = "400";
    dict['Valeur_P2_CA_N1'] = "45 000 €";
    dict['Valeur_P2_CA_N2'] = "56 000 €";
    dict['Valeur_P2_CA_N3'] = "68 000 €";
    
    dict['Valeur_P3_PrixMoyen_N1'] = "200 €";
    dict['Valeur_P3_PrixMoyen_N2'] = "210 €";
    dict['Valeur_P3_PrixMoyen_N3'] = "220 €";
    dict['Valeur_P3_Volume_N1'] = "150";
    dict['Valeur_P3_Volume_N2'] = "180";
    dict['Valeur_P3_Volume_N3'] = "200";
    dict['Valeur_P3_CA_N1'] = "30 000 €";
    dict['Valeur_P3_CA_N2'] = "37 800 €";
    dict['Valeur_P3_CA_N3'] = "44 000 €";
    
    dict['Valeur_Total_N1'] = "150 000 €";
    dict['Valeur_Total_N2'] = "189 800 €";
    dict['Valeur_Total_N3'] = "231 000 €";
    
    // Stocks
    dict['Référence produit 1'] = "Licences logicielles (unités)";
    dict['Valeur_Prod1_Entrees'] = "20";
    dict['Valeur_Prod1_Sorties'] = "15";
    dict['Valeur_Prod1_StockInitial'] = "10";
    dict['Valeur_Prod1_Mouvements'] = "+ 5";
    dict['Valeur_Prod1_StockFinal'] = "15";
    dict['Valeur_Prod1_StockMini'] = "5";
    dict['Remarque_Prod1'] = "Renouvellements mensuels";
    
    dict['Référence produit 2'] = "Fournitures de bureau (packs)";
    dict['Valeur_Prod2_Entrees'] = "10";
    dict['Valeur_Prod2_Sorties'] = "8";
    dict['Valeur_Prod2_StockInitial'] = "5";
    dict['Valeur_Prod2_Mouvements'] = "+ 2";
    dict['Valeur_Prod2_StockFinal'] = "7";
    dict['Valeur_Prod2_StockMini'] = "3";
    dict['Remarque_Prod2'] = "Consommation interne";
    
    dict['Référence produit 3'] = "Documentation et supports imprimés";
    dict['Valeur_Prod3_Entrees'] = "50";
    dict['Valeur_Prod3_Sorties'] = "30";
    dict['Valeur_Prod3_StockInitial'] = "20";
    dict['Valeur_Prod3_Mouvements'] = "+ 20";
    dict['Valeur_Prod3_StockFinal'] = "40";
    dict['Valeur_Prod3_StockMini'] = "10";
    dict['Remarque_Prod3'] = "Kit d'accueil clients";
    
    // Écarts
    dict['Valeur_CA_Prevu'] = "12 000 €";
    dict['Valeur_CA_Realise'] = "12 400 €";
    dict['Valeur_CA_Ecart'] = "+ 400 €";
    dict['Action_CA'] = "Continuer sur le même rythme de facturation et stabiliser l'encours clients.";
    dict['Valeur_Achats_Prevu'] = "1 500 €";
    dict['Valeur_Achats_Realise'] = "1 850 €";
    dict['Valeur_Achats_Ecart'] = "+ 350 €";
    dict['Action_Achats'] = "Contrôler les frais de déplacement et d'abonnements logiciels non indispensables.";
    dict['Valeur_MargeBrute_Prevu'] = "10 500 €";
    dict['Valeur_MargeBrute_Realise'] = "10 550 €";
    dict['Valeur_MargeBrute_Ecart'] = "+ 50 €";
    dict['Action_MargeBrute'] = "Maintien de la performance opérationnelle.";
    dict['Valeur_Indic4_Prevu'] = "8";
    dict['Valeur_Indic4_Realise'] = "8";
    dict['Valeur_Indic4_Ecart'] = "0";
    dict['Action_Indic4'] = "Augmenter le budget marketing digital pour générer de nouveaux leads le mois prochain.";
  }
  
  const jd = generateExcelJuryData(candidate, evalResult);
  for (let i = 1; i <= 8; i++) {
    dict[`NOTE_P1_J1_C${i}`] = String(jd.notesJ1[i - 1]);
    dict[`NOTE_P1_J2_C${i}`] = String(jd.notesJ2[i - 1]);
    dict[`COMMENTAIRE_P1_J1_C${i}`] = jd.commentsJ1[i - 1];
    dict[`COMMENTAIRE_P1_J2_C${i}`] = jd.commentsJ2[i - 1];
  }
  dict[`APPRECIATION_P1_J1`] = jd.appreciationJ1;
  dict[`APPRECIATION_P1_J2`] = jd.appreciationJ2;
  dict[`APPRECIATION_P1_J3`] = "";
  
  return dict;
}
