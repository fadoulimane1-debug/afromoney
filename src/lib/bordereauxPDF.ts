/**
 * Génération du bordereau officiel de clôture journalière — AFROMONEY.
 * Page 1 : soldes, snapshots, mouvements, signature.
 * Page 2 : détail complet des transactions du jour (si > 0).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import type { DailyClosure } from '@/types';
import { getTransactions } from '@/lib/storage';
import { isSignatureImage } from '@/components/SignaturePad';

dayjs.locale('fr');

/* ── Palette ── */
type RGB = [number, number, number];
const CLR = {
  navy:       [15, 23, 42]    as RGB,
  navyMid:    [30, 41, 59]    as RGB,
  teal:       [6, 182, 212]   as RGB,
  tealDark:   [8, 145, 178]   as RGB,
  white:      [255, 255, 255] as RGB,
  offWhite:   [248, 250, 252] as RGB,
  gray50:     [241, 245, 249] as RGB,
  gray300:    [203, 213, 225] as RGB,
  gray400:    [148, 163, 184] as RGB,
  gray600:    [71, 85, 105]   as RGB,
  gray900:    [15, 23, 42]    as RGB,
  success:    [16, 185, 129]  as RGB,
  successBg:  [209, 250, 229] as RGB,
  error:      [220, 38, 38]   as RGB,
  errorBg:    [254, 226, 226] as RGB,
  warning:    [217, 119, 6]   as RGB,
  warningBg:  [254, 243, 199] as RGB,
  blue:       [37, 99, 235]   as RGB,
  orange:     [194, 65, 12]   as RGB,
};

