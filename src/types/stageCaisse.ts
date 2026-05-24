/**
 * Modèle aligné sur le cahier « Exercice stage — gestion de caisse agence de change » (PDF mai 2026).
 * 5 concepts : Devise, Caisse, Operation (+ moment), LigneOperation (double entrée), SoldeJournalier (3 snapshots).
 */

export type SnapshotType = 'DEPART' | 'CLOTURE' | 'FINAL';

/** Phase de la journée (table Operation.moment) — PDF §4.3 : MATIN / JOURNEE / SOIR. */
export type OperationMoment = 'MATIN' | 'JOURNEE' | 'SOIR';

/** Nature d’opération (cahier stage). CHARGES V8 ≈ DEPENSE. */
export type OperationNatureStage =
  | 'ACHAT'
  | 'VENTE'
  | 'DEPOT'
  | 'DEPENSE'
  | 'ALIMENTATION'
  | 'RETRAIT';

export type LigneSens = 'ENTREE' | 'SORTIE';

export interface DeviseRef {
  code: string;
  libelle: string;
  symbole: string;
}

export interface CaisseRef {
  id: number;
  nom: string;
}

/** Entête de mouvement (phase journée = moment). */
export interface StageOperation {
  id: string;
  caisse_id: number;
  date_operation: string;
  date_comptable: string;
  moment: OperationMoment;
  nature: OperationNatureStage;
  description?: string;
  utilisateur?: string;
  taux_change?: number | null;
  lignes: StageLigneOperation[];
}

export interface StageLigneOperation {
  devise_code: string;
  sens: LigneSens;
  montant: number;
}

/** Un des 3 snapshots par devise et jour (unicité caisse + date + type + devise). */
export interface SoldeJournalierRow {
  id: string;
  caisse_id: number;
  date_comptable: string;
  type_solde: SnapshotType;
  devise_code: string;
  montant: number;
  horodatage: string;
}
