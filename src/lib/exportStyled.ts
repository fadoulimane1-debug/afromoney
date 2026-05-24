/**
 * Exports structurés AFROMONEY — Excel (cadres, en-têtes), Word (HTML), helpers PDF.
 */
import XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';

const BORDER = {
  top: { style: 'thin', color: { rgb: '334155' } },
  bottom: { style: 'thin', color: { rgb: '334155' } },
  left: { style: 'thin', color: { rgb: '334155' } },
  right: { style: 'thin', color: { rgb: '334155' } },
};

const STYLE_TITLE = {
  font: { bold: true, sz: 14, color: { rgb: '0891B2' } },
  alignment: { vertical: 'center' },
};

const STYLE_SUB = {
  font: { sz: 10, color: { rgb: '64748B' } },
  alignment: { vertical: 'center' },
};

const STYLE_HEADER = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER,
};

const STYLE_CELL = {
  font: { sz: 10, color: { rgb: '0F172A' } },
  alignment: { vertical: 'center' },
  border: BORDER,
};

const STYLE_CELL_ALT = {
  ...STYLE_CELL,
  fill: { fgColor: { rgb: 'F8FAFC' } },
};

const STYLE_TOTAL = {
  font: { bold: true, sz: 10, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'E2E8F0' } },
  alignment: { vertical: 'center' },
  border: BORDER,
};

const STYLE_EMPTY = {
  font: { italic: true, sz: 10, color: { rgb: '64748B' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER,
  fill: { fgColor: { rgb: 'FEF3C7' } },
};

export type StyledSheetInput = {
  sheetName: string;
  documentTitle: string;
  periodLabel?: string;
  headers: string[];
  /** Chaque ligne = tableau de valeurs (string | number) */
  rows: (string | number)[][];
  colWidths?: number[];
  /** Dernière ligne en gras (ex. TOTAL) */
  highlightLastRow?: boolean;
};

function cellValue(v: string | number): string | number {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

/** Construit une feuille AOA avec styles (titre, en-têtes, données cadrées). */
export function buildStyledSheet(input: StyledSheetInput): XLSX.WorkSheet {
  const { documentTitle, periodLabel, headers, rows } = input;
  const colCount = Math.max(headers.length, 1);
  const genAt = dayjs().format('DD/MM/YYYY à HH:mm');

  const aoa: (string | number)[][] = [
    [documentTitle],
    [periodLabel ? `${periodLabel} · Généré le ${genAt}` : `Généré le ${genAt}`],
    [],
    headers,
  ];

  if (rows.length === 0) {
    aoa.push([...Array(colCount).fill('Aucune donnée pour cette période')]);
  } else {
    for (const row of rows) {
      const padded = headers.map((_, i) => cellValue(row[i] ?? ''));
      aoa.push(padded);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs colonnes
  ws['!cols'] = (input.colWidths ?? headers.map(() => 14)).map((wch) => ({ wch }));

  // Fusion titre + sous-titre
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];
  if (rows.length === 0) {
    ws['!merges']!.push({ s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } });
  }

  const headerRow = 3;
  const dataStart = 4;
  const dataEnd = dataStart + Math.max(rows.length, 1) - 1;

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };

      if (r === 0) ws[addr].s = STYLE_TITLE;
      else if (r === 1) ws[addr].s = STYLE_SUB;
      else if (r === headerRow) ws[addr].s = STYLE_HEADER;
      else if (r >= dataStart && rows.length === 0) ws[addr].s = STYLE_EMPTY;
      else if (r >= dataStart) {
        const isLast = input.highlightLastRow && rows.length > 0 && r === dataEnd;
        const base = isLast
          ? STYLE_TOTAL
          : (r - dataStart) % 2 === 0
            ? STYLE_CELL
            : STYLE_CELL_ALT;
        if (typeof ws[addr].v === 'number') {
          const neg = (ws[addr].v as number) < 0;
          ws[addr].s = {
            ...base,
            font: { ...base.font, color: { rgb: neg ? 'DC2626' : (base.font?.color?.rgb ?? '0F172A') } },
            numFmt: '# ##0.00',
          };
          ws[addr].t = 'n';
        } else {
          ws[addr].s = base;
        }
      }
    }
  }

  // Hauteur ligne en-tête
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][headerRow] = { hpt: 22 };

  return ws;
}

