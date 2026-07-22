import { CompetencyTheme, RSCertificationCode } from './types';

export const COMPETENCY_THEMES: Record<RSCertificationCode, CompetencyTheme[]> = {
  RS6485: [
    {
      id: 'c1',
      title: 'Principes fondamentaux de la comptabilité',
      description: 'Compréhension du plan comptable, écriture et organisation comptable de base.',
    },
    {
      id: 'c2',
      title: 'Lecture et analyse des documents comptables',
      description: 'Bilan, compte de résultat, tableau de trésorerie et annexes.',
    },
    {
      id: 'c3',
      title: 'TVA et obligations fiscales courantes',
      description: 'Déclaration de TVA, lettrage et respect des échéances réglementaires.',
    },
    {
      id: 'c4',
      title: 'Facturation et obligations légales',
      description: 'Émission de factures conformes, mentions obligatoires et suivi des impayés.',
    },
    {
      id: 'c5',
      title: 'Organisation comptable et opérations quotidiennes',
      description: 'Gestion des pièces justificatives et saisie chronologique des flux.',
    },
  ],
  RS7200: [
    {
      id: 'c1',
      title: 'Stratégie, ciblage et persona',
      description: 'Définition des objectifs de communication et profilage de la clientèle cible.',
    },
    {
      id: 'c2',
      title: 'Choix des plateformes et spécificités',
      description: 'Sélection des réseaux adaptés (Instagram, LinkedIn, Facebook, TikTok).',
    },
    {
      id: 'c3',
      title: 'Création de contenus et identité visuelle',
      description: 'Conception graphique, rédaction de posts et respect de la charte visuelle.',
    },
    {
      id: 'c4',
      title: 'Calendrier éditorial et planification',
      description: 'Organisation de la fréquence de publication et automatisation.',
    },
    {
      id: 'c5',
      title: 'Publicité, e-réputation et influence',
      description: 'Campagnes sponsorisées, gestion des avis et partenariats.',
    },
    {
      id: 'c6',
      title: 'Analyse des performances et KPI',
      description: 'Mesure de l’engagement, du trafic généré et ajustements stratégiques.',
    },
  ],
  RS7311: [
    {
      id: 'c1',
      title: 'Fondamentaux de l’IA et cadre éthique / RGPD',
      description: 'Compréhension des modèles d’IA, protection des données et responsabilité.',
    },
    {
      id: 'c2',
      title: 'Prompt engineering et IA générative',
      description: 'Formulation de requêtes efficaces pour la rédaction et la création de contenu.',
    },
    {
      id: 'c3',
      title: 'Automatisation des processus internes',
      description: 'Optimisation des flux de travail répétitifs grâce aux outils IA.',
    },
    {
      id: 'c4',
      title: 'Analyse de données assistée par IA',
      description: 'Exploitation des données clients et financières avec l’IA.',
    },
    {
      id: 'c5',
      title: 'Outils No-code / Low-code et intégrations',
      description: 'Connexion de solutions IA aux outils quotidiens de la TPE.',
    },
  ],
  RS7344: [
    {
      id: 'c1',
      title: 'Usages généraux de l’IA générative et prédictive',
      description: 'Identification des opportunités de croissance grâce à l’IA.',
    },
    {
      id: 'c2',
      title: 'Stratégie IA et feuille de route opérationnelle',
      description: 'Élaboration d’un plan d’action d’intégration de l’IA dans l’entreprise.',
    },
    {
      id: 'c3',
      title: 'Prompt engineering avancé',
      description: 'Maîtrise des techniques avancées d’ingénierie de prompt.',
    },
    {
      id: 'c4',
      title: 'Cadre juridique, RGPD et responsabilité',
      description: 'Sécurisation de la propriété intellectuelle et conformité des données.',
    },
    {
      id: 'c5',
      title: 'Conduite du changement et charte d’usage IA',
      description: 'Accompagnement de l’équipe et charte d’utilisation responsable.',
    },
    {
      id: 'c6',
      title: 'Mesure de l’impact et amélioration continue',
      description: 'Évaluation des gains de productivité et veille technologique.',
    },
  ],
};

export function getThemeConfig(codeCertif: RSCertificationCode) {
  const list = COMPETENCY_THEMES[codeCertif] || COMPETENCY_THEMES['RS6485'];
  return {
    themes: list.map((t) => ({ id: t.id, title: t.title })),
    competencies: list,
  };
}
