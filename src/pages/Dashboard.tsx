import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import {
  Wallet, Package, Send, TrendingUp, Percent,
  Plus, BarChart2, RefreshCw, ArrowRight, Banknote, FileText,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getTransactions,
  getExchangeRates,
  calculateCaisse,
  getLastClosure,
  getClosureByDate,
  calculateDailyClosure,
} from '@/lib/storage';
import { generateSynthesePDF } from '@/lib/synthesePDF';
import type { DailyClosure } from '@/types';
import { summarizeCaisseJourV8 } from '@/lib/bilanV8';
import { calculRapportMensuel } from '@/lib/calculations';
import type { Transaction } from '@/types';
import { RatesBadge } from '@/components/RatesBadge';
import { AlertsPanel } from '@/components/AlertsPanel';
import { CoherenceAuditPanel } from '@/components/CoherenceAuditPanel';
import { calculStock } from '@/lib/calculations';
import { fmtMad, fmtPct, fmtCompactK } from '@/lib/formatNumbers';

dayjs.locale('fr');

// ─── helpers ────────────────────────────────────────────────────────────────

function calcStockTotal(transactions: Transaction[]): number {
  const rates = getExchangeRates();
  return calculStock(transactions, rates).reduce((s, st) => s + st.valeurMAD, 0);
}

function buildCaisseHistory(transactions: Transaction[]): { label: string; caisse: number }[] {
  const days = Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day'));
  return days.map((day) => {
    const txUntilDay = transactions.filter((t) => dayjs(t.date).isBefore(day.endOf('day')));
    const caisse = txUntilDay.reduce((acc, t) => {
      if (t.type === 'DEPOT')    return acc + t.montantMAD;
      if (t.type === 'RETRAIT')  return acc - t.montantMAD;
      if (t.type === 'CHARGES')  return acc - t.montantMAD;
      return acc;
    }, 0);
    return { label: day.format('ddd D'), caisse };
  });
}

function buildTopDevises(transactions: Transaction[]): { devise: string; volume: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'ACHAT' && t.type !== 'VENTE') continue;
    map.set(t.devise, (map.get(t.devise) ?? 0) + t.montantMAD);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([devise, volume]) => ({ devise, volume }));
}

const STATUT_STYLE: Record<string, string> = {
  'PAYÉ':      'bg-green-500/15 text-green-400',
  'CRÉDIT':    'bg-yellow-500/15 text-yellow-400',
  'NON-PAYÉ':  'bg-red-500/15 text-red-400',
};

const TYPE_STYLE: Record<string, string> = {
  ACHAT:    'text-blue-400',
  VENTE:    'text-green-400',
  DEPOT:    'text-purple-400',
  RETRAIT:  'text-orange-400',
  CHARGES:  'text-red-400',
};

// ─── KPI card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ElementType;
  gradient: string;
  ring: string;
}

