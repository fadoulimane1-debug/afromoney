import type { TransactionType } from '@/types';

export const DEVISES = ['EUR', 'USD', 'GBP', 'CAD', 'SAR', 'AED', 'CHF', 'MAD', 'KWD', 'QAR', 'BHD'];

export const TYPES_OPERATION: TransactionType[] = [
  'ACHAT',
  'VENTE',
  'DEPOT',
  'RETRAIT',
  'CHARGES',
];

/** Libellés comme sur le classeur Excel / AFROMONEY V8 (DÉPÔT, CHARGES AGENCE). */
export const TYPE_OPERATION_LABEL: Record<TransactionType, string> = {
  ACHAT:      'ACHAT',
  VENTE:      'VENTE',
  DEPOT:      'DÉPÔT',
  RETRAIT:    'RETRAIT',
  CHARGES:    'CHARGES AGENCE',
  ANNULATION: 'ANNULATION',
};

/** Colonne SECTION — feuille HISTORIQUE (AFROMONEY_V8_FINAL). */
export const SECTION_HISTORIQUE_V8: Record<TransactionType, string> = {
  ACHAT:      'ACHAT',
  VENTE:      'VENTE',
  DEPOT:      'DÉPÔT',
  RETRAIT:    'RETRAIT',
  CHARGES:    'CHARGES AGENCE',
  ANNULATION: 'ANNULATION',
};

/** Ordre des devises — feuille CAISSE & récap « RÉCAPITULATIF PAR DEVISE » V8. */
export const DEVISES_CAISSE_V8 = [
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'SAR',
  'AED',
  'CHF',
  'KWD',
] as const;

/** Libellé opération par défaut (champ « Opération » du suivi). */
export function buildDefaultOperation(
  type: TransactionType,
  montant: number,
  devise: string
): string {
  return `${TYPE_OPERATION_LABEL[type]} — ${montant} ${devise}`.trim();
}

export const STATUTS = ['PAYÉ', 'CRÉDIT', 'NON-PAYÉ'] as const;

/** Cours médian (référence) — utilisé si aucune autre source. */
export const TAUX_PAR_DEFAUT: Record<string, number> = {
  EUR: 11.25,
  USD: 10.15,
  GBP: 13.2,
  CAD: 7.65,
  SAR: 2.75,
  AED: 2.85,
  CHF: 11.5,
  MAD: 1.0,
  KWD: 29.0,
  QAR: 2.43,
  BHD: 23.5,
};

/** Taux bureau : achat (vous achetez la devise au client) < vente (vous vendez au client). */
export const TAUX_BUREAU_DEFAUT: Record<string, { achat: number; vente: number }> = {
  EUR: { achat: 11.2, vente: 11.3 },
  USD: { achat: 10.1, vente: 10.2 },
  GBP: { achat: 13.1, vente: 13.3 },
  CAD: { achat: 7.6, vente: 7.7 },
  SAR: { achat: 2.7, vente: 2.8 },
  AED: { achat: 2.8, vente: 2.9 },
  CHF: { achat: 11.4, vente: 11.6 },
  KWD: { achat: 28.8, vente: 29.2 },
  QAR: { achat: 2.4, vente: 2.46 },
  BHD: { achat: 23.3, vente: 23.7 },
};

export const UTILISATEURS_TEST = [
  { id: '1', nom: 'Admin User',    email: 'admin@afromoney.com',       role: 'ADMIN'       as const },
  { id: '2', nom: 'Maryam Saad',   email: 'responsable@afromoney.com', role: 'RESPONSABLE' as const },
  { id: '3', nom: 'Omar Benali',   email: 'caissier@afromoney.com',    role: 'CAISSIER'    as const },
];
