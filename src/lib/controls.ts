import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getMouvements } from '@/lib/storage';
import { stockDisponibleDevise } from '@/lib/calculations';
import { getAllSnapshots } from '@/lib/stageCaisse/storage';
import { fmtMad, fmtDevise } from '@/lib/formatNumbers';
import type { TransactionType } from '@/types';
import dayjs from 'dayjs';

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
    // + départ snapshot — cherche le DEPART du jour de l'opération
    // ou le plus récent avant cette date (pour saisies rétroactives)
    const today = input.dateOperation ?? dayjs().format('YYYY-MM-DD');
    const allSnaps = getAllSnapshots();
    // Cherche le snapshot DEPART le plus récent ≤ dateOperation
    const departSnaps = allSnaps
      .filter((s) => s.type_solde === 'DEPART' && s.devise_code === input.devise && s.date_comptable <= today)
      .sort((a, b) => b.date_comptable.localeCompare(a.date_comptable));
    const departDevise = departSnaps[0]?.montant ?? 0;
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
