/**
 * Export / modèle CSV clôtures — Excel français (UTF-8 BOM, séparateur ;).
 */
import dayjs from 'dayjs';
import type { DailyClosure } from '@/types';
import { EXCEL_CLOSURE_HEADERS } from '@/lib/excelImport';

function fmtCsvNum(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '';
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = n < 0 ? '-' : '';
  return `${sign}${grouped},${frac}`;
}

/** Détail devises lisible (pas de JSON brut `{}`). */
export function formatBalanceDetail(bal: Record<string, number> | undefined): string {
  if (!bal || typeof bal !== 'object') return '';
  const parts = Object.entries(bal)
    .filter(([, v]) => Number.isFinite(v) && Math.abs(v) > 0.0001)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([devise, montant]) => `${devise} ${fmtCsvNum(montant)}`);
  return parts.join(' | ');
}

export function formatDateFr(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY') : iso;
}

function closureToRow(c: DailyClosure): string[] {
  const sig =
    c.signature && c.signature.length > 80
      ? 'Signature enregistrée'
      : (c.signature ?? '');
  return [
    formatDateFr(c.date),
    String(c.day),
    String(c.month),
    String(c.year),
    c.employee,
    c.manager ?? '',
    fmtCsvNum(c.initialBalanceMAD),
    formatBalanceDetail(c.initialBalance),
    fmtCsvNum(c.transactions.totalBuys),
    fmtCsvNum(c.transactions.totalSells),
    fmtCsvNum(c.transactions.totalDeposits),
    fmtCsvNum(c.transactions.totalWithdrawals),
    fmtCsvNum(c.transactions.totalCharges),
    fmtCsvNum(c.dailyBenefit),
    fmtCsvNum(c.theoreticalBalance),
    fmtCsvNum(c.realBalance),
    fmtCsvNum(c.variance),
    c.isBalanced ? 'OUI' : 'NON',
    c.status,
    c.validatedAt ? dayjs(c.validatedAt).format('DD/MM/YYYY HH:mm') : '',
    sig,
    (c.notes ?? '').replace(/;/g, ','),
    fmtCsvNum(c.finalBalanceMAD),
    formatBalanceDetail(c.finalBalance),
  ];
}

function escapeCell(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function closuresToCsv(closures: DailyClosure[]): string {
  const sorted = [...closures].sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    EXCEL_CLOSURE_HEADERS.join(';'),
    ...sorted.map((c) => closureToRow(c).map(escapeCell).join(';')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadClosuresCsv(
  closures: DailyClosure[],
  filename = `clotures_afromoney_${dayjs().format('YYYY-MM-DD')}.csv`,
): void {
  const csv = closuresToCsv(closures);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Modèle vide (en-têtes uniquement) pour import manuel. */
export function downloadClosuresTemplateCsv(): void {
  downloadClosuresCsv([], 'clotures-modele-afromoney.csv');
}
