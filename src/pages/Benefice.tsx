import { useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { useAppData } from '@/hooks/useAppData';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { montantMadComptable } from '@/lib/calculations';
import { fmt } from '@/lib/formatNumbers';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

dayjs.locale('fr');

const MOIS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

type View = 'jour' | 'mois' | 'annee';

function KpiCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
          </div>
          <div className={`rounded-full p-2 ${color.replace('border-l-', 'bg-').replace('-500', '-100')}`}>
            <Icon size={20} className={color.replace('border-l-', 'text-').replace('-500', '-600')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg text-xs space-y-1">
      <p className="font-bold text-zinc-800 mb-1">{label}</p>
      <p className="text-emerald-600">Ventes : {fmt(d.ventes)} MAD</p>
      <p className="text-red-500">Achats : {fmt(d.achats)} MAD</p>
      {d.charges > 0 && <p className="text-zinc-500">Charges : {fmt(d.charges)} MAD</p>}
      <p className={`font-bold border-t border-zinc-100 pt-1 ${d.benefice >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
        Bénéfice : {fmt(d.benefice)} MAD
      </p>
    </div>
  );
};

export function Benefice() {
  const { transactions } = useAppData();
  const [view, setView] = useState<View>('mois');
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().format('YYYY-MM'));

  const txComptables = useMemo(() => filterTransactionsComptables(transactions), [transactions]);

  // ── Données par jour (pour le mois sélectionné) ──
  const dataJour = useMemo(() => {
    const d = dayjs(selectedMonth);
    const nbJours = d.daysInMonth();
    return Array.from({ length: nbJours }, (_, i) => {
      const dateYmd = d.date(i + 1).format('YYYY-MM-DD');
      const txJ = txComptables.filter((t) => dayjs(t.date).format('YYYY-MM-DD') === dateYmd);
      const achats = txJ.filter((t) => t.type === 'ACHAT').reduce((s, t) => s + montantMadComptable(t), 0);
      const ventes = txJ.filter((t) => t.type === 'VENTE').reduce((s, t) => s + montantMadComptable(t), 0);
      const charges = txJ.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + montantMadComptable(t), 0);
      return {
        label: d.date(i + 1).format('DD'),
        fullLabel: d.date(i + 1).locale('fr').format('ddd DD MMM'),
        achats, ventes, charges,
        benefice: ventes - achats - charges,
        nbOps: txJ.length,
      };
    });
  }, [txComptables, selectedMonth]);

  // ── Données par mois (pour l'année sélectionnée) ──
  const dataMois = useMemo(() => {
    return MOIS_FR.map((nom, i) => {
      const txM = txComptables.filter((t) => {
        const d = dayjs(t.date);
        return d.year() === selectedYear && d.month() === i;
      });
      const achats = txM.filter((t) => t.type === 'ACHAT').reduce((s, t) => s + montantMadComptable(t), 0);
      const ventes = txM.filter((t) => t.type === 'VENTE').reduce((s, t) => s + montantMadComptable(t), 0);
      const charges = txM.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + montantMadComptable(t), 0);
      return {
        label: nom.slice(0, 3),
        fullLabel: `${nom} ${selectedYear}`,
        achats, ventes, charges,
        benefice: ventes - achats - charges,
        nbOps: txM.length,
      };
    });
  }, [txComptables, selectedYear]);

  // ── Années disponibles ──
  const years = useMemo(() => {
    const ys = new Set(txComptables.map((t) => dayjs(t.date).year()));
    ys.add(dayjs().year());
    return [...ys].sort((a, b) => b - a);
  }, [txComptables]);

  // ── KPI globaux (année sélectionnée) ──
  const kpi = useMemo(() => {
    const totVentes = dataMois.reduce((s, d) => s + d.ventes, 0);
    const totAchats = dataMois.reduce((s, d) => s + d.achats, 0);
    const totCharges = dataMois.reduce((s, d) => s + d.charges, 0);
    const totBenefice = totVentes - totAchats - totCharges;
    const marge = totVentes > 0 ? (totBenefice / totVentes) * 100 : 0;
    const meilleurMois = [...dataMois].sort((a, b) => b.benefice - a.benefice)[0];
    return { totVentes, totAchats, totCharges, totBenefice, marge, meilleurMois };
  }, [dataMois]);

  const chartData = view === 'jour' ? dataJour : dataMois;
  const hasData = chartData.some((d) => d.nbOps > 0 || d.benefice !== 0);

  return (
    <div>
      <PageHero
        title="Bénéfice"
        subtitle="Total ventes − Total achats − Charges magasin"
      />

      <div className="page-content mx-auto max-w-7xl space-y-6">

        {/* ── Sélecteur année ── */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
            {([
              ['jour', 'Par jour', CalendarDays],
              ['mois', 'Par mois', Calendar],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  view === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {view === 'jour' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MOIS_FR.map((nom, i) => {
                const val = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                return <option key={val} value={val}>{nom} {selectedYear}</option>;
              })}
            </select>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Ventes"
            value={`${fmt(kpi.totVentes)} MAD`}
            sub={`Année ${selectedYear}`}
            color="border-l-emerald-500"
            icon={TrendingUp}
          />
          <KpiCard
            label="Total Achats"
            value={`${fmt(kpi.totAchats)} MAD`}
            sub={`Année ${selectedYear}`}
            color="border-l-red-500"
            icon={TrendingDown}
          />
          <KpiCard
            label="Charges"
            value={`${fmt(kpi.totCharges)} MAD`}
            sub={`Année ${selectedYear}`}
            color="border-l-zinc-500"
            icon={Minus}
          />
          <KpiCard
            label="Bénéfice Net"
            value={`${fmt(kpi.totBenefice)} MAD`}
            sub={`Marge ${kpi.marge.toFixed(1)}%`}
            color={kpi.totBenefice >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}
            icon={BarChart3}
          />
        </div>

        {/* ── Graphique ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-900">
              {view === 'jour'
                ? `Bénéfice journalier — ${MOIS_FR[Number(selectedMonth.split('-')[1]) - 1]} ${selectedYear}`
                : `Bénéfice mensuel — ${selectedYear}`}
            </CardTitle>
            <p className="text-xs text-zinc-400">Bénéfice = Ventes − Achats − Charges</p>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <p className="py-12 text-center text-sm text-zinc-400">Aucune donnée pour cette période.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#d4d4d8" strokeWidth={1.5} />
                  <Bar dataKey="benefice" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.benefice >= 0 ? '#10b981' : '#ef4444'}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Tableau détaillé ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-900">
              Détail {view === 'jour' ? 'journalier' : 'mensuel'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      {view === 'jour' ? 'Jour' : 'Mois'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">Ventes (MAD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-red-500">Achats (MAD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Charges</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600">Bénéfice</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Marge %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Nb ops</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, i) => {
                    const marge = row.ventes > 0 ? (row.benefice / row.ventes) * 100 : 0;
                    const hasOps = row.nbOps > 0 || Math.abs(row.benefice) > 0;
                    if (!hasOps) return (
                      <tr key={i} className={`border-b border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}>
                        <td className="px-4 py-2 text-xs text-zinc-500">{row.fullLabel}</td>
                        <td colSpan={6} className="px-4 py-2 text-center text-xs text-zinc-300">—</td>
                      </tr>
                    );
                    return (
                      <tr key={i} className={`border-b border-zinc-100 ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'} hover:bg-blue-50/40 transition-colors`}>
                        <td className="px-4 py-2.5 text-xs font-medium text-zinc-700">{row.fullLabel}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-emerald-700">{fmt(row.ventes)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-red-600">{fmt(row.achats)}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-500">{row.charges > 0 ? fmt(row.charges) : '—'}</td>
                        <td className={`px-4 py-2.5 text-right text-xs font-bold tabular-nums ${row.benefice >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {fmt(row.benefice)}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${marge >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {marge.toFixed(1)} %
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-400">{row.nbOps}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Ligne totaux */}
                <tfoot>
                  <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold">
                    <td className="px-4 py-3 text-xs font-bold text-zinc-700">
                      TOTAL {selectedYear}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-emerald-700">{fmt(kpi.totVentes)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-red-600">{fmt(kpi.totAchats)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-zinc-500">{fmt(kpi.totCharges)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold tabular-nums ${kpi.totBenefice >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(kpi.totBenefice)}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-bold tabular-nums ${kpi.marge >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {kpi.marge.toFixed(1)} %
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-zinc-500">
                      {dataMois.reduce((s, d) => s + d.nbOps, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Meilleur mois ── */}
        {kpi.meilleurMois && kpi.meilleurMois.nbOps > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-bold text-emerald-800">
              🏆 Meilleur mois : {kpi.meilleurMois.fullLabel}
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              Bénéfice : <span className="font-bold">{fmt(kpi.meilleurMois.benefice)} MAD</span>
              {' · '}Ventes : {fmt(kpi.meilleurMois.ventes)} MAD
              {' · '}Achats : {fmt(kpi.meilleurMois.achats)} MAD
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
