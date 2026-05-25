/**
 * Types MongoDB (backend Node.js uniquement).
 * Ces interfaces correspondent aux documents stockés dans MongoDB Atlas.
 *
 * Convention MongoDB :
 *   - _id  : ObjectId sérialisé en string côté application
 *   - Les champs sont en camelCase (contrairement au snake_case Supabase)
 *   - createdAt / updatedAt : gérés automatiquement par Mongoose / timestamps
 *
 * ⚠️  À n'importer que dans du code serveur (Express, Next.js API routes).
 *     Ne pas importer dans des composants React / pages Vite.
 */

// ============================================================
// Enums partagés (alignés sur src/types/supabase.ts)
// ============================================================

export type TransactionTypeM =
  | 'ACHAT'
  | 'VENTE'
  | 'DEPOT'
  | 'RETRAIT'
  | 'CHARGES'
  | 'ANNULATION';

export type StatutPaiementM = 'PAYÉ' | 'CRÉDIT' | 'NON-PAYÉ';

export type MouvementTypeM =
  | 'ACHAT'
  | 'VENTE'
  | 'DEPOT'
  | 'RETRAIT'
  | 'CHARGES'
  | 'RELIQUAT'
  | 'ALIMENTATION'
  | 'PRELEVEMENT'
  | 'ANNULATION';

export type StatutReliquatM = 'NON_SOLDE' | 'PARTIELLEMENT_SOLDE' | 'SOLDE';

export type CategorieClientM = 'STANDARD' | 'HABITUEL' | 'AMI' | 'ANONYME';

export type PieceTypeM = 'CIN' | 'PASSPORT' | 'AUTRES';

export type RoleM = 'ADMIN' | 'RESPONSABLE' | 'CAISSIER';

export type MomentJourneeM = 'MATIN' | 'JOURNEE' | 'SOIR';

export type ContexteCoffreM = 'AVANT_OUVERTURE' | 'EN_SEANCE' | 'APRES_CLOTURE';

export type StatutComptageM = 'BROUILLON' | 'VALIDÉ' | 'LITIGE';

// ============================================================
// ITransaction — collection "transactions"
// ============================================================

export interface ITransaction {
  _id?: string;
  /** Numéro séquentiel BCH-AAAA-NNNNNN. */
  numero: string;
  type: TransactionTypeM;
  devise: string;
  montant: number;
  /** Équivalent MAD de l'opération. */
  montantMAD: number;
  taux: number;
  operation: string;
  statut: StatutPaiementM;
  moment?: MomentJourneeM | null;
  montantAPayer?: number | null;
  /** Référence vers IClient._id. */
  clientId?: string | null;
  clientNom?: string | null;
  cin?: string | null;
  categorie: CategorieClientM;
  beneficiaire?: string | null;
  employeId: string;
  employeNom?: string | null;
  note?: string | null;
  caisseDepart?: number | null;
  jour: number;
  mois: number;
  annee: number;
  /** Hash d'intégrité SHA-256 — immuable après création. */
  hash?: string | null;
  /** Référence vers ITransaction._id pour les annulations. */
  annulationRef?: string | null;
  annulationRaison?: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// IClient — collection "clients"
// ============================================================

export interface IClient {
  _id?: string;
  nom: string;
  pieceType: PieceTypeM;
  pieceNumero: string;
  categorie: CategorieClientM;
  telephone?: string | null;
  email?: string | null;
  creePar: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// IUtilisateur — collection "utilisateurs"
// ============================================================

export interface IUtilisateur {
  _id?: string;
  nom: string;
  email: string;
  role: RoleM;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// IVersement — sous-document dans IReliquat
// ============================================================

export interface IVersement {
  id: string;
  date: Date;
  montant: number;
  note?: string | null;
}

// ============================================================
// IReliquat — collection "reliquats"
//   Statuts alignés sur le projet : NON_SOLDE / PARTIELLEMENT_SOLDE / SOLDE
//   (le SQL initial utilisait EN_ATTENTE — corrigé ici)
// ============================================================

export interface IReliquat {
  _id?: string;
  client: string;
  categorieClient?: CategorieClientM | null;
  /** ID ou numéro de l'opération source. */
  operationRef: string;
  operationNumero?: string | null;
  devise: string;
  montantInitial: number;
  montantRestant: number;
  statut: StatutReliquatM;
  /** Tableau des versements partiels. */
  versements: IVersement[];
  note?: string | null;
  dateCreation: Date;
  dateMaj: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// IMouvementCaisse — collection "mouvements_caisse"
//   Journal append-only : aucun document ne doit être modifié.
// ============================================================

export interface IMouvementCaisse {
  _id?: string;
  /** ISO 8601 complet (ex. 2026-05-25T10:35:22.314Z). */
  timestamp: Date;
  type: MouvementTypeM;
  devise: string;
  /** Positif = entrée, négatif = sortie. */
  montant: number;
  soldeAvant: number;
  soldeApres: number;
  operationRef?: string | null;
  operationNumero?: string | null;
  caissier: string;
  note?: string | null;
  contexte?: ContexteCoffreM | null;
  createdAt: Date;
}

// ============================================================
// ILigneComptage — sous-document dans IComptageCaisse
// ============================================================

export interface ILigneComptage {
  devise: string;
  montantPhysique: number;
  montantTheorique: number;
  ecart: number;
}

// ============================================================
// IComptageCaisse — collection "comptages_caisse"
// ============================================================

export interface IComptageCaisse {
  _id?: string;
  date: Date;
  moment: 'OUVERTURE' | 'CLOTURE';
  caissier: string;
  responsable?: string | null;
  lignes: ILigneComptage[];
  ecartTotalMAD: number;
  statut: StatutComptageM;
  /** Data URL PNG de la signature manuscrite. */
  signature?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Helpers de nommage des collections
// ============================================================

export const COLLECTIONS = {
  TRANSACTIONS:     'transactions',
  CLIENTS:          'clients',
  UTILISATEURS:     'utilisateurs',
  RELIQUATS:        'reliquats',
  MOUVEMENTS_CAISSE:'mouvements_caisse',
  COMPTAGES_CAISSE: 'comptages_caisse',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
