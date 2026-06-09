/**
 * Formatage unifié — milliers : espace · décimales : virgule.
 * Ex. 42320 → « 42 320,00 »
 */
export { parseMontantStr, formatMontantFr } from '@/lib/parseMontant';

export function fmtNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const body = decimals > 0 ? `${grouped},${decPart}` : grouped;
  return neg ? `−${body}` : body;
}

/** Montants MAD (2 décimales, séparateur milliers). */
export const fmtMad = (n: number) => fmtNumber(n, 2);

/** Quantités devise (2 décimales par défaut). */
export const fmtDevise = (n: number, decimals = 2) => fmtNumber(n, decimals);

/** Taux de change (4 décimales). */
export const fmtRate = (n: number) => fmtNumber(n, 4);

/** Pourcentage affiché avec séparateurs. */
export const fmtPct = (n: number, decimals = 2) => `${fmtNumber(n, decimals)} %`;

/** Entier (quantités, compteurs). */
export const fmtInt = (n: number) => fmtNumber(Math.round(n), 0);

/** Graphiques : 1 234 k */
export function fmtCompactK(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const k = n / 1000;
  return `${fmtInt(k)} k`;
}

/** Format montant (2 décimales par défaut, séparateur milliers). */
export function fmt(n: number, decimals = 2): string {
  return fmtNumber(n, decimals);
}
