import type { Transaction } from '@/types';
import { getStatutAudit } from '@/lib/audit';

/** Opérations comptables : hors lignes ANNULATION et hors opérations annulées (R1). */
export function filterTransactionsComptables(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.type === 'ANNULATION') return false;
    return getStatutAudit(tx, transactions) === 'VALIDE';
  });
}
