import dayjs from 'dayjs';
import type { Transaction } from '@/types';
import { SECTION_HISTORIQUE_V8 } from '@/lib/constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';

/** Lignes prêtes pour export CSV — en-têtes identiques à la feuille HISTORIQUE V8. */
export function buildHistoriqueV8Rows(
  transactions: Transaction[],
  employeResolver: (employeId: string) => string
): Record<string, string | number>[] {
  return [...filterTransactionsComptables(transactions)]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((tx) => ({
      DATE: dayjs(tx.date).format('DD/MM/YYYY'),
      EMPLOYÉ: employeResolver(tx.employeId),
      SECTION: SECTION_HISTORIQUE_V8[tx.type],
      DEVISE: tx.devise,
      QUANTITÉ: tx.montant,
      TAUX: tx.taux,
      'MONTANT MAD': tx.montantMAD,
      NOTE: tx.note,
      'CAISSE DÉPART': tx.caisseDepart ?? '',
    }));
}
