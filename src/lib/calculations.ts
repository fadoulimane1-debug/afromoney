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

/** Opération dont la jambe MAD entre en caisse (uniquement si PAYÉ). */
export function operationMadCaisseActif(
  tx: Pick<Transaction, 'type' | 'statut'>,
): boolean {
  if (tx.type === 'DEPOT' || tx.type === 'RETRAIT') {
    return depotRetraitMadCaisseActif(
      tx as Pick<Transaction, 'type' | 'statut' | 'devise' | 'montant' | 'montantMAD' | 'taux'>,
    );
  }
  if (tx.type === 'ACHAT' || tx.type === 'VENTE' || tx.type === 'CHARGES') {
    return tx.statut === 'PAYÉ';
  }
  return true;
}

export function montantMadComptable(
  tx: Pick<Transaction, 'type' | 'statut' | 'devise' | 'montant' | 'montantMAD' | 'taux' | 'montantAPayer'>,
): number {
  if (tx.type === 'DEPOT' || tx.type === 'RETRAIT') {
    if (!operationMadCaisseActif(tx)) return 0;
    return tx.devise === 'MAD' ? tx.montant : tx.montantMAD;
  }
  // ACHAT partiel : seul le montant payé sort de la caisse
  if (tx.type === 'ACHAT' && tx.statut === 'CRÉDIT') {
    return tx.montantAPayer != null && Number.isFinite(tx.montantAPayer)
      ? tx.montantAPayer
      : 0;
  }
  // VENTE partielle : seul le montant payé entre en caisse
if (tx.type === 'VENTE' && tx.statut === 'NON-PAYÉ') {
  return tx.montantAPayer != null && Number.isFinite(tx.montantAPayer)
    ? tx.montantAPayer
    : 0;
}
  if (!operationMadCaisseActif(tx)) return 0;
  return tx.montantMAD;
}

export function sumMontantMadParType(transactions: Transaction[], type: TransactionType): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((s, t) => s + montantMadComptable(t), 0);
}

/** Filtre phase journée pour le stock restant caisse du jour. */
export type StockJourMomentFilter = 'ALL' | 'MATIN' | 'APRES_MIDI';

function txMatchesMomentFilter(
  tx: Pick<Transaction, 'moment' | 'date'>,
  filter: StockJourMomentFilter,
): boolean {
  if (filter === 'ALL') return true;
  const hour = dayjs(tx.date).hour();
  if (filter === 'MATIN') return hour < 12;
  return hour >= 12;
}

export interface StockRestantJourRow {
  devise: string;
  depart: number;
  ventes: number;
  alimentations: number;
  depots: number;
  reliquats: number;
  achats: number;
  charges: number;
  retraits: number;
  prelevements: number;
  credits: number;
  restant: number;
}

function mouvementMatchesMoment(
  timestamp: string,
  filter: StockJourMomentFilter,
): boolean {
  if (filter === 'ALL') return true;
  const hour = dayjs(timestamp).hour();
  if (filter === 'MATIN') return hour < 12;
  return hour >= 12;
}

/**
 * Stock restant par devise (quantités en caisse) :
 * Départ + Achats + Alimentations + Dépôts + Reliquats soldés
 * − Ventes − Charges − Retraits − Prélèvements − Crédits
 */
export function computeStockRestantJour(
  transactions: Transaction[],
  departByDevise: Record<string, number>,
  dayYmd: string,
  devisesOrder: readonly string[],
  momentFilter: StockJourMomentFilter = 'ALL',
  mouvements: { timestamp: string; devise: string; type: string; montant: number }[] = [],
  creditsPage: { date: string; devise: string; montant: number; statut: string }[] = [],
): StockRestantJourRow[] {
  const txJ = filterTransactionsComptables(transactions)
    .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === dayYmd)
    .filter((t) => txMatchesMomentFilter(t, momentFilter));

  const mvJ = mouvements.filter(
    (m) =>
      dayjs(m.timestamp).format('YYYY-MM-DD') === dayYmd &&
      mouvementMatchesMoment(m.timestamp, momentFilter),
  );

  const activeDevises = new Set<string>();
  for (const d of devisesOrder) activeDevises.add(d);
  for (const d of Object.keys(departByDevise)) {
    if (d !== 'MAD') activeDevises.add(d);
  }
  for (const t of txJ) {
    if (t.devise !== 'MAD') activeDevises.add(t.devise);
  }
  for (const m of mvJ) {
    if (m.devise !== 'MAD') activeDevises.add(m.devise);
  }
  for (const c of creditsPage) {
    if (c.date === dayYmd && c.devise !== 'MAD') activeDevises.add(c.devise);
  }

  return devisesOrder
    .filter((devise) => activeDevises.has(devise))
    .map((devise) => {
      const depart = departByDevise[devise] ?? 0;
      let ventes = 0;
      let alimentations = 0;
      let depots = 0;
      let reliquats = 0;
      let achats = 0;
      let charges = 0;
      let retraits = 0;
      let prelevements = 0;
      let credits = 0;

      for (const t of txJ) {
        if (t.type === 'CHARGES') {
          if (devise === 'MAD') charges += t.montantMAD;
          else if (t.devise === devise) charges += t.montant;
          continue;
        }
        if (t.devise !== devise) continue;
        if (t.type === 'VENTE') ventes += t.montant;
        if (t.type === 'DEPOT') depots += t.montant;
        if (t.type === 'ACHAT') achats += t.montant;
        if (t.type === 'RETRAIT') retraits += t.montant;
       if (t.statut === 'CRÉDIT' && t.type !== 'ACHAT') credits += t.montant;
      }

      for (const m of mvJ) {
        if (m.devise !== devise) continue;
        if (m.type === 'ALIMENTATION') alimentations += Math.abs(m.montant);
        if (m.type === 'PRELEVEMENT') prelevements += Math.abs(m.montant);
        if (m.type === 'RELIQUAT') reliquats += Math.abs(m.montant);
      }

      credits += creditsPage
        .filter((c) => c.date === dayYmd && c.devise === devise && c.statut !== 'Payé')
        .reduce((s, c) => s + c.montant, 0);

      const restant = Math.round(
        (depart +
          achats +
          alimentations +
          depots +
          reliquats -
          ventes -
          charges -
          retraits -
          prelevements -
          credits) *
          100,
      ) / 100;

      return {
        devise,
        depart,
        ventes,
        alimentations,
        depots,
        reliquats,
        achats,
        charges,
        retraits,
        prelevements,
        credits,
        restant,
      };
    })
    .filter(
      (r) =>
        Math.abs(r.depart) > 0.0001 ||
        r.ventes > 0 ||
        r.alimentations > 0 ||
        r.depots > 0 ||
        r.reliquats > 0 ||
        r.achats > 0 ||
        r.charges > 0 ||
        r.retraits > 0 ||
        r.prelevements > 0 ||
        r.credits > 0 ||
        Math.abs(r.restant) > 0.0001,
    );
}

