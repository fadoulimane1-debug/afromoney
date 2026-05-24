/**
 * Export Excel structuré — feuille CLÔTURES (cadres, en-têtes, colonnes lisibles).
 */
import dayjs from 'dayjs';
import type { DailyClosure } from '@/types';
import { EXCEL_CLOSURE_HEADERS } from '@/lib/excelImport';
import { createWorkbook, downloadExcelWorkbook, type StyledSheetInput } from '@/lib/exportStyled';
import { formatBalanceDetail, formatDateFr } from '@/lib/closureCsvExport';

function statusLabel(s: DailyClosure['status']): string {
  const map: Record<DailyClosure['status'], string> = {
    DRAFT: 'Brouillon',
    PENDING_VALIDATION: 'En attente',
    VALIDATED: 'Validée',
    ERROR: 'Écart',
  };
  return map[s];
}

function closureToExcelRow(c: DailyClosure): (string | number)[] {
  const sig =
    c.signature && c.signature.length > 80 ? 'Signature enregistrée' : (c.signature ?? '');
  return [
    formatDateFr(c.date),
    c.day,
    c.month,
    c.year,
    c.employee,
    c.manager ?? '—',
    c.initialBalanceMAD,
    formatBalanceDetail(c.initialBalance) || '—',
    c.transactions.totalBuys,
    c.transactions.totalSells,
    c.transactions.totalDeposits,
    c.transactions.totalWithdrawals,
    c.transactions.totalCharges,
    c.dailyBenefit,
    c.theoreticalBalance,
    c.realBalance,
    c.variance,
    c.isBalanced ? 'OUI' : 'NON',
    statusLabel(c.status),
    c.validatedAt ? dayjs(c.validatedAt).format('DD/MM/YYYY HH:mm') : '—',
    sig || '—',
    c.notes ?? '—',
    c.finalBalanceMAD,
    formatBalanceDetail(c.finalBalance) || '—',
  ];
}

const COL_WIDTHS = [
  12, 5, 5, 6, 14, 12, 14, 32, 12, 12, 11, 11, 11, 13, 14, 12, 9, 8, 12, 16, 14, 12, 14, 32,
];

export function buildClosuresExcelWorkbook(closures: DailyClosure[]) {
  const sorted = [...closures].sort((a, b) => a.date.localeCompare(b.date));
  const beneficeCumul = sorted.reduce((s, c) => s + c.dailyBenefit, 0);
  const validees = sorted.filter((c) => c.status === 'VALIDATED').length;
  const equilibrees = sorted.filter((c) => c.isBalanced).length;

  const sommaire: StyledSheetInput = {
    sheetName: 'SOMMAIRE',
    documentTitle: 'AFROMONEY — Export clôtures journalières',
    periodLabel: `${sorted.length} clôture(s) · ${dayjs().format('MMMM YYYY')}`,
    headers: ['Indicateur', 'Valeur'],
    rows: [
      ['Nombre de clôtures', sorted.length],
      ['Clôtures validées', validees],
      ['Clôtures équilibrées', equilibrees],
      ['Bénéfice cumulé (MAD)', beneficeCumul],
      ['Dernière date', sorted.length ? formatDateFr(sorted[sorted.length - 1].date) : '—'],
    ],
    colWidths: [28, 22],
  };

  const clotures: StyledSheetInput = {
    sheetName: 'CLÔTURES',
    documentTitle: 'Historique des clôtures — détail',
    periodLabel: 'Montants en MAD sauf indication · séparateur milliers à l’affichage Excel',
    headers: [...EXCEL_CLOSURE_HEADERS],
    rows: sorted.map(closureToExcelRow),
    colWidths: COL_WIDTHS,
  };

  return createWorkbook([sommaire, clotures]);
}

export function downloadClosuresExcel(
  closures: DailyClosure[],
  filename = `clotures_afromoney_${dayjs().format('YYYY-MM-DD')}.xlsx`,
): void {
  const wb = buildClosuresExcelWorkbook(closures);
  downloadExcelWorkbook(wb, filename);
}
