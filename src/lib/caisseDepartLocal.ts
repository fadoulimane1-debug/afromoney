/** Caisse départ du jour — équivalent cellule « CAISSE DÉPART » feuille CAISSE V8 (stockage local). */

const prefix = 'afromoney_caisse_depart_';

export function getCaisseDepartJour(dateKey: string): number | null {
  const raw = localStorage.getItem(prefix + dateKey);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setCaisseDepartJour(dateKey: string, value: number | null): void {
  const k = prefix + dateKey;
  if (value == null || Number.isNaN(value)) localStorage.removeItem(k);
  else localStorage.setItem(k, String(value));
}
