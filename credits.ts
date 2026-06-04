import dayjs from 'dayjs';
import { appendDepotCaisse } from '@/lib/storage';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';

export type CreditStatut = 'En cours' | 'Payé' | 'Retard';

export interface Credit {
  id: string;
  date: string;
  nom: string;
  devise: string;
  montant: number;
  taux: number;
  contre_val_mad: number;
  note: string;
  statut: CreditStatut;
  echeance?: string;
  dateSolde?: string;
}

const LS_KEY = 'credits';

function emitCreditsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afromoney-credits'));
    window.dispatchEvent(new Event('afromoney-data'));
  }
}

export function loadCredits(): Credit[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Credit[]) : [];
  } catch {
    return [];
  }
}

export function saveCredits(list: Credit[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  emitCreditsChanged();
}

export function creditsForCaisseJour(day: string): Credit[] {
  return loadCredits().filter((c) => c.date === day || c.dateSolde === day);
}

export function creditsEncours(): Credit[] {
  return loadCredits().filter((c) => c.statut !== 'Payé');
}

export function sumCreditsSoldesMad(day: string): number {
  return loadCredits()
    .filter((c) => c.statut === 'Payé' && c.dateSolde === day)
    .reduce((s, c) => s + c.contre_val_mad, 0);
}

export function settleCredit(id: string): Credit | null {
  const list = loadCredits();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const c = list[idx];
  if (c.statut === 'Payé') return c;

  const today = dayjs().format('YYYY-MM-DD');
  const updated: Credit = { ...c, statut: 'Payé', dateSolde: today };
  list[idx] = updated;
  saveCredits(list);

  appendDepotCaisse({
    montant: updated.contre_val_mad,
    operationRef: updated.id,
    caissier: 'Crédit soldé',
    note: `Crédit soldé — ${updated.nom}`,
  });

  logAudit(AUDIT_ACTIONS.CREDIT_UPDATE, { id, action: 'marquerPayé', montantMAD: updated.contre_val_mad }, today);
  return updated;
}