/* ── Formateur nombre (sans Intl pour éviter les espaces insécables en PDF) ── */
function fN(n: number, dec = 2): string {
  const sign   = n < 0 ? '-' : '';
  const [int, frac] = Math.abs(n).toFixed(dec).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped},${frac}`;
}

/* ── Setters jsPDF ── */
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function txt(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }
function drw(doc: jsPDF, c: RGB)  { doc.setDrawColor(c[0], c[1], c[2]); }

/* ── Helpers ── */
function sectionTitle(doc: jsPDF, y: number, label: string, W: number, ML: number, CW: number): number {
  fill(doc, CLR.tealDark);
  doc.rect(ML, y, CW, 7, 'F');
  txt(doc, CLR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(label, W / 2, y + 4.8, { align: 'center' });
  return y + 7;
}

function dataRow(
  doc: jsPDF,
  y: number, h: number,
  label: string, value: string,
  bg: RGB, lColor: RGB, vColor: RGB,
  ML: number, MR: number, CW: number
): number {
  fill(doc, bg);
  doc.rect(ML, y, CW, h, 'F');
  txt(doc, lColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(label, ML + 4, y + h / 2 + 1.5);
  txt(doc, vColor);
  doc.setFont('helvetica', 'bold');
  doc.text(value, MR, y + h / 2 + 1.5, { align: 'right' });
  return y + h;
}

function pageFooter(doc: jsPDF, page: number, totalPages: number, refNo: string, genLabel: string, W: number, H: number, ML: number, MR: number) {
  fill(doc, CLR.navy);
  doc.rect(0, H - 13, W, 13, 'F');
  fill(doc, CLR.teal);
  doc.rect(0, H - 13, W, 0.8, 'F');
  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('AFROMONEY — Bureau de change agence principale', ML, H - 8);
  doc.text(`Ref : ${refNo} — ${genLabel}`, W / 2, H - 8, { align: 'center' });
  doc.text(`Page ${page}/${totalPages}`, MR, H - 8, { align: 'right' });
  doc.text('Invariant PDF §7.2 — Document officiel non modifiable apres signature', W / 2, H - 4, { align: 'center' });
}

/* ════════════════════════════════════════════
   EXPORT PRINCIPAL
════════════════════════════════════════════ */

export function generateBordereauPDF(closure: DailyClosure): void {
  const doc   = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W     = 210;
  const H     = 297;
  const ML    = 14;
  const MR    = 196;
  const CW    = MR - ML;

  const dateLabel = dayjs(closure.date).locale('fr').format('dddd D MMMM YYYY');
  const genLabel  = dayjs().format('DD/MM/YYYY HH:mm:ss');
  const refNo     = `CLO-${closure.date.replace(/-/g, '')}`;
  const isOk      = closure.isBalanced;
  const status    = closure.status;

  const txJour = getTransactions()
    .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === closure.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPages = txJour.length > 0 ? 2 : 1;

  /* ══════════════════════════════════
     PAGE 1
  ══════════════════════════════════ */

  // ── En-tête navy ──
  fill(doc, CLR.navy);
  doc.rect(0, 0, W, 44, 'F');
  fill(doc, CLR.teal);
  doc.rect(0, 0, W, 1.8, 'F');

  // AFROMONEY
  txt(doc, CLR.teal);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('AFROMONEY', ML, 14);
  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Bureau de change — Agence principale', ML, 20);

  // Titre document
  txt(doc, CLR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BORDEREAU DE CLOTURE JOURNALIERE', MR, 13, { align: 'right' });
  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Ref : ${refNo}`, MR, 20, { align: 'right' });
  doc.text(`Genere : ${genLabel}`, MR, 25.5, { align: 'right' });

  // Badge statut
  const badgeColor = isOk ? CLR.success : status === 'ERROR' ? CLR.error : CLR.warning;
  const badgeLabel = isOk ? 'EQUILIBREE' : status === 'ERROR' ? 'ECART DETECTE' : 'EN ATTENTE';
  fill(doc, badgeColor);
  doc.roundedRect(ML, 28, 52, 9, 2, 2, 'F');
  txt(doc, CLR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(badgeLabel, ML + 26, 33.5, { align: 'center' });

  // ── Bandeau info ──
  let y = 51;
  fill(doc, CLR.gray50);
  doc.rect(ML, y, CW, 26, 'F');
  drw(doc, CLR.gray300);
  doc.rect(ML, y, CW, 26);

  const infoY1 = y + 8;
  const infoY2 = y + 18;
  const cols   = [ML + 3, ML + 55, ML + 112, ML + 152];

  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  ['DATE', 'OPERATEUR', 'RESPONSABLE', 'VALIDE A'].forEach((h, i) => doc.text(h, cols[i], infoY1 - 2));

  txt(doc, CLR.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(dateLabel, cols[0], infoY1 + 4);
  doc.text(closure.employee || '—', cols[1], infoY1 + 4);
  doc.text(closure.manager || '—', cols[2], infoY1 + 4);
  doc.text(
    closure.validatedAt ? dayjs(closure.validatedAt).format('HH:mm') : '—',
    cols[3], infoY1 + 4
  );

  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Jour ${closure.day} du mois ${closure.month}/${closure.year}`, cols[0], infoY2 + 2);
  if (closure.signature && !isSignatureImage(closure.signature)) {
    doc.text(`Sig. : ${closure.signature.substring(0, 38)}`, cols[1], infoY2 + 2);
  }

  y += 30;

  /* ── SNAPSHOTS ── */
  y += 4;
  y = sectionTitle(doc, y, '3 SNAPSHOTS JOURNALIERS  (DEPART · CLOTURE · FINAL)', W, ML, CW);

  const snapRows: Array<{ label: string; value: number; hint?: string }> = [
    { label: 'Snapshot 1 — DEPART    Solde herite de la cloture J-1', value: closure.initialBalanceMAD, hint: 'Colonne G Excel V8' },
    { label: 'Snapshot 2 — CLOTURE   Solde theorique calcule (G + K - L - M + N)', value: closure.theoreticalBalance, hint: 'Colonne O Excel V8' },
    { label: 'Snapshot 3 — FINAL     Solde reel constate (comptage physique)', value: closure.realBalance, hint: 'Colonne P Excel V8' },
  ];

  snapRows.forEach((r, i) => {
    const bg = i % 2 === 0 ? CLR.white : CLR.offWhite;
    fill(doc, bg);
    doc.rect(ML, y, CW, 10, 'F');

    txt(doc, CLR.gray600);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(r.label, ML + 4, y + 6);

    if (r.hint) {
      txt(doc, CLR.gray400);
      doc.setFontSize(6.5);
      doc.text(r.hint, ML + 4, y + 9.5);
    }

    txt(doc, CLR.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${fN(r.value)} MAD`, MR, y + 6.5, { align: 'right' });
    y += 10;
  });

  // Ligne écart
  const ecBg = isOk ? CLR.successBg : CLR.errorBg;
  const ecC  = isOk ? CLR.success   : CLR.error;
  fill(doc, ecBg);
  doc.rect(ML, y, CW, 10, 'F');
  txt(doc, ecC);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Ecart  (Snapshot 3 - Snapshot 2)', ML + 4, y + 6.5);
  const ecartSign = closure.variance >= 0 ? '+' : '';
  const ecartFlag = isOk ? '[CAISSE EQUILIBREE]' : '[ALERTE — VERIFICATION REQUISE]';
  doc.text(`${ecartSign}${fN(closure.variance)} MAD  ${ecartFlag}`, MR, y + 6.5, { align: 'right' });
  y += 10;

  /* ── MOUVEMENTS DU JOUR ── */
  y += 5;
  y = sectionTitle(doc, y, 'MOUVEMENTS DU JOUR', W, ML, CW);

  const mvtRows: Array<{ label: string; value: number; lColor: RGB; vColor: RGB }> = [
    { label: 'Achats devises    (sorties MAD)',       value: closure.transactions.totalBuys,        lColor: CLR.error,   vColor: CLR.error   },
    { label: 'Ventes devises    (entrees MAD)',        value: closure.transactions.totalSells,       lColor: CLR.success, vColor: CLR.success },
    { label: 'Depots caisse     (alimentation MAD)',   value: closure.transactions.totalDeposits,    lColor: CLR.blue,    vColor: CLR.blue    },
    { label: 'Retraits caisse   (sortie MAD)',         value: closure.transactions.totalWithdrawals, lColor: CLR.orange,  vColor: CLR.orange  },
    { label: 'Charges agence    (sortie MAD)',         value: closure.transactions.totalCharges,     lColor: CLR.gray600, vColor: CLR.gray600 },
  ];

  mvtRows.forEach((r, i) => {
    const bg = i % 2 === 0 ? CLR.white : CLR.offWhite;
    y = dataRow(doc, y, 9, r.label, `${fN(r.value)} MAD`, bg, r.lColor, r.vColor, ML, MR, CW);
  });

  // Bénéfice
  const bC = closure.dailyBenefit >= 0 ? CLR.success : CLR.error;
  const bB = closure.dailyBenefit >= 0 ? CLR.successBg : CLR.errorBg;
  fill(doc, bB);
  doc.rect(ML, y, CW, 11, 'F');
  txt(doc, bC);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BENEFICE DU JOUR   (Ventes - Achats)', ML + 4, y + 7);
  const bSign = closure.dailyBenefit >= 0 ? '+' : '';
  doc.text(`${bSign}${fN(closure.dailyBenefit)} MAD`, MR, y + 7, { align: 'right' });
  y += 11;

  /* ── NOTES ── */
  if (closure.notes?.trim()) {
    y += 4;
    fill(doc, CLR.warningBg);
    const lines = doc.splitTextToSize(`Notes / Justification : ${closure.notes}`, CW - 8) as string[];
    const nh = Math.max(10, lines.length * 5 + 6);
    doc.rect(ML, y, CW, nh, 'F');
    txt(doc, CLR.warning);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(lines, ML + 4, y + 6);
    y += nh;
  }

  /* ── VALIDATION BANNER ── */
  y += 6;
  const valColor = isOk ? CLR.success : CLR.warning;
  fill(doc, valColor);
  doc.rect(ML, y, CW, 11, 'F');
  txt(doc, CLR.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const valLabel = isOk
    ? 'CLOTURE VALIDEE ET EQUILIBREE'
    : status === 'ERROR'
    ? 'CLOTURE AVEC ECART — VERIFICATION DU RESPONSABLE REQUISE'
    : 'CLOTURE EN ATTENTE DE VALIDATION';
  doc.text(valLabel, W / 2, y + 7.5, { align: 'center' });
  y += 11;

  /* ── SIGNATURES ── */
  y += 7;
  fill(doc, CLR.gray50);
  doc.rect(ML, y, CW, 40, 'F');
  drw(doc, CLR.gray300);
  doc.rect(ML, y, CW, 40);

  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('SIGNATURE OPERATEUR', ML + 32, y + 7, { align: 'center' });
  doc.text('VISA RESPONSABLE / DIRECTEUR', ML + 118, y + 7, { align: 'center' });

  // Noms
  txt(doc, CLR.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(closure.employee || '—', ML + 32, y + 20, { align: 'center' });
  doc.text(closure.manager || '—', ML + 118, y + 20, { align: 'center' });

  if (closure.signature && isSignatureImage(closure.signature)) {
    try {
      doc.addImage(closure.signature, 'PNG', ML + 88, y + 22, 58, 16);
    } catch {
      /* ignore invalid image */
    }
  }

  // Lignes de signature
  drw(doc, CLR.gray300);
  doc.line(ML + 6, y + 32, ML + 58, y + 32);
  doc.line(ML + 80, y + 32, ML + 156, y + 32);

  txt(doc, CLR.gray400);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Signature originale', ML + 32, y + 37, { align: 'center' });
  doc.text('Signature originale', ML + 118, y + 37, { align: 'center' });

  pageFooter(doc, 1, totalPages, refNo, genLabel, W, H, ML, MR);

  /* ══════════════════════════════════
     PAGE 2 — Détail des transactions
  ══════════════════════════════════ */
  if (txJour.length > 0) {
    doc.addPage();

    fill(doc, CLR.navy);
    doc.rect(0, 0, W, 32, 'F');
    fill(doc, CLR.teal);
    doc.rect(0, 0, W, 1.8, 'F');

    txt(doc, CLR.teal);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AFROMONEY', ML, 13);

    txt(doc, CLR.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DETAIL DES TRANSACTIONS', MR, 13, { align: 'right' });

    txt(doc, CLR.gray400);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${dateLabel} — ${txJour.length} transaction(s)`, ML, 20);
    doc.text(`Ref : ${refNo}`, MR, 20, { align: 'right' });

    autoTable(doc, {
      startY: 38,
      head: [['N°', 'Heure', 'Moment', 'Type', 'Devise', 'Montant', 'Taux', 'MAD', 'Statut', 'Note']],
      body: txJour.map((t, i) => [
        String(i + 1),
        dayjs(t.date).format('HH:mm'),
        t.moment ?? '—',
        t.type,
        t.devise,
        fN(t.montant, 4),
        fN(t.taux, 4),
        fN(t.montantMAD),
        t.statut,
        (t.note ?? '').substring(0, 30),
      ]),
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: CLR.navy,
        textColor: CLR.white,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: CLR.offWhite },
      footStyles: { fillColor: CLR.gray50, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center',  cellWidth: 7  },
        1: { halign: 'center',  cellWidth: 12 },
        2: { halign: 'center',  cellWidth: 14 },
        3: { halign: 'center',  cellWidth: 16, fontStyle: 'bold' },
        4: { halign: 'center',  cellWidth: 12 },
        5: { halign: 'right',   cellWidth: 22 },
        6: { halign: 'right',   cellWidth: 20 },
        7: { halign: 'right',   cellWidth: 22 },
        8: { halign: 'center',  cellWidth: 16 },
        9: { halign: 'left',    cellWidth: 'auto' as unknown as number },
      },
      margin: { left: ML, right: ML },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        // Type column — color by type
        if (data.column.index === 3) {
          const typeColors: Record<string, RGB> = {
            ACHAT:   CLR.error,
            VENTE:   CLR.success,
            DEPOT:   [6, 182, 212],
            RETRAIT: CLR.orange,
            CHARGES: CLR.gray600,
          };
          const c = typeColors[String(data.cell.raw)];
          if (c) data.cell.styles.textColor = c as [number, number, number];
          data.cell.styles.fontStyle = 'bold';
        }
        // Statut column
        if (data.column.index === 8) {
          const s = String(data.cell.raw);
          if (s === 'CREDIT') data.cell.styles.textColor = CLR.warning as [number, number, number];
          if (s === 'NON-PAYE') data.cell.styles.textColor = CLR.error as [number, number, number];
        }
      },
    });

    pageFooter(doc, 2, totalPages, refNo, genLabel, W, H, ML, MR);
  }

  doc.save(`bordereau_${closure.date}.pdf`);
}
