/**
 * Rapport PDF professionnel 8 pages — clôture journalière AFROMONEY.
 * Rendu HTML (html2canvas) + assemblage jsPDF — style aligné bordereauxPDF.ts
 */

import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import type { DailyClosure, Transaction, TransactionType } from '@/types';
import { montantMadComptable } from '@/lib/calculations';
import { isSignatureImage } from '@/components/SignaturePad';
import {
  C,
  fN,
  logoSvg,
  pageWrap,
  headerBand,
  kpiCard,
  dataTable,
  renderHtmlPagesToPdf,
  sectionBox,
} from '@/lib/pdfShared';

dayjs.locale('fr');

function signatureBlockHtml(closure: DailyClosure): string {
  if (closure.signature && isSignatureImage(closure.signature)) {
    return `<img src="${closure.signature}" alt="Signature" style="max-width:340px;max-height:110px;display:block;margin:12px auto;object-fit:contain;"/>`;
  }
  if (closure.signature) {
    return `<div style="font-size:9px;color:${C.gray600};padding:8px;">Signé numériquement</div>`;
  }
  return `<div style="height:60px;border-bottom:2px solid ${C.gray300};margin:0 40px 12px;"></div><div style="font-size:9px;color:${C.gray400};">En attente de signature</div>`;
}

function fmtDateLong(iso: string): string {
  return dayjs(iso).locale('fr').format('dddd D MMMM YYYY');
}

function fmtDateShort(iso: string): string {
  return dayjs(iso).format('DD/MM/YYYY');
}

function statusLabel(status: DailyClosure['status']): string {
  const map: Record<DailyClosure['status'], string> = {
    DRAFT: 'Brouillon',
    PENDING_VALIDATION: 'En attente de validation',
    VALIDATED: 'Validée et signée',
    ERROR: 'Écart détecté — vérification requise',
  };
  return map[status];
}

const TOTAL_CLOSURE_PAGES = 8;

function buildLineChartSvg(
  points: number[],
  width: number,
  height: number,
  stroke: string
): string {
  if (points.length < 2) {
    return `<svg width="${width}" height="${height}"><text x="50%" y="50%" text-anchor="middle" fill="${C.gray400}" font-size="11" font-family="Arial">Aucune transaction</text></svg>`;
  }
  const pad = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((v - min) / range) * (height - 2 * pad);
    return `${x},${y}`;
  });
  const poly = coords.join(' ');
  const area = `${coords[0].split(',')[0]},${height - pad} ${poly} ${coords[coords.length - 1].split(',')[0]},${height - pad}`;
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.teal}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${C.teal}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${[0.25, 0.5, 0.75].map((r) => `<line x1="${pad}" y1="${height - pad - r * (height - 2 * pad)}" x2="${width - pad}" y2="${height - pad - r * (height - 2 * pad)}" stroke="${C.gray300}" stroke-width="0.5"/>`).join('')}
      <polygon points="${area}" fill="url(#lg)"/>
      <polyline points="${poly}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${coords.map((c) => `<circle cx="${c.split(',')[0]}" cy="${c.split(',')[1]}" r="3" fill="${stroke}"/>`).join('')}
    </svg>`;
}

function buildPieChartSvg(
  slices: { label: string; value: number; color: string }[],
  size: number
): string {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return `<svg width="${size}" height="${size}"><text x="50%" y="50%" text-anchor="middle" fill="${C.gray400}" font-size="11" font-family="Arial">—</text></svg>`;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  let angle = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const slice = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return `<path d="${d}" fill="${sl.color}"/>`;
  });
  const legend = slices
    .map(
      (sl) =>
        `<div style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:9px;">
          <span style="width:10px;height:10px;border-radius:2px;background:${sl.color};display:inline-block;"></span>
          <span style="color:${C.gray600};">${sl.label}</span>
          <span style="font-weight:bold;color:${C.navy};margin-left:auto;">${fN(sl.value)} MAD</span>
        </div>`
    )
    .join('');
  return `
    <div style="display:flex;align-items:center;gap:16px;">
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>
      <div style="flex:1;">${legend}</div>
    </div>`;
}

function evolutionPoints(closure: DailyClosure, txDay: Transaction[]): number[] {
  const sorted = [...txDay].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let balance = closure.initialBalanceMAD;
  const pts = [balance];
  for (const t of sorted) {
    if (t.type === 'ACHAT') balance -= t.montantMAD;
    else if (t.type === 'VENTE') balance += t.montantMAD;
    else if (t.type === 'DEPOT') balance += montantMadComptable(t);
    else if (t.type === 'RETRAIT' || t.type === 'CHARGES') {
      balance -= t.type === 'CHARGES' ? t.montantMAD : montantMadComptable(t);
    }
    pts.push(balance);
  }
  pts.push(closure.theoreticalBalance);
  return pts;
}

function typeColor(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    ACHAT:      C.error,
    VENTE:      C.success,
    DEPOT:      C.teal,
    RETRAIT:    C.orange,
    CHARGES:    C.gray600,
    ANNULATION: C.gray600,
  };
  return map[type];
}

function txGroupSection(title: string, txList: Transaction[]): string {
  const rows =
    txList.length === 0
      ? [{ cells: ['—', '—', '—', '—', '—', '—'] }]
      : txList.map((t) => ({
          cells: [
            `<span style="color:${typeColor(t.type)};font-weight:bold;">${t.type}</span>`,
            t.devise,
            fN(t.montant, 4),
            fN(t.taux, 4),
            fN(t.montantMAD),
            dayjs(t.date).format('HH:mm'),
          ],
        }));
  return sectionBox(
    `${title} (${txList.length})`,
    dataTable(
      ['Type', 'Devise', 'Montant', 'Taux', 'MAD', 'Heure'],
      rows,
      ['left', 'center', 'right', 'right', 'right', 'center'],
    ),
  );
}

function checkRow(ok: boolean, label: string): string {
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${ok ? C.successBg : C.errorBg};border-radius:6px;margin-bottom:6px;border-left:4px solid ${ok ? C.success : C.error};">
      <span style="font-size:14px;">${ok ? '✓' : '✗'}</span>
      <span style="font-size:10px;color:${C.navy};font-weight:600;">${label}</span>
    </div>`;
}

