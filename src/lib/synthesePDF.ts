/**
 * Rapport PDF Synthèse (tableau de bord) — design cadré, 4 pages.
 */
import dayjs from 'dayjs';
import type { DailyClosure, Transaction } from '@/types';
import type { CaisseJourV8 } from '@/lib/bilanV8';
import {
  C,
  fN,
  logoSvg,
  pageWrap,
  headerBand,
  kpiCard,
  sectionBox,
  dataTable,
  renderHtmlPagesToPdf,
} from '@/lib/pdfShared';
import { filterTransactionsComptables } from '@/lib/transactionFilters';

export interface SynthesePdfInput {
  closure: DailyClosure;
  transactionsDay: Transaction[];
  /** KPI mois courant */
  totalVentes: number;
  totalAchats: number;
  chargesAgence: number;
  beneficeNet: number;
  margePercent: number;
  nbTransactionsMois: number;
  caisseMad: number;
  stockTotalMad: number;
  caisseJour: CaisseJourV8;
  lastClosureBalance: number | null;
}

function statusLabel(status: DailyClosure['status']): string {
  const map: Record<DailyClosure['status'], string> = {
    DRAFT: 'Brouillon',
    PENDING_VALIDATION: 'En attente',
    VALIDATED: 'Validée',
    ERROR: 'Écart détecté',
  };
  return map[status];
}

function txRows(txList: Transaction[]): { cells: string[] }[] {
  const actives = filterTransactionsComptables(txList);
  if (actives.length === 0) {
    return [{ cells: ['Aucune opération valide ce jour', '—', '—', '—', '—'] }];
  }
  return actives.map((t) => ({
    cells: [
      t.numero ?? '—',
      t.type,
      t.devise,
      fN(t.montant, t.devise === 'MAD' ? 2 : 2),
      fN(t.montantMAD),
      dayjs(t.date).format('HH:mm'),
    ],
  }));
}

