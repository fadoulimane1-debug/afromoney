import dayjs from 'dayjs';
import type { Transaction, TransactionType } from '@/types';
import { DEVISES_CAISSE_V8 } from '@/lib/constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { sumCreditsSoldesMad } from '@/lib/credits';

const MOIS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

function sumMontantMadForType(transactions: Transaction[], type: TransactionType): number {
  return filterTransactionsComptables(transactions)
    .filter((t) => t.type === type)
    .reduce((s, t) => s + t.montantMAD, 0);
}

/** Une ligne de la feuille « BILAN MENSUEL » V8. */
export interface BilanMensuelV8Row {
  monthIndex: number;
  label: string;
  achatsMad: number;
  ventesMad: number;
  depotsMad: number;
  retraitsMad: number;
  chargesMad: number;
  benefice: number;
  margePercent: number;
  nbOps: number;
}

/** 12 mois pour une année — même formules que le classeur (BÉNÉFICE = ventes − achats − charges ; marge = BÉNÉFICE / ventes). */
export function buildBilanAnnuelV8(transactions: Transaction[], year: number): BilanMensuelV8Row[] {
  return MOIS_FR.map((nom, i) => {
    const txM = transactions.filter((t) => {
      const d = dayjs(t.date);
      return d.year() === year && d.month() === i;
    });
    const achatsMad = sumMontantMadForType(txM, 'ACHAT');
    const ventesMad = sumMontantMadForType(txM, 'VENTE');
    const depotsMad = sumMontantMadForType(txM, 'DEPOT');
    const retraitsMad = sumMontantMadForType(txM, 'RETRAIT');
    const chargesMad = sumMontantMadForType(txM, 'CHARGES');
    const benefice = ventesMad - achatsMad - chargesMad;
    const margePercent = ventesMad > 0 ? (benefice / ventesMad) * 100 : 0;
    return {
      monthIndex: i + 1,
      label: `${nom} ${year}`,
      achatsMad,
      ventesMad,
      depotsMad,
      retraitsMad,
      chargesMad,
      benefice,
      margePercent: Math.round(margePercent * 100) / 100,
      nbOps: filterTransactionsComptables(txM).length,
    };
  });
}

/** Totaux colonne droite feuille CAISSE — journée calendaire. */
export interface CaisseJourV8 {
  dateLabel: string;
  totalAchatsMad: number;
  totalVentesMad: number;
  totalDepotsMad: number;
  totalRetraitsMad: number;
  creditsAccordesMad: number;
  /** Crédits page « Crédits » soldés ce jour (entrée caisse MAD). */
  creditsSoldesMad: number;
  beneficeEstime: number;
}

export function summarizeCaisseJourV8(
  transactions: Transaction[],
  day: dayjs.Dayjs = dayjs()
): CaisseJourV8 {
  const txJ = filterTransactionsComptables(
    transactions.filter((t) => dayjs(t.date).isSame(day, 'day')),
  );
  const totalAchatsMad = sumMontantMadForType(txJ, 'ACHAT');
  const totalVentesMad = sumMontantMadForType(txJ, 'VENTE');
  const totalDepotsMad = sumMontantMadForType(txJ, 'DEPOT');
  const totalRetraitsMad = sumMontantMadForType(txJ, 'RETRAIT');
  const chargesMad = sumMontantMadForType(txJ, 'CHARGES');
  const creditsAccordesMad = txJ
    .filter((t) => t.statut === 'CRÉDIT')
    .reduce((s, t) => s + t.montantMAD, 0);
  const dayStr = day.format('YYYY-MM-DD');
  const creditsSoldesMad = sumCreditsSoldesMad(dayStr);
  const beneficeEstime = totalVentesMad - totalAchatsMad - chargesMad;
  return {
    dateLabel: day.format('dddd D MMMM YYYY'),
    totalAchatsMad,
    totalVentesMad,
    totalDepotsMad,
    totalRetraitsMad,
    creditsAccordesMad,
    creditsSoldesMad,
    beneficeEstime,
  };
}

export interface RecapDeviseJourRow {
  devise: string;
  achatsJour: number;
  ventesJour: number;
  retraitsJour: number;
}

/** Mouvements du jour par devise (bloc récap V8), devises CAISSE uniquement. */
export function recapDeviseJournee(
  transactions: Transaction[],
  day: dayjs.Dayjs = dayjs()
): RecapDeviseJourRow[] {
  const txJ = filterTransactionsComptables(
    transactions.filter((t) => dayjs(t.date).isSame(day, 'day')),
  );
  const map = new Map<string, { achats: number; ventes: number; retraits: number }>();
  for (const d of DEVISES_CAISSE_V8) {
    map.set(d, { achats: 0, ventes: 0, retraits: 0 });
  }
  for (const t of txJ) {
    const slot = map.get(t.devise);
    if (!slot) continue;
    if (t.type === 'ACHAT') slot.achats += t.montant;
    if (t.type === 'VENTE') slot.ventes += t.montant;
    if (t.type === 'RETRAIT') slot.retraits += t.montant;
  }
  return DEVISES_CAISSE_V8.map((devise) => {
    const m = map.get(devise)!;
    return {
      devise,
      achatsJour: m.achats,
      ventesJour: m.ventes,
      retraitsJour: m.retraits,
    };
  });
}
