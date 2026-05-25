import { useEffect, useRef, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getReliquats as getReliquatsLocal,
  addReliquat,
  ajouterVersement,
  deleteReliquat,
  getExchangeRates,
} from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import {
  getReliquats as fetchSupaReliquats,
  createReliquat as saveReliquatToSupabase,
  updateReliquat as updateReliquatInSupabase,
} from '@/services/supabaseService';
import type { ReliquatDB, VersementDB } from '@/types/supabase';
import {
  apiGetReliquats,
  apiCreateReliquat,
  apiUpdateReliquat,
  apiDeleteReliquat,
} from '@/lib/mongoApiClient';
import type { ApiReliquat } from '@/lib/mongoApiClient';
import { DEVISES, TAUX_PAR_DEFAUT } from '@/lib/constants';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import type { Reliquat, StatutReliquat } from '@/types';
import { fmt } from '@/lib/formatNumbers';

dayjs.locale('fr');

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return dayjs().format('YYYY-MM-DD');
}

function getTaux(devise: string): number {
  if (devise === 'MAD') return 1;
  const rates = getExchangeRates();
  const found = rates.find((r) => r.devise === devise);
  return found?.tauxJour ?? TAUX_PAR_DEFAUT[devise] ?? 1;
}

function toMAD(montant: number, devise: string): number {
  return montant * getTaux(devise);
}

// ─── statut config ────────────────────────────────────────────────────────────

const STATUT_CFG: Record<StatutReliquat, { label: string; badge: string; icon: React.ElementType }> = {
  NON_SOLDE: {
    label: 'Non soldé',
    badge: 'bg-red-100 text-red-800 ring-red-200',
    icon: AlertTriangle,
  },
  PARTIELLEMENT_SOLDE: {
    label: 'Partiel',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    icon: Clock,
  },
  SOLDE: {
    label: 'Soldé',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    icon: CheckCircle,
  },
};