function buildPages(data: SynthesePdfInput): string[] {
  const { closure, caisseJour } = data;
  const dateLabel = dayjs(closure.date).locale('fr').format('dddd D MMMM YYYY');
  const genLabel = dayjs().format('DD/MM/YYYY à HH:mm');
  const refNo = `SYN-${closure.date.replace(/-/g, '')}`;
  const totalPages = 4;
  const isOk = closure.isBalanced;
  const tx = closure.transactions;

  const p1 = pageWrap(
    `
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div style="margin-bottom:20px;padding:16px;border:2px solid ${C.teal};border-radius:12px;background:${C.offWhite};">${logoSvg(88)}</div>
      <div style="font-size:26px;font-weight:bold;color:${C.navy};line-height:1.25;">RAPPORT SYNTHÈSE</div>
      <div style="margin-top:8px;font-size:13px;color:${C.tealDark};font-weight:bold;">${dateLabel}</div>
      <div style="margin-top:24px;padding:14px 32px;border:2px solid ${C.navy};border-radius:8px;background:linear-gradient(135deg,${C.navy},${C.navyMid});">
        <div style="font-size:10px;color:${C.gray400};text-transform:uppercase;">Document</div>
        <div style="font-size:15px;font-weight:bold;color:${C.white};margin-top:4px;">Indicateurs · Caisse · Clôture</div>
      </div>
      <div style="margin-top:28px;font-size:9px;color:${C.gray600};padding:8px 16px;border:1px dashed ${C.gray300};border-radius:4px;">
        Réf. ${refNo} · Généré le ${genLabel}
      </div>
    </div>`,
    1,
    totalPages,
    refNo,
    genLabel,
  );

  const p2 = pageWrap(
    `
    ${headerBand('INDICATEURS CLÉS', dateLabel)}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
      ${kpiCard('Caisse (DEP/RET/CHG)', `${fN(data.caisseMad)} MAD`, C.blue, C.offWhite)}
      ${kpiCard('Stock (valeur MAD)', `${fN(data.stockTotalMad)} MAD`, C.emerald, C.successBg)}
      ${kpiCard('Bénéfice net (mois)', `${fN(data.beneficeNet)} MAD`, data.beneficeNet >= 0 ? C.success : C.error, data.beneficeNet >= 0 ? C.successBg : C.errorBg)}
      ${kpiCard('Transactions (mois)', String(data.nbTransactionsMois), C.navy, C.gray50)}
    </div>
    ${sectionBox(
      'Performance du mois en cours',
      dataTable(
        ['Élément', 'Montant (MAD)'],
        [
          { cells: ['Total ventes', fN(data.totalVentes)] },
          { cells: ['Total achats', fN(data.totalAchats)] },
          { cells: ['Charges agence', fN(data.chargesAgence)] },
          {
            cells: ['Bénéfice net', fN(data.beneficeNet)],
            bold: true,
            highlight: data.beneficeNet >= 0 ? 'ok' : 'err',
          },
          { cells: ['Marge %', `${fN(data.margePercent)} %`] },
        ],
        ['left', 'right'],
      ),
    )}
    ${sectionBox(
      'Caisse du jour (feuille CAISSE V8)',
      dataTable(
        ['Libellé', 'MAD'],
        [
          { cells: ['Achats jour', fN(caisseJour.totalAchatsMad)] },
          { cells: ['Ventes jour', fN(caisseJour.totalVentesMad)] },
          { cells: ['Dépôts', fN(caisseJour.totalDepotsMad)] },
          { cells: ['Retraits', fN(caisseJour.totalRetraitsMad)] },
          { cells: ['Crédits accordés', fN(caisseJour.creditsAccordesMad)] },
          {
            cells: ['Bénéfice estimé', fN(caisseJour.beneficeEstime)],
            bold: true,
            highlight: caisseJour.beneficeEstime >= 0 ? 'ok' : 'warn',
          },
        ],
        ['left', 'right'],
      ),
    )}
    ${data.lastClosureBalance != null ? `<div style="font-size:8px;color:${C.gray600};padding:6px 10px;border:1px solid ${C.gray300};border-radius:4px;background:${C.gray50};">Solde hérité dernière clôture : <strong>${fN(data.lastClosureBalance)} MAD</strong></div>` : ''}`,
    2,
    totalPages,
    refNo,
    genLabel,
  );

  const p3 = pageWrap(
    `
    ${headerBand('CLÔTURE JOURNALIÈRE', statusLabel(closure.status))}
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      ${kpiCard('Solde initial', `${fN(closure.initialBalanceMAD)} MAD`, C.blue, C.offWhite)}
      ${kpiCard('Théorique', `${fN(closure.theoreticalBalance)} MAD`, C.navy, C.gray50)}
      ${kpiCard('Réel', `${fN(closure.realBalance)} MAD`, C.tealDark, '#ecfeff')}
      ${kpiCard('Écart', `${closure.variance >= 0 ? '+' : ''}${fN(closure.variance)} MAD`, isOk ? C.success : C.error, isOk ? C.successBg : C.errorBg)}
    </div>
    ${sectionBox(
      'Détail soldes MAD',
      dataTable(
        ['Élément', 'Montant (MAD)'],
        [
          { cells: ['Solde initial', fN(closure.initialBalanceMAD)] },
          { cells: ['+ Dépôts', `+ ${fN(tx.totalDeposits)}`] },
          { cells: ['− Retraits', `− ${fN(tx.totalWithdrawals)}`] },
          { cells: ['− Charges', `− ${fN(tx.totalCharges)}`] },
          { cells: ['− Achats devises', `− ${fN(tx.totalBuys)}`] },
          { cells: ['+ Ventes devises', `+ ${fN(tx.totalSells)}`] },
          { cells: ['Solde théorique', fN(closure.theoreticalBalance)], highlight: 'total' },
          { cells: ['Solde réel', fN(closure.realBalance)], bold: true, highlight: isOk ? 'ok' : 'err' },
        ],
        ['left', 'right'],
      ),
    )}
    <div style="padding:10px 12px;border:2px solid ${isOk ? C.success : C.error};border-radius:6px;background:${isOk ? C.successBg : C.errorBg};text-align:center;">
      <div style="font-size:9px;color:${C.gray600};">Statut</div>
      <div style="font-size:13px;font-weight:bold;color:${isOk ? C.success : C.error};">${statusLabel(closure.status)}${closure.manager ? ` — ${closure.manager}` : ''}</div>
    </div>`,
    3,
    totalPages,
    refNo,
    genLabel,
  );

  const p4 = pageWrap(
    `
    ${headerBand('OPÉRATIONS DU JOUR', `${data.transactionsDay.length} ligne(s) · ${dayjs(closure.date).format('DD/MM/YYYY')}`)}
    ${sectionBox(
      'Journal des transactions (valides)',
      dataTable(
        ['N° Op.', 'Type', 'Devise', 'Montant', 'MAD', 'Heure'],
        txRows(data.transactionsDay),
        ['left', 'center', 'center', 'right', 'right', 'center'],
      ),
    )}
    <div style="margin-top:10px;padding:10px;border:1px solid ${C.gray300};border-radius:6px;background:${C.offWhite};font-size:8px;color:${C.gray600};">
      <strong style="color:${C.navy};">Note :</strong> Document généré depuis la page Synthèse. Les montants utilisent le format fr-MA (séparateur de milliers). Opérations annulées exclues.
    </div>`,
    4,
    totalPages,
    refNo,
    genLabel,
  );

  return [p1, p2, p3, p4];
}

export async function generateSynthesePDF(data: SynthesePdfInput): Promise<void> {
  const pages = buildPages(data);
  await renderHtmlPagesToPdf(pages, `rapport_synthese_${data.closure.date}.pdf`);
}
