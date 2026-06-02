import type { Transaction, Stock, MonthlyReport, ExchangeRate } from '@/types';
import { TAUX_PAR_DEFAUT } from './constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { getMouvements } from '@/lib/storage';
import dayjs from 'dayjs';

export function calculMontantMAD(montant: number, taux: number): number {
  return Math.round(montant * taux * 100) / 100;
}

export function montantAPayerAffiche(tx: Pick<Transaction, 'montantAPayer' | 'montantMAD'>): number {
  if (tx.montantAPayer != null && Number.isFinite(tx.montantAPayer)) return tx.montantAPayer;
  return tx.montantMAD;
}

export function montantAPayerSaisiExplicite(tx: Pick<Transaction, 'montantAPayer'>): boolean {
  return tx.montantAPayer != null && Number.isFinite(tx.montantAPayer);
}

export function resteNonPayeVente(tx: Pick<Transaction, 'type' | 'montantMAD' | 'montantAPayer'>): number {
  if (tx.type !== 'VENTE') return 0;
  const mad = tx.montantMAD;
  const paye = tx.montantAPayer != null && Number.isFinite(tx.montantAPayer) ? tx.montantAPayer : 0;
  return Math.max(0, Math.round((mad - paye) * 100) / 100);
}

export function statutVenteFromPaye(montantMAD: number, montantPaye: number): 'PAYÉ' | 'NON-PAYÉ' {
  const reste = Math.max(0, Math.round((montantMAD - montantPaye) * 100) / 100);
  return reste <= 0.001 ? 'PAYÉ' : 'NON-PAYÉ';
}

/**
 * FIX — Stock disponible par devise:
 * ACHAT + DEPOT + ALIMENTATION (mouvements caisse) − VENTE − RETRAIT − PRELEVEMENT
 */
export function calculStock(transactions: Transaction[], rates: ExchangeRate[]): Stock[] {
  const actives = filterTransactionsComptables(transactions);
  const mouvements = getMouvements();
  const rateMap = new Map<string, number>(rates.map((r) => [r.devise, r.tauxJour]));

  const stockMap = new Map<string, {
    achete: number; vendu: number; depots: number;
    retraits: number; alimentations: number; prelevements: number;
  }>();

  // Transactions
  for (const tx of actives) {
    if (tx.devise === 'MAD') continue;
    const entry = stockMap.get(tx.devise) ?? { achete: 0, vendu: 0, depots: 0, retraits: 0, alimentations: 0, prelevements: 0 };
    if (tx.type === 'ACHAT')   entry.achete   += tx.montant;
    if (tx.type === 'VENTE')   entry.vendu    += tx.montant;
    if (tx.type === 'DEPOT')   entry.depots   += tx.montant;
    if (tx.type === 'RETRAIT') entry.retraits += tx.montant;
    stockMap.set(tx.devise, entry);
  }

  // Mouvements caisse (ALIMENTATION / PRELEVEMENT en devise étrangère)
  for (const mv of mouvements) {
    if (mv.devise === 'MAD') continue;
    const entry = stockMap.get(mv.devise) ?? { achete: 0, vendu: 0, depots: 0, retraits: 0, alimentations: 0, prelevements: 0 };
    if (mv.type === 'ALIMENTATION') entry.alimentations += Math.abs(mv.montant);
    if (mv.type === 'PRELEVEMENT')  entry.prelevements  += Math.abs(mv.montant);
    stockMap.set(mv.devise, entry);
  }

  return Array.from(stockMap.entries()).map(([devise, e]) => {
    const taux = rateMap.get(devise) ?? TAUX_PAR_DEFAUT[devise] ?? 1;
    const stockActuel = e.achete + e.depots + e.alimentations - e.vendu - e.retraits - e.prelevements;
    return {
      devise,
      totalAchete: e.achete + e.depots + e.alimentations,
      totalVendu: e.vendu + e.retraits + e.prelevements,
      stockActuel,
      valeurMAD: calculMontantMAD(stockActuel, taux),
    };
  });
}

export function calculRapportPourListe(transactions: Transaction[], moisLabel: string): MonthlyReport {
  const actives = filterTransactionsComptables(transactions);
  const totalAchats = actives.filter((tx) => tx.type === 'ACHAT').reduce((s, tx) => s + tx.montantMAD, 0);
  const totalVentes = actives.filter((tx) => tx.type === 'VENTE').reduce((s, tx) => s + tx.montantMAD, 0);
  const chargesAgence = actives.filter((tx) => tx.type === 'CHARGES').reduce((s, tx) => s + tx.montantMAD, 0);
  const beneficeBrut = totalVentes - totalAchats;
  const beneficeNet = beneficeBrut - chargesAgence;
  const margePercent = totalVentes > 0 ? (beneficeNet / totalVentes) * 100 : 0;
  return {
    mois: moisLabel,
    caisseDepart: 0,
    totalAchats,
    totalVentes,
    beneficeBrut,
    chargesAgence,
    beneficeNet,
    margePercent: Math.round(margePercent * 100) / 100,
    nbTransactions: actives.length,
  };
}

export function calculRapportMensuel(transactions: Transaction[], mois: string): MonthlyReport {
  const txMois = transactions.filter((tx) => dayjs(tx.date).format('YYYY-MM') === mois);
  return calculRapportPourListe(txMois, mois);
}
