import dayjs from 'dayjs';
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
  /** Montant restant dû (MAD) — réduit à chaque paiement partiel */
  montantRestant: number;
  note: string;
  statut: CreditStatut;
  echeance?: string;
  /** Date du dernier paiement */
  dateSolde?: string;
  /** Historique des paiements partiels */
  paiements?: { date: string; montant: number }[];
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
    const list = raw ? (JSON.parse(raw) as Credit[]) : [];
    // Normalise les anciens crédits sans montantRestant
    return list.map((c) => ({
      ...c,
      montantRestant: c.montantRestant ?? c.contre_val_mad,
    }));
  } catch {
    return [];
  }
}

export function saveCredits(list: Credit[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  emitCreditsChanged();
}

/** Crédits liés à la journée (créés ou soldés ce jour). */
export function creditsForCaisseJour(day: string): Credit[] {
  return loadCredits().filter((c) => c.date === day || c.dateSolde === day);
}

/** Encours non soldés (tous statuts sauf Payé). */
export function creditsEncours(): Credit[] {
  return loadCredits().filter((c) => c.statut !== 'Payé');
}

/** Total MAD des paiements de crédits effectués aujourd'hui (sort de caisse). */
export function sumCreditsSoldesMad(day: string): number {
  return loadCredits()
    .flatMap((c) => c.paiements ?? [])
    .filter((p) => p.date === day)
    .reduce((s, p) => s + p.montant, 0);
}

/**
 * Paiement partiel ou total d'un crédit.
 * montantPaye = montant payé aujourd'hui (MAD)
 * Si montantPaye >= montantRestant → statut Payé
 * Sinon → reste En cours avec montantRestant réduit
 */
export function settleCredit(id: string, montantPaye?: number): Credit | null {
  const list = loadCredits();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const c = list[idx];
  if (c.statut === 'Payé') return c;

  const today = dayjs().format('YYYY-MM-DD');
  const restant = c.montantRestant ?? c.contre_val_mad;
  const paye = montantPaye != null ? Math.min(montantPaye, restant) : restant;
  const nouveauRestant = Math.max(0, Math.round((restant - paye) * 100) / 100);

  const updated: Credit = {
    ...c,
    montantRestant: nouveauRestant,
    statut: nouveauRestant <= 0 ? 'Payé' : 'En cours',
    dateSolde: today,
    paiements: [...(c.paiements ?? []), { date: today, montant: paye }],
  };
  list[idx] = updated;
  saveCredits(list);

  logAudit(
    AUDIT_ACTIONS.CREDIT_UPDATE,
    { id, action: 'paiement', montantPaye: paye, restant: nouveauRestant },
    today,
  );
  return updated;
}
