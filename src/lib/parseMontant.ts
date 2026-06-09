/**
 * Parse un montant saisi ou affiché (fr-MA / interne).
 * Ex. : "2.157,14" → 2157.14 · "2157.14" → 2157.14 · "500" → 500
 */
export function parseMontantStr(raw: string): number {
  let s = raw.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    if (parts.length === 2 && /^\d{3}$/.test(parts[1])) {
      s = parts[0] + parts[1];
    }
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

export function formatMontantFr(n: number): string {
  if (!Number.isFinite(n)) return '';
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const body = `${grouped},${decPart}`;
  return n < 0 ? `−${body}` : body;
}
