import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { getTransactions, getClosures, getExchangeRates } from '@/lib/storage';
import { buildBilanAnnuelV8 } from '@/lib/bilanV8';
import { DEVISES, TAUX_PAR_DEFAUT } from '@/lib/constants';
import { createWorkbook, downloadExcelWorkbook, type StyledSheetInput } from '@/lib/exportStyled';
import { filterTransactionsComptables } from '@/lib/transactionFilters';

dayjs.locale('fr');

/**
 * Export professionnel 6 feuilles structurées (cadres, en-têtes, page sommaire).
 */
export function exportToExcel6Sheets(month: number, year: number): void {
  const monthLabel = dayjs(new Date(year, month, 1)).format('MMMM YYYY');
  const transactions = getTransactions();
  const closures = getClosures();
  const rates = getExchangeRates();

  const monthTx = filterTransactionsComptables(
    transactions.filter((t) => {
      const d = dayjs(t.date);
      return d.month() === month && d.year() === year;
    }),
  );

  const monthClosures = closures
    .filter((c) => {
      const d = dayjs(c.date);
      return d.month() === month && d.year() === year;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const bilanRows = buildBilanAnnuelV8(transactions, year);
  const totA = bilanRows.reduce((s, r) => s + r.achatsMad, 0);
  const totV = bilanRows.reduce((s, r) => s + r.ventesMad, 0);
  const totD = bilanRows.reduce((s, r) => s + r.depotsMad, 0);
  const totR = bilanRows.reduce((s, r) => s + r.retraitsMad, 0);
  const totC = bilanRows.reduce((s, r) => s + r.chargesMad, 0);
  const totB = bilanRows.reduce((s, r) => s + r.benefice, 0);
  const totOp = bilanRows.reduce((s, r) => s + r.nbOps, 0);

  const stockMap: Record<string, { achats: number; ventes: number; plMad: number }> = {};
  for (const t of monthTx) {
    if (!stockMap[t.devise]) stockMap[t.devise] = { achats: 0, ventes: 0, plMad: 0 };
    if (t.type === 'ACHAT') {
      stockMap[t.devise].achats += t.montant;
      stockMap[t.devise].plMad -= t.montantMAD;
    }
    if (t.type === 'VENTE') {
      stockMap[t.devise].ventes += t.montant;
      stockMap[t.devise].plMad += t.montantMAD;
    }
  }

  const mAchats = monthTx.filter((t) => t.type === 'ACHAT').reduce((s, t) => s + t.montantMAD, 0);
  const mVentes = monthTx.filter((t) => t.type === 'VENTE').reduce((s, t) => s + t.montantMAD, 0);
  const mCharges = monthTx.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + t.montantMAD, 0);
  const mBrut = mVentes - mAchats;
  const mNet = mBrut - mCharges;
  const mMarge = mVentes > 0 ? (mNet / mVentes) * 100 : 0;
  const mCredited = monthTx.filter((t) => t.statut === 'CRÉDIT').reduce((s, t) => s + t.montantMAD, 0);
  const nbEcarts = monthClosures.filter((c) => !c.isBalanced).length;
  const nbValid = monthClosures.filter((c) => c.status === 'VALIDATED').length;
  const compliance =
    monthClosures.length > 0
      ? ((monthClosures.length - nbEcarts) / monthClosures.length) * 100
      : 100;

  const sheets: StyledSheetInput[] = [
    {
      sheetName: 'TRANSACTIONS',
      documentTitle: 'Transactions du mois',
      periodLabel: monthLabel,
      headers: [
        'Date',
        'Jour',
        'Moment',
        'Employé',
        'Type',
        'Opération',
        'Devise',
        'Montant',
        'Taux',
        'MAD',
        'Statut',
        'Bénéficiaire',
        'Note',
      ],
      rows: monthTx.map((t) => [
        dayjs(t.date).format('DD/MM/YYYY'),
        dayjs(t.date).date(),
        t.moment ?? '',
        t.employeNom ?? t.employeId,
        t.type,
        t.operation,
        t.devise,
        t.montant,
        t.taux,
        t.montantMAD,
        t.statut,
        t.beneficiaire ?? '',
        t.note ?? '',
      ]),
      colWidths: [11, 5, 8, 14, 9, 24, 7, 12, 10, 12, 9, 14, 20],
    },
    {
      sheetName: 'BILAN_MENSUEL',
      documentTitle: `Bilan mensuel ${year}`,
      periodLabel: 'Année complète',
      headers: [
        'Mois',
        'Achats MAD',
        'Ventes MAD',
        'Dépôts',
        'Retraits',
        'Charges',
        'Bénéfice net',
        'Marge %',
        'Opérations',
      ],
      rows: [
        ...bilanRows.map((r) => [
          r.label,
          r.achatsMad,
          r.ventesMad,
          r.depotsMad,
          r.retraitsMad,
          r.chargesMad,
          r.benefice,
          r.ventesMad > 0 ? r.margePercent : 0,
          r.nbOps,
        ]),
        [
          `TOTAL ${year}`,
          totA,
          totV,
          totD,
          totR,
          totC,
          totB,
          totV > 0 ? (totB / totV) * 100 : 0,
          totOp,
        ],
      ],
      highlightLastRow: true,
      colWidths: [16, 13, 13, 12, 12, 12, 14, 9, 11],
    },
    {
      sheetName: 'CLÔTURES',
      documentTitle: 'Clôtures journalières',
      periodLabel: monthLabel,
      headers: [
        'Date',
        'Jour',
        'Employé',
        'Responsable',
        'Solde initial',
        'Achats',
        'Ventes',
        'Dépôts',
        'Retraits',
        'Charges',
        'Bénéfice jour',
        'Théorique',
        'Réel',
        'Écart',
        'OK',
        'Statut',
        'Validé le',
      ],
      rows: monthClosures.map((c) => [
        c.date,
        c.day,
        c.employee,
        c.manager ?? '',
        c.initialBalanceMAD,
        c.transactions.totalBuys,
        c.transactions.totalSells,
        c.transactions.totalDeposits,
        c.transactions.totalWithdrawals,
        c.transactions.totalCharges,
        c.dailyBenefit,
        c.theoreticalBalance,
        c.realBalance,
        c.variance,
        c.isBalanced ? 'OUI' : 'NON',
        c.status,
        c.validatedAt ? dayjs(c.validatedAt).format('DD/MM/YYYY HH:mm') : '',
      ]),
      colWidths: [11, 4, 12, 12, 12, 10, 10, 10, 10, 10, 11, 11, 11, 9, 5, 10, 16],
    },
    {
      sheetName: 'POSITIONS',
      documentTitle: 'Positions devises',
      periodLabel: monthLabel,
      headers: [
        'Devise',
        'Achats qté',
        'Ventes qté',
        'Position',
        'Taux jour',
        'Valeur MAD',
        'P&L MAD',
      ],
      rows: DEVISES.filter((d) => stockMap[d]).map((dev) => {
        const s = stockMap[dev];
        const tauxJour = rates.find((r) => r.devise === dev)?.tauxJour ?? TAUX_PAR_DEFAUT[dev] ?? 1;
        const position = s.achats - s.ventes;
        return [dev, s.achats, s.ventes, position, tauxJour, position * tauxJour, s.plMad];
      }),
      colWidths: [8, 12, 12, 12, 11, 14, 12],
    },
    {
      sheetName: 'ANALYSE_KPI',
      documentTitle: 'Analyse KPI',
      periodLabel: monthLabel,
      headers: ['Indicateur', 'Valeur', 'Unité'],
      rows: [
        ['Période', monthLabel, ''],
        ['Transactions', monthTx.length, 'opérations'],
        ['Achats MAD', mAchats, 'MAD'],
        ['Ventes MAD', mVentes, 'MAD'],
        ['Charges', mCharges, 'MAD'],
        ['Bénéfice brut', mBrut, 'MAD'],
        ['Bénéfice net', mNet, 'MAD'],
        ['Marge nette', mMarge, '%'],
        ['Encours crédits', mCredited, 'MAD'],
        ['Jours validés', nbValid, 'jours'],
        ['Jours clôturés', monthClosures.length, 'jours'],
        ['Écarts détectés', nbEcarts, 'jours'],
        ['Score conformité', compliance, '%'],
        ['Devises actives', Object.keys(stockMap).length, 'devises'],
      ],
      colWidths: [32, 16, 12],
    },
    {
      sheetName: 'TAUX_CONFIG',
      documentTitle: 'Taux & configuration',
      periodLabel: monthLabel,
      headers: ['Paramètre', 'Valeur', 'Mise à jour'],
      rows: [
        ['── TAUX DE CHANGE ──', '', ''],
        ...rates.map((r) => [
          r.devise,
          `Achat ${r.tauxAchat} | Vente ${r.tauxVente} | Jour ${r.tauxJour}`,
          dayjs(r.dateUpdate).format('DD/MM/YYYY HH:mm'),
        ]),
        ['', '', ''],
        ['── SYSTÈME ──', '', ''],
        ['Devises gérées', DEVISES.join(', '), ''],
        ['Formule bénéfice', 'Ventes − Achats − Charges', ''],
        ['Période export', monthLabel, ''],
      ],
      colWidths: [22, 48, 18],
    },
  ];

  const sommaire: StyledSheetInput = {
    sheetName: 'SOMMAIRE',
    documentTitle: 'AFROMONEY — Export mensuel',
    periodLabel: monthLabel,
    headers: ['Feuille', 'Contenu'],
    rows: [
      ['TRANSACTIONS', `${monthTx.length} opération(s)`],
      ['BILAN_MENSUEL', `Année ${year}`],
      ['CLÔTURES', `${monthClosures.length} jour(s)`],
      ['POSITIONS', `${Object.keys(stockMap).length} devise(s)`],
      ['ANALYSE_KPI', 'Indicateurs clés'],
      ['TAUX_CONFIG', `${rates.length} taux`],
    ],
    colWidths: [18, 40],
  };

  const wb = createWorkbook([sommaire, ...sheets]);
  downloadExcelWorkbook(wb, `afromoney_${String(month + 1).padStart(2, '0')}_${year}.xlsx`);
}
