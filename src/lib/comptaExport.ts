import dayjs from 'dayjs';
import type { Transaction } from '@/types';
import { TYPE_OPERATION_LABEL } from '@/lib/constants';
import { exportSingleStyledSheet } from '@/lib/exportStyled';

function txDateIso(t: Transaction): string {
  const d = t.date;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

/** Journal simplifié pour export comptable / cabinet */
export interface JournalLine {
  date: string;
  piece: string;
  libelle: string;
  compteDebit: string;
  compteCredit: string;
  montantMAD: number;
  devise: string;
  montantDevise: number;
  employe: string;
}

const COMPTE_CAISSE = '5161';
const COMPTE_STOCK_DEVISES = '5146';
const COMPTE_CHARGES = '618';
const COMPTE_PRODUITS_CHANGE = '711';

function comptesPourType(type: Transaction['type']): { debit: string; credit: string } {
  switch (type) {
    case 'ACHAT':
      return { debit: COMPTE_STOCK_DEVISES, credit: COMPTE_CAISSE };
    case 'VENTE':
      return { debit: COMPTE_CAISSE, credit: COMPTE_PRODUITS_CHANGE };
    case 'DEPOT':
      return { debit: COMPTE_CAISSE, credit: COMPTE_CAISSE };
    case 'RETRAIT':
      return { debit: COMPTE_CAISSE, credit: COMPTE_CAISSE };
    case 'CHARGES':
      return { debit: COMPTE_CHARGES, credit: COMPTE_CAISSE };
    default:
      return { debit: COMPTE_CAISSE, credit: COMPTE_CAISSE };
  }
}

export function buildJournalLines(transactions: Transaction[]): JournalLine[] {
  return transactions
    .slice()
    .sort((a, b) => txDateIso(a).localeCompare(txDateIso(b)))
    .map((t) => {
      const { debit, credit } = comptesPourType(t.type);
      return {
        date: txDateIso(t),
        piece: t.id,
        libelle: t.operation || `${TYPE_OPERATION_LABEL[t.type]} ${t.montant} ${t.devise}`,
        compteDebit: debit,
        compteCredit: credit,
        montantMAD: t.montantMAD,
        devise: t.devise,
        montantDevise: t.montant,
        employe: t.employeNom ?? t.employeId ?? '',
      };
    });
}

export function journalToCsv(lines: JournalLine[]): string {
  const header = [
    'Date',
    'Pièce',
    'Libellé',
    'Compte débit',
    'Compte crédit',
    'Montant MAD',
    'Devise',
    'Montant devise',
    'Employé',
  ].join(';');
  const rows = lines.map((l) =>
    [
      l.date,
      l.piece,
      `"${l.libelle.replace(/"/g, '""')}"`,
      l.compteDebit,
      l.compteCredit,
      l.montantMAD.toFixed(2),
      l.devise,
      l.montantDevise.toFixed(4),
      l.employe,
    ].join(';'),
  );
  return '\uFEFF' + [header, ...rows].join('\n');
}

export function downloadJournalCompta(transactions: Transaction[], filename?: string): void {
  const lines = buildJournalLines(transactions);
  const csv = journalToCsv(lines);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `journal_compta_${dayjs().format('YYYY-MM')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const JOURNAL_HEADERS = [
  'Date',
  'Pièce',
  'Libellé',
  'Compte débit',
  'Compte crédit',
  'Montant MAD',
  'Devise',
  'Montant devise',
  'Employé',
];

export function downloadJournalComptaExcel(transactions: Transaction[], filename?: string): void {
  const lines = buildJournalLines(transactions);
  const period =
    lines.length > 0
      ? `${lines[0].date} → ${lines[lines.length - 1].date}`
      : dayjs().format('YYYY-MM');
  exportSingleStyledSheet(
    {
      sheetName: 'Journal compta',
      documentTitle: 'Journal comptable simplifié — AFROMONEY',
      periodLabel: `${lines.length} écriture(s) · ${period}`,
      headers: JOURNAL_HEADERS,
      rows: lines.map((l) => [
        l.date,
        l.piece,
        l.libelle,
        l.compteDebit,
        l.compteCredit,
        l.montantMAD,
        l.devise,
        l.montantDevise,
        l.employe,
      ]),
      colWidths: [11, 14, 36, 12, 12, 13, 8, 14, 16],
    },
    filename ?? `journal_compta_${dayjs().format('YYYY-MM')}.xlsx`,
  );
}
