import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileDown, Download } from 'lucide-react';
import { generateBordereauPDF } from '@/lib/bordereauxPDF';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import Papa from 'papaparse';
import { getClosures } from '@/lib/storage';
import { importClosureRowsFromExcel } from '@/lib/excelImport';
import { fmt } from '@/lib/formatNumbers';
import { downloadClosuresCsv, downloadClosuresTemplateCsv } from '@/lib/closureCsvExport';
import { downloadClosuresExcel } from '@/lib/closureExcelExport';
import type { DailyClosure } from '@/types';

dayjs.locale('fr');

const STATUS_BADGE: Record<DailyClosure['status'], { label: string; cls: string }> = {
  DRAFT:              { label: 'Brouillon', cls: 'bg-zinc-100 text-zinc-600' },
  PENDING_VALIDATION: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
  VALIDATED:          { label: 'Validée',    cls: 'bg-emerald-100 text-emerald-700' },
  ERROR:              { label: 'Écart',      cls: 'bg-red-100 text-red-700' },
};

interface StatCardProps { label: string; value: number | string; colorClass?: string }
function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/90 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${colorClass ?? 'text-zinc-800'}`}>{value}</p>
    </div>
  );
}

export function ClosureHistory() {
  const [closures, setClosures]         = useState<DailyClosure[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<DailyClosure['status'] | 'ALL'>('ALL');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    const data = getClosures();
    setClosures([...data].sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  useEffect(() => {
    reload();
    const onData = () => reload();
    window.addEventListener('afromoney-data', onData);
    return () => window.removeEventListener('afromoney-data', onData);
  }, [reload]);

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (res) => {
        const rows = res.data.filter((r) => Object.keys(r).some((k) => String((r as Record<string, unknown>)[k] ?? '').trim() !== ''));
        const n = importClosureRowsFromExcel(rows);
        if (n < 0) setImportMsg('Erreur lors de l’import.');
        else {
          setImportMsg(`${n} ligne(s) importée(s).`);
          reload();
        }
        setTimeout(() => setImportMsg(null), 5000);
      },
      error: () => setImportMsg('Fichier illisible.'),
    });
  }

  const months = useMemo(
    () => [...new Set(closures.map((c) => c.date.substring(0, 7)))].sort().reverse(),
    [closures]
  );

  const filtered = useMemo(() => {
    return closures.filter((c) => {
      const okMonth  = !selectedMonth || c.date.startsWith(selectedMonth);
      const okStatus = selectedStatus === 'ALL' || c.status === selectedStatus;
      return okMonth && okStatus;
    });
  }, [closures, selectedMonth, selectedStatus]);

  const stats = useMemo(() => ({
    total:      closures.length,
    validated:  closures.filter((c) => c.status === 'VALIDATED').length,
    balanced:   closures.filter((c) => c.isBalanced).length,
    errors:     closures.filter((c) => !c.isBalanced).length,
    totalBenefit: closures.reduce((s, c) => s + c.dailyBenefit, 0),
  }), [closures]);

  return (
    <div>
      <PageHero
        title="Historique des clôtures"
        subtitle="Consultation et contrôle des clôtures journalières"
        tall
      />

      <div className="page-content space-y-6">
        {importMsg && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">{importMsg}</div>
        )}

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="text-sm font-medium text-zinc-800">Export / import CSV (feuille CLÔTURES)</p>
              <p className="mt-1 text-xs text-zinc-500">
                <strong>Excel structuré</strong> : tableaux cadrés, en-têtes, 2 feuilles (SOMMAIRE + CLÔTURES).
                <strong> CSV</strong> : pour réimporter dans l’application.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-cyan-600 text-white hover:bg-cyan-700"
                onClick={() => downloadClosuresExcel(filtered.length ? filtered : closures)}
              >
                <Download size={14} /> Excel structuré ({filtered.length || closures.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => downloadClosuresCsv(filtered.length ? filtered : closures)}
              >
                <Download size={14} /> CSV (import)
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImportFile} />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Importer CSV
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadClosuresTemplateCsv}>
                <Download size={14} /> Modèle vide
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total clôtures"   value={stats.total}     colorClass="text-blue-600" />
          <StatCard label="Validées"          value={stats.validated} colorClass="text-emerald-600" />
          <StatCard label="Équilibrées"       value={stats.balanced}  colorClass="text-emerald-600" />
          <StatCard label="Avec écart"        value={stats.errors}    colorClass="text-red-500" />
          <StatCard
            label="Bénéfice cumulé"
            value={`${fmt(stats.totalBenefit)} MAD`}
            colorClass={stats.totalBenefit >= 0 ? 'text-emerald-600' : 'text-red-500'}
          />
        </div>

        {/* ── Filtres ── */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Mois
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Tous les mois</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {dayjs(`${m}-01`).format('MMMM YYYY')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Statut
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as DailyClosure['status'] | 'ALL')}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="DRAFT">Brouillon</option>
                  <option value="PENDING_VALIDATION">En attente</option>
                  <option value="VALIDATED">Validée</option>
                  <option value="ERROR">Écart détecté</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tableau ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {filtered.length} clôture{filtered.length !== 1 ? 's' : ''}
              {selectedMonth ? ` — ${dayjs(`${selectedMonth}-01`).format('MMMM YYYY')}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-zinc-400">
                Aucune clôture pour ce filtre
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      {['Date', 'Solde initial', 'Solde final', 'Bénéfice', 'Écart', 'Statut', 'Responsable', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const badge = STATUS_BADGE[c.status];
                      return (
                        <tr
                          key={c.id}
                          className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 ${
                            i % 2 === 1 ? 'bg-zinc-50/50' : ''
                          }`}
                        >
                          {/* Date */}
                          <td className="px-4 py-3 font-medium text-zinc-800">
                            {dayjs(c.date).format('ddd D MMM YYYY')}
                          </td>

                          {/* Solde initial */}
                          <td className="px-4 py-3 tabular-nums text-zinc-600">
                            {fmt(c.initialBalanceMAD)}{' '}
                            <span className="text-xs text-zinc-400">MAD</span>
                          </td>

                          {/* Solde final */}
                          <td className="px-4 py-3 tabular-nums font-semibold text-blue-600">
                            {fmt(c.finalBalanceMAD)}{' '}
                            <span className="text-xs font-normal text-zinc-400">MAD</span>
                          </td>

                          {/* Bénéfice */}
                          <td className={`px-4 py-3 tabular-nums font-semibold ${c.dailyBenefit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {c.dailyBenefit >= 0 ? '+' : ''}{fmt(c.dailyBenefit)}{' '}
                            <span className="text-xs font-normal text-zinc-400">MAD</span>
                          </td>

                          {/* Écart */}
                          <td className={`px-4 py-3 tabular-nums font-semibold ${c.isBalanced ? 'text-emerald-600' : 'text-red-500'}`}>
                            {c.variance >= 0 ? '+' : ''}{fmt(c.variance)}{' '}
                            <span className="text-xs font-normal text-zinc-400">MAD</span>
                          </td>

                          {/* Statut */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>

                          {/* Responsable */}
                          <td className="px-4 py-3 text-zinc-600">
                            {c.manager ?? <span className="text-zinc-300">—</span>}
                          </td>

                          {/* Bordereau PDF */}
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => generateBordereauPDF(c)}
                              title={`Bordereau PDF — ${c.date}`}
                              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <FileDown size={12} />
                              PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Chaîne J-1 → J ── */}
        {filtered.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Chaîne d'héritage J-1 → J (5 dernières)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                {filtered.slice(0, 5).reverse().map((c, i, arr) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center min-w-[110px]">
                      <p className="text-[10px] font-medium text-zinc-400">
                        {dayjs(c.date).format('D MMM')}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-zinc-800">
                        {fmt(c.finalBalanceMAD)}
                      </p>
                      <p className="text-[10px] text-zinc-400">MAD</p>
                    </div>
                    {i < arr.length - 1 && (
                      <span className="text-zinc-300 text-lg">→</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
