import { useEffect, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  Lock,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Papa from 'papaparse';
import {
  getMouvements,
  getSoldeDevise,
  appendAlimentation,
  appendPrelevement,
} from '@/lib/storage';
import { DEVISES } from '@/lib/constants';
import { fmt } from '@/lib/formatNumbers';
import type { MouvementCaisse, MouvementType } from '@/types';
import {
  getMouvements,
  getSoldeDevise,
  appendAlimentation,
  appendPrelevement,
  getCurrentUser,
} from '@/lib/storage';

dayjs.locale('fr');

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

type MvTypeFull = MouvementType | 'TOUS';

const TYPE_CFG: Record<
  MouvementType,
  { label: string; shortLabel: string; badgeClass: string; sign: '+' | '-' | '±' }
> = {
  ACHAT:        { label: 'Achat devise',    shortLabel: 'ACHAT',   badgeClass: 'bg-blue-100 text-blue-800 ring-blue-200',        sign: '±' },
  VENTE:        { label: 'Vente devise',    shortLabel: 'VENTE',   badgeClass: 'bg-emerald-100 text-emerald-800 ring-emerald-200', sign: '±' },
  DEPOT:        { label: 'Dépôt',           shortLabel: 'DÉPÔT',   badgeClass: 'bg-violet-100 text-violet-800 ring-violet-200',   sign: '+' },
  RETRAIT:      { label: 'Retrait',         shortLabel: 'RETRAIT', badgeClass: 'bg-orange-100 text-orange-800 ring-orange-200',   sign: '-' },
  CHARGES:      { label: 'Charges',         shortLabel: 'CHARGES', badgeClass: 'bg-red-100 text-red-800 ring-red-200',            sign: '-' },
  RELIQUAT:     { label: 'Reliquat',        shortLabel: 'REL.',    badgeClass: 'bg-amber-100 text-amber-800 ring-amber-200',      sign: '+' },
  ALIMENTATION: { label: 'Alimentation',    shortLabel: 'ALIM.',   badgeClass: 'bg-cyan-100 text-cyan-800 ring-cyan-200',         sign: '+' },
  PRELEVEMENT:  { label: 'Prélèvement',     shortLabel: 'PRÉL.',   badgeClass: 'bg-rose-100 text-rose-800 ring-rose-200',         sign: '-' },
  ANNULATION:   { label: 'Annulation',      shortLabel: 'ANNUL.', badgeClass: 'bg-zinc-100 text-zinc-700 ring-zinc-300',          sign: '±' },
};

const ALL_TYPES: MouvementType[] = [
  'ACHAT', 'VENTE', 'DEPOT', 'RETRAIT', 'CHARGES', 'RELIQUAT', 'ALIMENTATION', 'PRELEVEMENT', 'ANNULATION',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function signClass(n: number) {
  return n > 0 ? 'text-emerald-700' : n < 0 ? 'text-red-600' : 'text-zinc-500';
}

function signPrefix(n: number) {
  return n > 0 ? '+' : '';
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: MouvementType }) {
  const cfg = TYPE_CFG[type];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cfg.badgeClass}`}>
      {cfg.shortLabel}
    </span>
  );
}

// ─── Formulaire alimentation / prélèvement ───────────────────────────────────

interface ManualForm {
  sens: 'ALIMENTATION' | 'PRELEVEMENT';
  montant: string;
  devise: string;
  note: string;
}

function emptyManualForm(): ManualForm {
  return { sens: 'ALIMENTATION', montant: '', devise: 'MAD', note: '' };
}

function ManualEntryPanel({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyManualForm);
  const [error, setError] = useState('');

  function set<K extends keyof ManualForm>(k: K, v: ManualForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setError('');
  }

  function handleSave() {
    const val = parseFloat(form.montant);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Montant > 0 requis');
      return;
    }
    if (form.sens === 'ALIMENTATION') {
      appendAlimentation({ montant: val, devise: form.devise, note: form.note.trim() || undefined });
    } else {
      appendPrelevement({ montant: val, devise: form.devise, note: form.note.trim() || undefined });
    }
    setForm(emptyManualForm());
    setOpen(false);
    onDone();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
        <Plus size={14} className="mr-1" />
        Alimentation / Prélèvement
      </Button>
    );
  }

  return (
    <Card className="border-cyan-200 bg-cyan-50/50">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-cyan-900">Mouvement manuel</CardTitle>
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-800">
            <X size={15} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-3">
          {/* Sens */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set('sens', 'ALIMENTATION')}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.sens === 'ALIMENTATION'
                    ? 'border-cyan-400 bg-cyan-100 text-cyan-800'
                    : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                }`}
              >
                <ArrowUpCircle size={13} /> Alimentation
              </button>
              <button
                type="button"
                onClick={() => set('sens', 'PRELEVEMENT')}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.sens === 'PRELEVEMENT'
                    ? 'border-rose-400 bg-rose-100 text-rose-800'
                    : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                }`}
              >
                <ArrowDownCircle size={13} /> Prélèvement
              </button>
            </div>
          </div>

          {/* Devise */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Devise</label>
            <select
              value={form.devise}
              onChange={(e) => set('devise', e.target.value)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
            >
              <option value="MAD">MAD</option>
              {DEVISES.filter((d) => d !== 'MAD').map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Montant */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Montant *</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={form.montant}
              onChange={(e) => set('montant', e.target.value)}
              placeholder="0.00"
              className={`w-36 ${error ? 'border-red-400' : ''}`}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* Note / raison */}
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Raison</label>
            <Input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="ex : Apport comptoir, Remise coffre..."
              className="min-w-[180px]"
            />
          </div>

          {/* Valider */}
          <div className="flex items-end">
            <Button
              onClick={handleSave}
              className={form.sens === 'ALIMENTATION' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
            >
              {form.sens === 'ALIMENTATION' ? <ArrowUpCircle size={14} className="mr-1" /> : <ArrowDownCircle size={14} className="mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function JournalCaisse() {
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>(getMouvements);
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterType, setFilterType] = useState<MvTypeFull>('TOUS');
  const [filterDevise, setFilterDevise] = useState('TOUS');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  function refresh() {
    setMouvements(getMouvements());
    setPage(1);
  }

  // Écouter les événements mouvements
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('afromoney-mouvements', handler);
    return () => window.removeEventListener('afromoney-mouvements', handler);
  }, []);

  // Filtrage
  const filtered = mouvements
    .filter((m) => {
      if (filterDate && !m.timestamp.startsWith(filterDate)) return false;
      if (filterType !== 'TOUS' && m.type !== filterType) return false;
      if (filterDevise !== 'TOUS' && m.devise !== filterDevise) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.caissier.toLowerCase().includes(q) &&
          !(m.operationRef ?? '').toLowerCase().includes(q) &&
          !(m.note ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Soldes courants (sur toute l'historique, pas juste la date filtrée)
  const devisesList = ['MAD', ...DEVISES.filter((d) => d !== 'MAD')];
  const soldeCourant = Object.fromEntries(
    devisesList.map((d) => [d, getSoldeDevise(d, mouvements)])
  );
  const devisesActives = devisesList.filter((d) => soldeCourant[d] !== 0);

  // Totaux filtrés
  const totalEntrees = filtered.reduce((s, m) => s + (m.montant > 0 ? m.montant : 0), 0);
  const totalSorties = filtered.reduce((s, m) => s + (m.montant < 0 ? m.montant : 0), 0);

  // Devises disponibles pour filtre
  const devisesDispos = [...new Set(mouvements.map((m) => m.devise))].sort();

  function exportCSV() {
    const rows = filtered.map((m) => ({
      ID: m.id,
      Timestamp: m.timestamp,
      Type: m.type,
      Devise: m.devise,
      Montant: m.montant,
      'Solde avant': m.soldeAvant,
      'Solde après': m.soldeApres,
      'Opération réf.': m.operationRef ?? '',
      Caissier: m.caissier,
      Note: m.note ?? '',
      Statut: 'VERROUILLÉ',
    }));
    const csv = Papa.unparse(rows, { delimiter: ';' });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_caisse_${filterDate || 'complet'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Journal Caisse — Immuable"
        subtitle="Audit trail complet · Chaque mouvement est verrouillé 🔒"
      />

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── Soldes courants ── */}
        {devisesActives.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {devisesActives.map((d) => {
              const s = soldeCourant[d];
              return (
                <Card key={d} className={s < 0 ? 'border-red-200' : 'border-zinc-200'}>
                  <CardContent className="px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{d}</p>
                    <p className={`mt-0.5 text-lg font-bold tabular-nums ${s < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                      {signPrefix(s)}{fmt(s)}
                    </p>
                    <p className="text-[9px] text-zinc-400">solde courant</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Formulaire manuel ── */}
        <ManualEntryPanel onDone={refresh} />

        {/* ── Filtres + export ── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Date */}
              <input
                type="date"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              />
              <button
                type="button"
                onClick={() => { setFilterDate(''); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-600 hover:border-zinc-400"
              >
                Tout
              </button>

              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as MvTypeFull); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Tous types</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_CFG[t].label}</option>
                ))}
              </select>

              {/* Devise */}
              <select
                value={filterDevise}
                onChange={(e) => { setFilterDevise(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Toutes devises</option>
                {devisesDispos.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Recherche */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Caissier, réf., note..."
                  className="h-8 w-44 pl-8 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    <X size={11} />
                  </button>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto h-8">
                <Download size={13} className="mr-1" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Résumé rapide ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs">
              <p className="text-zinc-500">Lignes filtrées</p>
              <p className="text-base font-bold text-zinc-900">{filtered.length}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs">
              <p className="text-emerald-600">Entrées</p>
              <p className="text-base font-bold text-emerald-700">+{fmt(totalEntrees)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs">
              <p className="text-red-600">Sorties</p>
              <p className="text-base font-bold text-red-700">{fmt(totalSorties)}</p>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400">
                {mouvements.length === 0
                  ? 'Aucun mouvement enregistré. Les mouvements se créent automatiquement lors des opérations.'
                  : 'Aucun mouvement pour ces filtres.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-zinc-200 bg-zinc-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Heure</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Type</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Devise</th>
                        <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Montant</th>
                        <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Solde avant</th>
                        <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Solde après</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Réf. opération</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Caissier</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Note</th>
                        <th className="px-3 py-2.5 text-center font-medium text-zinc-500">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {pageRows.map((m, i) => (
                        <tr
                          key={m.id}
                          className={`transition-colors hover:bg-zinc-50 ${i % 2 === 0 ? '' : 'bg-zinc-50/50'}`}
                        >
                          {/* Heure */}
                          <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">
                            <div className="font-mono">{dayjs(m.timestamp).format('HH:mm:ss')}</div>
                            <div className="text-[10px] text-zinc-400">{dayjs(m.timestamp).format('DD/MM/YY')}</div>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2.5">
                            <TypeBadge type={m.type} />
                          </td>

                          {/* Devise */}
                          <td className="px-3 py-2.5 font-mono font-semibold text-zinc-700">
                            {m.devise}
                          </td>

                          {/* Montant */}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={`font-bold ${signClass(m.montant)}`}>
                              {signPrefix(m.montant)}{fmt(Math.abs(m.montant))}
                            </span>
                          </td>

                          {/* Solde avant */}
                          <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                            {fmt(m.soldeAvant)}
                          </td>

                          {/* Solde après */}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={`font-semibold ${signClass(m.soldeApres)}`}>
                              {fmt(m.soldeApres)}
                            </span>
                            <span className="ml-1">
                              {m.montant > 0
                                ? <TrendingUp size={10} className="inline text-emerald-500" />
                                : <TrendingDown size={10} className="inline text-red-500" />
                              }
                            </span>
                          </td>

                          {/* Réf. opération */}
                          <td className="px-3 py-2.5 font-mono text-[10px]">
                            {m.operationNumero
                              ? <span className="font-semibold text-blue-700" title={m.operationRef ?? m.operationNumero}>{m.operationNumero}</span>
                              : m.operationRef
                                ? <span className="text-zinc-400" title={m.operationRef}>{m.operationRef.slice(0, 16)}{m.operationRef.length > 16 ? '…' : ''}</span>
                                : <span className="text-zinc-400">—</span>
                            }
                          </td>

                          {/* Caissier */}
                          <td className="px-3 py-2.5 text-zinc-600">
                            {m.caissier}
                          </td>

                          {/* Note */}
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-zinc-400 italic" title={m.note}>
                            {m.note || '—'}
                          </td>

                         {/* Statut LOCKED */}
                          <td className="px-3 py-2.5 text-center">
                            {(m.type === 'ALIMENTATION' || m.type === 'PRELEVEMENT') && getCurrentUser()?.role === 'ADMIN' ? (
                              <button
                                onClick={() => {
                                  if (!window.confirm('Supprimer ce mouvement ?')) return;
                                  const all = getMouvements().filter((x) => x.id !== m.id);
                                  localStorage.setItem('mouvements_caisse', JSON.stringify(all));
                                  refresh();
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-200"
                              >
                                🗑 Supprimer
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                                <Lock size={9} />
                                LOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                    <p className="text-xs text-zinc-500">
                      Page {page} / {totalPages} — {filtered.length} mouvement{filtered.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={13} />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === '...' ? (
                            <span key={`e-${i}`} className="px-1 text-xs text-zinc-400">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setPage(p as number)}
                              className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                                page === p ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
