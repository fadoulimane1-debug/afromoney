import { useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Download,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  Percent,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppData } from '@/hooks/useAppData';
import { buildBilanAnnuelV8, type BilanMensuelV8Row } from '@/lib/bilanV8';
import {
  buildPivotMatrix,
  filterTransactionsForReport,
  type JourFilter,
} from '@/lib/pivotReport';
import { calculRapportPourListe } from '@/lib/calculations';
import { TYPE_OPERATION_LABEL } from '@/lib/constants';
import { exportToExcel6Sheets } from '@/lib/excelExport';
import { downloadJournalCompta, downloadJournalComptaExcel } from '@/lib/comptaExport';
import {
  exportSingleStyledSheet,
  downloadWordReport,
  drawPdfReportHeader,
  drawPdfPageFrame,
} from '@/lib/exportStyled';
import { getTransactions } from '@/lib/storage';
import { fmt, fmtPct, fmtNumber } from '@/lib/formatNumbers';

dayjs.locale('fr');

/* ─── Helpers ─── */

function fmtZero(n: number, dec = 2): string {
  return n === 0 ? '—' : fmtNumber(n, dec);
}

const PIE_COLORS = ['#ef4444', '#10b981', '#0ea5e9', '#f97316', '#71717a'];
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/* ─── Tooltip recharts custom ─── */

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xl text-xs">
      <p className="mb-1.5 font-bold text-zinc-800">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1" style={{ color: entry.color }}>
            ● {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-zinc-900">
            {fmt(entry.value)} MAD
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Export helpers ─── */

function pdfBody(rows: BilanMensuelV8Row[], total: ReturnType<typeof computeTotal>) {
  const toRow = (r: BilanMensuelV8Row | typeof total, label: string) => [
    label,
    fmtNumber(r.achatsMad),
    fmtNumber(r.ventesMad),
    fmtNumber(r.depotsMad),
    fmtNumber(r.retraitsMad),
    fmtNumber(r.chargesMad),
    fmtNumber(r.benefice),
    r.ventesMad > 0 ? fmtPct((r.benefice / r.ventesMad) * 100) : '—',
    String(r.nbOps),
  ];
  return [
    ...rows.map((r) => toRow(r, r.label)),
    toRow(total, 'TOTAL'),
  ];
}

/* ─── Totals computation ─── */

function computeTotal(rows: BilanMensuelV8Row[]) {
  const achatsMad  = rows.reduce((s, r) => s + r.achatsMad, 0);
  const ventesMad  = rows.reduce((s, r) => s + r.ventesMad, 0);
  const depotsMad  = rows.reduce((s, r) => s + r.depotsMad, 0);
  const retraitsMad = rows.reduce((s, r) => s + r.retraitsMad, 0);
  const chargesMad = rows.reduce((s, r) => s + r.chargesMad, 0);
  const benefice   = rows.reduce((s, r) => s + r.benefice, 0);
  const nbOps      = rows.reduce((s, r) => s + r.nbOps, 0);
  return { achatsMad, ventesMad, depotsMad, retraitsMad, chargesMad, benefice, nbOps };
}

/* ─── PivotSection ─── */

function fmtPivotCell(value: number, dec = 2): string {
  if (value === 0) return '';
  return fmtNumber(value, dec);
}

function PivotSection({
  title,
  subtitle,
  pivot,
  decimals,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  pivot: ReturnType<typeof buildPivotMatrix>;
  decimals: number;
  emptyHint: string;
}) {
  const { types, devises, get, rowTotal, colTotal, grandTotal } = pivot;
  if (devises.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        <p className="mt-4 text-sm text-zinc-400">{emptyHint}</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto p-2 sm:p-4">
        <Table className="min-w-max text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 min-w-[140px] bg-zinc-50 font-semibold text-zinc-800">
                Type
              </TableHead>
              {devises.map((d) => (
                <TableHead key={d} className="text-right font-semibold text-zinc-800">
                  {d}
                </TableHead>
              ))}
              <TableHead className="text-right font-semibold text-zinc-900">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t}>
                <TableCell className="sticky left-0 z-10 bg-white font-medium text-zinc-900 shadow-[1px_0_0_0_#e4e4e7]">
                  {TYPE_OPERATION_LABEL[t]}
                </TableCell>
                {devises.map((d) => (
                  <TableCell key={d} className="text-right tabular-nums text-zinc-700">
                    {fmtPivotCell(get(t, d), decimals)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold tabular-nums text-zinc-900">
                  {fmtPivotCell(rowTotal(t), decimals)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-zinc-50 font-semibold hover:bg-zinc-50">
              <TableCell className="sticky left-0 z-10 bg-zinc-50 font-semibold text-zinc-900 shadow-[1px_0_0_0_#e4e4e7]">
                Total général
              </TableCell>
              {devises.map((d) => (
                <TableCell key={d} className="text-right tabular-nums text-zinc-900">
                  {fmtPivotCell(colTotal(d), decimals)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-zinc-950">
                {fmtPivotCell(grandTotal, decimals)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Page principale
═══════════════════════════════════════════════ */

export function Reports() {
  const { transactions } = useAppData();

  /* ── Sélecteurs ── */
  const [bilanYear, setBilanYear]   = useState(() => dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [jourFilter, setJourFilter] = useState<JourFilter>('all');

  const yearOptions = useMemo(() => [0, 1, 2].map((o) => dayjs().year() - o), []);
  const monthOptions = useMemo(
    () => [
      { value: '', label: 'Toutes les périodes' },
      ...Array.from({ length: 12 }, (_, i) => {
        const m = dayjs().subtract(i, 'month').format('YYYY-MM');
        return { value: m, label: dayjs(m).format('MMMM YYYY') };
      }),
    ],
    []
  );

  /* ── Bilan annuel V8 ── */
  const bilanRows = useMemo(
    () => buildBilanAnnuelV8(transactions, bilanYear),
    [transactions, bilanYear]
  );

  const bilanTotal = useMemo(() => computeTotal(bilanRows), [bilanRows]);

  /* ── KPI année ── */
  const yearKpi = useMemo(() => {
    const beneficeBrut = bilanTotal.ventesMad - bilanTotal.achatsMad;
    const marge = bilanTotal.ventesMad > 0
      ? (bilanTotal.benefice / bilanTotal.ventesMad) * 100
      : 0;
    return { ...bilanTotal, beneficeBrut, marge };
  }, [bilanTotal]);

  /* ── Données graphiques ── */
  const chartData = useMemo(
    () =>
      bilanRows.map((r, i) => ({
        mois: MOIS_COURTS[i] ?? r.label.substring(0, 3),
        achats: r.achatsMad,
        ventes: r.ventesMad,
        benefice: r.benefice,
        charges: r.chargesMad,
      })),
    [bilanRows]
  );

  const pieData = useMemo(
    () =>
      [
        { name: 'Achats',   value: bilanTotal.achatsMad,   color: PIE_COLORS[0] },
        { name: 'Ventes',   value: bilanTotal.ventesMad,   color: PIE_COLORS[1] },
        { name: 'Dépôts',   value: bilanTotal.depotsMad,   color: PIE_COLORS[2] },
        { name: 'Retraits', value: bilanTotal.retraitsMad, color: PIE_COLORS[3] },
        { name: 'Charges',  value: bilanTotal.chargesMad,  color: PIE_COLORS[4] },
      ].filter((d) => d.value > 0),
    [bilanTotal]
  );

  /* ── Pivot TCD (filtre période) ── */
  const filteredForPivot = useMemo(
    () => filterTransactionsForReport(transactions, selectedMonth, jourFilter),
    [transactions, selectedMonth, jourFilter]
  );

  const reportPeriode = useMemo(() => {
    const label = selectedMonth ? dayjs(selectedMonth).format('MMMM YYYY') : 'Toutes périodes';
    const jourBit = jourFilter === 'all' ? '' : ` · jour ${jourFilter}`;
    return calculRapportPourListe(filteredForPivot, `${label}${jourBit}`);
  }, [filteredForPivot, selectedMonth, jourFilter]);

  const pivotDevise = useMemo(() => buildPivotMatrix(filteredForPivot, 'montant'), [filteredForPivot]);
  const pivotMAD    = useMemo(() => buildPivotMatrix(filteredForPivot, 'montantMAD'), [filteredForPivot]);

  /* ── Exports ── */
  function exportExcel() {
    const headers = [
      'Mois',
      'Achats (MAD)',
      'Ventes (MAD)',
      'Dépôts',
      'Retraits',
      'Charges',
      'Bénéfice net',
      'Marge %',
      'Opérations',
    ];
    const rows = [
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
        `TOTAL ${bilanYear}`,
        bilanTotal.achatsMad,
        bilanTotal.ventesMad,
        bilanTotal.depotsMad,
        bilanTotal.retraitsMad,
        bilanTotal.chargesMad,
        bilanTotal.benefice,
        bilanTotal.ventesMad > 0 ? (bilanTotal.benefice / bilanTotal.ventesMad) * 100 : 0,
        bilanTotal.nbOps,
      ],
    ];
    exportSingleStyledSheet(
      {
        sheetName: `Bilan ${bilanYear}`,
        documentTitle: `Bilan annuel ${bilanYear}`,
        periodLabel: selectedMonth ? dayjs(selectedMonth).format('MMMM YYYY') : 'Année complète',
        headers,
        rows,
        highlightLastRow: true,
        colWidths: [16, 13, 13, 12, 12, 12, 14, 9, 11],
      },
      `bilan_afromoney_${bilanYear}.xlsx`,
    );
  }

  function exportWord() {
    downloadWordReport({
      title: `Bilan AFROMONEY ${bilanYear}`,
      subtitle: selectedMonth ? dayjs(selectedMonth).format('MMMM YYYY') : 'Synthèse annuelle',
      sections: [
        {
          heading: 'Bilan mensuel',
          headers: [
            'Mois',
            'Achats',
            'Ventes',
            'Dépôts',
            'Retraits',
            'Charges',
            'Bénéfice',
            'Marge %',
            'Ops',
          ],
          rows: [
            ...bilanRows.map((r) => [
              r.label,
              fmt(r.achatsMad),
              fmt(r.ventesMad),
              fmt(r.depotsMad),
              fmt(r.retraitsMad),
              fmt(r.chargesMad),
              fmt(r.benefice),
              fmtPct(r.margePercent),
              r.nbOps,
            ]),
            [
              `TOTAL ${bilanYear}`,
              fmt(bilanTotal.achatsMad),
              fmt(bilanTotal.ventesMad),
              fmt(bilanTotal.depotsMad),
              fmt(bilanTotal.retraitsMad),
              fmt(bilanTotal.chargesMad),
              fmt(bilanTotal.benefice),
              bilanTotal.ventesMad > 0
                ? fmtPct((bilanTotal.benefice / bilanTotal.ventesMad) * 100)
                : '—',
              bilanTotal.nbOps,
            ],
          ],
        },
      ],
      filename: `bilan_afromoney_${bilanYear}.doc`,
    });
  }

  function exportExcel6() {
    let m = dayjs().month();
    let y = dayjs().year();
    if (selectedMonth) {
      const d = dayjs(selectedMonth);
      m = d.month();
      y = d.year();
    }
    exportToExcel6Sheets(m, y);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    drawPdfPageFrame(doc);
    const startY = drawPdfReportHeader(
      doc,
      `Bilan AFROMONEY — ${bilanYear}`,
      `Achats ${fmt(bilanTotal.achatsMad)} MAD · Ventes ${fmt(bilanTotal.ventesMad)} MAD · Bénéfice ${fmt(bilanTotal.benefice)} MAD · ${dayjs().format('DD/MM/YYYY HH:mm')}`,
    );

    autoTable(doc, {
      startY,
      margin: { left: 12, right: 12 },
      head: [['Mois', 'Achats', 'Ventes', 'Dépôts', 'Retraits', 'Charges', 'Bénéfice', 'Marge %', 'Ops']],
      body: pdfBody(bilanRows, bilanTotal),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [51, 65, 85], lineWidth: 0.2 },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [51, 65, 85],
      tableLineWidth: 0.25,
      didParseCell: (data) => {
        if (data.row.index === bilanRows.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 232, 240];
        }
        const val = parseFloat(String(data.cell.raw));
        if (!isNaN(val) && val < 0 && data.section === 'body') {
          data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`AFROMONEY — Page ${p}/${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6, {
        align: 'right',
      });
    }

    doc.save(`bilan_afromoney_${bilanYear}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  /* ── Render ── */

  const kpiItems = [
    {
      label: 'Transactions',
      value: yearKpi.nbOps,
      suffix: '',
      icon: Activity,
      color: 'text-zinc-900',
      bg: 'bg-zinc-50',
    },
    {
      label: 'Total achats',
      value: fmt(yearKpi.achatsMad),
      suffix: ' MAD',
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Total ventes',
      value: fmt(yearKpi.ventesMad),
      suffix: ' MAD',
      icon: TrendingUp,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: 'Bénéfice brut',
      value: fmt(yearKpi.beneficeBrut),
      suffix: ' MAD',
      icon: TrendingUp,
      color: yearKpi.beneficeBrut >= 0 ? 'text-emerald-700' : 'text-red-600',
      bg: yearKpi.beneficeBrut >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Charges',
      value: fmt(yearKpi.chargesMad),
      suffix: ' MAD',
      icon: TrendingDown,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Bénéfice net',
      value: fmt(yearKpi.benefice),
      suffix: ' MAD',
      icon: TrendingUp,
      color: yearKpi.benefice >= 0 ? 'text-emerald-700' : 'text-red-600',
      bg: yearKpi.benefice >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Marge',
      value: fmtPct(yearKpi.marge),
      suffix: ' %',
      icon: Percent,
      color: yearKpi.marge >= 0 ? 'text-violet-700' : 'text-red-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div>
      <PageHero
        title="Bilan & TCD"
        subtitle="Formules V8 : Bénéfice = Ventes − Achats − Charges · Marge = Bénéfice / Ventes × 100"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-white/80">
              Année
              <select
                value={bilanYear}
                onChange={(e) => setBilanYear(Number(e.target.value))}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-slate-800">{y}</option>
                ))}
              </select>
            </label>
            <button className="btn-gradient flex items-center gap-1.5" onClick={exportExcel}>
              <FileSpreadsheet size={13} /> Excel (bilan)
            </button>
            <button className="btn-gradient flex items-center gap-1.5" onClick={exportExcel6}>
              <FileSpreadsheet size={13} /> Excel 6 feuilles
            </button>
            <button className="btn-glass flex items-center gap-1.5" onClick={exportWord}>
              <Download size={13} /> Word
            </button>
            <button className="btn-gradient flex items-center gap-1.5" onClick={exportPDF}>
              <Download size={13} /> PDF
            </button>
            <button className="btn-gradient flex items-center gap-1.5" onClick={handlePrint}>
              <Printer size={13} /> Imprimer
            </button>
            <button
              type="button"
              className="btn-gradient flex items-center gap-1.5"
              onClick={() => downloadJournalComptaExcel(getTransactions())}
              title="Journal comptable avec en-tête et tableaux cadrés"
            >
              <FileSpreadsheet size={13} /> Journal compta (Excel)
            </button>
            <button
              type="button"
              className="btn-glass flex items-center gap-1.5"
              onClick={() => downloadJournalCompta(getTransactions())}
              title="Export CSV séparateur point-virgule"
            >
              <Download size={13} /> Journal compta (CSV)
            </button>
          </>
        }
      />

      <div className="page-content space-y-8">
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {kpiItems.map(({ label, value, suffix, icon: Icon, color, bg }) => (
          <Card key={label} className={`border-zinc-200 shadow-sm ${bg}`}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <Icon size={10} className={color} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className={`text-base font-bold tabular-nums ${color}`}>
                {value}
                <span className="text-xs font-normal">{suffix}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Graphiques ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Line chart: bénéfice net */}
        <Card className="border-zinc-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">
              Évolution bénéfice net — {bilanYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(v) => fmt(v, 0)} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="#e4e4e7" strokeDasharray="4 2" />
                <Line
                  type="monotone"
                  dataKey="benefice"
                  name="Bénéfice net"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart: répartition types */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">
              Répartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
                Aucune donnée pour {bilanYear}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      fmt(typeof value === 'number' ? value : Number(value ?? 0)) + ' MAD',
                      '',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart: achats vs ventes */}
        <Card className="border-zinc-200 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">
              Achats vs Ventes par mois — {bilanYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(v) => fmt(v, 0)} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="achats" name="Achats" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={28} />
                <Bar dataKey="ventes" name="Ventes" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={28} />
                <Bar dataKey="charges" name="Charges" fill="#71717a" radius={[2, 2, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Tableau bilan mensuel ── */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm print:shadow-none">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Bilan mensuel AFROMONEY V8 — {bilanYear}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Formule : Bénéfice = Ventes − Achats − Charges · Marge = Bénéfice / Ventes × 100
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-max text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-zinc-50/80">
                <TableHead className="sticky left-0 z-10 min-w-[130px] bg-zinc-50 font-semibold text-zinc-800">
                  Mois
                </TableHead>
                <TableHead className="text-right font-semibold text-red-700">Achats (MAD)</TableHead>
                <TableHead className="text-right font-semibold text-teal-700">Ventes (MAD)</TableHead>
                <TableHead className="text-right font-semibold text-sky-700">Dépôts</TableHead>
                <TableHead className="text-right font-semibold text-orange-700">Retraits</TableHead>
                <TableHead className="text-right font-semibold text-zinc-600">Charges</TableHead>
                <TableHead className="text-right font-semibold text-zinc-800">Bénéfice</TableHead>
                <TableHead className="text-right font-semibold text-violet-700">Marge %</TableHead>
                <TableHead className="text-right font-semibold text-zinc-700">Nb ops</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {bilanRows.map((row, i) => {
                const isEven = i % 2 === 0;
                const hasData = row.nbOps > 0;
                return (
                  <TableRow
                    key={row.monthIndex}
                    className={`${isEven ? 'bg-white' : 'bg-zinc-50/40'} ${!hasData ? 'opacity-50' : ''}`}
                  >
                    <TableCell className="sticky left-0 z-10 bg-inherit font-medium text-zinc-900 shadow-[1px_0_0_0_#e4e4e7]">
                      {row.label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">
                      {fmtZero(row.achatsMad)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-teal-700">
                      {fmtZero(row.ventesMad)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sky-700">
                      {fmtZero(row.depotsMad)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-orange-700">
                      {fmtZero(row.retraitsMad)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600">
                      {fmtZero(row.chargesMad)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        row.benefice > 0
                          ? 'text-emerald-700'
                          : row.benefice < 0
                          ? 'text-red-600'
                          : 'text-zinc-400'
                      }`}
                    >
                      {fmtZero(row.benefice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-violet-700">
                      {row.ventesMad > 0 ? fmtPct(row.margePercent) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-zinc-700">
                      {row.nbOps > 0 ? row.nbOps : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            {/* ── Ligne TOTAL ── */}
            <tfoot>
              <tr className="border-t-2 border-zinc-300 bg-zinc-100">
                <td className="sticky left-0 z-10 bg-zinc-100 px-4 py-3 text-xs font-bold text-zinc-900 shadow-[1px_0_0_0_#d1d5db]">
                  TOTAL {bilanYear}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-red-700">
                  {fmt(bilanTotal.achatsMad)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-teal-700">
                  {fmt(bilanTotal.ventesMad)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-sky-700">
                  {fmt(bilanTotal.depotsMad)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-orange-700">
                  {fmt(bilanTotal.retraitsMad)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-zinc-700">
                  {fmt(bilanTotal.chargesMad)}
                </td>
                <td
                  className={`px-4 py-3 text-right text-xs font-bold tabular-nums ${
                    bilanTotal.benefice >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {fmt(bilanTotal.benefice)}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-violet-700">
                  {bilanTotal.ventesMad > 0
                    ? fmtPct((bilanTotal.benefice / bilanTotal.ventesMad) * 100)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs font-bold text-zinc-900">
                  {bilanTotal.nbOps}
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </section>

      {/* ── TCD / Tableaux croisés dynamiques ── */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Filtres TCD
          </span>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <span className="whitespace-nowrap text-xs">Période</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {monthOptions.map((m) => (
                <option key={m.value || 'all'} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <span className="whitespace-nowrap text-xs">Jour</span>
            <select
              value={jourFilter === 'all' ? 'all' : String(jourFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setJourFilter(v === 'all' ? 'all' : Number(v));
              }}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tous</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((j) => (
                <option key={j} value={String(j)}>{j}</option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-zinc-400">
            {filteredForPivot.length} transaction{filteredForPivot.length !== 1 ? 's' : ''}
            · Bénéfice net :{' '}
            <span className={reportPeriode.beneficeNet >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
              {fmt(reportPeriode.beneficeNet)} MAD
            </span>
          </span>
        </div>

        <PivotSection
          title="TCD · Montants en devise"
          subtitle="Somme des montants saisis par type d'opération et par devise."
          pivot={pivotDevise}
          decimals={2}
          emptyHint="Aucune transaction pour ces filtres."
        />
        <PivotSection
          title="TCD · Sommes en MAD"
          subtitle="Somme des montants MAD par type et par devise d'origine."
          pivot={pivotMAD}
          decimals={2}
          emptyHint="Aucune transaction pour ces filtres."
        />
      </div>
      </div>{/* end page-content */}
    </div>
  );
}
