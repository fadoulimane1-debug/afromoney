import type { Transaction, Stock, MonthlyReport, ExchangeRate, TransactionType } from '@/types';
import { TAUX_PAR_DEFAUT } from './constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import dayjs from 'dayjs';

export function calculMontantMAD(montant: number, taux: number): number {
  return Math.round(montant * taux * 100) / 100;
}

/**
 * Valeur colonne « À payer » (MAD) : montant saisi (crédit / acompte) si présent,
 * sinon équivalent MAD de la ligne — comme sur le suivi quand la cellule n’est pas réservée au seul reste dû.
 */
export function montantAPayerAffiche(tx: Pick<Transaction, 'montantAPayer' | 'montantMAD'>): number {
  if (tx.montantAPayer != null && Number.isFinite(tx.montantAPayer)) return tx.montantAPayer;
  return tx.montantMAD;
}

export function montantAPayerSaisiExplicite(tx: Pick<Transaction, 'montantAPayer'>): boolean {
  return tx.montantAPayer != null && Number.isFinite(tx.montantAPayer);
}

/** VENTE : reste dû = montant vente (MAD) − montant payé */
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
 * DÉPÔT / RETRAIT : la jambe MAD (journal caisse, totaux jour, clôture) ne compte
 * que lorsque le solde est PAYÉ. La devise étrangère (ex. EUR déposé) reste toujours en stock.
 */
export function depotRetraitMadCaisseActif(
  tx: Pick<Transaction, 'type' | 'statut' | 'devise' | 'montant' | 'montantMAD' | 'taux'>,
): boolean {
  if (tx.type !== 'DEPOT' && tx.type !== 'RETRAIT') return false;
  if (tx.statut !== 'PAYÉ') return false;
  if (tx.devise === 'MAD') return tx.montant > 0;
  return tx.taux !== 1 && tx.montantMAD > 0;
}

/** Montant MAD à inclure dans bilans / caisse du jour / clôture. */
export function montantMadComptable(
  tx: Pick<Transaction, 'type' | 'statut' | 'devise' | 'montant' | 'montantMAD' | 'taux'>,
): number {
  if (tx.type === 'DEPOT' || tx.type === 'RETRAIT') {
    if (!depotRetraitMadCaisseActif(tx)) return 0;
    return tx.devise === 'MAD' ? tx.montant : tx.montantMAD;
  }
  return tx.montantMAD;
}

export function sumMontantMadParType(transactions: Transaction[], type: TransactionType): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((s, t) => s + montantMadComptable(t), 0);
}

export function calculStock(transactions: Transaction[], rates: ExchangeRate[]): Stock[] {
  const actives = filterTransactionsComptables(transactions);
  const rateMap = new Map<string, number>(
    rates.map((r) => [r.devise, r.tauxJour])
  );

  const stockMap = new Map<string, { achete: number; vendu: number }>();

  for (const tx of actives) {
    if (tx.devise === 'MAD') continue;
    const entry = stockMap.get(tx.devise) ?? { achete: 0, vendu: 0 };
        // DÉPÔT devise = entrée stock (ouverture) — même si MAD encore NON-PAYÉ
    if (tx.type === 'ACHAT' || tx.type === 'DEPOT') entry.achete += tx.montant;
    if (tx.type === 'VENTE' || tx.type === 'RETRAIT') entry.vendu += tx.montant;
    stockMap.set(tx.devise, entry);
  }

  return Array.from(stockMap.entries()).map(([devise, { achete, vendu }]) => {
    const taux = rateMap.get(devise) ?? TAUX_PAR_DEFAUT[devise] ?? 1;
    const stockActuel = achete - vendu;
    return {
      devise,
      totalAchete: achete,
      totalVendu: vendu,
      stockActuel,
      valeurMAD: calculMontantMAD(stockActuel, taux),
    };
  });
}

/** Agrège achats / ventes / charges en MAD sur une liste déjà filtrée (ex. même périmètre qu’un TCD Excel). */
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
