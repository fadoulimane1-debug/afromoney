import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, Trash2, Pencil, X, RotateCcw, Search, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Banknote } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionForm } from '@/components/TransactionForm';
import { getTransactions, deleteTransaction, updateTransaction, getExchangeRates, getReliquats, ajouterVersement } from '@/lib/storage';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import type { Reliquat } from '@/types';
import { buildHistoriqueV8Rows } from '@/lib/historiqueV8';
import { DEVISES, TYPES_OPERATION, STATUTS, UTILISATEURS_TEST, SECTION_HISTORIQUE_V8 } from '@/lib/constants';
import { montantAPayerAffiche, montantAPayerSaisiExplicite, statutVenteFromPaye } from '@/lib/calculations';
import { formatMontantFr, parseMontantStr } from '@/lib/parseMontant';
import { fmt, fmtRate } from '@/lib/formatNumbers';
import type { Transaction } from '@/types';

dayjs.locale('fr');

// ─── constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TYPE_BADGE: Record<string, string> = {
  ACHAT:      'bg-blue-100 text-blue-800 ring-blue-200',
  VENTE:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
  DEPOT:      'bg-violet-100 text-violet-800 ring-violet-200',
  RETRAIT:    'bg-orange-100 text-orange-800 ring-orange-200',
  CHARGES:    'bg-red-100 text-red-800 ring-red-200',
  ANNULATION: 'bg-zinc-100 text-zinc-700 ring-zinc-300',
};

const STATUT_BADGE: Record<string, string> = {
  'PAYÉ':     'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'CRÉDIT':   'bg-amber-100 text-amber-900 ring-amber-200',
  'NON-PAYÉ': 'bg-red-100 text-red-800 ring-red-200',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function employeName(id: string) {
  return UTILISATEURS_TEST.find((u) => u.id === id)?.nom ?? id;
}

function monthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = dayjs().subtract(i, 'month');
    return { value: d.format('YYYY-MM'), label: d.format('MMMM YYYY') };
  });
}

/** Estimate bénéfice for VENTE: (tauxVente – tauxAchat) × montant using stored rates */
function calcBenefice(tx: Transaction, rates: { devise: string; tauxAchat: number; tauxVente: number }[]): number | null {
  if (tx.type !== 'VENTE') return null;
  const r = rates.find((r) => r.devise === tx.devise);
  if (!r) return null;
  return (r.tauxVente - r.tauxAchat) * tx.montant;
}

