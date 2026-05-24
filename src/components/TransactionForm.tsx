import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle, XCircle, RotateCcw, Save, Calculator, Search, UserCheck, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statutVenteFromPaye } from '@/lib/calculations';
import { formatMontantFr, parseMontantStr } from '@/lib/parseMontant';
import { fmtRate } from '@/lib/formatNumbers';
import { validateOperationControls, hasBlockingIssues } from '@/lib/controls';
import { addTransaction, getExchangeRates, getClients } from '@/lib/storage';
import {
  DEVISES,
  TYPES_OPERATION,
  TYPE_OPERATION_LABEL,
  STATUTS,
  UTILISATEURS_TEST,
  buildDefaultOperation,
} from '@/lib/constants';
import type { Transaction, TransactionType, Client } from '@/types';
import { useNavigate } from 'react-router-dom';

const SEUIL_IDENTIFICATION_MAD = 10_000;

type TxStatut = Transaction['statut'];

interface FormState {
  caisseDepart: string;
  jour: string;
  mois: string;
  date: string;
  moment: 'MATIN' | 'JOURNEE' | 'SOIR';
  employeId: string;
  type: TransactionType;
  devise: string;
  montant: string;
  taux: string;
  montantMAD: string;
  statut: TxStatut;
  montantAPayer: string;
  operation: string;
  note: string;
  beneficiaire: string;
  clientId: string;
}

interface FormErrors {
  date?: string;
  employeId?: string;
  type?: string;
  devise?: string;
  montant?: string;
  taux?: string;
  statut?: string;
  jour?: string;
  mois?: string;
  montantAPayer?: string;
  clientId?: string;
}

export interface TransactionFormProps {
  onSuccess?: (tx: Transaction) => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultTaux(devise: string, type: TransactionType): string {
  if (devise === 'MAD') return '1';
  const rates = getExchangeRates();
  const found = rates.find((r) => r.devise === devise);
  if (!found) return '1';
  if (type === 'ACHAT') return String(found.tauxAchat);
  if (type === 'VENTE') return String(found.tauxVente);
  return String(found.tauxJour);
}

function tauxLabel(type: TransactionType): string {
  if (type === 'ACHAT') return 'Taux achat *';
  if (type === 'VENTE') return 'Taux vente *';
  return 'Taux *';
}

function formatMontantStr(n: number): string {
  return formatMontantFr(n);
}

function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.date) e.date = 'Date requise';
  if (!f.employeId) e.employeId = 'Employé requis';
  if (!f.type) e.type = 'Type requis';
  if (!f.devise) e.devise = 'Devise requise';
  if (!f.montant || parseFloat(f.montant) < 0.01) e.montant = 'Montant ≥ 0.01';
  if (!f.taux || parseFloat(f.taux) <= 0) e.taux = 'Taux invalide';
  if (!f.statut) e.statut = 'Statut requis';
  const j = parseInt(f.jour, 10);
  const m = parseInt(f.mois, 10);
  if (!f.jour || j < 1 || j > 31) e.jour = 'Jour 1–31';
  if (!f.mois || m < 1 || m > 12) e.mois = 'Mois 1–12';
  // Identification client obligatoire si montant ≥ seuil (R5)
  const mad = parseFloat(f.montantMAD);
  if (Number.isFinite(mad) && mad >= SEUIL_IDENTIFICATION_MAD && !f.clientId) {
    e.clientId = `Identification client obligatoire (opération ≥ ${SEUIL_IDENTIFICATION_MAD.toLocaleString('fr-MA')} MAD — R5)`;
  }
  if (f.type === 'VENTE') {
    const mad = Number.isFinite(parseMontantStr(f.montantMAD))
      ? parseMontantStr(f.montantMAD)
      : parseMontantStr(f.montant) * parseMontantStr(f.taux);
    const paye = f.montantAPayer.trim() === '' ? 0 : parseMontantStr(f.montantAPayer);
    if (!Number.isFinite(mad) || mad <= 0) {
      e.montantAPayer = 'Montant vente (MAD) requis';
    } else if (!Number.isFinite(paye) || paye < 0) {
      e.montantAPayer = 'Montant payé invalide';
    } else if (paye > mad + 0.001) {
      e.montantAPayer = 'Le montant payé ne peut pas dépasser le montant de la vente';
    }
  }
  return e;
}