function KpiCard({ label, value, sub, Icon, gradient, ring }: KpiCardProps) {
  return (
    <div
      className={`kpi-card group relative p-5 ${ring}`}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-600">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gradient} ring-1 shadow-sm ${ring}`}>
          <Icon size={18} className="text-zinc-800" />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [lastClosureBalance, setLastClosureBalance] = useState<number | null>(null);
  const [todayClosure, setTodayClosure] = useState<DailyClosure | null>(null);
  const [rapportPdfLoading, setRapportPdfLoading] = useState(false);
  useEffect(() => {
    const sync = () => {
      const lc = getLastClosure();
      setLastClosureBalance(lc ? lc.finalBalanceMAD : null);
      const todayStr = dayjs().format('YYYY-MM-DD');
      setTodayClosure(getClosureByDate(todayStr) ?? null);
    };
    sync();
    window.addEventListener('afromoney-data', sync);
    return () => window.removeEventListener('afromoney-data', sync);
  }, [tick]);

  const transactions = useMemo(() => {
    void tick;
    return getTransactions();
  }, [tick]);

  const report = useMemo(() => {
    void tick;
    const d = dayjs();
    return calculRapportMensuel(transactions, d.format('YYYY-MM'));
  }, [tick, transactions]);
  const caisse        = useMemo(() => {
    void tick;
    return calculateCaisse();
  }, [tick]);
  const stockTotal    = useMemo(() => calcStockTotal(transactions), [transactions]);
  const caisseHistory = useMemo(() => buildCaisseHistory(transactions), [transactions]);
  const topDevises    = useMemo(() => buildTopDevises(transactions), [transactions]);
  const caisseJour    = useMemo(
    () => summarizeCaisseJourV8(transactions, dayjs()),
    [transactions]
  );

  const txMois = useMemo(() => {
    void tick;
    const d = dayjs();
    const month = d.month() + 1;
    const year = d.year();
    return transactions
      .filter((t) => {
        const td = dayjs(t.date);
        return td.month() + 1 === month && td.year() === year;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions, tick]);

  const now = dayjs();

  const handleRapportPDF = async () => {
    const todayStr = now.format('YYYY-MM-DD');
    const closure =
      todayClosure ?? getClosureByDate(todayStr) ?? calculateDailyClosure(todayStr);
    setRapportPdfLoading(true);
    try {
      const txs = transactions.filter(
        (t) => dayjs(t.date).format('YYYY-MM-DD') === closure.date,
      );
      await generateSynthesePDF({
        closure,
        transactionsDay: txs,
        totalVentes: report.totalVentes,
        totalAchats: report.totalAchats,
        chargesAgence: report.chargesAgence,
        beneficeNet: report.beneficeNet,
        margePercent: report.margePercent,
        nbTransactionsMois: report.nbTransactions,
        caisseMad: caisse,
        stockTotalMad: stockTotal,
        caisseJour,
        lastClosureBalance,
      });
    } finally {
      setRapportPdfLoading(false);
    }
  };

  const kpis: KpiCardProps[] = [
    {
      label: 'Caisse Totale (MAD)',
      value: `${fmtMad(caisse)} MAD`,
      Icon: Wallet,
      gradient: 'bg-gradient-to-br from-blue-600/20 to-blue-800/10',
      ring: 'ring-blue-500/20',
    },
    {
      label: 'Stock Total (Valeur MAD)',
      value: `${fmtMad(stockTotal)} MAD`,
      Icon: Package,
      gradient: 'bg-gradient-to-br from-emerald-600/20 to-emerald-800/10',
      ring: 'ring-emerald-500/20',
    },
    {
      label: 'Transactions (Ce mois)',
      value: String(report.nbTransactions),
      sub: now.format('MMMM YYYY'),
      Icon: Send,
      gradient: 'bg-gradient-to-br from-violet-600/20 to-violet-800/10',
      ring: 'ring-violet-500/20',
    },
    {
      label: 'Bénéfice (Ce mois)',
      value: `${fmtMad(report.beneficeNet)} MAD`,
      sub: `Ventes ${fmtMad(report.totalVentes)} − Achats ${fmtMad(report.totalAchats)} − Charges ${fmtMad(report.chargesAgence)}`,
      Icon: TrendingUp,
      gradient: 'bg-gradient-to-br from-orange-600/20 to-orange-800/10',
      ring: 'ring-orange-500/20',
    },
    {
      label: 'Marge Brute (%)',
      value: fmtPct(report.margePercent),
      sub: `Ventes: ${fmtMad(report.totalVentes)} MAD`,
      Icon: Percent,
      gradient: 'bg-gradient-to-br from-pink-600/20 to-pink-800/10',
      ring: 'ring-pink-500/20',
    },
  ];

  return (
    <div className="dashboard-root">
      <PageHero
        title="Synthèse"
        subtitle={`${now.format('dddd D MMMM YYYY')} — vue d'ensemble des indicateurs AFROMONEY`}
        tall
        actions={
          <>
            <RatesBadge compact />
            <button className="btn-gradient flex items-center gap-1.5" onClick={refresh}>
              <RefreshCw size={14} /> Actualiser
            </button>
            <button
              className="btn-glass flex items-center gap-1.5"
              onClick={() => navigate('/transactions')}
            >
              <Plus size={14} /> Nouvelle transaction
            </button>
            <button
              type="button"
              className="btn-glass flex items-center gap-1.5 disabled:opacity-50"
              onClick={handleRapportPDF}
              disabled={rapportPdfLoading}
              title="Rapport PDF Synthèse — 4 pages cadrées (indicateurs, clôture, opérations)"
            >
              {rapportPdfLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              📄 Rapport Synthèse PDF
            </button>
          </>
        }
      />

      <div className="page-content space-y-6">
      <Card className="border-zinc-200/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-900">Alertes métier</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsPanel max={8} />
        </CardContent>
      </Card>

      <CoherenceAuditPanel />

      {/* ── Alerte clôture du jour (brouillon auto ≠ clôture validée) ── */}
      {todayClosure && todayClosure.status === 'VALIDATED' && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/90 px-5 py-3 backdrop-blur-sm">
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700">
              Clôture d'aujourd'hui validée
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">
              Statut : {todayClosure.status} · Responsable : {todayClosure.manager ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/clotures-history')}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white/70 px-4 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            Historique clôtures →
          </button>
        </div>
      )}
      {todayClosure && todayClosure.status === 'ERROR' && (
        <div className="flex items-center gap-4 rounded-xl border-2 border-red-300 bg-red-50/90 px-5 py-4 backdrop-blur-sm">
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">Écart sur la clôture du jour</p>
            <p className="mt-0.5 text-xs text-red-600">
              Corrigez le solde réel ou complétez la validation depuis la page Clôture.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/cloture')}
            className="shrink-0 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
          >
            Corriger →
          </button>
        </div>
      )}
      {(!todayClosure || (todayClosure.status !== 'VALIDATED' && todayClosure.status !== 'ERROR')) && (
        <div className="flex items-center gap-4 rounded-xl border-2 border-amber-300 bg-amber-50/90 px-5 py-4 backdrop-blur-sm">
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Clôture journalière à finaliser</p>
            <p className="mt-0.5 text-xs text-amber-800">
              La journée doit être contrôlée et signée par le responsable (aligné feuille « CLÔTURES » Excel).
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/cloture')}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700"
          >
            Accéder à la clôture →
          </button>
        </div>
      )}
      {/* ── Héritage J-1 ── */}
      {lastClosureBalance !== null && (
        <div className="flex items-center gap-4 rounded-xl border border-amber-200/60 bg-amber-50/90 px-5 py-3 backdrop-blur-sm">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Solde hérité de la dernière clôture
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-800">
              {fmtMad(lastClosureBalance)} <span className="text-sm font-normal">MAD</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/cloture')}
            className="shrink-0 rounded-lg border border-amber-300 bg-white/70 px-4 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            Nouvelle clôture →
          </button>
        </div>
      )}
      {/* ── KPI grid ── */}
      <div className="kpi-stagger grid grid-cols-2 gap-4 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* ── Caisse journée V8 (feuille CAISSE — colonne droite) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Caisse journalière — alignée AFROMONEY V8</CardTitle>
          <p className="text-xs text-zinc-500">{caisseJour.dateLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total achats', value: fmtMad(caisseJour.totalAchatsMad), bold: false },
              { label: 'Total ventes', value: fmtMad(caisseJour.totalVentesMad), bold: false },
              { label: 'Total dépôts', value: fmtMad(caisseJour.totalDepotsMad), bold: false },
              { label: 'Total retraits', value: fmtMad(caisseJour.totalRetraitsMad), bold: false },
              { label: 'Crédits accordés', value: fmtMad(caisseJour.creditsAccordesMad), bold: false },
              { label: 'Bénéfice estimé', value: fmtMad(caisseJour.beneficeEstime), bold: true },
            ].map((cell) => (
              <div key={cell.label} className="rounded-xl border border-white/30 bg-white/45 px-3 py-2 shadow-sm backdrop-blur-md transition-colors hover:border-cyan-300/40">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{cell.label}</p>
                <p className={`mt-0.5 text-sm tabular-nums ${cell.bold ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-800'}`}>
                  {cell.value} <span className="text-[10px] font-normal text-zinc-500">MAD</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Boutons rapides ── */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/caisse')}
          className="gap-1.5"
        >
          <Banknote size={13} /> Caisse du jour
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/transactions')}
          className="gap-1.5"
        >
          <Plus size={13} /> Nouvelle transaction
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/stock')}
          className="gap-1.5"
        >
          <Package size={13} /> Voir le stock
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/reports')}
          className="gap-1.5"
        >
          <BarChart2 size={13} /> Rapports
        </Button>
      </div>

      {/* ── Graphiques ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Line chart — évolution caisse */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Évolution caisse — 7 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            {caisseHistory.every((d) => d.caisse === 0) ? (
              <p className="py-8 text-center text-sm text-zinc-600">Aucune donnée disponible</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={caisseHistory} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={60}
                    tickFormatter={(v) => fmtCompactK(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ color: '#3f3f46' }}
                    formatter={(v) => [`${fmtMad(Number(v))} MAD`, 'Caisse']}
                  />
                  <Line type="monotone" dataKey="caisse" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart — top devises */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 5 devises par volume (MAD)</CardTitle>
          </CardHeader>
          <CardContent>
            {topDevises.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-600">Aucune donnée disponible</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topDevises} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="devise" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={60}
                    tickFormatter={(v) => fmtCompactK(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ color: '#3f3f46' }}
                    formatter={(v) => [`${fmtMad(Number(v))} MAD`, 'Volume']}
                  />
                  <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dernières transactions ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Transactions du mois ({txMois.length > 0 ? `${txMois.length} affichée${txMois.length > 1 ? 's' : ''}` : 'aucune'})
            </CardTitle>
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-xs text-blue-600 transition-colors hover:text-blue-700"
            >
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txMois.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-600">
              Aucune transaction ce mois-ci
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    {['Date', 'Employé', 'Type', 'Devise', 'Montant MAD', 'Statut'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txMois.map((tx) => (
                    <tr key={tx.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50">
                      <td className="px-4 py-2.5 text-xs text-zinc-600">{dayjs(tx.date).format('DD/MM/YY HH:mm')}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-800">{tx.employeId}</td>
                      <td className={`px-4 py-2.5 text-xs font-semibold ${TYPE_STYLE[tx.type] ?? 'text-zinc-800'}`}>{tx.type}</td>
                      <td className="px-4 py-2.5 text-xs font-medium text-zinc-800">{tx.devise}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-zinc-900">{fmtMad(tx.montantMAD)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[tx.statut] ?? ''}`}>
                          {tx.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>{/* end page-content */}
    </div>
  );
}
