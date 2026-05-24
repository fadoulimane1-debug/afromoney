/**
 * Récupération automatique des taux de change.
 *
 * Priorité :
 *   1. BKAM officiel   → https://www.bkam.ma/websitedata/Taux_de_Change.json
 *   2. CDN fawazahmed0 → CORS-safe, gratuit, toutes devises
 *   3. Taux en cache localStorage (dernier fetch réussi)
 *   4. Taux par défaut codés en dur
 */

import type { ExchangeRate } from '@/types';
import { DEVISES, TAUX_BUREAU_DEFAUT, TAUX_PAR_DEFAUT } from '@/lib/constants';
import { getExchangeRates, saveExchangeRates } from '@/lib/storage';

/* ── Types publics ── */

export type RatesSource = 'BKAM' | 'CDN' | 'cache' | 'default';

export interface RatesMeta {
  fetchedAt: string;   // ISO
  source: RatesSource;
}

/* ── Clés localStorage ── */

const LS_META = 'afromoney_rates_meta';

/* ── Helpers ── */

function safeParseFloat(v: unknown): number {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** Écart appliqué quand la source ne donne qu'un cours médian (CDN / cache corrompu). */
const SPREAD_HALF_PCT = 0.005; // 0,5 % de chaque côté → ~1 % entre achat et vente

/** Achats < ventes : le bureau achète la devise moins cher qu'il ne la vend. */
export function applyBureauSpread(devise: string, mid: number, dateUpdate = new Date()): ExchangeRate {
  const half = Math.max(mid * SPREAD_HALF_PCT, 0.015);
  const achat = parseFloat((mid - half).toFixed(4));
  const vente = parseFloat((mid + half).toFixed(4));
  return {
    devise,
    tauxAchat: achat,
    tauxVente: vente,
    tauxJour: parseFloat(mid.toFixed(4)),
    dateUpdate,
  };
}

export function ensureBureauSpread(rate: ExchangeRate): ExchangeRate {
  if (rate.devise === 'MAD') return rate;
  const achat = rate.tauxAchat;
  const vente = rate.tauxVente;
  if (achat > 0 && vente > 0 && vente - achat >= 0.01) {
    return {
      ...rate,
      tauxJour: parseFloat(((achat + vente) / 2).toFixed(4)),
    };
  }
  const mid =
    rate.tauxJour > 0
      ? rate.tauxJour
      : achat > 0
        ? achat
        : vente > 0
          ? vente
          : 0;
  const dateUpdate = rate.dateUpdate instanceof Date ? rate.dateUpdate : new Date(rate.dateUpdate);

  // Cours connu (CDN / BKAM / saisie) : écart ~1 % autour du milieu, pas les défauts codés en dur
  if (mid > 0) {
    return applyBureauSpread(rate.devise, mid, dateUpdate);
  }

  const bureau = TAUX_BUREAU_DEFAUT[rate.devise];
  if (bureau) {
    return {
      devise: rate.devise,
      tauxAchat: bureau.achat,
      tauxVente: bureau.vente,
      tauxJour: parseFloat(((bureau.achat + bureau.vente) / 2).toFixed(4)),
      dateUpdate,
    };
  }
  const t = TAUX_PAR_DEFAUT[rate.devise] ?? 1;
  return applyBureauSpread(rate.devise, t, dateUpdate);
}

export function repairAllRatesSpread(): ExchangeRate[] {
  const fixed = getExchangeRates().map(ensureBureauSpread);
  saveExchangeRates(fixed);
  return fixed;
}

function fallbackRate(devise: string): ExchangeRate {
  const bureau = TAUX_BUREAU_DEFAUT[devise];
  if (bureau) {
    const now = new Date();
    return {
      devise,
      tauxAchat: bureau.achat,
      tauxVente: bureau.vente,
      tauxJour: parseFloat(((bureau.achat + bureau.vente) / 2).toFixed(4)),
      dateUpdate: now,
    };
  }
  const t = TAUX_PAR_DEFAUT[devise] ?? 1;
  return applyBureauSpread(devise, t);
}

/* ── Parser BKAM ── */
// Format attendu : [{ CODE:"EUR", ACHAT:"11.20", VENTE:"11.30" }, ...]
function parseBKAM(rows: unknown[]): ExchangeRate[] {
  const now = new Date();
  return rows.flatMap((r: any) => {
    const devise = String(r?.CODE ?? r?.code ?? '').toUpperCase();
    const achat  = safeParseFloat(r?.ACHAT ?? r?.achat);
    const vente  = safeParseFloat(r?.VENTE ?? r?.vente);
    if (!devise || achat <= 0 || vente <= 0) return [];
    return [{
      devise,
      tauxAchat: achat,
      tauxVente: vente,
      tauxJour:  parseFloat(((achat + vente) / 2).toFixed(4)),
      dateUpdate: now,
    }];
  });
}

/* ── Parser CDN fawazahmed0 ── */
// Format : { date:"2026-05-15", mad:{ eur:0.0889, usd:0.0988, ... } }
// mad[code] = nombre de "devise" pour 1 MAD → tauxJour = 1 / mad[code]
function parseCDN(json: { mad?: Record<string, number> }): ExchangeRate[] {
  const now = new Date();
  const map = json.mad ?? {};
  return Object.entries(map).flatMap(([code, madRate]) => {
    if (!madRate || madRate <= 0) return [];
    const devise = code.toUpperCase();
    const tauxJour = parseFloat((1 / madRate).toFixed(4));
    return [{ ...applyBureauSpread(devise, tauxJour, now) }];
  });
}

/* ── Merge avec les devises connues ── */
function mergeRates(fetched: ExchangeRate[], existing: ExchangeRate[]): ExchangeRate[] {
  const fetchedMap = new Map(fetched.map((r) => [r.devise, r]));
  const existingMap = new Map(existing.map((r) => [r.devise, r]));
  return DEVISES.filter((d) => d !== 'MAD').map((d) =>
    ensureBureauSpread(fetchedMap.get(d) ?? existingMap.get(d) ?? fallbackRate(d)),
  );
}

/* ── Fetch BKAM ── */
async function tryBKAM(): Promise<ExchangeRate[]> {
  const url =
    typeof import.meta !== 'undefined' && import.meta.env?.DEV
      ? '/api/bkam/websitedata/Taux_de_Change.json'
      : 'https://www.bkam.ma/websitedata/Taux_de_Change.json';
  const res = await fetch(url, {
    signal: timeoutSignal(8_000),
    cache: 'no-cache',
  });
  if (!res.ok) throw new Error(`BKAM ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) throw new Error('BKAM: tableau vide');
  const rates = parseBKAM(json);
  if (rates.length < 3) throw new Error('BKAM: données insuffisantes');
  return rates;
}

/* ── Fetch CDN fawazahmed0 ── */
async function tryCDN(): Promise<ExchangeRate[]> {
  const url = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/mad.json';
  const res = await fetch(url, {
    signal: timeoutSignal(8_000),
    cache: 'no-cache',
  });
  if (!res.ok) throw new Error(`CDN ${res.status}`);
  const json = await res.json();
  const rates = parseCDN(json);
  if (rates.length < 5) throw new Error('CDN: données insuffisantes');
  return rates;
}

/* ── Meta (source + horodatage du dernier fetch réussi) ── */

export function getCachedMeta(): RatesMeta | null {
  try {
    const raw = localStorage.getItem(LS_META);
    return raw ? (JSON.parse(raw) as RatesMeta) : null;
  } catch {
    return null;
  }
}

function saveMeta(source: RatesSource) {
  localStorage.setItem(LS_META, JSON.stringify({ fetchedAt: new Date().toISOString(), source }));
}

function isCacheStale(maxAgeHours = 4): boolean {
  const meta = getCachedMeta();
  if (!meta || meta.source === 'default') return true;
  return Date.now() - new Date(meta.fetchedAt).getTime() > maxAgeHours * 3_600_000;
}

/* ── Fetch principal (BKAM → CDN → cache → default) ── */

export async function fetchAndSaveRates(): Promise<RatesSource> {
  const existing = getExchangeRates();

  // 1. BKAM
  try {
    const bkam = await tryBKAM();
    const merged = mergeRates(bkam, existing);
    saveExchangeRates(merged);
    saveMeta('BKAM');
    return 'BKAM';
  } catch {
    /* BKAM indisponible → essayer CDN */
  }

  // 2. CDN
  try {
    const cdn = await tryCDN();
    const merged = mergeRates(cdn, existing);
    saveExchangeRates(merged);
    saveMeta('CDN');
    return 'CDN';
  } catch {
    /* CDN indisponible → conserver le cache */
  }

  // 3. Cache existant
  if (existing.length > 0) {
    const meta = getCachedMeta();
    return meta?.source ?? 'cache';
  }

  // 4. Défaut codé en dur
  return 'default';
}

/**
 * Fetch uniquement si le cache est périmé (> 4 h).
 * À appeler au démarrage de l'app et/ou toutes les heures.
 */
export async function smartFetchRates(): Promise<RatesSource> {
  if (!isCacheStale()) {
    return getCachedMeta()?.source ?? 'cache';
  }
  return fetchAndSaveRates();
}

/** Millisecondes avant le prochain 09:00 local. */
export function msUntilNineAM(): number {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (now.getHours() >= 9) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