// ─── components ──────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: StatutReliquat }) {
  const cfg = STATUT_CFG[statut];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${cfg.badge}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-600">{label}</label>
      {children}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      {hint && !error && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  hasError = false,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full rounded-md border bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        ${hasError ? 'border-red-400 bg-red-50' : 'border-zinc-300'}`}
    >
      {children}
    </select>
  );
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {ok ? <CheckCircle size={15} /> : <X size={15} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100">
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Création reliquat modal ──────────────────────────────────────────────────

interface CreateForm {
  client: string;
  categorieClient: 'HABITUEL' | 'AMI';
  /** R7 — détermine la devise dûe */
  typeOperation: 'ACHAT' | 'VENTE';
  devise: string;
  montantInitial: string;
  operationRef: string;
  operationNumero: string;
  note: string;
}

interface CreateErrors {
  client?: string;
  devise?: string;
  montantInitial?: string;
  operationRef?: string;
}

function emptyCreate(): CreateForm {
  return {
    client: '',
    categorieClient: 'HABITUEL',
    typeOperation: 'ACHAT',
    devise: 'MAD',
    montantInitial: '',
    operationRef: '',
    operationNumero: '',
    note: '',
  };
}

function validateCreate(f: CreateForm): CreateErrors {
  const e: CreateErrors = {};
  if (!f.client.trim()) e.client = 'Nom client requis';
  if (!f.devise) e.devise = 'Devise requise';
  if (!f.montantInitial || parseFloat(f.montantInitial) <= 0) e.montantInitial = 'Montant > 0 requis';
  if (!f.operationRef.trim()) e.operationRef = 'Référence opération requise';
  return e;
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [errors, setErrors] = useState<CreateErrors>({});

  // R7 — devise verrouillée selon le type d'opération
  const deviseVerrouillee = form.typeOperation === 'ACHAT';

  function set(field: keyof CreateForm, val: string) {
    setForm((f) => {
      const next = { ...f, [field]: val };
      // R7 : quand le type change, on recalcule la devise dûe
      if (field === 'typeOperation') {
        next.devise = val === 'ACHAT' ? 'MAD' : (f.devise === 'MAD' ? 'EUR' : f.devise);
      }
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSave() {
    const errs = validateCreate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const today = todayStr();
    const montant = parseFloat(form.montantInitial);
    addReliquat({
      dateCreation: today,
      client: form.client.trim(),
      categorieClient: form.categorieClient,
      devise: form.devise,
      montantInitial: montant,
      montantRestant: montant,
      operationRef: form.operationRef.trim(),
      operationNumero: form.operationNumero.trim() || undefined,
      statut: 'NON_SOLDE',
      note: form.note.trim() || undefined,
    });
    void saveReliquatToSupabase({
      client: form.client.trim(),
      categorie_client: form.categorieClient,
      operation_ref: form.operationRef.trim(),
      operation_numero: form.operationNumero.trim() || null,
      devise: form.devise,
      montant_initial: montant,
      montant_restant: montant,
      statut: 'NON_SOLDE',
      versements: [],
      note: form.note.trim() || null,
      date_creation: today,
      date_maj: today,
    });
    void apiCreateReliquat({
      client:          form.client.trim(),
      categorieClient: form.categorieClient,
      operationRef:    form.operationRef.trim(),
      operationNumero: form.operationNumero.trim() || null,
      devise:          form.devise,
      montantInitial:  montant,
      montantRestant:  montant,
      statut:          'NON_SOLDE',
      versements:      [],
      note:            form.note.trim() || null,
      dateCreation:    new Date().toISOString(),
      dateMaj:         new Date().toISOString(),
    }).catch((err) => console.error('[MongoDB] createReliquat:', err));
    logAudit(AUDIT_ACTIONS.RELIQUAT_CREATE, {
      client: form.client,
      devise: form.devise,
      montant,
      operationRef: form.operationRef,
    }, today);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Nouveau reliquat</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">

          {/* R7 — sélecteur de type avec explication */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Type d'opération *</label>
            <div className="flex overflow-hidden rounded-lg border border-zinc-300 bg-white text-sm">
              {(['ACHAT', 'VENTE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('typeOperation', t)}
                  className={[
                    'flex-1 py-2 px-3 text-xs font-bold transition-colors',
                    form.typeOperation === t
                      ? t === 'ACHAT'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                      : 'text-zinc-500 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  {t === 'ACHAT' ? '📥 ACHAT devise' : '📤 VENTE devise'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-[11px] text-blue-700">
              {form.typeOperation === 'ACHAT'
                ? '✅ ACHAT : le bureau achète la devise — il doit des MAD au client → reliquat en MAD'
                : '✅ VENTE : le bureau vend la devise — il doit la devise au client → reliquat en devise'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client *" error={errors.client}>
              <Input
                value={form.client}
                onChange={(e) => set('client', e.target.value)}
                placeholder="Nom du client"
                className={errors.client ? 'border-red-400' : ''}
              />
            </Field>
            <Field label="Catégorie client">
              <NativeSelect value={form.categorieClient} onChange={(v) => set('categorieClient', v)}>
                <option value="HABITUEL">HABITUEL</option>
                <option value="AMI">AMI</option>
              </NativeSelect>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Devise dûe *"
              error={errors.devise}
              hint={deviseVerrouillee ? '🔒 ACHAT → toujours MAD (R7)' : 'VENTE → devise effectivement due au client'}
            >
              {deviseVerrouillee ? (
                <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-500 cursor-not-allowed select-none">
                  MAD — Dirham marocain 🔒
                </div>
              ) : (
                <NativeSelect value={form.devise} onChange={(v) => set('devise', v)} hasError={!!errors.devise}>
                  {DEVISES.filter((d) => d !== 'MAD').map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field
              label={`Montant dû * (${form.devise})`}
              error={errors.montantInitial}
              hint={form.typeOperation === 'ACHAT'
                ? 'Ex. : 23 400 MAD = montantMAD − versement initial'
                : form.devise !== 'MAD' ? `≈ ${fmt(parseFloat(form.montantInitial || '0') * getTaux(form.devise))} MAD` : undefined}
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.montantInitial}
                onChange={(e) => set('montantInitial', e.target.value)}
                placeholder="0.00"
                className={errors.montantInitial ? 'border-red-400' : ''}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Réf. opération *" error={errors.operationRef} hint="ID ou numéro de l'opération initiale">
              <Input
                value={form.operationRef}
                onChange={(e) => set('operationRef', e.target.value)}
                placeholder="ex: BCH-2026-000001"
                className={errors.operationRef ? 'border-red-400' : ''}
              />
            </Field>
            <Field label="N° bordereau">
              <Input
                value={form.operationNumero}
                onChange={(e) => set('operationNumero', e.target.value)}
                placeholder="BCH-2026-XXXXXX"
              />
            </Field>
          </div>

          <Field label="Note">
            <Input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Remarque optionnelle..."
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus size={14} className="mr-1" />
            Créer le reliquat
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Soldage modal ────────────────────────────────────────────────────────────

function SolderModal({
  reliquat,
  onClose,
  onSolded,
}: {
  reliquat: Reliquat;
  onClose: () => void;
  onSolded: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const max = reliquat.montantRestant;

  function handleSave() {
    const val = parseFloat(montant);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Montant > 0 requis');
      return;
    }
    if (val > max + 0.005) {
      setError(`Maximum : ${fmt(max)} ${reliquat.devise}`);
      return;
    }
    const today = todayStr();
    const updated = ajouterVersement(reliquat.id, { date: today, montant: val, note: note.trim() || undefined });
    if (!updated) return;
    void updateReliquatInSupabase(reliquat.id, {
      montant_restant: updated.montantRestant,
      statut: updated.statut,
      versements: updated.versements.map((v) => ({
        id: v.id,
        date: v.date,
        montant: v.montant,
        note: v.note ?? null,
      })),
      date_maj: today,
    });
    void apiUpdateReliquat(reliquat.id, {
      montantRestant: updated.montantRestant,
      statut:         updated.statut,
      versements:     updated.versements.map((v) => ({
        id: v.id,
        date: v.date,
        montant: v.montant,
        note: v.note ?? null,
      })),
      dateMaj: new Date().toISOString(),
    }).catch((err) => console.error('[MongoDB] updateReliquat:', err));
    logAudit(
      updated.statut === 'SOLDE' ? AUDIT_ACTIONS.RELIQUAT_SOLDE : AUDIT_ACTIONS.RELIQUAT_VERSEMENT,
      { id: reliquat.id, client: reliquat.client, montant: val, restant: updated.montantRestant },
      today,
    );
    onSolded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Solder reliquat</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X size={18} />
          </button>
        </div>

        {/* Context */}
        <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Client</span>
            <span className="font-semibold text-zinc-900">{reliquat.client}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Restant dû</span>
            <span className="font-bold text-red-600">{fmt(reliquat.montantRestant)} {reliquat.devise}</span>
          </div>
          {reliquat.devise !== 'MAD' && (
            <div className="flex justify-between">
              <span className="text-zinc-500">≈ MAD</span>
              <span className="text-zinc-700">{fmt(toMAD(reliquat.montantRestant, reliquat.devise))} MAD</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Réf. opération</span>
            <span className="font-mono text-zinc-700">{reliquat.operationNumero || reliquat.operationRef}</span>
          </div>
        </div>

        {/* Versements antérieurs */}
        {reliquat.versements.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Historique versements</p>
            <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-xs">
              {reliquat.versements.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-zinc-500">{dayjs(v.date).format('DD/MM/YYYY')}</span>
                  <span className="font-semibold text-emerald-700">+{fmt(v.montant)} {reliquat.devise}</span>
                  {v.note && <span className="ml-2 text-zinc-400 italic">{v.note}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Field label={`Versement (${reliquat.devise}) *`} error={error} hint={`Maximum : ${fmt(max)} ${reliquat.devise}`}>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={max}
                value={montant}
                onChange={(e) => { setMontant(e.target.value); setError(''); }}
                placeholder="0.00"
                className={error ? 'border-red-400' : ''}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-xs"
                onClick={() => setMontant(String(max))}
              >
                Total
              </Button>
            </div>
          </Field>
          <Field label="Note">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Remarque..."
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle size={14} className="mr-1" />
            Enregistrer versement
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

type SortKey = 'dateCreation' | 'client' | 'devise' | 'montantInitial' | 'montantRestant' | 'statut';

function SortTh({
  label,
  col,
  current,
  dir,
  onClick,
}: {
  label: string;
  col: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onClick: (c: SortKey) => void;
}) {
  const active = current === col;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hover:text-zinc-800"
      onClick={() => onClick(col)}
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

// ─── Supabase mappers ────────────────────────────────────────────────────────

function dbToLocalReliquat(db: ReliquatDB): Reliquat {
  return {
    id: db.id,
    dateCreation: db.date_creation,
    dateMaj: db.date_maj,
    client: db.client,
    categorieClient: (db.categorie_client as 'HABITUEL' | 'AMI') ?? undefined,
    operationRef: db.operation_ref,
    operationNumero: db.operation_numero ?? undefined,
    devise: db.devise,
    montantInitial: db.montant_initial,
    montantRestant: db.montant_restant,
    statut: db.statut,
    versements: (db.versements as VersementDB[]).map((v) => ({
      id: v.id,
      date: v.date,
      montant: v.montant,
      note: v.note ?? undefined,
    })),
    note: db.note ?? undefined,
  };
}

// ─── MongoDB mappers ──────────────────────────────────────────────────────────

function mongoToLocalReliquat(doc: ApiReliquat): Reliquat {
  type V = { id: string; date: string; montant: number; note?: string | null };
  return {
    id: doc._id,
    dateCreation: String(doc.dateCreation ?? '').slice(0, 10) || todayStr(),
    dateMaj:      String(doc.dateMaj      ?? '').slice(0, 10) || todayStr(),
    client:        doc.client,
    categorieClient: (doc['categorieClient'] as 'HABITUEL' | 'AMI') ?? undefined,
    operationRef:  doc.operationRef,
    operationNumero: (doc['operationNumero'] as string) ?? undefined,
    devise:        doc.devise,
    montantInitial: doc.montantInitial,
    montantRestant: doc.montantRestant,
    statut:        doc.statut,
    versements: (doc.versements as V[]).map((v) => ({
      id: v.id,
      date: v.date,
      montant: v.montant,
      note: v.note ?? undefined,
    })),
    note: (doc['note'] as string) ?? undefined,
  };
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function Reliquats() {
  const [reliquats, setReliquats] = useState<Reliquat[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [solderTarget, setSolderTarget] = useState<Reliquat | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<StatutReliquat | 'TOUS'>('TOUS');
  const [filterDevise, setFilterDevise] = useState('TOUS');

  const [sortCol, setSortCol] = useState<SortKey>('dateCreation');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  async function loadReliquats() {
    setLoading(true);
    try {
      const mongoRows = await apiGetReliquats();
      if (mongoRows.length > 0) {
        setReliquats(mongoRows.map(mongoToLocalReliquat));
        setLoading(false);
        return;
      }
    } catch { /* backend non disponible */ }
    const supaRows = await fetchSupaReliquats();
    if (supaRows.length > 0) {
      setReliquats(supaRows.map(dbToLocalReliquat));
    } else {
      setReliquats(getReliquatsLocal());
    }
    setLoading(false);
  }

  const refresh = () => { void loadReliquats(); };

  useEffect(() => { void loadReliquats(); }, []);

  function showToast(msg: string, ok = true) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function handleSort(col: SortKey) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  function handleDelete(id: string) {
    deleteReliquat(id);
    supabase.from('reliquats').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('[supabase] deleteReliquat:', error);
    });
    void apiDeleteReliquat(id).catch((err) => console.error('[MongoDB] deleteReliquat:', err));
    logAudit(AUDIT_ACTIONS.RELIQUAT_DELETE, { id }, todayStr());
    refresh();
    setConfirmDelete(null);
    showToast('Reliquat supprimé.');
  }

  // filtrage + tri
  const filtered = reliquats
    .filter((r) => {
      if (filterStatut !== 'TOUS' && r.statut !== filterStatut) return false;
      if (filterDevise !== 'TOUS' && r.devise !== filterDevise) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.client.toLowerCase().includes(q) &&
          !r.operationRef.toLowerCase().includes(q) &&
          !(r.operationNumero ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va: string | number = a[sortCol] as string | number;
      let vb: string | number = b[sortCol] as string | number;
      if (typeof va === 'string' && typeof vb === 'string') {
        va = va.toLowerCase(); vb = vb.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  // kpis
  const actifs = reliquats.filter((r) => r.statut !== 'SOLDE');
  const totalDuMAD = actifs.reduce((s, r) => s + toMAD(r.montantRestant, r.devise), 0);
  const nbNonSolde = reliquats.filter((r) => r.statut === 'NON_SOLDE').length;
  const nbPartiel = reliquats.filter((r) => r.statut === 'PARTIELLEMENT_SOLDE').length;

  // devises disponibles pour le filtre
  const devisesList = [...new Set(reliquats.map((r) => r.devise))];

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Reliquats — Créances clients"
        subtitle="⚠️ Opérations partielles · Clients habituels & amis"
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Toast */}
        {toast && (
          <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-zinc-500">Total créances</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-zinc-900">{actifs.length}</p>
              <p className="text-xs text-zinc-500">reliquats ouverts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-zinc-500">Montant dû (≈ MAD)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-red-600">{fmt(totalDuMAD)}</p>
              <p className="text-xs text-zinc-500">MAD équivalent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-zinc-500">Non soldés</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-red-700">{nbNonSolde}</p>
              <p className="text-xs text-zinc-500">aucun versement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-zinc-500">Partiels</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-amber-600">{nbPartiel}</p>
              <p className="text-xs text-zinc-500">versement partiel</p>
            </CardContent>
          </Card>
        </div>

        {/* Barre filtre + create */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher client, réf. opération..."
                  className="pl-8 text-sm"
                />
              </div>

              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value as StatutReliquat | 'TOUS')}
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
              >
                <option value="TOUS">Tous statuts</option>
                <option value="NON_SOLDE">Non soldés</option>
                <option value="PARTIELLEMENT_SOLDE">Partiels</option>
                <option value="SOLDE">Soldés</option>
              </select>

              <select
                value={filterDevise}
                onChange={(e) => setFilterDevise(e.target.value)}
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
              >
                <option value="TOUS">Toutes devises</option>
                {devisesList.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <Button
                onClick={() => setShowCreate(true)}
                disabled={loading}
                className="ml-auto bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
              >
                <Plus size={14} className="mr-1" />
                {loading ? 'Chargement…' : 'Nouveau reliquat'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400">
                {reliquats.length === 0
                  ? 'Aucun reliquat enregistré. Créez-en un avec le bouton ci-dessus.'
                  : 'Aucun reliquat ne correspond aux filtres.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <SortTh label="Date" col="dateCreation" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Client" col="client" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Devise" col="devise" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Montant initial" col="montantInitial" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Restant dû" col="montantRestant" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Statut" col="statut" current={sortCol} dir={sortDir} onClick={handleSort} />
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Réf. opération</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500">Dernière MAJ</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-3 py-3 text-xs text-zinc-500">
                          {dayjs(r.dateCreation).format('DD/MM/YYYY')}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <User size={12} className="shrink-0 text-zinc-400" />
                            <span className="font-medium text-zinc-900">{r.client}</span>
                            {r.categorieClient && (
                              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 ring-1 ring-blue-200">
                                {r.categorieClient}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`font-mono text-xs font-semibold ${r.devise === 'MAD' ? 'text-zinc-700' : 'text-amber-700'}`}>
                            {r.devise}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-700">
                          {fmt(r.montantInitial)} <span className="text-[10px] text-zinc-400">{r.devise}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          <span className={r.statut === 'SOLDE' ? 'text-emerald-600' : 'text-red-600'}>
                            {fmt(r.montantRestant)} <span className="text-[10px] font-normal">{r.devise}</span>
                          </span>
                          {r.devise !== 'MAD' && r.statut !== 'SOLDE' && (
                            <div className="text-[10px] font-normal text-zinc-400">
                              ≈ {fmt(toMAD(r.montantRestant, r.devise))} MAD
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatutBadge statut={r.statut} />
                        </td>
                        <td className="px-3 py-3 text-xs font-mono text-zinc-500">
                          {r.operationNumero || r.operationRef}
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-400">
                          {dayjs(r.dateMaj).format('DD/MM/YY')}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            {r.statut !== 'SOLDE' && (
                              <button
                                onClick={() => setSolderTarget(r)}
                                className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Solder / Versement partiel"
                              >
                                Solder
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete(r.id)}
                              className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
              <h3 className="mb-2 font-semibold text-zinc-900">Confirmer la suppression</h3>
              <p className="mb-5 text-sm text-zinc-600">Cette action est irréversible. Supprimer ce reliquat ?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                <Button
                  onClick={() => handleDelete(confirmDelete)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 size={14} className="mr-1" /> Supprimer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { refresh(); showToast('Reliquat créé avec succès.'); }}
        />
      )}

      {solderTarget && (
        <SolderModal
          reliquat={solderTarget}
          onClose={() => setSolderTarget(null)}
          onSolded={() => { refresh(); showToast('Versement enregistré.'); }}
        />
      )}
    </div>
  );
}