/** Somme des mouvements journal caisse d'un type pour un jour (valeur absolue). */
export function sumMouvementsJour(
  mouvements: { timestamp: string; type: string; devise: string; montant: number }[],
  dayYmd: string,
  type: string,
  devise = 'MAD',
): number {
  return mouvements
    .filter(
      (m) =>
        dayjs(m.timestamp).format('YYYY-MM-DD') === dayYmd &&
        m.type === type &&
        m.devise === devise,
    )
    .reduce((s, m) => s + Math.abs(m.montant), 0);
}

/**
 * Caisse MAD durant la journée :
 * Départ + Dépôts + Ventes − Achats − Retraits − Charges
 * + Alimentations − Prélèvements + Crédits soldés + Reliquats soldés
 */
export function computeCaisseDurantJourneeMad(input: {
  departMad: number;
  depotsMad: number;
  ventesMad: number;
  achatsMad: number;
  retraitsMad: number;
  chargesMad: number;
  alimentationsMad: number;
  prelevementsMad: number;
  creditsSoldesMad: number;
  reliquatsSoldesMad: number;
}): number {
  const {
    departMad,
    depotsMad,
    ventesMad,
    achatsMad,
    retraitsMad,
    chargesMad,
    alimentationsMad,
    prelevementsMad,
    creditsSoldesMad,
    reliquatsSoldesMad,
  } = input;
  return (
    Math.round(
      (departMad +
        depotsMad +
        ventesMad -
        achatsMad -
        retraitsMad -
        chargesMad +
        alimentationsMad -
        prelevementsMad +
        creditsSoldesMad +
        reliquatsSoldesMad) *
        100,
    ) / 100
  );
}

/** Stock restant d'une devise pour un jour — même formule que l'écran Caisse du jour. */
export function stockRestantDevisePourJour(
  devise: string,
  dayYmd: string,
  transactions: Transaction[],
  departByDevise: Record<string, number>,
  mouvements: { timestamp: string; devise: string; type: string; montant: number }[] = [],
  creditsPage: { date: string; devise: string; montant: number; statut: string }[] = [],
): number {
  const rows = computeStockRestantJour(
    transactions,
    departByDevise,
    dayYmd,
    [devise],
    'ALL',
    mouvements,
    creditsPage,
  );
  const row = rows.find((r) => r.devise === devise);
  if (row) return row.restant;
  return departByDevise[devise] ?? 0;
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
    // DÉPÔT devise = entrée stock (ouverture / consignation) — même si MAD encore NON-PAYÉ
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

/**
 * Stock disponible d'une devise pour contrôler une VENTE.
 * @param asOfDay YYYY-MM-DD — si fourni, ignore les opérations des jours suivants (saisie à une date passée).
 */
export function stockDisponibleDevise(
  devise: string,
  transactions: Transaction[],
  options?: {
    asOfDay?: string;
    mouvements?: { timestamp: string; devise: string; type: string; montant: number }[];
  },
): number {
  const cutoff = options?.asOfDay ? dayjs(options.asOfDay).endOf('day') : null;
  let txs = filterTransactionsComptables(transactions).filter((t) => t.devise === devise);
  if (cutoff) {
    txs = txs.filter((t) => !dayjs(t.date).isAfter(cutoff));
  }

  let achete = 0;
  let vendu = 0;
  for (const tx of txs) {
    if (tx.type === 'ACHAT' || tx.type === 'DEPOT') achete += tx.montant;
    if (tx.type === 'VENTE' || tx.type === 'RETRAIT') vendu += tx.montant;
  }

  for (const m of options?.mouvements ?? []) {
    if (m.devise !== devise) continue;
    if (cutoff && dayjs(m.timestamp).isAfter(cutoff)) continue;
    if (m.type === 'ALIMENTATION') achete += Math.abs(m.montant);
    if (m.type === 'PRELEVEMENT') vendu += Math.abs(m.montant);
  }

  return Math.round((achete - vendu) * 100) / 100;
}

/** Agrège achats / ventes / charges en MAD sur une liste déjà filtrée (ex. même périmètre qu’un TCD Excel). */
export function calculRapportPourListe(
  transactions: Transaction[],
  moisLabel: string
): MonthlyReport {
  const actives = filterTransactionsComptables(transactions);
  const totalAchats = actives
    .filter((tx) => tx.type === 'ACHAT')
     .reduce((s, tx) => s + montantMadComptable(tx), 0);
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
