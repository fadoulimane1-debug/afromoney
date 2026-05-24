import type { Transaction } from '@/types';

// ─── Hash R1 ──────────────────────────────────────────────────────────────────

/**
 * Génère un hash d'intégrité déterministe (64 hex chars, style SHA-256).
 * Calculé une seule fois à la création de la transaction et stocké.
 * Toute modification des champs financiers invalide le hash.
 */
export function generateHash(fields: {
  id: string;
  numero: string;
  type: string;
  devise: string;
  montant: number;
  montantMAD: number;
  taux: number;
  employeId: string;
}): string {
  const input = `${fields.id}|${fields.numero}|${fields.type}|${fields.devise}|${fields.montant.toFixed(6)}|${fields.montantMAD.toFixed(6)}|${fields.taux.toFixed(6)}|${fields.employeId}`;

  // Splitmix64-style synchronous hash → 64-char hex
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x9e3779b9) >>> 0;
  }

  let result = '';
  let seed = h >>> 0;
  for (let i = 0; i < 8; i++) {
    seed = (seed + 0x9e3779b9) >>> 0;
    let z = seed;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    result += z.toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Vérifie que le hash stocké correspond aux champs financiers actuels.
 * Retourne false si aucun hash n'est stocké (anciennes transactions).
 */
export function verifyHash(tx: Transaction): boolean {
  if (!tx.hash || !tx.numero) return false;
  const computed = generateHash({
    id: tx.id,
    numero: tx.numero,
    type: tx.type,
    devise: tx.devise,
    montant: tx.montant,
    montantMAD: tx.montantMAD,
    taux: tx.taux,
    employeId: tx.employeId,
  });
  return computed === tx.hash;
}

/** Toutes les transactions enregistrées sont immuables. */
export function isOperationLocked(): boolean {
  return true;
}

// ─── Statut audit ─────────────────────────────────────────────────────────────

export type StatutAudit = 'VALIDE' | 'ANNULEE';

/**
 * Calcule le statut d'audit d'une transaction.
 * Une transaction est ANNULEE si une autre de type ANNULATION la référence.
 */
export function getStatutAudit(tx: Transaction, allTx: Transaction[]): StatutAudit {
  if (tx.type === 'ANNULATION') return 'VALIDE';
  const annulled = allTx.some((t) => t.type === 'ANNULATION' && t.annulationRef === tx.id);
  return annulled ? 'ANNULEE' : 'VALIDE';
}
