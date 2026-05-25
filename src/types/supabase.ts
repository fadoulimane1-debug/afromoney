// ============================================================
// Types Supabase — miroir des tables de la base de données
// ============================================================

// ---- ENUMS partagés ----------------------------------------

export type TransactionType = 'ACHAT' | 'VENTE' | 'DEPOT' | 'RETRAIT' | 'CHARGES' | 'ANNULATION';
export type StatutPaiement = 'PAYÉ' | 'CRÉDIT' | 'NON-PAYÉ';
export type MouvementTypeDB = 'ACHAT' | 'VENTE' | 'DEPOT' | 'RETRAIT' | 'CHARGES' | 'RELIQUAT' | 'ALIMENTATION' | 'PRELEVEMENT' | 'ANNULATION';
export type StatutReliquat = 'NON_SOLDE' | 'PARTIELLEMENT_SOLDE' | 'SOLDE';
export type CategorieClient = 'STANDARD' | 'HABITUEL' | 'AMI' | 'ANONYME';
export type PieceType = 'CIN' | 'PASSPORT' | 'AUTRES';
export type Role = 'ADMIN' | 'RESPONSABLE' | 'CAISSIER';
export type MomentJournee = 'MATIN' | 'JOURNEE' | 'SOIR';
export type ContexteCoffre = 'AVANT_OUVERTURE' | 'EN_SEANCE' | 'APRES_CLOTURE';
export type StatutComptage = 'BROUILLON' | 'VALIDÉ' | 'LITIGE';

// ---- TRANSACTION -------------------------------------------

export interface Transaction {
  id: string;
  /** Numéro séquentiel BCH-AAAA-NNNNNN. */
  numero: string;
  type: TransactionType;
  devise: string;
  montant: number;
  montant_mad: number;
  taux: number;
  operation: string;
  statut: StatutPaiement;
  moment: MomentJournee | null;
  montant_a_payer: number | null;
  client_id: string | null;
  /** Nom libre du client (ANONYME ou non identifié). */
  client_nom: string | null;
  cin: string | null;
  categorie: CategorieClient;
  beneficiaire: string | null;
  employe_id: string;
  employe_nom: string | null;
  note: string | null;
  caisse_depart: number | null;
  jour: number;
  mois: number;
  annee: number;
  /** Hash d'intégrité — calculé à la création, jamais modifiable. */
  hash: string | null;
  /** Référence vers la transaction originale (type ANNULATION). */
  annulation_ref: string | null;
  annulation_raison: string | null;
  date: string;         // ISO date YYYY-MM-DD
  created_at: string;   // ISO 8601
  updated_at: string;
}

// ---- CLIENT ------------------------------------------------

export interface ClientDB {
  id: string;
  nom: string;
  piece_type: PieceType;
  piece_numero: string;
  categorie: CategorieClient;
  telephone: string | null;
  email: string | null;
  cree_par: string;
  created_at: string;
  updated_at: string;
}

// ---- UTILISATEUR -------------------------------------------

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  role: Role;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

// ---- RELIQUAT ----------------------------------------------

export interface VersementDB {
  id: string;
  date: string;      // YYYY-MM-DD
  montant: number;
  note: string | null;
}

export interface ReliquatDB {
  id: string;
  client: string;
  categorie_client: CategorieClient | null;
  operation_ref: string;
  operation_numero: string | null;
  devise: string;
  montant_initial: number;
  montant_restant: number;
  statut: StatutReliquat;
  /** Tableau de versements sérialisé en JSON dans Supabase. */
  versements: VersementDB[];
  note: string | null;
  date_creation: string;   // YYYY-MM-DD
  date_maj: string;        // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

// ---- MOUVEMENT CAISSE (journal immuable) -------------------

export interface MouvementCaisseDB {
  id: string;
  /** Horodatage complet ISO 8601 (ex. 2026-05-21T10:35:22.314Z). */
  timestamp: string;
  type: MouvementTypeDB;
  devise: string;
  /** Positif = entrée, négatif = sortie. */
  montant: number;
  /** Solde de la devise juste avant ce mouvement. */
  solde_avant: number;
  /** Solde de la devise juste après ce mouvement. */
  solde_apres: number;
  operation_ref: string | null;
  operation_numero: string | null;
  caissier: string;
  note: string | null;
  contexte: ContexteCoffre | null;
  created_at: string;
  updated_at: string;
}

// ---- COMPTAGE CAISSE (physique vs théorique) ---------------

export interface LigneComptage {
  devise: string;
  montant_physique: number;
  montant_theorique: number;
  ecart: number;
}

export interface ComptageCaisse {
  id: string;
  date: string;                    // YYYY-MM-DD
  /** OUVERTURE = début de journée, CLOTURE = fin de journée. */
  moment: 'OUVERTURE' | 'CLOTURE';
  caissier: string;
  responsable: string | null;
  lignes: LigneComptage[];
  ecart_total_mad: number;
  statut: StatutComptage;
  /** Image PNG (data URL) de la signature manuscrite. */
  signature: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}
