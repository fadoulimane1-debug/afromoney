import dayjs from 'dayjs';
import { getStatutAudit } from '@/lib/audit';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { calculStock } from '@/lib/calculations';
import { getSoldeDevise, getTransactions, getMouvements } from '@/lib/storage';
import { getExchangeRates } from '@/lib/storage';
import { fmtMad, fmtDevise } from '@/lib/formatNumbers';

export type CoherenceIssue = {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
};

function loadCredits(): { id: string; statut: string; contre_val_mad: number }[] {
  try {
    const raw = localStorage.getItem('credits');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadReliquats(): { id: string; statut: string; montant: number; devise: string }[] {
  try {
    const raw = localStorage.getItem('reliquats');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Contrôles croisés stock / journal / crédits / annulations. */
export function runCoherenceAudit(): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  const all = getTransactions();
  const actives = filterTransactionsComptables(all);
  const rates = getExchangeRates();
  const stock = calculStock(actives, rates);
  const mouvements = getMouvements();

  const annulees = all.filter(
    (tx) => tx.type !== 'ANNULATION' && getStatutAudit(tx, all) === 'ANNULEE',
  ).length;
  if (annulees > 0) {
    issues.push({
      level: 'info',
      code: 'ANNUL_EXCLUES',
      message: `${annulees} opération(s) annulée(s) exclue(s) du stock et des totaux MAD.`,
    });
  }

  for (const st of stock) {
    if (st.stockActuel < -0.0001) {
      issues.push({
        level: 'error',
        code: 'STOCK_NEG',
        message: `Stock ${st.devise} négatif : ${fmtDevise(st.stockActuel)} (achats ${fmtDevise(st.totalAchete)} − ventes ${fmtDevise(st.totalVendu)}).`,
      });
    }
  }

  const txCredit = actives.filter((t) => t.statut === 'CRÉDIT');
  const creditsPage = loadCredits().filter((c) => c.statut === 'En cours' || c.statut === 'EN_COURS');
  if (txCredit.length > 0 && creditsPage.length === 0) {
    issues.push({
      level: 'warn',
      code: 'CREDIT_TX_ONLY',
      message: `${txCredit.length} transaction(s) en statut CRÉDIT sans fiche sur la page Crédits (registres séparés).`,
    });
  }
  if (creditsPage.length > 0 && txCredit.length === 0) {
    issues.push({
      level: 'warn',
      code: 'CREDIT_PAGE_ONLY',
      message: `${creditsPage.length} créance(s) page Crédits sans transaction statut CRÉDIT.`,
    });
  }

  const reliquatsOuverts = loadReliquats().filter((r) => r.statut !== 'Soldé' && r.statut !== 'SOLDE');
  if (reliquatsOuverts.length > 0) {
    issues.push({
      level: 'info',
      code: 'RELIQUATS',
      message: `${reliquatsOuverts.length} reliquat(s) ouvert(s) — journal caisse distinct des transactions.`,
    });
  }

  const ventesNonPayees = actives.filter(
    (t) => t.type === 'VENTE' && t.statut === 'NON-PAYÉ',
  );
  const resteTotal = ventesNonPayees.reduce((s, t) => {
    const paye = t.montantAPayer ?? 0;
    return s + Math.max(0, t.montantMAD - paye);
  }, 0);
  if (resteTotal > 0.01) {
    issues.push({
      level: 'warn',
      code: 'VENTE_IMPAYE',
      message: `Reste client VENTE (hors page Crédits) : ${fmtMad(resteTotal)} MAD sur ${ventesNonPayees.length} vente(s).`,
    });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const orphanMvt = mouvements.filter(
    (m) => m.operationRef && !all.some((t) => t.id === m.operationRef),
  );
  if (orphanMvt.length > 0) {
    issues.push({
      level: 'warn',
      code: 'MVT_ORPHELIN',
      message: `${orphanMvt.length} mouvement(s) caisse sans transaction liée (réf. supprimée ?).`,
    });
  }

  const madSolde = getSoldeDevise('MAD');
  const jourMvt = mouvements.filter((m) => m.timestamp.startsWith(today));
  const entrees = jourMvt.filter((m) => m.montant > 0).reduce((s, m) => s + m.montant, 0);
  const sorties = jourMvt.filter((m) => m.montant < 0).reduce((s, m) => s + m.montant, 0);
  issues.push({
    level: 'info',
    code: 'CAISSE_MAD',
    message: `Solde MAD journal : ${fmtMad(madSolde)} · Aujourd'hui entrées ${fmtMad(entrees)} / sorties ${fmtMad(Math.abs(sorties))}.`,
  });

  return issues;
}
