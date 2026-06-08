import dayjs from 'dayjs';
import type { Transaction } from '@/types';
import type { SnapshotType, StageOperation } from '@/types/stageCaisse';
import { getTransactions } from '@/lib/storage';
import { getSnapshotMap, getStageOperationsForDay, replaceSnapshotsForType, hasSnapshotType } from './storage';

/** Soldes caisse par code devise (quantités en caisse, pas valeur unique). */
export type BalanceMap = Record<string, number>;

export function zeroBalances(devises: string[]): BalanceMap {
  return Object.fromEntries(devises.map((d) => [d, 0]));
}

export function applyLigne(b: BalanceMap, devise: string, sens: 'ENTREE' | 'SORTIE', montant: number) {
  const v = b[devise] ?? 0;
  b[devise] = sens === 'ENTREE' ? v + montant : v - montant;
}

export function applyStageOperationToBalances(b: BalanceMap, op: StageOperation) {
  for (const l of op.lignes) {
    applyLigne(b, l.devise_code, l.sens, l.montant);
  }
}

/**
 * PDF §5 étapes 1–2 : solde courant = FINAL(J-1) puis opérations moment = MATIN.
 * Sert de base au snapshot DÉPART (étape 3).
 */
export function computeBalancesAfterMorningAdjusts(
  caisseId: number,
  date: string,
  devises: string[]
): BalanceMap {
  const prev = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
  const finalVeille = getSnapshotMap(caisseId, prev, 'FINAL');
  const b = zeroBalances(devises);
  for (const d of devises) b[d] = finalVeille[d] ?? 0;
  const ops = getStageOperationsForDay(caisseId, date).filter((o) => o.moment === 'MATIN');
  for (const op of ops) applyStageOperationToBalances(b, op);
  return b;
}

export function txsForAccountingDay(dayYmd: string): Transaction[] {
  return getTransactions().filter((t) => dayjs(t.date).format('YYYY-MM-DD') === dayYmd);
}

/**
 * Impact caisse selon cahier stage (double effet achat/vente) — aligné feuille V8.
 * Ces mouvements correspondent aux opérations « journée » (PDF) ; ici issus du module V8.
 */
export function applyV8TransactionToBalances(b: BalanceMap, t: Transaction) {
  switch (t.type) {
    case 'ACHAT':
      applyLigne(b, t.devise, 'ENTREE', t.montant);
      applyLigne(b, 'MAD', 'SORTIE', t.montantMAD);
      break;
    case 'VENTE':
      applyLigne(b, 'MAD', 'ENTREE', t.montantMAD);
      applyLigne(b, t.devise, 'SORTIE', t.montant);
      break;
    case 'DEPOT': {
      const d = t.devise;
      const amt = d === 'MAD' ? t.montantMAD : t.montant;
      applyLigne(b, d, 'ENTREE', amt);
      break;
    }
    case 'RETRAIT': {
      const d = t.devise;
      const amt = d === 'MAD' ? t.montantMAD : t.montant;
      applyLigne(b, d, 'SORTIE', amt);
      break;
    }
    case 'CHARGES':
      applyLigne(b, 'MAD', 'SORTIE', t.montantMAD);
      break;
    default:
      break;
  }
}

/** Solde départ + transactions V8 du jour → solde de clôture théorique (PDF étape 4–5). */
export function computeClosingFromOpeningAndV8(depart: BalanceMap, dayYmd: string, devises: string[]): BalanceMap {
  const b = zeroBalances(devises);
  for (const d of devises) b[d] = depart[d] ?? 0;
  for (const t of txsForAccountingDay(dayYmd)) {
    applyV8TransactionToBalances(b, t);
  }
  return b;
}

/** Clôture + opérations moment = SOIR (PDF étapes 6–7). */
export function computeFinalAfterEveningAdjusts(
  cloture: BalanceMap,
  caisseId: number,
  date: string,
  devises: string[]
): BalanceMap {
  const b = zeroBalances(devises);
  for (const d of devises) b[d] = cloture[d] ?? 0;
  const ops = getStageOperationsForDay(caisseId, date).filter((o) => o.moment === 'SOIR');
  for (const op of ops) applyStageOperationToBalances(b, op);
  return b;
}

export function writeSnapshotGroup(
  caisseId: number,
  date: string,
  type: SnapshotType,
  balances: BalanceMap,
  devises: string[]
) {
  replaceSnapshotsForType(caisseId, date, type, devises, balances);
}

/** Snapshot DÉPART saisi s’il existe, sinon FINAL(J-1) + opérations MATIN. */
export function getEffectiveDepartBalances(caisseId: number, date: string, devises: string[]): BalanceMap {
  if (hasSnapshotType(caisseId, date, 'DEPART')) {
    const m = getSnapshotMap(caisseId, date, 'DEPART');
    const b = zeroBalances(devises);
    for (const d of devises) b[d] = m[d] ?? 0;
    return b;
  }
  return computeBalancesAfterMorningAdjusts(caisseId, date, devises);
}

/** Snapshot CLÔTURE saisi s’il existe, sinon départ effectif + transactions V8. */
export function getEffectiveClosingBalances(caisseId: number, date: string, devises: string[]): BalanceMap {
  if (hasSnapshotType(caisseId, date, 'CLOTURE')) {
    const m = getSnapshotMap(caisseId, date, 'CLOTURE');
    const b = zeroBalances(devises);
    for (const d of devises) b[d] = m[d] ?? 0;
    return b;
  }
  const depart = getEffectiveDepartBalances(caisseId, date, devises);
  return computeClosingFromOpeningAndV8(depart, date, devises);
}

/** PDF §5 étapes 1–3 : enregistre le snapshot DÉPART = FINAL veille + Σ MATIN. */
export function repriseDepartDepuisVeille(
  caisseId: number,
  dateJ: string,
  _prevDate: string,
  devises: string[]
): void {
  const bal = computeBalancesAfterMorningAdjusts(caisseId, dateJ, devises);
  writeSnapshotGroup(caisseId, dateJ, 'DEPART', bal, devises);
}

/** Crée le snapshot DÉPART s'il manque (saisie rétroactive). Retourne true si créé. */
export function ensureDepartSnapshotForDay(
  caisseId: number,
  date: string,
  devises: string[],
): boolean {
  if (hasSnapshotType(caisseId, date, 'DEPART')) return false;
  const prev = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
  repriseDepartDepuisVeille(caisseId, date, prev, devises);
  return true;
}
