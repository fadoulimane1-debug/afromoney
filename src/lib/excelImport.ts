import type { DailyClosure } from '@/types';
import { saveClosure } from './storage';

function parseDate(raw: string): { day: number; month: number; year: number } {
  const s = String(raw).trim();
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (fr) {
    const day = parseInt(fr[1], 10);
    const month = parseInt(fr[2], 10);
    const year = parseInt(fr[3], 10);
    return { day, month, year };
  }
  const d = new Date(s);
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function parseJSON(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function n(raw: unknown): number {
  const v = parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(v) ? 0 : v;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normalise les clés de ligne (FR / EN, accents). */
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(stripAccents(k.trim().toLowerCase()), v);
  }
  for (const key of keys) {
    const nk = stripAccents(key.trim().toLowerCase());
    if (map.has(nk)) return map.get(nk);
  }
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  return pick(row, keys);
}

/**
 * Importe des lignes (CSV / Excel parsé en JSON) vers `localStorage` clôtures.
 * @returns nombre de lignes importées, ou -1 si erreur fatale.
 */
export function importClosureRowsFromExcel(rows: Record<string, unknown>[]): number {
  try {
    let count = 0;
    for (const row of rows) {
      const dateRaw = cell(row, 'Date', 'date') as string | undefined;
      const date = String(dateRaw ?? '').trim();
      if (!date) continue;

      const { day, month, year } = parseDate(date);

      const totalBuys = n(cell(row, 'Total Achats', 'Total achats', 'total buys'));
      const totalSells = n(cell(row, 'Total Ventes', 'Total ventes', 'total sells'));
      const totalDeposits = n(cell(row, 'Total Dépôts', 'Total Depots', 'total deposits'));
      const totalWithdrawals = n(cell(row, 'Total Retraits', 'Total retraits', 'total withdrawals'));
      const totalCharges = n(cell(row, 'Total Charges', 'Total charges'));

      const beneCell = cell(row, 'Bénéfice du jour', 'Benefice du jour', 'Bénéfice', 'Benefice');
      const dailyBenefit =
        beneCell !== undefined && beneCell !== null && String(beneCell).trim() !== ''
          ? n(beneCell)
          : totalSells - totalBuys;

      const initialMad = n(cell(row, 'Solde Initial MAD', 'Solde initial MAD'));
      const soldeTheoRaw = cell(row, 'Solde Théorique', 'Solde theorique', 'theoretical balance');
      const theoreticalBalance =
        soldeTheoRaw != null && String(soldeTheoRaw).trim() !== ''
          ? n(soldeTheoRaw)
          : initialMad + totalDeposits - totalWithdrawals - totalCharges + dailyBenefit;

      const soldeReelCell = cell(row, 'Solde Réel', 'Solde reel', 'real balance');
      const realBalance =
        soldeReelCell !== undefined && soldeReelCell !== null && String(soldeReelCell).trim() !== ''
          ? n(soldeReelCell)
          : theoreticalBalance;
      const ecartCell = cell(row, 'Écart', 'Ecart', 'variance');
      const variance =
        ecartCell !== undefined && ecartCell !== null && String(ecartCell).trim() !== ''
          ? n(ecartCell)
          : realBalance - theoreticalBalance;

      const rawStatus = String(cell(row, 'Statut', 'status') ?? 'DRAFT')
        .trim()
        .toUpperCase();
      const status: DailyClosure['status'] = (
        ['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'ERROR'].includes(rawStatus)
          ? rawStatus
          : 'DRAFT'
      ) as DailyClosure['status'];

      const equilibree = String(cell(row, 'Équilibrée', 'Equilibree', 'balanced') ?? '')
        .trim()
        .toUpperCase();
      const isBalanced =
        equilibree === 'OUI' || equilibree === 'YES' || Math.abs(variance) < 0.01;

      const closure: DailyClosure = {
        id: `closure_${date}`,
        date,
        day,
        month,
        year,
        employee: String(cell(row, 'Employé', 'Employe', 'employee') ?? ''),
        manager: cell(row, 'Responsable', 'manager') ? String(cell(row, 'Responsable', 'manager')) : undefined,

        initialBalance: parseJSON(cell(row, 'Solde Initial (détail devises)', 'Solde initial (detail devises)')),
        initialBalanceMAD: initialMad,

        transactions: { totalBuys, totalSells, totalDeposits, totalWithdrawals, totalCharges },

        finalBalance: parseJSON(cell(row, 'Solde Final (détail devises)', 'Solde final (detail devises)')),
        finalBalanceMAD: n(cell(row, 'Solde Final MAD', 'Solde final MAD')) || realBalance,

        dailyBenefit,
        theoreticalBalance,
        realBalance,
        variance,
        isBalanced,

        status,
        validatedAt: cell(row, 'Validé le', 'Valide le', 'validated at')
          ? String(cell(row, 'Validé le', 'Valide le', 'validated at'))
          : undefined,
        signature: cell(row, 'Signature', 'signature') ? String(cell(row, 'Signature')) : undefined,
        notes: cell(row, 'Notes', 'notes') ? String(cell(row, 'Notes')) : undefined,
        errorDetails:
          Math.abs(variance) < 0.01 ? undefined : `Écart importé: ${variance.toFixed(2)} MAD`,
      };

      if (saveClosure(closure)) count++;
    }
    return count;
  } catch (err) {
    console.error('excelImport:', err);
    return -1;
  }
}

/**
 * Import feuille « CLÔTURES » — retour booléen (API simple).
 */
export function importClosuresFromExcel(excelData: Record<string, unknown>[]): boolean {
  const nImported = importClosureRowsFromExcel(excelData);
  return nImported >= 0;
}

/** En-têtes attendus pour la feuille Excel « CLÔTURES » (export modèle). */
export const EXCEL_CLOSURE_HEADERS = [
  'Date',
  'Jour',
  'Mois',
  'Année',
  'Employé',
  'Responsable',
  'Solde Initial MAD',
  'Solde Initial (détail devises)',
  'Total Achats',
  'Total Ventes',
  'Total Dépôts',
  'Total Retraits',
  'Total Charges',
  'Bénéfice du jour',
  'Solde Théorique',
  'Solde Réel',
  'Écart',
  'Équilibrée',
  'Statut',
  'Validé le',
  'Signature',
  'Notes',
  'Solde Final MAD',
  'Solde Final (détail devises)',
] as const;