function emptyForm(): FormState {
  const d = dayjs();
  const devise = 'EUR';
  const type: TransactionType = 'ACHAT';
  return {
    caisseDepart: '',
    jour: String(d.date()),
    mois: String(d.month() + 1),
    date: todayStr(),
    moment: 'JOURNEE' as const,
    employeId: UTILISATEURS_TEST[0]?.id ?? '',
    type,
    devise,
    montant: '',
    taux: getDefaultTaux(devise, type),
    montantMAD: '',
    statut: 'PAYÉ',
    montantAPayer: '',
    operation: '',
    note: '',
    beneficiaire: '',
    clientId: '',
  };
}

interface ToastState { msg: string; ok: boolean }

/* ─── Small UI components ─── */

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
        toast.ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {toast.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {toast.msg}
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `space-y-1 ${className}` : 'space-y-1'}>
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

/* ─── ClientSelector ─── */

function ClientSelector({
  value,
  onChange,
  hasError,
  required,
}: {
  value: string;
  onChange: (id: string, client: Client | null) => void;
  hasError?: boolean;
  required?: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const clients = getClients();

  const selected = clients.find((c) => c.id === value) ?? null;

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.nom.toLowerCase().includes(q) ||
      c.pieceNumero.toLowerCase().includes(q)
    );
  });

  const CAT_BADGE: Record<string, string> = {
    STANDARD: 'bg-zinc-100 text-zinc-600',
    HABITUEL: 'bg-blue-100 text-blue-700',
    AMI:      'bg-amber-100 text-amber-700',
  };
  const CAT_EMOJI: Record<string, string> = { STANDARD: '○', HABITUEL: '✅', AMI: '⭐' };

  return (
    <div className="relative">
      {/* Trigger */}
      {selected ? (
        <div className={`flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm ${hasError ? 'border-red-400' : 'border-zinc-300'}`}>
          <UserCheck size={13} className="shrink-0 text-blue-500" />
          <span className="flex-1 font-medium text-zinc-900 truncate">{selected.nom}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${CAT_BADGE[selected.categorie]}`}>
            {CAT_EMOJI[selected.categorie]} {selected.categorie}
          </span>
          <button
            type="button"
            onClick={() => { onChange('', null); setSearch(''); }}
            className="text-zinc-400 hover:text-zinc-700"
          >
            <XIcon size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-full items-center gap-2 rounded-md border bg-white px-3 text-sm text-left transition-colors hover:border-zinc-400 ${hasError ? 'border-red-400 bg-red-50' : 'border-zinc-300'}`}
        >
          <Search size={13} className="shrink-0 text-zinc-400" />
          <span className={required ? 'text-zinc-400' : 'text-zinc-400'}>
            {required ? 'Sélectionner client (obligatoire ≥10k)…' : 'Sélectionner client (optionnel)…'}
          </span>
        </button>
      )}

      {/* Dropdown */}
      {open && !selected && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-[280px] rounded-lg border border-zinc-300 bg-white py-1 shadow-xl">
          <div className="px-2 pb-1 pt-1">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, N° pièce..."
              className="flex h-8 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">Aucun client trouvé.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id, c); setOpen(false); setSearch(''); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-100"
                >
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${CAT_BADGE[c.categorie]}`}>
                    {CAT_EMOJI[c.categorie]}
                  </span>
                  <span className="flex-1 text-left font-medium text-zinc-900 truncate">{c.nom}</span>
                  <span className="shrink-0 font-mono text-zinc-400">{c.pieceNumero}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-zinc-100 px-2 pb-2 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/clients'); }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              + Gérer la base clients →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full flex items-center gap-2 border-b border-zinc-100 pb-1 pt-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{children}</span>
    </div>
  );
}

/* ─── Main form ─── */

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opDirty = useRef(false);
  /** false = montant payé suit le montant de vente (taux × quantité) */
  const payeDirty = useRef(false);

  /* Sync jour/mois from date */
  useEffect(() => {
    const d = dayjs(form.date);
    if (d.isValid()) {
      setForm((f) => ({ ...f, jour: String(d.date()), mois: String(d.month() + 1) }));
    }
  }, [form.date]);

  /* Auto-fill taux when devise or type changes */
  useEffect(() => {
    setForm((f) => ({ ...f, taux: getDefaultTaux(f.devise, f.type) }));
  }, [form.devise, form.type]);

  /* Auto-calculate montantMAD ; VENTE : montant payé = montant vente tant que non modifié */
  useEffect(() => {
    const m = parseMontantStr(form.montant);
    const t = parseMontantStr(form.taux);
    if (Number.isFinite(m) && Number.isFinite(t) && m > 0 && t > 0) {
      const madNum = Math.round(m * t * 100) / 100;
      const mad = formatMontantStr(madNum);
      setForm((f) => {
        const next: Partial<FormState> = { montantMAD: mad };
        if (f.type === 'VENTE' && !payeDirty.current) {
          next.montantAPayer = formatMontantFr(madNum);
        }
        return { ...f, ...next };
      });
    } else {
      setForm((f) => ({ ...f, montantMAD: '' }));
    }
  }, [form.montant, form.taux, form.type]);

  /* VENTE : statut auto PAYÉ / NON-PAYÉ selon reste dû */
  useEffect(() => {
    if (form.type !== 'VENTE') return;
    const mad = parseMontantStr(form.montantMAD);
    if (!Number.isFinite(mad) || mad <= 0) return;
    const paye = form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer);
    const payeOk = Number.isFinite(paye) && paye >= 0 ? paye : 0;
    const statut = statutVenteFromPaye(mad, payeOk);
    setForm((f) => (f.statut === statut ? f : { ...f, statut }));
  }, [form.type, form.montantMAD, form.montantAPayer]);

  /* Auto-fill operation libellé */
  useEffect(() => {
    if (opDirty.current) return;
    const m = parseFloat(form.montant);
    if (!form.montant || !form.devise) return;
    setForm((f) => ({
      ...f,
      operation: buildDefaultOperation(f.type, Number.isFinite(m) ? m : 0, f.devise),
    }));
  }, [form.type, form.montant, form.devise]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function applyPaiementCompletVente() {
    if (!hasMAD) return;
    payeDirty.current = false;
    setForm((f) => ({
      ...f,
      montantAPayer: formatMontantFr(montantMADNum),
      statut: 'PAYÉ',
    }));
    setErrors((e) => ({ ...e, montantAPayer: undefined }));
  }

  function showToast(msg: string, ok: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast('Corrigez les erreurs avant d\'enregistrer', false);
      return;
    }

    const now = dayjs();
    const d = dayjs(form.date).hour(now.hour()).minute(now.minute()).second(now.second());
    const employe = UTILISATEURS_TEST.find((u) => u.id === form.employeId);
    const montantMADFinal =
      form.montantMAD.trim() !== '' && Number.isFinite(parseMontantStr(form.montantMAD))
        ? parseMontantStr(form.montantMAD)
        : parseMontantStr(form.montant) * parseMontantStr(form.taux);

    let statutFinal = form.statut;
    let montantAPayer: number | undefined;
    if (form.type === 'VENTE') {
      const paye = form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer);
      montantAPayer = Number.isFinite(paye) && paye >= 0 ? paye : 0;
      statutFinal = statutVenteFromPaye(montantMADFinal, montantAPayer);
    } else if (form.statut === 'CRÉDIT' && form.montantAPayer.trim() !== '') {
      const ap = parseFloat(form.montantAPayer);
      montantAPayer = Number.isFinite(ap) ? ap : undefined;
    }
    const caisseDepart =
      form.caisseDepart.trim() !== '' ? parseFloat(form.caisseDepart) : undefined;

    const montantNum = parseFloat(form.montant);
    const tauxNum = parseFloat(form.taux);

    // Bloquer paiement partiel pour client STANDARD
    if (form.type === 'VENTE' && form.clientId) {
      const selectedClient = getClients().find((c) => c.id === form.clientId);
      if (selectedClient?.categorie === 'STANDARD') {
        const paye = form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer);
        if (paye < montantMADFinal - 0.01) {
          showToast(
            `Client STANDARD "${selectedClient.nom}" — paiement intégral requis. Opérations partielles (reliquats) réservées aux clients HABITUEL / AMI.`,
            false
          );
          return;
        }
      }
    }

    const controlIssues = validateOperationControls({
      type: form.type,
      devise: form.devise,
      montant: montantNum,
      montantMAD: montantMADFinal,
      note: form.note,
    });
    if (hasBlockingIssues(controlIssues)) {
      showToast(controlIssues.find((i) => i.level === 'error')!.message, false);
      return;
    }
    if (controlIssues.some((i) => i.level === 'warning')) {
      const w = controlIssues.find((i) => i.level === 'warning')!;
      if (!window.confirm(`${w.message}\n\nEnregistrer quand même ?`)) return;
    }

    const tx = addTransaction({
      date: d.toDate(),
      caisseDepart: caisseDepart !== undefined && Number.isFinite(caisseDepart) ? caisseDepart : undefined,
      jour: parseInt(form.jour, 10),
      mois: parseInt(form.mois, 10),
      moment: form.moment,
      employeId: form.employeId,
      employeNom: employe?.nom,
      type: form.type,
      operation:
        form.operation.trim() ||
        buildDefaultOperation(form.type, montantNum, form.devise),
      devise: form.devise.toUpperCase(),
      montant: montantNum,
      taux: tauxNum,
      montantMAD: montantMADFinal,
      montantAPayer:
        montantAPayer !== undefined && Number.isFinite(montantAPayer) ? montantAPayer : undefined,
      note: form.note.trim(),
      statut: statutFinal,
      beneficiaire:
        form.type === 'DEPOT' && form.beneficiaire.trim()
          ? form.beneficiaire.trim()
          : undefined,
      clientId: form.clientId || undefined,
    });

    showToast(`${tx.numero ? `[${tx.numero}] ` : ''}${TYPE_OPERATION_LABEL[form.type]} ${montantNum} ${form.devise} — enregistré`, true);
    opDirty.current = false;
    payeDirty.current = false;
    setForm(emptyForm());
    setErrors({});
    onSuccess?.(tx);
  }

  function handleReset() {
    opDirty.current = false;
    payeDirty.current = false;
    setForm(emptyForm());
    setErrors({});
    setToast(null);
  }

  const montantMADNum = parseMontantStr(form.montantMAD);
  const hasMAD = Number.isFinite(montantMADNum) && montantMADNum > 0;
  const payeNum =
    form.montantAPayer.trim() === '' ? 0 : parseMontantStr(form.montantAPayer);
  const payeOk = Number.isFinite(payeNum) && payeNum >= 0;
  const resteNonPayeAffiche =
    form.type === 'VENTE' && hasMAD && payeOk
      ? formatMontantFr(Math.max(0, Math.round((montantMADNum - payeNum) * 100) / 100))
      : '';

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader className="border-b border-zinc-100 pb-4">
        <CardTitle className="text-base font-semibold text-zinc-900">
          Nouvelle opération — Caisse V8
        </CardTitle>
        <p className="text-xs text-zinc-400">
          Tous les champs marqués * sont obligatoires. Le taux est auto-rempli depuis les taux du jour (achat/vente).
        </p>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} noValidate>
          {toast && (
            <div className="mb-4">
              <Toast toast={toast} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">

            {/* ── Section 1: Identification journée ── */}
            <SectionLabel>Identification journée</SectionLabel>

            <Field label="Jour *" error={errors.jour} hint="Auto-rempli depuis la date">
              <Input
                type="number"
                min={1}
                max={31}
                value={form.jour}
                onChange={(e) => set('jour', e.target.value)}
                className={errors.jour ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}
              />
            </Field>

            <Field label="Mois *" error={errors.mois} hint="Auto-rempli depuis la date">
              <Input
                type="number"
                min={1}
                max={12}
                value={form.mois}
                onChange={(e) => set('mois', e.target.value)}
                className={errors.mois ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}
              />
            </Field>

            <Field label="Date complète *" error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                max={todayStr()}
                className={errors.date ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}
              />
            </Field>

            <Field label="Moment" hint="Phase de la journée">
              <div className="flex h-9 gap-0 overflow-hidden rounded-md border border-zinc-300 bg-white text-sm">
                {(['MATIN', 'JOURNEE', 'SOIR'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('moment', m)}
                    className={[
                      'flex-1 border-r border-zinc-200 px-1 text-xs font-semibold transition-colors last:border-r-0',
                      form.moment === m
                        ? m === 'MATIN'
                          ? 'bg-sky-600 text-white'
                          : m === 'JOURNEE'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-violet-600 text-white'
                        : 'text-zinc-500 hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    {m === 'JOURNEE' ? 'JOURNÉE' : m}
                  </button>
                ))}
              </div>
            </Field>

            {/* ── Section 2: Opération ── */}
            <SectionLabel>Détails de l'opération</SectionLabel>

            <Field label="Employé *" error={errors.employeId}>
              <NativeSelect
                value={form.employeId}
                onChange={(v) => set('employeId', v)}
                hasError={!!errors.employeId}
              >
                {UTILISATEURS_TEST.map((u) => (
                  <option key={u.id} value={u.id}>{u.nom}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Type / Section *" error={errors.type}>
              <NativeSelect
                value={form.type}
                onChange={(v) => {
                  const type = v as TransactionType;
                  payeDirty.current = false;
                  setForm((f) => {
                    const mad = parseMontantStr(f.montantMAD);
                    const madOk = Number.isFinite(mad) && mad > 0;
                    const payeVente = madOk ? formatMontantFr(mad) : '';
                    return {
                      ...f,
                      type,
                      montantAPayer: type === 'VENTE' ? payeVente : '',
                      statut:
                        type === 'VENTE' && madOk
                          ? statutVenteFromPaye(mad, mad)
                          : type === 'VENTE'
                            ? 'NON-PAYÉ'
                            : f.statut,
                    };
                  });
                  setErrors((e) => ({ ...e, type: undefined, montantAPayer: undefined }));
                }}
                hasError={!!errors.type}
              >
                {TYPES_OPERATION.map((t) => (
                  <option key={t} value={t}>{TYPE_OPERATION_LABEL[t]}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Devise *" error={errors.devise}>
              <NativeSelect
                value={form.devise}
                onChange={(v) => set('devise', v)}
                hasError={!!errors.devise}
              >
                {DEVISES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Montant / Quantité *" error={errors.montant}>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex. 500"
                value={form.montant}
                onChange={(e) => set('montant', e.target.value)}
                className={errors.montant ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}
              />
            </Field>

            {/* ── Section 3: Calcul MAD ── */}
            <SectionLabel>Calcul MAD</SectionLabel>

            <Field
              label={tauxLabel(form.type)}
              error={errors.taux}
              hint={
                form.devise !== 'MAD'
                  ? `Auto-rempli : ${form.type === 'ACHAT' ? 'taux achat' : form.type === 'VENTE' ? 'taux vente' : 'taux jour'}`
                  : 'MAD → taux 1'
              }
            >
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={form.taux}
                onChange={(e) => set('taux', e.target.value)}
                className={errors.taux ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}
              />
            </Field>

            <Field
              label={form.type === 'VENTE' ? 'Montant de vente (MAD)' : 'Montant en MAD'}
              hint="Prix vente × quantité (devise)"
            >
              <div className="relative">
                <Input
                  type="text"
                  readOnly
                  value={hasMAD ? formatMontantFr(montantMADNum) : '—'}
                  className="cursor-default border-zinc-200 bg-zinc-50 text-right font-bold tabular-nums text-zinc-900 focus:ring-0"
                />
                <Calculator
                  size={12}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
              </div>
            </Field>

            {form.type === 'VENTE' && (
              <>
                <Field
                  label="Montant payé (MAD)"
                  error={errors.montantAPayer}
                  hint="Par défaut = vente — réduire si partiel"
                >
                  <div className="flex gap-1.5">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={form.montantAPayer}
                      onChange={(e) => {
                        payeDirty.current = true;
                        set('montantAPayer', e.target.value);
                      }}
                      onBlur={() => {
                        if (form.montantAPayer.trim() === '') {
                          payeDirty.current = true;
                          set('montantAPayer', formatMontantFr(0));
                        }
                      }}
                      className={
                        errors.montantAPayer
                          ? 'min-w-0 flex-1 border-red-400 bg-red-50 text-right text-sm font-bold tabular-nums text-zinc-900 focus:ring-red-400'
                          : 'min-w-0 flex-1 bg-white text-right text-sm font-bold tabular-nums text-zinc-900'
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!hasMAD}
                      onClick={applyPaiementCompletVente}
                      className="shrink-0 px-2 text-[10px] font-semibold"
                      title="Paiement total — statut PAYÉ"
                    >
                      Complet
                    </Button>
                  </div>
                </Field>
                <Field
                  label="Reste non payé (MAD)"
                  hint="Vente − payé"
                >
                  <Input
                    type="text"
                    readOnly
                    value={resteNonPayeAffiche === '' ? '—' : resteNonPayeAffiche}
                    className="cursor-default border-zinc-200 bg-zinc-50 text-right text-sm font-bold tabular-nums text-zinc-900 focus:ring-0"
                  />
                </Field>
              </>
            )}

            {/* ── Section 4: Statut & paiement ── */}
            <SectionLabel>Statut & paiement</SectionLabel>

            {form.type === 'VENTE' ? (
              <Field label="Statut du solde *" error={errors.statut} hint="Automatique selon le reste">
                <Input
                  type="text"
                  readOnly
                  value={form.statut}
                  className={`cursor-default border-zinc-200 bg-zinc-50 font-bold focus:ring-0 ${
                    form.statut === 'PAYÉ' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                />
              </Field>
            ) : (
              <>
                <Field label="Statut *" error={errors.statut}>
                  <NativeSelect
                    value={form.statut}
                    onChange={(v) => set('statut', v as TxStatut)}
                    hasError={!!errors.statut}
                  >
                    {STATUTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </Field>
                {form.statut === 'CRÉDIT' && (
                  <Field label="À payer (MAD)" hint="Montant restant dû pour ce crédit">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex. 1 150,00"
                      value={form.montantAPayer}
                      onChange={(e) => set('montantAPayer', e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}

            {form.type === 'DEPOT' && (
              <Field label="Bénéficiaire" hint="Optionnel">
                <Input
                  type="text"
                  placeholder="Nom ou référence"
                  value={form.beneficiaire}
                  onChange={(e) => set('beneficiaire', e.target.value)}
                />
              </Field>
            )}

            {/* ── Section 5: Identification client ── */}
            <SectionLabel>
              {hasMAD && montantMADNum >= SEUIL_IDENTIFICATION_MAD
                ? `⚠️ Identification client (R5 — ≥ ${SEUIL_IDENTIFICATION_MAD.toLocaleString('fr-MA')} MAD)`
                : 'Client (optionnel)'}
            </SectionLabel>

            <Field
              label={hasMAD && montantMADNum >= SEUIL_IDENTIFICATION_MAD ? 'Client *' : 'Client'}
              error={errors.clientId}
              hint={
                hasMAD && montantMADNum >= SEUIL_IDENTIFICATION_MAD
                  ? 'Obligatoire au-delà du seuil réglementaire'
                  : 'Lier une transaction à un client enregistré'
              }
              className="col-span-full"
            >
              <ClientSelector
                value={form.clientId}
                onChange={(id) => {
                  set('clientId', id);
                }}
                hasError={!!errors.clientId}
                required={hasMAD && montantMADNum >= SEUIL_IDENTIFICATION_MAD}
              />
            </Field>
          </div>

          {/* ── Section 5: Libellé & Note ── */}
          <div className="mt-1 border-b border-zinc-100 pb-1 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Libellé & note
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Opération * (libellé synthétique)"
              hint="Auto-rempli — modifiable (ex. : « Achat EUR 500 — client Ahmed »)"
            >
              <textarea
                rows={2}
                placeholder="Ex. Vente EUR 300 — client vitrine"
                value={form.operation}
                onChange={(e) => {
                  opDirty.current = true;
                  set('operation', e.target.value);
                }}
                className="flex w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900
                  placeholder:text-zinc-400 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </Field>

            <Field label="Note" hint="Optionnel — contrepartie, détail crédit, remarque">
              <textarea
                rows={2}
                placeholder="Contrepartie, détail, numéro de bon…"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                className="flex w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900
                  placeholder:text-zinc-400 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </Field>
          </div>

          {/* ── Résumé avant envoi ── */}
          {hasMAD && form.montant && form.devise && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
              <span className="font-medium text-blue-800">
                {TYPE_OPERATION_LABEL[form.type]}
              </span>
              <span className="text-blue-600">
                {parseFloat(form.montant).toLocaleString('fr-MA')} {form.devise}
              </span>
              <span className="text-zinc-400">×</span>
              <span className="text-blue-600">{fmtRate(parseFloat(form.taux) || 0)}</span>
              <span className="text-zinc-400">=</span>
              <span className="font-bold text-blue-900">
                {montantMADNum.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
              </span>
              {form.type === 'VENTE' && (
                <>
                  <span className="text-zinc-400">|</span>
                  <span className="text-blue-700">
                    Payé{' '}
                    {(form.montantAPayer.trim() === ''
                      ? 0
                      : parseMontantStr(form.montantAPayer)
                    ).toLocaleString('fr-MA', { minimumFractionDigits: 2 })}{' '}
                    MAD
                  </span>
                  {resteNonPayeAffiche !== '' && (
                    <span
                      className={
                        montantMADNum - payeNum <= 0.001
                          ? 'font-semibold text-emerald-800'
                          : 'font-semibold text-red-700'
                      }
                    >
                      Reste dû {resteNonPayeAffiche} MAD
                    </span>
                  )}
                </>
              )}
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  form.statut === 'PAYÉ'
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                    : form.statut === 'CRÉDIT'
                    ? 'bg-amber-100 text-amber-800 ring-amber-200'
                    : 'bg-red-100 text-red-800 ring-red-200'
                }`}
              >
                {form.statut}
              </span>
            </div>
          )}

          {/* ── Boutons ── */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-zinc-600"
            >
              <RotateCcw size={13} /> Réinitialiser
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Save size={13} /> Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