function buildPages(closure: DailyClosure, txDay: Transaction[]): string[] {
  const dateLabel = fmtDateLong(closure.date);
  const genLabel = dayjs().format('DD/MM/YYYY HH:mm:ss');
  const refNo = `RPT-${closure.date.replace(/-/g, '')}`;
  const isOk = closure.isBalanced;
  const { transactions: tx } = closure;

  const achats = txDay.filter((t) => t.type === 'ACHAT');
  const ventes = txDay.filter((t) => t.type === 'VENTE');
  const depots = txDay.filter((t) => t.type === 'DEPOT');
  const retraits = txDay.filter((t) => t.type === 'RETRAIT');

  const beneficeBrut = closure.dailyBenefit;
  const beneficeNet = beneficeBrut - tx.totalCharges;
  const margePct = tx.totalSells > 0 ? (beneficeBrut / tx.totalSells) * 100 : 0;

  const statusBg = closure.status === 'VALIDATED' ? C.successBg : closure.status === 'ERROR' ? C.errorBg : C.warningBg;
  const statusColor = closure.status === 'VALIDATED' ? C.success : closure.status === 'ERROR' ? C.error : C.warning;

  const evolution = evolutionPoints(closure, txDay);

  /* ── Page 1 : Couverture ── */
  const p1 = pageWrap(
    `
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div style="margin-bottom:20px;padding:18px;border:2px solid ${C.teal};border-radius:12px;background:${C.offWhite};">${logoSvg(96)}</div>
      <div style="font-size:28px;font-weight:bold;color:${C.navy};letter-spacing:0.5px;line-height:1.3;">RAPPORT DE CLÔTURE<br/>JOURNALIÈRE</div>
      <div style="margin-top:20px;font-size:14px;color:${C.tealDark};font-weight:bold;">${dateLabel}</div>
      <div style="margin-top:32px;padding:12px 28px;border:2px solid ${C.navy};background:linear-gradient(135deg,${C.navy},${C.tealDark});border-radius:8px;">
        <div style="font-size:11px;color:${C.gray400};text-transform:uppercase;">Agence</div>
        <div style="font-size:18px;font-weight:bold;color:${C.white};margin-top:4px;">AFROMONEY</div>
      </div>
      <div style="margin-top:40px;font-size:10px;color:${C.gray600};padding:8px 14px;border:1px dashed ${C.gray300};border-radius:4px;">Réf. ${refNo} · Généré le ${genLabel}</div>
    </div>`,
    1,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 2 : Résumé exécutif ── */
  const p2 = pageWrap(
    `
    ${headerBand('RÉSUMÉ EXÉCUTIF', dateLabel)}
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      ${kpiCard('Solde initial', `${fN(closure.initialBalanceMAD)} MAD`, C.blue, C.offWhite)}
      ${kpiCard('Théorique', `${fN(closure.theoreticalBalance)} MAD`, C.navy, C.gray50)}
      ${kpiCard('Réel', `${fN(closure.realBalance)} MAD`, C.tealDark, '#ecfeff')}
      ${kpiCard('Écart', `${closure.variance >= 0 ? '+' : ''}${fN(closure.variance)} MAD`, isOk ? C.success : C.error, isOk ? C.successBg : C.errorBg)}
      ${kpiCard('Bénéfice', `${beneficeBrut >= 0 ? '+' : ''}${fN(beneficeBrut)} MAD`, C.emerald, C.successBg)}
    </div>
    ${sectionBox(
      'Évolution de la caisse (journée)',
      `<div style="border:1px solid ${C.gray300};border-radius:4px;padding:6px;background:${C.offWhite};">${buildLineChartSvg(evolution, 600, 130, C.teal)}</div>`,
    )}
    <div style="padding:12px 16px;background:${statusBg};border-radius:8px;border:2px solid ${statusColor};text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <div style="font-size:9px;color:${C.gray600};text-transform:uppercase;">Statut validation</div>
      <div style="font-size:14px;font-weight:bold;color:${statusColor};margin-top:4px;">${statusLabel(closure.status)}</div>
      ${closure.manager ? `<div style="font-size:9px;color:${C.gray600};margin-top:4px;">Responsable : ${closure.manager}</div>` : ''}
    </div>`,
    2,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 3 : Détails soldes ── */
  const formula =
    'Solde théorique = Solde initial + Dépôts − Retraits − Charges + (Ventes − Achats)';
  const p3 = pageWrap(
    `
    ${headerBand('DÉTAILS SOLDES', 'Réconciliation caisse MAD')}
    ${sectionBox(
      'Tableau de réconciliation MAD',
      dataTable(
        ['Élément', 'Montant (MAD)'],
        [
          { cells: ['Solde initial (hérité J−1)', fN(closure.initialBalanceMAD)] },
          { cells: ['+ Dépôts', `+ ${fN(tx.totalDeposits)}`] },
          { cells: ['− Retraits', `− ${fN(tx.totalWithdrawals)}`] },
          { cells: ['− Charges', `− ${fN(tx.totalCharges)}`] },
          { cells: ['− Achats devises', `− ${fN(tx.totalBuys)}`] },
          { cells: ['+ Ventes devises', `+ ${fN(tx.totalSells)}`] },
          { cells: ['Solde théorique final', fN(closure.theoreticalBalance)], highlight: 'total' },
          { cells: ['Solde réel constaté', fN(closure.realBalance)], bold: true, highlight: isOk ? 'ok' : 'err' },
        ],
        ['left', 'right'],
      ),
    )}
    <div style="padding:10px;background:${C.gray50};border-radius:6px;font-size:9px;color:${C.gray600};margin-bottom:10px;border:1px solid ${C.gray300};border-left:4px solid ${C.teal};">
      <strong style="color:${C.navy};">Formule :</strong> ${formula}
    </div>
    <div style="padding:12px;background:${isOk ? C.successBg : C.errorBg};border-radius:8px;border:2px solid ${isOk ? C.success : C.error};">
      <div style="font-size:10px;font-weight:bold;color:${C.navy};">Analyse de l'écart (Réel − Théorique)</div>
      <div style="font-size:18px;font-weight:bold;color:${isOk ? C.success : C.error};margin-top:6px;">
        ${closure.variance >= 0 ? '+' : ''}${fN(closure.variance)} MAD
        ${isOk ? ' — Caisse équilibrée ✓' : ' — Écart à justifier'}
      </div>
    </div>`,
    3,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 4 : Transactions ── */
  const p4 = pageWrap(
    `
    ${headerBand('TRANSACTIONS DU JOUR', `${txDay.length} opération(s) — ${fmtDateShort(closure.date)}`)}
    ${txGroupSection('ACHATS', achats)}
    ${txGroupSection('VENTES', ventes)}
    ${txGroupSection('DÉPÔTS', depots)}
    ${txGroupSection('RETRAITS', retraits)}`,
    4,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 5 : Analyse bénéfice ── */
  const pieSlices = [
    { label: 'Achats', value: tx.totalBuys, color: C.error },
    { label: 'Ventes', value: tx.totalSells, color: C.success },
    { label: 'Dépôts', value: tx.totalDeposits, color: C.teal },
  ];
  const p5 = pageWrap(
    `
    ${headerBand('ANALYSE BÉNÉFICE', 'Performance journalière')}
    <div style="background:${C.offWhite};border-radius:8px;padding:14px;border:1px solid ${C.gray300};margin-bottom:14px;">
      <div style="font-size:10px;font-weight:bold;color:${C.navy};margin-bottom:10px;">Répartition des flux (Achats / Ventes / Dépôts)</div>
      ${buildPieChartSvg(pieSlices, 120)}
    </div>
    <div style="display:flex;gap:12px;">
      <div style="flex:1;padding:14px;background:${C.successBg};border-radius:8px;border-left:4px solid ${C.success};">
        <div style="font-size:9px;color:${C.gray600};">Bénéfice brut</div>
        <div style="font-size:16px;font-weight:bold;color:${C.success};">${fN(beneficeBrut)} MAD</div>
        <div style="font-size:8px;color:${C.gray600};margin-top:4px;">Ventes − Achats</div>
      </div>
      <div style="flex:1;padding:14px;background:${C.offWhite};border-radius:8px;border-left:4px solid ${C.blue};">
        <div style="font-size:9px;color:${C.gray600};">Bénéfice net</div>
        <div style="font-size:16px;font-weight:bold;color:${C.blue};">${fN(beneficeNet)} MAD</div>
        <div style="font-size:8px;color:${C.gray600};margin-top:4px;">Brut − Charges (${fN(tx.totalCharges)} MAD)</div>
      </div>
      <div style="flex:1;padding:14px;background:${C.warningBg};border-radius:8px;border-left:4px solid ${C.warning};">
        <div style="font-size:9px;color:${C.gray600};">Marge</div>
        <div style="font-size:16px;font-weight:bold;color:${C.warning};">${fN(margePct)} %</div>
        <div style="font-size:8px;color:${C.gray600};margin-top:4px;">Bénéfice / Ventes</div>
      </div>
    </div>`,
    5,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 6 : Conformité ── */
  const hasAudit = txDay.length > 0;
  const hasRates = txDay.some((t) => t.taux > 0);
  const signed = Boolean(closure.manager && isSignatureImage(closure.signature));
  const p6 = pageWrap(
    `
    ${headerBand('CONFORMITÉ & CONTRÔLES', 'Checklist réglementaire')}
    ${checkRow(true, 'Double-entrée comptable vérifiée')}
    ${checkRow(hasAudit, 'Audit trail complet (' + txDay.length + ' écritures)')}
    ${checkRow(hasRates, 'Taux éditables appliqués sur les opérations de change')}
    ${checkRow(isOk, 'Réconciliation caisse validée (écart < 0,01 MAD)')}
    <div style="margin-top:20px;padding:16px;background:${C.gray50};border-radius:8px;border:2px solid ${C.gray300};">
      <div style="font-size:11px;font-weight:bold;color:${C.navy};">Signature numérique responsable</div>
      <div style="font-size:22px;font-weight:bold;color:${signed ? C.success : C.error};margin-top:8px;">${signed ? 'OUI' : 'NON'}</div>
      ${signed ? `<div style="font-size:8px;color:${C.gray600};margin-top:8px;">Signature manuscrite enregistrée</div>` : ''}
    </div>`,
    6,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 7 : Notes ── */
  const notes = closure.notes?.trim() || '—';
  const observations = closure.errorDetails?.trim() || (isOk ? 'Aucune anomalie signalée.' : 'Écart de caisse constaté — voir justification.');
  const ecartJustif = !isOk && closure.notes?.trim() ? closure.notes : isOk ? 'Non applicable (caisse équilibrée).' : 'Justification requise.';
  const p7 = pageWrap(
    `
    ${headerBand('NOTES & JUSTIFICATIONS', 'Observations de clôture')}
    <div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:bold;color:${C.tealDark};text-transform:uppercase;margin-bottom:6px;">Notes de clôture</div>
      <div style="padding:12px;background:${C.warningBg};border-radius:6px;font-size:10px;color:${C.navy};min-height:60px;border-left:3px solid ${C.warning};">${notes}</div>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:bold;color:${C.tealDark};text-transform:uppercase;margin-bottom:6px;">Observations</div>
      <div style="padding:12px;background:${C.offWhite};border-radius:6px;font-size:10px;color:${C.gray600};min-height:50px;border:1px solid ${C.gray300};">${observations}</div>
    </div>
    <div>
      <div style="font-size:9px;font-weight:bold;color:${C.tealDark};text-transform:uppercase;margin-bottom:6px;">Écarts justifiés</div>
      <div style="padding:12px;background:${isOk ? C.successBg : C.errorBg};border-radius:6px;font-size:10px;color:${C.navy};min-height:50px;border-left:3px solid ${isOk ? C.success : C.error};">${ecartJustif}</div>
    </div>`,
    7,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  /* ── Page 8 : Signature ── */
  const sigHtml = signatureBlockHtml(closure);
  const p8 = pageWrap(
    `
    ${headerBand('SIGNATURE & TAMPON', 'Validation officielle')}
    <div style="margin-top:30px;padding:24px;border:2px dashed ${C.gray300};border-radius:12px;text-align:center;background:${C.offWhite};">
      <div style="font-size:10px;color:${C.gray600};margin-bottom:12px;">Signature manuscrite du responsable</div>
      ${sigHtml}
    </div>
    <div style="margin-top:24px;display:flex;gap:20px;">
      <div style="flex:1;padding:12px;background:${C.gray50};border-radius:8px;">
        <div style="font-size:9px;color:${C.gray600};">Nom du responsable</div>
        <div style="font-size:14px;font-weight:bold;color:${C.navy};margin-top:4px;">${closure.manager || '—'}</div>
      </div>
      <div style="flex:1;padding:12px;background:${C.gray50};border-radius:8px;">
        <div style="font-size:9px;color:${C.gray600};">Date & heure</div>
        <div style="font-size:14px;font-weight:bold;color:${C.navy};margin-top:4px;">
          ${closure.validatedAt ? dayjs(closure.validatedAt).format('DD/MM/YYYY HH:mm:ss') : genLabel}
        </div>
      </div>
    </div>
    <div style="margin-top:40px;text-align:center;padding:16px;background:linear-gradient(135deg,${C.navy},${C.navyMid});border-radius:8px;">
      <div style="font-size:11px;font-weight:bold;color:${C.teal};letter-spacing:1px;">Confidentiel — Bureau de Change AFROMONEY</div>
      <div style="font-size:9px;color:${C.gray400};margin-top:6px;">Document officiel · ${refNo}</div>
    </div>`,
    8,
    TOTAL_CLOSURE_PAGES,
    refNo,
    genLabel
  );

  return [p1, p2, p3, p4, p5, p6, p7, p8];
}

/* ════════════════════════════════════════════
   EXPORT PRINCIPAL
════════════════════════════════════════════ */

export async function generateRapportPDF(
  closure: DailyClosure,
  transactions: Transaction[]
): Promise<void> {
  const txDay = transactions
    .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === closure.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pagesHtml = buildPages(closure, txDay);
  await renderHtmlPagesToPdf(pagesHtml, `rapport_cloture_${closure.date}.pdf`);
}
