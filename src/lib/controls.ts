import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getMouvements } from '@/lib/storage';
import { stockDisponibleDevise } from '@/lib/calculations';
import { getSnapshotMap } from '@/lib/stageCaisse/storage';
import { fmtMad, fmtDevise } from '@/lib/formatNumbers';
import type { TransactionType } from '@/types';
import dayjs from 'dayjs';

const CAISSE_ID = 1;

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
    // Stock depuis transactions + mouvements
    const stockTx = stockDisponibleDevise(input.devise, getTransactions(), {
      asOfDay: input.dateOperation,
      mouvements: getMouvements(),
    });
    // + départ snapshot du jour
    const today = input.dateOperation ?? dayjs().format('YYYY-MM-DD');
    const snap = getSnapshotMap(CAISSE_ID, today, 'DEPART');
    const departDevise = snap[input.devise] ?? 0;
    const dispo = stockTx + departDevise;

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
