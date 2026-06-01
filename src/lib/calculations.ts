import type { Transaction, Stock, MonthlyReport, ExchangeRate } from '@/types';
import { TAUX_PAR_DEFAUT } from './constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
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
  const paye =
    tx.montantAPayer != null && Number.isFinite(tx.montantAPayer) ? tx.montantAPayer : 0;
  return Math.max(0, Math.round((mad - paye) * 100) / 100);
}

export function statutVenteFromPaye(montantMAD: number, montantPaye: number): 'PAYÉ' | 'NON-PAYÉ' {
  const reste = Math.max(0, Math.round((montantMAD - montantPaye) * 100) / 100);
  return reste <= 0.001 ? 'PAYÉ' : 'NON-PAYÉ';
}

/**
 * FIX BUG 2 — Stock disponible par devise :
 * = départ du jour + ACHAT + DEPOT (en devise) − VENTE − RETRAIT (en devise)
 * Les DEPOT/RETRAIT en devise étrangère sont maintenant comptés dans le stock.
 */
export function calculStock(transactions: Transaction[], rates: ExchangeRate[]): Stock[] {
  const actives = filterTransactionsComptables(transactions);
  const rateMap = new Map<string, number>(
    rates.map((r) => [r.devise, r.tauxJour])
  );
  const stockMap = new Map<string, { achete: number; vendu: number; depots: number; retraits: number }>();

  for (const tx of actives) {
    if (tx.devise === 'MAD') continue;
    const entry = stockMap.get(tx.devise) ?? { achete: 0, vendu: 0, depots: 0, retraits: 0 };
    if (tx.type === 'ACHAT')   entry.achete   += tx.montant;
    if (tx.type === 'VENTE')   entry.vendu    += tx.montant;
    // FIX: DEPOT et RETRAIT en devise étrangère alimentent/retirent du stock
    if (tx.type === 'DEPOT')   entry.depots   += tx.montant;
    if (tx.type === 'RETRAIT') entry.retraits += tx.montant;
    stockMap.set(tx.devise, entry);
  }

  return Array.from(stockMap.entries()).map(([devise, { achete, vendu, depots, retraits }]) => {
    const taux = rateMap.get(devise) ?? TAUX_PAR_DEFAUT[devise] ?? 1;
    // Stock = achats + dépôts en devise - ventes - retraits en devise
    const stockActuel = achete + depots - vendu - retraits;
    return {
      devise,
      totalAchete: achete + depots,
      totalVendu: vendu + retraits,
      stockActuel,
      valeurMAD: calculMontantMAD(stockActuel, taux),
    };
  });
}

export function calculRapportPourListe(
  transactions: Transaction[],
  moisLabel: string
): MonthlyReport {
  const actives = filterTransactionsComptables(transactions);
  const totalAchats = actives
    .filter((tx) => tx.type === 'ACHAT')
    .reduce((s, tx) => s + tx.montantMAD, 0);
  const totalVentes = actives
    .filter((tx) => tx.type === 'VENTE')
    .reduce((s, tx) => s + tx.montantMAD, 0);
  const chargesAgence = actives
    .filter((tx) => tx.type === 'CHARGES')
    .reduce((s, tx) => s + tx.montantMAD, 0);
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

export function calculRapportMensuel(
  transactions: Transaction[],
  mois: string
): MonthlyReport {
  const txMois = transactions.filter(
    (tx) => dayjs(tx.date).format('YYYY-MM') === mois
  );
  return calculRapportPourListe(txMois, mois);
}
