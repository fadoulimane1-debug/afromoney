/**
 * Thème et composants HTML partagés pour les PDF AFROMONEY (html2canvas + jsPDF).
 */
import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

export const PAGE_W_PX = 794;
export const PAGE_H_PX = 1123;
export const PAD_PX = 52;
export const PDF_W = 210;
export const PDF_H = 297;

export const C = {
  navy: '#0f172a',
  navyMid: '#1e293b',
  teal: '#06b6d4',
  tealDark: '#0891b2',
  white: '#ffffff',
  offWhite: '#f8fafc',
  gray50: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray600: '#475569',
  success: '#10b981',
  successBg: '#d1fae5',
  error: '#dc2626',
  errorBg: '#fee2e2',
  warning: '#d97706',
  warningBg: '#fef3c7',
  blue: '#2563eb',
  orange: '#c2410c',
  emerald: '#059669',
};

/** Montant fr-MA avec séparateur de milliers (espace). */
export function fN(n: number, dec = 2): string {
  const sign = n < 0 ? '-' : '';
  const [int, frac] = Math.abs(n).toFixed(dec).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped},${frac}`;
}

export function logoSvg(size = 72): string {
  const loops = [0, 45, 90, 135, 180, 225, 270, 315]
    .map(
      (deg, i) =>
        `<ellipse cx="16" cy="16" rx="11.35" ry="4.18" fill="none" stroke="${i % 2 === 0 ? C.teal : C.navy}" stroke-width="1.6" transform="rotate(${deg} 16 16)"/>`,
    )
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="${C.white}" stroke="${C.gray300}" stroke-width="1"/>
    <g>${loops}</g>
    <circle cx="16" cy="16" r="4.15" fill="${C.white}"/>
  </svg>`;
}

export function pageFooter(page: number, total: number, refNo: string, genLabel: string): string {
  return `
    <div data-pdf-footer style="position:absolute;bottom:0;left:0;right:0;height:52px;background:linear-gradient(90deg,${C.navy},${C.navyMid});border-top:3px solid ${C.teal};padding:10px 22px;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;font-size:9px;color:${C.gray400};box-shadow:0 -2px 8px rgba(15,23,42,0.15);">
      <span style="font-weight:600;color:${C.teal};">AFROMONEY</span>
      <span>Réf. ${refNo} · ${genLabel}</span>
      <span style="font-weight:bold;color:${C.white};">Page ${page}/${total}</span>
    </div>`;
}

/** Cadre page + zone contenu cadrée. */
export function pageWrap(
  inner: string,
  page: number,
  total: number,
  refNo: string,
  genLabel: string,
): string {
  return `
    <div style="position:relative;width:${PAGE_W_PX}px;height:${PAGE_H_PX}px;box-sizing:border-box;padding:${PAD_PX}px;font-family:Arial,Helvetica,sans-serif;background:${C.white};overflow:hidden;">
      <div style="position:absolute;inset:12px;border:2px solid ${C.navy};border-radius:4px;pointer-events:none;opacity:0.35;"></div>
      <div style="position:absolute;inset:16px;border:1px solid ${C.teal};border-radius:2px;pointer-events:none;opacity:0.5;"></div>
      <div style="position:relative;z-index:1;height:calc(100% - 56px);overflow:hidden;">
        ${inner}
      </div>
      ${pageFooter(page, total, refNo, genLabel)}
    </div>`;
}

export function headerBand(title: string, subtitle?: string): string {
  return `
    <div style="background:linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%);border-radius:6px;padding:12px 16px;margin-bottom:12px;border:2px solid ${C.teal};box-shadow:0 2px 6px rgba(15,23,42,0.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:16px;font-weight:bold;color:${C.teal};letter-spacing:0.5px;">AFROMONEY</div>
          <div style="font-size:8px;color:${C.gray400};margin-top:2px;">Bureau de change — Synthèse & clôture</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:bold;color:${C.white};">${title}</div>
          ${subtitle ? `<div style="font-size:8px;color:${C.gray400};margin-top:3px;">${subtitle}</div>` : ''}
        </div>
      </div>
    </div>`;
}

export function kpiCard(label: string, value: string, color: string, bg: string): string {
  return `
    <div style="flex:1;min-width:140px;background:${bg};border-radius:6px;padding:10px 10px;border:1.5px solid ${C.gray300};border-top:3px solid ${color};box-shadow:0 1px 3px rgba(15,23,42,0.08);">
      <div style="font-size:7px;color:${C.gray600};text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;">${label}</div>
      <div style="font-size:12px;font-weight:bold;color:${color};margin-top:5px;">${value}</div>
    </div>`;
}

export function sectionBox(title: string, body: string, accent = C.teal): string {
  return `
    <div style="margin-bottom:12px;border:1.5px solid ${C.gray300};border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.06);">
      <div style="background:${C.navy};color:${C.white};font-size:9px;font-weight:bold;padding:6px 12px;border-bottom:2px solid ${accent};">${title}</div>
      <div style="padding:10px 12px;background:${C.white};">${body}</div>
    </div>`;
}

export type TableRow = { cells: string[]; bold?: boolean; highlight?: 'ok' | 'warn' | 'err' | 'total' };

export function dataTable(headers: string[], rows: TableRow[], colAlign?: ('left' | 'right' | 'center')[]): string {
  const aligns = colAlign ?? headers.map((_, i) => (i === 0 ? 'left' : 'right'));
  const th = headers
    .map(
      (h, i) =>
        `<th style="padding:7px 8px;font-size:8px;text-align:${aligns[i]};border:1px solid ${C.navy};background:${C.navy};color:${C.white};font-weight:bold;">${h}</th>`,
    )
    .join('');
  const tr = rows
    .map((row, ri) => {
      let bg = ri % 2 === 0 ? C.white : C.offWhite;
      let color = C.navy;
      let fw = row.bold ? 'bold' : 'normal';
      if (row.highlight === 'total') {
        bg = C.navyMid;
        color = C.white;
        fw = 'bold';
      } else if (row.highlight === 'ok') bg = C.successBg;
      else if (row.highlight === 'warn') bg = C.warningBg;
      else if (row.highlight === 'err') bg = C.errorBg;
      const tds = row.cells
        .map(
          (c, i) =>
            `<td style="padding:6px 8px;font-size:8.5px;text-align:${aligns[i]};border:1px solid ${C.gray300};background:${bg};color:${color};font-weight:${fw};">${c}</td>`,
        )
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;border:2px solid ${C.navy};margin-bottom:4px;">
      <thead><tr>${th}</tr></thead>
      <tbody>${tr}</tbody>
    </table>`;
}

export async function renderHtmlPagesToPdf(
  pagesHtml: string[],
  filename: string,
): Promise<void> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;pointer-events:none;opacity:0;z-index:-1;';
  document.body.appendChild(host);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  try {
    for (let i = 0; i < pagesHtml.length; i++) {
      const pageEl = document.createElement('div');
      pageEl.innerHTML = pagesHtml[i];
      pageEl.style.width = `${PAGE_W_PX}px`;
      pageEl.style.height = `${PAGE_H_PX}px`;
      host.appendChild(pageEl);

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: PAGE_W_PX,
        height: PAGE_H_PX,
      });

      const img = canvas.toDataURL('image/jpeg', 0.93);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, 0, PDF_W, PDF_H);
      host.removeChild(pageEl);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