// ─── MultiSelect dropdown ─────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  }

  const count = selected.size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
      >
        {label}
        {count > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
        <ChevronDown size={11} className="text-zinc-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-30 min-w-[140px] rounded-lg border border-zinc-300 bg-white py-1 shadow-xl">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-100"
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
                className="accent-blue-500"
              />
              <span className="text-xs text-zinc-800">
                {opt === 'CHARGES' ? 'CHARGES AGENCE' : opt}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SortHeader ──────────────────────────────────────────────────────────────

type SortKey = keyof Transaction | 'benefice' | 'montantAPayer';

interface SortHeaderProps {
  label: string;
  colKey: SortKey;
  current: SortKey | null;
  dir: 'asc' | 'desc';
  onClick: (k: SortKey) => void;
  className?: string;
}

function SortHeader({ label, colKey, current, dir, onClick, className = '' }: SortHeaderProps) {
  const active = current === colKey;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hover:text-zinc-800 ${className}`}
      onClick={() => onClick(colKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <ChevronsUpDown size={11} className="opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  tx: Transaction;
  onClose: () => void;
  onSave: () => void;
}

function EditModal({ tx, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState({
    statut: tx.statut,
    note: tx.note,
    taux: String(tx.taux),
    beneficiaire: tx.beneficiaire ?? '',
    montantMAD: String(tx.montantMAD),
    operation: tx.operation,
    montantAPayer: tx.montantAPayer != null ? String(tx.montantAPayer) : '',
    caisseDepart: tx.caisseDepart != null ? String(tx.caisseDepart) : '',
    jour: String(tx.jour),
    mois: String(tx.mois),
  });
  useEffect(() => {
  const taux = parseFloat(form.taux);
  if (!Number.isFinite(taux) || taux <= 0) return;
  if (tx.type === 'DEPOT' || tx.type === 'RETRAIT') return;
  const mad = Math.round(tx.montant * taux * 100) / 100;
  setForm((f) => ({ ...f, montantMAD: String(mad) }));
}, [form.taux]);
  function handleSave() {
    const taux = Math.round(parseFloat(form.taux) * 10000) / 10000;
    const montantMAD = parseMontantStr(form.montantMAD);
    const montantAPayerParsed =
      form.montantAPayer.trim() === '' ? undefined : parseMontantStr(form.montantAPayer);
    const caisseDepart =
      form.caisseDepart.trim() === '' ? undefined : parseFloat(form.caisseDepart);
 const madFinal = (tx.type === 'DEPOT' || tx.type === 'RETRAIT')
  ? tx.montantMAD
  : Number.isFinite(montantMAD) ? montantMAD : tx.montantMAD;
    const payeFinal =
      tx.type === 'VENTE'
        ? form.montantAPayer.trim() === ''
          ? 0
          : Number.isFinite(montantAPayerParsed ?? NaN)
            ? (montantAPayerParsed as number)
            : 0
        : montantAPayerParsed !== undefined && Number.isFinite(montantAPayerParsed)
          ? montantAPayerParsed
          : undefined;
    const statutFinal =
      tx.type === 'VENTE'
        ? statutVenteFromPaye(madFinal, payeFinal ?? 0)
        : (form.statut as Transaction['statut']);

    updateTransaction(tx.id, {
      statut: statutFinal,
      note: form.note,
      taux,
      montantMAD: madFinal,
      beneficiaire: form.beneficiaire || undefined,
      operation: form.operation.trim() || tx.operation,
      montantAPayer: payeFinal,
      caisseDepart,
      jour: parseInt(form.jour, 10) || tx.jour,
      mois: parseInt(form.mois, 10) || tx.mois,
    });
    onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Modifier la transaction</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Info readonly */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs sm:grid-cols-4">
          <div><span className="text-zinc-500">Section: </span><span className="font-medium text-zinc-900">{SECTION_HISTORIQUE_V8[tx.type]}</span></div>
          <div><span className="text-zinc-500">Devise: </span><span className="font-medium text-zinc-900">{tx.devise}</span></div>
          <div><span className="text-zinc-500">Montant: </span><span className="font-medium text-zinc-900">{fmt(tx.montant)}</span></div>
          <div><span className="text-zinc-500">J/M: </span><span className="font-medium text-zinc-900">{tx.jour}/{tx.mois}</span></div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Jour</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.jour}
                onChange={(e) => setForm((f) => ({ ...f, jour: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Mois</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.mois}
                onChange={(e) => setForm((f) => ({ ...f, mois: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Opération</label>
            <Input
              value={form.operation}
              onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))}
            />
          </div>

          {tx.type === 'VENTE' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">Montant payé (MAD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.montantAPayer}
                  onChange={(e) => setForm((f) => ({ ...f, montantAPayer: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">Reste non payé (MAD)</label>
                <Input
                  type="text"
                  readOnly
                  className="bg-zinc-50 font-semibold"
                  value={(() => {
                    const paye =
                      form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer);
                    const mad = parseMontantStr(form.montantMAD) || tx.montantMAD;
                    const reste = Math.max(0, Math.round((mad - paye) * 100) / 100);
                    return formatMontantFr(reste);
                  })()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600">Statut du solde</label>
                <Input
                  type="text"
                  readOnly
                  className="bg-zinc-50 font-semibold"
                  value={statutVenteFromPaye(
                    parseMontantStr(form.montantMAD) || tx.montantMAD,
                    form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer) || 0,
                  )}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Montant à payer (MAD)</label>
              <Input
                type="number"
                step="0.01"
                value={form.montantAPayer}
                onChange={(e) => setForm((f) => ({ ...f, montantAPayer: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Taux</label>
            <Input
              type="number"
              step="0.01"
              value={form.taux}
              onChange={(e) => setForm((f) => ({ ...f, taux: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Montant MAD</label>
            <Input
              type="number"
              step="0.01"
              value={form.montantMAD}
              onChange={(e) => setForm((f) => ({ ...f, montantMAD: e.target.value }))}
            />
          </div>

          {tx.type !== 'VENTE' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Statut</label>
              <select
                value={form.statut}
                onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as Transaction['statut'] }))}
                className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {tx.type === 'DEPOT' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Bénéficiaire</label>
              <Input
                value={form.beneficiaire}
                onChange={(e) => setForm((f) => ({ ...f, beneficiaire: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Note</label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="flex w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Reliquats mini-panel ────────────────────────────────────────────────────

function QuickSolderModal({
  reliquat,
  onClose,
  onDone,
}: {
  reliquat: Reliquat;
  onClose: () => void;
  onDone: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    const val = parseFloat(montant);
    if (!Number.isFinite(val) || val <= 0) { setError('Montant > 0 requis'); return; }
    if (val > reliquat.montantRestant + 0.005) { setError(`Max : ${fmt(reliquat.montantRestant)} ${reliquat.devise}`); return; }
    const today = new Date().toISOString().slice(0, 10);
    const updated = ajouterVersement(reliquat.id, { date: today, montant: val, note: note.trim() || undefined });
    if (!updated) return;
    logAudit(
      updated.statut === 'SOLDE' ? AUDIT_ACTIONS.RELIQUAT_SOLDE : AUDIT_ACTIONS.RELIQUAT_VERSEMENT,
      { id: reliquat.id, client: reliquat.client, montant: val },
      today,
    );
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Solder reliquat — {reliquat.client}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800"><X size={16} /></button>
        </div>
        <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Restant dû</span>
            <span className="font-bold text-red-600">{fmt(reliquat.montantRestant)} {reliquat.devise}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Réf.</span>
            <span className="font-mono text-zinc-700">{reliquat.operationNumero || reliquat.operationRef}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Versement ({reliquat.devise}) *</label>
            <div className="flex gap-2">
              <input
                type="number" min="0.01" step="0.01"
                value={montant}
                onChange={(e) => { setMontant(e.target.value); setError(''); }}
                placeholder="0.00"
                className={`flex h-9 w-full rounded-md border bg-white px-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-zinc-300'}`}
              />
              <button
                type="button"
                onClick={() => setMontant(String(reliquat.montantRestant))}
                className="shrink-0 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
              >
                Total
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Note</label>
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarque..."
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle size={13} className="mr-1" /> Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReliquatsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(true);
  const [reliquats, setReliquats] = useState<Reliquat[]>(() =>
    getReliquats().filter((r) => r.statut !== 'SOLDE')
  );
  const [solderTarget, setSolderTarget] = useState<Reliquat | null>(null);

  function refresh() {
    setReliquats(getReliquats().filter((r) => r.statut !== 'SOLDE'));
    onRefresh();
  }

  if (reliquats.length === 0) return null;

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="py-3 px-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2 text-left"
          >
            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
            <span className="flex-1 text-sm font-semibold text-amber-900">
              Reliquats disponibles pour ce bureau
            </span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
              {reliquats.length}
            </span>
            {open ? <ChevronUp size={14} className="text-amber-700" /> : <ChevronDown size={14} className="text-amber-700" />}
          </button>
        </CardHeader>

        {open && (
          <CardContent className="p-0 border-t border-amber-200">
            <div className="divide-y divide-amber-100">
              {reliquats.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <Banknote size={13} className="shrink-0 text-amber-500" />
                  <span className="font-semibold text-zinc-800 min-w-[80px]">{r.client}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${
                    r.statut === 'NON_SOLDE'
                      ? 'bg-red-100 text-red-700 ring-red-200'
                      : 'bg-amber-100 text-amber-800 ring-amber-200'
                  }`}>
                    {r.statut === 'NON_SOLDE' ? 'Non soldé' : 'Partiel'}
                  </span>
                  <span className="font-bold text-red-700">{fmt(r.montantRestant)} {r.devise}</span>
                  <span className="text-zinc-400 flex-1">
                    depuis op. <span className="font-mono">{r.operationNumero || r.operationRef}</span>
                  </span>
                  <button
                    onClick={() => setSolderTarget(r)}
                    className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    Solder
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {solderTarget && (
        <QuickSolderModal
          reliquat={solderTarget}
          onClose={() => setSolderTarget(null)}
          onDone={refresh}
        />
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Transactions() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Filters
  const [month,   setMonth]   = useState(dayjs().format('YYYY-MM'));
  const [types,   setTypes]   = useState<Set<string>>(new Set());
  const [devises, setDevises] = useState<Set<string>>(new Set());
  const [statuts, setStatuts] = useState<Set<string>>(new Set());
  const [search,  setSearch]  = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);

  // Actions
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const rates = useMemo(() => {
    void tick;
    return getExchangeRates();
  }, [tick]);
  const allTx = useMemo(() => {
    void tick;
    return getTransactions();
  }, [tick]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  function resetFilters() {
    setMonth(dayjs().format('YYYY-MM'));
    setTypes(new Set());
    setDevises(new Set());
    setStatuts(new Set());
    setSearch('');
    setPage(1);
  }

  const hasActiveFilters = types.size > 0 || devises.size > 0 || statuts.size > 0 || !!search;

  // ── filtered + sorted ──
  const processed = useMemo(() => {
    let rows = allTx.filter((tx) => {
      if (month && dayjs(tx.date).format('YYYY-MM') !== month) return false;
      if (types.size   > 0 && !types.has(tx.type))    return false;
      if (devises.size > 0 && !devises.has(tx.devise)) return false;
      if (statuts.size > 0 && !statuts.has(tx.statut)) return false;
      if (search) {
        const q = search.toLowerCase();
        const emp = employeName(tx.employeId).toLowerCase();
        if (!tx.note.toLowerCase().includes(q) && !emp.includes(q) && !tx.devise.toLowerCase().includes(q) &&
            !(tx.operation ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (sortKey) {
      const cell = (tx: Transaction): number | string => {
        if (sortKey === 'benefice') return calcBenefice(tx, rates) ?? -Infinity;
        if (sortKey === 'montantAPayer') return montantAPayerAffiche(tx);
        if (sortKey === 'caisseDepart') return tx.caisseDepart ?? -Infinity;
        if (sortKey === 'date') return new Date(tx.date).getTime();
        return (tx as unknown as Record<string, unknown>)[sortKey as string] as number | string;
      };
      rows = [...rows].sort((a, b) => {
        const va = cell(a);
        const vb = cell(b);
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [allTx, month, types, devises, statuts, search, sortKey, sortDir, rates]);

  // ── pagination ──
  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const pageRows   = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── totals ──
  const totals = useMemo(() => {
    const totalMontantMAD = processed.reduce((s, t) => s + t.montantMAD, 0);
    const totalBenefice   = processed.reduce((s, t) => s + (calcBenefice(t, rates) ?? 0), 0);
    const achats  = processed.filter((t) => t.type === 'ACHAT').reduce((s, t) => s + t.montantMAD, 0);
    const ventes  = processed.filter((t) => t.type === 'VENTE').reduce((s, t) => s + t.montantMAD, 0);
    const charges = processed.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + t.montantMAD, 0);
    return { totalMontantMAD, totalBenefice, achats, ventes, charges };
  }, [processed, rates]);

  // ── CSV export ──
  function exportCSV() {
    const rows = processed.map((tx) => ({
      'Caisse départ': tx.caisseDepart ?? '',
      Jour: tx.jour,
      Mois: tx.mois,
      Date: dayjs(tx.date).format('DD/MM/YYYY HH:mm'),
      Employé: employeName(tx.employeId),
      Section: SECTION_HISTORIQUE_V8[tx.type],
      Opération: tx.operation,
      Devise: tx.devise,
      Montant: tx.montant,
      Taux: tx.taux,
      'Montant MAD': tx.montantMAD,
      'Montant à payer MAD': montantAPayerAffiche(tx),
      Note: tx.note,
      Statut: tx.statut,
      Bénéficiaire: tx.beneficiaire ?? '',
    }));
    const csv = Papa.unparse(rows, { delimiter: ';' });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Colonnes identiques à la feuille HISTORIQUE du classeur AFROMONEY_V8_FINAL. */
  function exportHistoriqueV8() {
    const rows = buildHistoriqueV8Rows(processed, employeName);
    const csv = Papa.unparse(rows, { delimiter: ';' });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_afromoney_v8_${month || 'tous'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete(id: string) {
    deleteTransaction(id);
    setConfirmDelete(null);
    refresh();
  }

  return (
    <div>
      <PageHero
        title="Historique & saisie"
        subtitle="Toutes les transactions — feuille HISTORIQUE V8 · exports CSV disponibles"
      />

      <div className="page-content space-y-6">
      {/* ── Formulaire ── */}
      <TransactionForm onSuccess={refresh} />

      {/* ── Reliquats panel ── */}
      <ReliquatsPanel onRefresh={refresh} />

      {/* ── Tableau ── */}
      <Card>
        <CardHeader>
          {/* Titre + Export */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">
              Transactions{' '}
              <span className="font-normal text-zinc-500">
                ({processed.length} résultat{processed.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download size={13} /> Export CSV (détail)
              </Button>
              <Button variant="outline" size="sm" onClick={exportHistoriqueV8}>
                <Download size={13} /> Export HISTORIQUE V8
              </Button>
            </div>
          </div>

          {/* ── Filtres ── */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Mois */}
            <select
              value={month}
              onChange={(e) => { setMonth(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {monthOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value="">Tous les mois</option>
            </select>

            <MultiSelect label="Type"   options={[...TYPES_OPERATION]} selected={types}   onChange={(s) => { setTypes(s);   setPage(1); }} />
            <MultiSelect label="Devise" options={DEVISES} selected={devises} onChange={(s) => { setDevises(s); setPage(1); }} />
            <MultiSelect label="Statut" options={[...STATUTS]}                              selected={statuts} onChange={(s) => { setStatuts(s); setPage(1); }} />

            {/* Recherche texte */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Note, opération, employé..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 w-44 pl-7 text-xs"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800">
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs text-zinc-500">
                <RotateCcw size={11} /> Réinitialiser
              </Button>
            )}
          </div>
        </CardHeader>

        {/* ── Résumé rapide ── */}
        {processed.length > 0 && (
          <div className="mx-4 mb-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:grid-cols-4">
            <div><span className="text-zinc-500">Achats: </span><span className="font-semibold text-blue-700">{fmt(totals.achats)} MAD</span></div>
            <div><span className="text-zinc-500">Ventes: </span><span className="font-semibold text-emerald-700">{fmt(totals.ventes)} MAD</span></div>
            <div><span className="text-zinc-500">Charges: </span><span className="font-semibold text-orange-700">{fmt(totals.charges)} MAD</span></div>
            <div><span className="text-zinc-500">Bénéfice estimé: </span><span className={`font-semibold ${totals.totalBenefice >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(totals.totalBenefice)} MAD</span></div>
          </div>
        )}

        <CardContent className="p-0">
          {processed.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-600">Aucune transaction pour ces filtres</p>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">N° Op.</th>
                      <SortHeader label="J/M" colKey="jour" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="Date" colKey="date" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Employé</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Section</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Opération</th>
                      <SortHeader label="Devise" colKey="devise" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="Montant" colKey="montant" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                      <SortHeader label="Taux" colKey="taux" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                      <SortHeader label="MAD" colKey="montantMAD" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                      <SortHeader label="À payer" colKey="montantAPayer" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                      <SortHeader label="Bénéfice" colKey="benefice" current={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Note</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Statut</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageRows.map((tx, i) => {
                      const benefice = calcBenefice(tx, rates);
                      const apPayer = montantAPayerAffiche(tx);
                      const apExplicite = montantAPayerSaisiExplicite(tx);
                      const apClass =
                        apExplicite && tx.statut === 'CRÉDIT' && apPayer > 0
                          ? 'font-semibold text-amber-700'
                          : apExplicite && apPayer === 0
                            ? 'text-zinc-500'
                            : 'font-medium text-zinc-900';
                      const isEven = i % 2 === 0;
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b border-zinc-200/40 transition-colors hover:bg-zinc-50 ${isEven ? 'bg-transparent' : 'bg-zinc-50/80'}`}
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-semibold text-blue-700">
                            {tx.numero ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-600 whitespace-nowrap">
                            {tx.jour}/{tx.mois}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-600 whitespace-nowrap">
                            {dayjs(tx.date).format('DD/MM/YY')}
                            <span className="ml-1 text-zinc-600">{dayjs(tx.date).format('HH:mm')}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-zinc-700">{tx.employeNom ?? employeName(tx.employeId)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TYPE_BADGE[tx.type] ?? ''}`}>
                              {SECTION_HISTORIQUE_V8[tx.type]}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-zinc-600" title={tx.operation}>
                            {tx.operation}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-zinc-900">{tx.devise}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-700">{fmt(tx.montant)}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-zinc-500">{fmtRate(tx.taux)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-900 whitespace-nowrap">{fmt(tx.montantMAD)}</td>
                          <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                            <span className={apClass}>{fmt(apPayer)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                            {benefice != null ? (
                              <span className={benefice >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
                                {fmt(benefice)}
                              </span>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-xs text-zinc-500" title={tx.note}>
                            {tx.note || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUT_BADGE[tx.statut] ?? ''}`}>
                              {tx.statut}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
      {confirmDelete === tx.id ? (
  <div className="flex items-center gap-1.5 text-xs">
    <button onClick={() => handleDelete(tx.id)} className="font-medium text-red-400 hover:text-red-300">
      Confirmer
    </button>
    <span className="text-zinc-700">|</span>
    <button onClick={() => setConfirmDelete(null)} className="text-zinc-500 hover:text-zinc-800">
      Annuler
    </button>
  </div>
) : (
  <div className="flex items-center gap-1">
    {(tx.statut === 'NON-PAYÉ' || tx.statut === 'CRÉDIT') && (
      <button
        title="Marquer comme payé"
 onClick={() => {
  const now = new Date();
  updateTransaction(tx.id, {
    statut: 'PAYÉ',
    montantAPayer: tx.montantMAD,
    datePaiement: now.toISOString().slice(0, 10),
  });
  refresh();
}}
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-emerald-100 hover:text-emerald-600"
      >
        <CheckCircle size={12} />
      </button>
    )}
    <button
      onClick={() => setEditingTx(tx)}
      className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-blue-400"
    >
      <Pencil size={12} />
    </button>
    <button
      onClick={() => setConfirmDelete(tx.id)}
      className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-red-400"
    >
      <Trash2 size={12} />
    </button>
  </div>
)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Ligne totaux */}
                    <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold">
                      <td colSpan={8} className="px-3 py-2.5 text-xs text-zinc-600">
                        Total ({processed.length} ligne{processed.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-900">
                        {fmt(totals.totalMontantMAD)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-amber-700">
                        {fmt(processed.reduce((s, t) => s + montantAPayerAffiche(t), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-700">
                        {fmt(totals.totalBenefice)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                  <p className="text-xs text-zinc-500">
                    Page {page} / {totalPages} — {processed.length} résultat{processed.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="icon"
                      className="h-7 w-7"
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
                          <span key={`ellipsis-${i}`} className="px-1 text-xs text-zinc-600">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                              page === p
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <Button
                      variant="outline" size="icon"
                      className="h-7 w-7"
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

      {/* ── Edit modal ── */}
      {editingTx && (
        <EditModal
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={refresh}
        />
      )}
      </div>{/* end page-content */}
    </div>
  );
}
