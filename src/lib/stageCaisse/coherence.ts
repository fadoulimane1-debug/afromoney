import type { SnapshotType } from '@/types/stageCaisse';
import { getSnapshotMap, getStageOperationsForDay } from './storage';
import { applyStageOperationToBalances, zeroBalances } from './engine';

/**
 * PDF §7.2 : SOLDE DEPART(J, d) = SOLDE FINAL(J-1, d) + Σ opérations(J, d, moment=MATIN).
 * Compare le snapshot DÉPART enregistré au montant théorique (entrées − sorties).
 */
export function checkDepartTheorique(
  caisseId: number,
  dateJ: string,
  dateJmoins1: string,
  devises: string[]
): { devise: string; ok: boolean; stocke: number; theorique: number }[] {
  const stockeMap = getSnapshotMap(caisseId, dateJ, 'DEPART');
  const finVeille = getSnapshotMap(caisseId, dateJmoins1, 'FINAL');
  const b = zeroBalances(devises);
  for (const d of devises) b[d] = finVeille[d] ?? 0;
  const matinOps = getStageOperationsForDay(caisseId, dateJ).filter((o) => o.moment === 'MATIN');
  for (const op of matinOps) applyStageOperationToBalances(b, op);
  return devises.map((devise) => {
    const theorique = b[devise] ?? 0;
    const stocke = stockeMap[devise] ?? 0;
    const ok = Math.abs(stocke - theorique) < 0.0001;
    return { devise, ok, stocke, theorique };
  });
}

export const SNAPSHOT_LABELS: Record<SnapshotType, string> = {
  DEPART: '1. Solde départ',
  CLOTURE: '2. Solde de clôture',
  FINAL: '3. Solde final',
};
