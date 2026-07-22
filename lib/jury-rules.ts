import { JuryConfig, Organization } from './types';

export const JURY_RULES: Record<Organization, JuryConfig> = {
  'Proforma Institut': {
    organisme: 'Proforma Institut',
    chair: 'Kaina Nassim',
    member: 'Tom Fournaise',
    contact: 'proformainstitut@gmail.com',
    examOfficer: 'Kaina Nassim',
    pedagogicalOfficer: 'Kaina Nassim',
  },
  'Proskills Institut': {
    organisme: 'Proskills Institut',
    chair: 'Anthony Malheiro',
    member: 'Romain Picano Palombo',
    contact: 'proskillsinstitut@gmail.com',
    examOfficer: 'Anthony Malheiro',
    pedagogicalOfficer: 'Anthony Malheiro',
  },
};

export function getJuryConfig(organisme: Organization): JuryConfig {
  return JURY_RULES[organisme] || JURY_RULES['Proforma Institut'];
}

export function getJuryRules(organisme: Organization) {
  const config = getJuryConfig(organisme);
  return {
    presidentName: config.chair,
    memberName: config.member,
    contact: config.contact,
  };
}