export function createWorkbook(sheets: StyledSheetInput[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const safeName = s.sheetName.replace(/[\\/*?:[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, buildStyledSheet(s), safeName);
  }
  return wb;
}

export function downloadExcelWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Page de garde + une feuille de données */
export function exportSingleStyledSheet(
  input: StyledSheetInput,
  filename: string,
): void {
  const cover: StyledSheetInput = {
    sheetName: 'SOMMAIRE',
    documentTitle: 'AFROMONEY — Bureau de change',
    periodLabel: input.documentTitle,
    headers: ['Information', 'Détail'],
    rows: [
      ['Document', input.documentTitle],
      ['Période', input.periodLabel ?? '—'],
      ['Généré le', dayjs().format('DD/MM/YYYY à HH:mm')],
      ['Feuille données', input.sheetName],
      ['Lignes exportées', String(input.rows.length)],
    ],
    colWidths: [28, 48],
  };
  const wb = createWorkbook([cover, input]);
  downloadExcelWorkbook(wb, filename);
}

/* ─── Word (.doc HTML) ─── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadWordReport(opts: {
  title: string;
  subtitle?: string;
  sections: {
    heading: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
  filename: string;
}): void {
  const genAt = dayjs().format('DD/MM/YYYY à HH:mm');
  const tables = opts.sections
    .map((sec) => {
      const head = sec.headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join('');
      const body =
        sec.rows.length === 0
          ? `<tr><td colspan="${sec.headers.length}" style="text-align:center;font-style:italic;color:#64748b;">Aucune donnée</td></tr>`
          : sec.rows
              .map(
                (row, i) =>
                  `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">${sec.headers
                    .map((_, j) => `<td>${escapeHtml(String(row[j] ?? '—'))}</td>`)
                    .join('')}</tr>`,
              )
              .join('');
      return `
        <h2 style="color:#0891b2;border-bottom:2px solid #0891b2;padding-bottom:4px;margin-top:24px;">${escapeHtml(sec.heading)}</h2>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #0f172a; }
  .banner { background: linear-gradient(135deg,#0f172a,#1e293b); color: #fff; padding: 16px 20px; border: 2px solid #0891b2; margin-bottom: 16px; }
  .banner h1 { margin: 0; font-size: 20px; color: #22d3ee; }
  .banner p { margin: 6px 0 0; font-size: 11px; color: #cbd5e1; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { border: 1pt solid #334155; padding: 6px 8px; font-size: 10pt; }
  th { background: #1e293b; color: #fff; font-weight: bold; text-align: center; }
  .footer { margin-top: 24px; font-size: 9pt; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 8px; }
</style>
</head>
<body>
  <div class="banner">
    <h1>AFROMONEY — Bureau de change</h1>
    <p>${escapeHtml(opts.title)}</p>
    <p>${escapeHtml(opts.subtitle ?? '')} · Document généré le ${genAt}</p>
  </div>
  ${tables}
  <p class="footer">Document interne AFROMONEY — Ne pas modifier les montants sans trace audit.</p>
</body>
</html>`;

  const blob = new Blob(['\uFEFF', html], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename.endsWith('.doc') ? opts.filename : `${opts.filename}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

/** En-tête PDF commun (jsPDF) */
export function drawPdfReportHeader(
  doc: import('jspdf').jsPDF,
  title: string,
  subtitle: string,
  yStart = 12,
): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(10, yStart, W - 20, 22, 'F');
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.6);
  doc.rect(10, yStart, W - 20, 22, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(34, 211, 238);
  doc.text('AFROMONEY', 14, yStart + 8);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, yStart + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle, 14, yStart + 19);
  doc.setTextColor(0, 0, 0);
  return yStart + 28;
}

export function drawPdfPageFrame(doc: import('jspdf').jsPDF): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, W - 16, H - 16, 'S');
}
