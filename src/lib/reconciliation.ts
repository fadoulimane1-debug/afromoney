/**
 * Logique de réconciliation journalière — intégration avec le système stageCaisse
 * (3 snapshots : DÉPART / CLÔTURE / FINAL — PDF §5–7).
 */
import type { SnapshotType } from '@/types/stageCaisse';
import { getSnapshotMap, hasSnapshotType } from '@/lib/stageCaisse/storage';
import { getExchangeRates } from '@/lib/storage';
import { newEntityId } from '@/lib/entityId';

const CAISSE_ID = 1;
const KEY_RECONCILIATIONS = 'afromoney_reconciliations';
const KEY_AUDIT_LOGS = 'afromoney_audit_logs';

// === TYPES ===

export interface ReconciliationRecord {
  id: string;
  date: string;
  createdAt: string;

  theoreticalByDevise: Record<string, number>;
  theoreticalMAD: number;

  physicalByDevise: Record<string, number>;
  physicalMAD: number;

  varianceByDevise: Record<string, number>;
  varianceMAD: number;

  status: 'OK' | 'ALERTE' | 'ERREUR';
  justification?: string;

  validated: boolean;
  validatedBy?: string;
  validatedAt?: string;

  invariantValid: boolean;
  invariantErrors: string[];

  hasDepart: boolean;
  hasCloture: boolean;
  hasFinal: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  date: string;
  action: string;
  user: string;
  details: Record<string, unknown>;
}

// === HELPERS ===

function emit() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('afromoney-data'));
}

/** Convertit un montant en devise vers MAD au taux jour. */
export function deviseToMAD(devise: string, amount: number): number {
  if (devise === 'MAD') return amount;
  const rates = getExchangeRates();
  const rate = rates.find((r) => r.devise === devise)?.tauxJour ?? 1;
  return amount * rate;
}

/** Convertit un map de balances en total MAD. */
export function snapshotToMAD(balances: Record<string, number>): number {
  return Object.entries(balances).reduce(
    (sum, [devise, amount]) => sum + deviseToMAD(devise, amount),
    0,
  );
}

/** Récupère le snapshot d'un type pour une date et calcule son total MAD. */
export function getSnapshotWithMAD(
  date: string,
  type: SnapshotType,
): { balances: Record<string, number>; mad: number } {
  const balances = getSnapshotMap(CAISSE_ID, date, type);
  return { balances, mad: snapshotToMAD(balances) };
}

/** Vérifie si un snapshot de ce type existe pour cette date. */
export function hasSnapshot(date: string, type: SnapshotType): boolean {
  return hasSnapshotType(CAISSE_ID, date, type);
}

/** Calcule l'écart entre le comptage physique et le solde théorique. */
export function computeVariance(
  theoreticalByDevise: Record<string, number>,
  physicalByDevise: Record<string, number>,
): { byDevise: Record<string, number>; totalMAD: number } {
  const allDevises = new Set([
    ...Object.keys(theoreticalByDevise),
    ...Object.keys(physicalByDevise),
  ]);
  const byDevise: Record<string, number> = {};
  let totalMAD = 0;
  for (const devise of allDevises) {
    const diff = (physicalByDevise[devise] ?? 0) - (theoreticalByDevise[devise] ?? 0);
    byDevise[devise] = diff;
    totalMAD += deviseToMAD(devise, diff);
  }
  return { byDevise, totalMAD };
}

// === RÉCONCILIATION CRUD ===

export function getReconciliations(): ReconciliationRecord[] {
  try {
    const data = localStorage.getItem(KEY_RECONCILIATIONS);
    return data ? (JSON.parse(data) as ReconciliationRecord[]) : [];
  } catch {
    return [];
  }
}

export function getReconciliation(date: string): ReconciliationRecord | null {
  return getReconciliations().find((r) => r.date === date) ?? null;
}

export function saveReconciliation(rec: ReconciliationRecord): void {
  const list = getReconciliations();
  const idx = list.findIndex((r) => r.date === rec.date);
  if (idx >= 0) list[idx] = rec;
  else list.push(rec);
  localStorage.setItem(KEY_RECONCILIATIONS, JSON.stringify(list));
  emit();
}

// === AUDIT TRAIL ===

export function getAuditLogs(date?: string): AuditLogEntry[] {
  try {
    const data = localStorage.getItem(KEY_AUDIT_LOGS);
    const all: AuditLogEntry[] = data ? (JSON.parse(data) as AuditLogEntry[]) : [];
    return date ? all.filter((l) => l.date === date) : all;
  } catch {
    return [];
  }
}

export function addAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): AuditLogEntry {
  const full: AuditLogEntry = {
    ...entry,
    id: newEntityId('audit'),
    timestamp: new Date().toISOString(),
  };
  try {
    const logs = getAuditLogs();
    logs.push(full);
    localStorage.setItem(KEY_AUDIT_LOGS, JSON.stringify(logs.slice(-1000)));
  } catch {
    /* ignore quota errors */
  }
  return full;
}
