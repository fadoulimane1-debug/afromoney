import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getExchangeRates } from '@/lib/storage';
import { calculStock } from '@/lib/calculations';
import { fmtMad, fmtDevise } from '@/lib/formatNumbers';
import type { TransactionType } from '@/types';

export interface ControlIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validateOperationControls(input: {
  type: TransactionType;
  devise: string;
  montant: number;
  montantMAD: number;
  note: string;
}): ControlIssue[] {
  const s = getProSettings();
  const issues: ControlIssue[] = [];

  if (input.montant <= 0) {
    issues.push({ level: 'error', message: 'Le montant doit être positif.' });
  }

  if (input.montantMAD >= s.seuilMontantMAD) {
    if (s.exigerNoteGrosMontant && !input.note.trim()) {
      issues.push({
        level: 'warning',
        message: `Montant ≥ ${fmtMad(s.seuilMontantMAD)} MAD : une note est recommandée.`,
      });
    }
  }

  if (input.type === 'VENTE' && input.devise !== 'MAD' && s.bloquerVenteStockInsuffisant) {
    const txs = getTransactions();
    const rates = getExchangeRates();
    const stocks = calculStock(txs, rates);
    const st = stocks.find((x) => x.devise === input.devise);
    const dispo = st?.stockActuel ?? 0;
    if (input.montant > dispo + 0.0001) {
      issues.push({
        level: 'error',
        message: `Stock ${input.devise} insuffisant (disponible : ${fmtDevise(dispo)}).`,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ControlIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
