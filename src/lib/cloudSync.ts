/**
 * Sync bidirectionnelle : MongoDB Atlas (via Railway) ↔ cache localStorage.
 * Tous les postes ouvrant afromoney.vercel.app voient les mêmes données.
 */
import type { Transaction, ExchangeRate, DailyClosure } from '@/types';
import { normalizeTransaction } from '@/lib/transactionNormalize';
import { getCloudApiBase, isCloudSyncEnabled } from '@/lib/cloudConfig';
import {
  apiGetTransactions,
  apiCreateTransaction,
  apiUpdateTransaction,
  apiDeleteTransaction,
  apiGetClosures,
  apiUpsertClosure,
  apiGetExchangeRates,
  apiPutExchangeRates,
  type ApiTransaction,
} from '@/lib/mongoApiClient';

function emitDataChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('afromoney-data'));
}

export function apiToTransaction(doc: ApiTransaction): Transaction {
  const row: Record<string, unknown> = {
    ...doc,
    id: doc._id ?? (doc.id as string) ?? '',
    date: doc.date,
  };
  delete row._id;
  delete row.createdAt;
  delete row.updatedAt;
  return normalizeTransaction(row);
}

export function transactionToApiPayload(tx: Transaction): Record<string, unknown> {
  const date = tx.date instanceof Date ? tx.date.toISOString() : new Date(tx.date).toISOString();
  return {
    numero: tx.numero,
    type: tx.type,
    devise: tx.devise,
    montant: tx.montant,
    montantMAD: tx.montantMAD,
    taux: tx.taux,
    operation: tx.operation,
    statut: tx.statut,
    note: tx.note ?? '',
    employeId: tx.employeId,
    employeNom: tx.employeNom,
    jour: tx.jour,
    mois: tx.mois,
    date,
    caisseDepart: tx.caisseDepart,
    montantAPayer: tx.montantAPayer,
    moment: tx.moment,
    beneficiaire: tx.beneficiaire,
    clientId: tx.clientId,
    hash: tx.hash,
    annulationRef: tx.annulationRef,
    annulationRaison: tx.annulationRaison,
    categorie: 'STANDARD',
  };
}

function isMongoId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/** Télécharge tout depuis le cloud et remplace le cache local. */
export async function pullAllFromCloud(): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const [apiTxs, apiClosures, ratesRes] = await Promise.all([
    apiGetTransactions(),
    apiGetClosures(),
    apiGetExchangeRates().catch(() => ({ rates: [] as ExchangeRate[] })),
  ]);

  // Ne pas écraser le localStorage si le cloud est vide
  if (apiTxs.length === 0 && apiClosures.length === 0) return;

  const transactions = apiTxs.map(apiToTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));

  localStorage.setItem('closures', JSON.stringify(apiClosures));
  const validated = [...apiClosures]
    .filter((c) => c.status === 'VALIDATED')
    .sort((a, b) => b.date.localeCompare(a.date));
  if (validated[0]) {
    localStorage.setItem('lastClosure', JSON.stringify(validated[0]));
  }

  const rates = (ratesRes.rates ?? []) as ExchangeRate[];
  if (rates.length > 0) {
    localStorage.setItem('exchangeRates', JSON.stringify(rates));
  }

  emitDataChanged();
}

/** Envoie les données locales vers le cloud si le cloud est vide (migration unique). */
export async function migrateLocalToCloudIfEmpty(): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const remote = await apiGetTransactions();
  if (remote.length > 0) return;

  const localRaw = localStorage.getItem('transactions');
  if (!localRaw) return;
  const local = (JSON.parse(localRaw) as Record<string, unknown>[]).map((r) =>
    normalizeTransaction(r),
  );
  if (local.length === 0) return;

  for (const tx of local) {
    await apiCreateTransaction(
      transactionToApiPayload(tx) as Omit<ApiTransaction, '_id' | 'createdAt' | 'updatedAt'>,
    );
  }

  const closuresRaw = localStorage.getItem('closures');
  if (closuresRaw) {
    const closures = JSON.parse(closuresRaw) as DailyClosure[];
    for (const c of closures) {
      await apiUpsertClosure(c);
    }
  }

  const ratesRaw = localStorage.getItem('exchangeRates');
  if (ratesRaw) {
    const rates = JSON.parse(ratesRaw) as ExchangeRate[];
    if (rates.length > 0) await apiPutExchangeRates(rates);
  }

  await pullAllFromCloud();
}

export async function cloudCreateTransaction(tx: Transaction): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  const created = await apiCreateTransaction(
    transactionToApiPayload(tx) as Omit<ApiTransaction, '_id' | 'createdAt' | 'updatedAt'>,
  );
  const txs = JSON.parse(localStorage.getItem('transactions') || '[]') as Transaction[];
  const idx = txs.findIndex((t) => t.id === tx.id || t.numero === tx.numero);
  const mapped = apiToTransaction(created);
  if (idx >= 0) txs[idx] = mapped;
  else txs.push(mapped);
  localStorage.setItem('transactions', JSON.stringify(txs));
  emitDataChanged();
}

export async function cloudUpdateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  const mongoId = isMongoId(id) ? id : findMongoIdByLocalId(id);
  if (!mongoId) return;
  const patch: Record<string, unknown> = { ...updates };
  if (patch.date instanceof Date) patch.date = patch.date.toISOString();
  await apiUpdateTransaction(mongoId, patch);
}

export async function cloudDeleteTransaction(id: string): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  const mongoId = isMongoId(id) ? id : findMongoIdByLocalId(id);
  if (!mongoId) return;
  await apiDeleteTransaction(mongoId);
}

function findMongoIdByLocalId(localId: string): string | null {
  const txs = JSON.parse(localStorage.getItem('transactions') || '[]') as Transaction[];
  const t = txs.find((x) => x.id === localId);
  return t && isMongoId(t.id) ? t.id : null;
}

export async function cloudUpsertClosure(closure: DailyClosure): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  await apiUpsertClosure(closure);
}

export async function cloudPutExchangeRates(rates: ExchangeRate[]): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  await apiPutExchangeRates(rates);
}

export async function checkCloudHealth(): Promise<boolean> {
  if (!isCloudSyncEnabled()) return false;
  try {
    const base = getCloudApiBase();
    if (!base) return false;
    const res = await fetch(`${base}/health`);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      console.warn('[CloudSync] /api/health a renvoyé du HTML — Railway doit lancer "npm run server", pas le site Vite.');
      return false;
    }
    const j = (await res.json()) as { status?: string };
    return j.status === 'ok';
  } catch {
    return false;
  }
}
