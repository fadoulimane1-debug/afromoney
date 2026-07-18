// === CLIENTS ===

export type PieceType = 'CIN' | 'PASSPORT' | 'AUTRES';
export type CategorieClient = 'STANDARD' | 'HABITUEL' | 'AMI';

export interface Client {
  id: string;
  nom: string;
  pieceType: PieceType;
  pieceNumero: string;
  categorie: CategorieClient;
  telephone?: string;
  email?: string;
  dateCreation: string;  // YYYY-MM-DD
  creePar: string;
}

// === TRANSACTIONS ===

/** Aligné sur « SUIVI TRANSACTIONS XCHANGE 2026 » — feuille Jan 2026 (et mois suivants). */
export type TransactionType = 'ACHAT' | 'VENTE' | 'DEPOT' | 'RETRAIT' | 'CHARGES' | 'ANNULATION';

export type StatutPaiement = 'PAYÉ' | 'CRÉDIT' | 'NON-PAYÉ';

export interface Transaction {
  id: string;
  /** Date complète (équivalent Excel). */
  date: Date;
  /** Colonne A du suivi — optionnel par ligne. */
  caisseDepart?: number | null;
  /** Jour (1–31), comme dans le tableau. */
  jour: number;
  /** Mois (1–12). */
  mois: number;
  /** Référence employé (liste). */
  employeId: string;
  /** Libellé libre pour export / conformité Excel (ex. « Abdelhamid »). */
  employeNom?: string | null;
  type: TransactionType;
  /**
   * Libellé métier de l’opération (champ ajouté — synthèse lisible).
   * Ex. : « Vente EUR client », « Dépôt MAD caisse ».
   */
  operation: string;
  devise: string;
  montant: number;
  taux: number;
  montantMAD: number;
  /**
   * VENTE : montant déjà payé par le client (MAD).
   * CRÉDIT : montant restant dû saisi à part.
   * Si absent, les exports utilisent `montantMAD` comme référence.
   */
  montantAPayer?: number | null;
  note: string;
  statut: StatutPaiement;
  /** Phase de la journée — MATIN / JOURNEE / SOIR (PDF §4.3). */
  moment?: 'MATIN' | 'JOURNEE' | 'SOIR';
  beneficiaire?: string;
  /** Référence vers Client.id — obligatoire si montantMAD ≥ 10 000. */
  clientId?: string;
  /** Numéro séquentiel BCH-AAAA-NNNNNN attribué à la création. */
  numero?: string;
  /** Hash d'intégrité R1 — calculé à la création, jamais modifiable. */
  hash?: string;
  /** Pour les transactions ANNULATION : ID de la transaction originale. */
  annulationRef?: string;
  /** Pour les transactions ANNULATION : raison déclarée. */
  annulationRaison?: string;
  datePaiement?: string | null;
}

export interface ExchangeRate {
  devise: string;
  tauxAchat: number;
  tauxVente: number;
  tauxJour: number;
  dateUpdate: Date;
}

export interface Stock {
  devise: string;
  totalAchete: number;
  totalVendu: number;
  stockActuel: number;
  valeurMAD: number;
}

export interface MonthlyReport {
  mois: string;
  caisseDepart: number;
  totalAchats: number;
  totalVentes: number;
  beneficeBrut: number;
  chargesAgence: number;
  beneficeNet: number;
  margePercent: number;
  nbTransactions: number;
}

export type Role = 'ADMIN' | 'RESPONSABLE' | 'CAISSIER';

export interface User {
  id: string;
  nom: string;
  email: string;
  role: Role;
  dateCreation: Date;
}

export interface AppState {
  transactions: Transaction[];
  exchangeRates: ExchangeRate[];
  users: User[];
  currentUser: User | null;
}

// === CLÔTURE JOURNALIÈRE ===

export interface DailyClosure {
  id: string;
  date: string; // ISO date: 2026-05-14
  day: number;
  month: number;
  year: number;
  employee: string;
  manager?: string;

  initialBalance: { [devise: string]: number };
  initialBalanceMAD: number;

  transactions: {
    totalBuys: number;
    totalSells: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalCharges: number;
  };

  finalBalance: { [devise: string]: number };
  finalBalanceMAD: number;

  dailyBenefit: number;
  theoreticalBalance: number;
  realBalance: number;

  variance: number;
  isBalanced: boolean;

  status: 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'ERROR';
  validatedAt?: string;
  /** Image PNG (data URL) de la signature manuscrite, ou identifiant legacy. */
  signature?: string;

  notes?: string;
  errorDetails?: string;
}

export interface ClosureHistory {
  closures: DailyClosure[];
  lastClosure?: DailyClosure;
}

export interface DailyBalanceByDevise {
  devise: string;
  initialQty: number;
  bought: number;
  sold: number;
  finalQty: number;
  rateDaily: number;
  finalValueMAD: number;
}

// === JOURNAL CAISSE (mouvements immuables) ===

export type MouvementType =
  | 'ACHAT'
  | 'VENTE'
  | 'DEPOT'
  | 'RETRAIT'
  | 'CHARGES'
  | 'RELIQUAT'
  | 'ALIMENTATION'
  | 'PRELEVEMENT'
  | 'ANNULATION';

export type ContexteCoffre = 'AVANT_OUVERTURE' | 'EN_SEANCE' | 'APRES_CLOTURE';

export interface MouvementCaisse {
  /** Clé unique : timestamp millis + nonce aléatoire. */
  id: string;
  /** Horodatage complet ISO 8601 (ex. 2026-05-21T10:35:22.314Z). */
  timestamp: string;
  type: MouvementType;
  devise: string;
  /** Positif = entrée, négatif = sortie. */
  montant: number;
  /** Solde de la devise juste avant ce mouvement. */
  soldeAvant: number;
  /** Solde de la devise juste après ce mouvement. */
  soldeApres: number;
  /** ID de la transaction ou du reliquat à l'origine. */
  operationRef?: string;
  /** Numéro BCH-AAAA-NNNNNN de la transaction à l'origine. */
  operationNumero?: string;
  caissier: string;
  note?: string;
  /** Moment de la journée pour ALIMENTATION/PRELEVEMENT coffre. */
  contexte?: ContexteCoffre;
  /** Toujours true — jamais modifiable. */
  readonly locked: true;
}

// === RELIQUATS (créances clients) ===

export type StatutReliquat = 'NON_SOLDE' | 'PARTIELLEMENT_SOLDE' | 'SOLDE';

export interface Versement {
  id: string;
  date: string;       // YYYY-MM-DD
  montant: number;
  note?: string;
}

export interface Reliquat {
  id: string;
  dateCreation: string;  // YYYY-MM-DD
  dateMaj: string;       // YYYY-MM-DD
  client: string;
  categorieClient?: 'HABITUEL' | 'AMI';
  /** ID ou numéro de la transaction d'origine */
  operationRef: string;
  operationNumero?: string;
  /** MAD ou devise étrangère */
  devise: string;
  montantInitial: number;
  montantRestant: number;
  statut: StatutReliquat;
  versements: Versement[];
  note?: string;
}
