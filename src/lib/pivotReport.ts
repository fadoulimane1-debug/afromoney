import type { Transaction, TransactionType } from '@/types';
import { DEVISES, TYPES_OPERATION } from '@/lib/constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import dayjs from 'dayjs';

export type JourFilter = 'all' | number;

/**
 * Filtre les transactions comme les segments Excel (mois YYYY-MM, jour optionnel).
 */
export function filterTransactionsForReport(
  transactions: Transaction[],
  monthKey: string | '',
  jourFilter: JourFilter = 'all'
): Transaction[] {
  let list = transactions;
  if (monthKey) {
    list = list.filter((tx) => dayjs(tx.date).format('YYYY-MM') === monthKey);
  }
  if (jourFilter !== 'all') {
    list = list.filter((tx) => tx.jour === jourFilter);
  }
  return filterTransactionsComptables(list);
}

/** Devises présentes dans les données, ordre aligné sur la liste métier puis le reste trié. */
export function devisesForPivot(transactions: Transaction[]): string[] {
  const seen = new Set(transactions.map((t) => t.devise));
  const ordered: string[] = [];
  for (const d of DEVISES) {
    if (seen.has(d)) ordered.push(d);
  }
  const rest = [...seen].filter((d) => !DEVISES.includes(d)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

export type PivotValueMode = 'montant' | 'montantMAD';

export interface PivotMatrix {
  types: TransactionType[];
  devises: string[];
  /** Somme pour (type, devise). */
  get(type: TransactionType, devise: string): number;
  rowTotal(type: TransactionType): number;
  colTotal(devise: string): number;
  grandTotal: number;
}

/**
 * Tableau croisé dynamique : lignes = types d’opération, colonnes = devises,
 * valeurs = somme des montants en devise native ou des montants MAD (comme les TCD Excel).
 */
export function buildPivotMatrix(
  transactions: Transaction[],
  valueMode: PivotValueMode
): PivotMatrix {
  const types = [...TYPES_OPERATION] as TransactionType[];
  const devises = devisesForPivot(transactions);

  const key = (type: TransactionType, devise: string) => `${type}\0${devise}`;
  const sums = new Map<string, number>();

  const pick = (tx: Transaction) =>
    valueMode === 'montant' ? tx.montant : tx.montantMAD;

  for (const tx of transactions) {
    const k = key(tx.type, tx.devise);
    sums.set(k, (sums.get(k) ?? 0) + pick(tx));
  }

  function get(type: TransactionType, devise: string): number {
    return sums.get(key(type, devise)) ?? 0;
  }

  function rowTotal(type: TransactionType): number {
    return devises.reduce((s, d) => s + get(type, d), 0);
  }

  function colTotal(devise: string): number {
    return types.reduce((s, t) => s + get(t, devise), 0);
  }

  const grandTotal = types.reduce((s, t) => s + rowTotal(t), 0);

  return { types, devises, get, rowTotal, colTotal, grandTotal };
}
