import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getMouvements } from '@/lib/storage';
import { stockDisponibleDevise } from '@/lib/calculations';
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
  /** Date de l'opération (YYYY-MM-DD) — stock calculé à cette date (saisie rétroactive). */
  dateOperation?: string;
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
    const dispo = stockDisponibleDevise(input.devise, getTransactions(), {
      asOfDay: input.dateOperation,
      mouvements: getMouvements(),
    });
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
