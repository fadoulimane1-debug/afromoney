/**
 * Client REST browser-compatible pour un backend MongoDB.
 *
 * Architecture correcte pour accéder à MongoDB depuis React/Vite :
 *
 *   [React/Vite browser]
 *        │  fetch()
 *        ▼
 *   [Backend Express / Next.js API Routes]  ← src/server/routes/
 *        │  MongoClient
 *        ▼
 *   [MongoDB Atlas]
 *
 * Ce fichier est importable dans les composants React.
 * Il appelle un backend REST qui, lui, utilise src/services/mongodbService.ts.
 *
 * Pour lancer le backend en local :
 *   cd server && node index.js   (voir src/server/index.ts)
 * En production : déployer sur Railway / Render / Heroku / VPS.
 */

// URL de base du backend — à surcharger via variable d'environnement Vite
const API_BASE = (import.meta.env.VITE_MONGODB_API_URL as string | undefined)
  ?? 'http://localhost:3001/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[mongoApiClient] ${res.status} ${res.statusText} — ${body}`);
  }

  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────────────────────
// Transactions
// ──────────────────────────────────────────────────────────────

export interface ApiTransaction {
  _id: string;
  numero: string;
  type: string;
  devise: string;
  montant: number;
  montantMAD: number;
  taux: number;
  operation: string;
  statut: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface TransactionQueryParams {
  dateDebut?: string;   // YYYY-MM-DD
  dateFin?: string;
  devise?: string;
  type?: string;
  employeId?: string;
}

export async function apiGetTransactions(
  params?: TransactionQueryParams,
): Promise<ApiTransaction[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  return apiFetch<ApiTransaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
}

export async function apiCreateTransaction(
  data: Omit<ApiTransaction, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiTransaction> {
  return apiFetch<ApiTransaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateTransaction(
  id: string,
  data: Partial<ApiTransaction>,
): Promise<ApiTransaction> {
  return apiFetch<ApiTransaction>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteTransaction(id: string): Promise<void> {
  await apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' });
}

// ──────────────────────────────────────────────────────────────
// Reliquats
// ──────────────────────────────────────────────────────────────

export interface ApiReliquat {
  _id: string;
  client: string;
  operationRef: string;
  devise: string;
  montantInitial: number;
  montantRestant: number;
  statut: 'NON_SOLDE' | 'PARTIELLEMENT_SOLDE' | 'SOLDE';
  versements: unknown[];
  dateCreation: string;
  dateMaj: string;
  [key: string]: unknown;
}

export async function apiGetReliquats(params?: {
  statut?: string;
}): Promise<ApiReliquat[]> {
  const qs = params?.statut ? `?statut=${params.statut}` : '';
  return apiFetch<ApiReliquat[]>(`/reliquats${qs}`);
}

export async function apiCreateReliquat(
  data: Omit<ApiReliquat, '_id'>,
): Promise<ApiReliquat> {
  return apiFetch<ApiReliquat>('/reliquats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateReliquat(
  id: string,
  data: Partial<ApiReliquat>,
): Promise<ApiReliquat> {
  return apiFetch<ApiReliquat>(`/reliquats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteReliquat(id: string): Promise<void> {
  await apiFetch<void>(`/reliquats/${id}`, { method: 'DELETE' });
}

// ──────────────────────────────────────────────────────────────
// Soldes (calculés côté serveur)
// ──────────────────────────────────────────────────────────────

export interface ApiSoldesResult {
  parDevise: { devise: string; achats: number; ventes: number; net: number }[];
  totalAchatsMAD: number;
  totalVentesMAD: number;
  totalCharges: number;
  benefice: number;
}

export async function apiCalculateSoldes(params?: {
  dateDebut?: string;
  dateFin?: string;
}): Promise<ApiSoldesResult> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  return apiFetch<ApiSoldesResult>(`/soldes${qs ? `?${qs}` : ''}`);
}

// ──────────────────────────────────────────────────────────────
// Clôtures journalières
// ──────────────────────────────────────────────────────────────

export async function apiGetClosures(): Promise<import('@/types').DailyClosure[]> {
  return apiFetch<import('@/types').DailyClosure[]>('/closures');
}

export async function apiUpsertClosure(
  closure: import('@/types').DailyClosure,
): Promise<import('@/types').DailyClosure> {
  return apiFetch<import('@/types').DailyClosure>('/closures', {
    method: 'PUT',
    body: JSON.stringify(closure),
  });
}

// ──────────────────────────────────────────────────────────────
// Taux de change partagés
// ──────────────────────────────────────────────────────────────

export async function apiGetExchangeRates(): Promise<{ rates: unknown[] }> {
  return apiFetch<{ rates: unknown[] }>('/settings/exchange-rates');
}

export async function apiPutExchangeRates(rates: unknown[]): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/settings/exchange-rates', {
    method: 'PUT',
    body: JSON.stringify({ rates }),
  });
}
