import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getMouvements } from '@/lib/storage';
import { stockRestantDevisePourJour } from '@/lib/calculations';
import { loadCredits } from '@/lib/credits';
import { ensureDepartSnapshotForDay, getEffectiveDepartBalances } from '@/lib/stageCaisse/engine';
import { DEVISES_CAISSE_V8 } from '@/lib/constants';
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
  /** Date de l'opération (YYYY-MM-DD) — stock du jour à cette date. */
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
    const day = input.dateOperation ?? dayjs().format('YYYY-MM-DD');
    const devisesSnapshot = ['MAD', ...DEVISES_CAISSE_V8];
    ensureDepartSnapshotForDay(CAISSE_ID, day, devisesSnapshot);
    const departBal = getEffectiveDepartBalances(CAISSE_ID, day, [...DEVISES_CAISSE_V8]);
    const departByDevise: Record<string, number> = {};
    for (const d of DEVISES_CAISSE_V8) {
      departByDevise[d] = departBal[d] ?? 0;
    }

    const dispo = stockRestantDevisePourJour(
      input.devise,
      day,
      getTransactions(),
      departByDevise,
      getMouvements(),
      loadCredits(),
    );

    if (input.montant > dispo + 0.0001) {
      const jourPasse = dayjs(day).isBefore(dayjs(), 'day');
      issues.push({
        level: jourPasse ? 'warning' : 'error',
        message: jourPasse
          ? `Stock ${input.devise} insuffisant pour le ${dayjs(day).format('DD/MM/YYYY')} (disponible : ${fmtDevise(dispo)}) — saisie rétroactive.`
          : `Stock ${input.devise} insuffisant (disponible : ${fmtDevise(dispo)}).`,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ControlIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
