import { useEffect, useRef, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Trash2,
  RotateCcw,
  Plus,
  Search,
  X,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getExchangeRates } from '@/lib/storage';
import { DEVISES, TAUX_PAR_DEFAUT } from '@/lib/constants';
import { newEntityId } from '@/lib/entityId';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import {
  loadCredits,
  saveCredits,
  settleCredit,
  type Credit,
  type CreditStatut,
} from '@/lib/credits';
import { enrichCreditAging, AGING_LABELS, type AgingBucket } from '@/lib/creditAging';
import { fmt, fmtRate, formatMontantFr } from '@/lib/formatNumbers';

dayjs.locale('fr');

/* ═══════════════════════════════════════
   Types & localStorage helpers
═══════════════════════════════════════ */

function getTaux(devise: string): number {
  if (devise === 'MAD') return 1;
  const rates = getExchangeRates();
  const found = rates.find((r) => r.devise === devise);
  return found?.tauxJour ?? TAUX_PAR_DEFAUT[devise] ?? 1;
}

/* ═══════════════════════════════════════
   Formatters
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   Statut config
═══════════════════════════════════════ */

const STATUT_CONFIG: Record<
  CreditStatut,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  'En cours': {
    label: 'En cours',
    badgeClass: 'bg-amber-100 text-amber-800 ring-amber-200',
    icon: Clock,
  },
  Payé: {
    label: 'Payé',
    badgeClass: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    icon: CheckCircle,
  },
  Retard: {
    label: 'Retard',
    badgeClass: 'bg-red-100 text-red-800 ring-red-200',
    icon: AlertTriangle,
  },
};

const STATUTS: CreditStatut[] = ['En cours', 'Payé', 'Retard'];

/* ═══════════════════════════════════════
   Form state
═══════════════════════════════════════ */

interface FormState {
  date: string;
  nom: string;
  devise: string;
  montant: string;
  taux: string;
  contre_val_mad: string;
  note: string;
  statut: CreditStatut;
  echeance: string;
}

interface FormErrors {
  date?: string;
  nom?: string;
  devise?: string;
  montant?: string;
  taux?: string;
}

function emptyForm(): FormState {
  const devise = 'EUR';
  return {
    date: dayjs().format('YYYY-MM-DD'),
    nom: '',
    devise,
    montant: '',
    taux: String(getTaux(devise)),
    contre_val_mad: '',
    note: '',
    statut: 'En cours',
    echeance: dayjs().add(30, 'day').format('YYYY-MM-DD'),
  };
}

function validateForm(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.date) e.date = 'Date requise';
  if (!f.nom.trim()) e.nom = 'Contrepartie requise';
  if (!f.devise) e.devise = 'Devise requise';
  if (!f.montant || parseFloat(f.montant) <= 0) e.montant = 'Montant > 0 requis';
  if (!f.taux || parseFloat(f.taux) <= 0) e.taux = 'Taux invalide';
  return e;
}

/* ═══════════════════════════════════════
   Small UI components
═══════════════════════════════════════ */

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

function StatutBadge({ statut }: { statut: CreditStatut }) {
  const cfg = STATUT_CONFIG[statut];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${cfg.badgeClass}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function Toast({
  msg,
  ok,
  onClose,
}: {
  msg: string;
  ok: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-600'
      }`}
    >
      {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
        <X size={13} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════
   Page principale
═══════════════════════════════════════ */

export function Credits() {
  const [credits, setCredits] = useState<Credit[]>(loadCredits);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [filterStatut, setFilterStatut] = useState<CreditStatut | 'Tous'>('Tous');
  const [search, setSearch] = useState('');

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /* Persist to localStorage whenever credits change */
  useEffect(() => {
    saveCredits(credits);
  }, [credits]);

  /* Auto-fill taux when devise changes */
  useEffect(() => {
    const t = getTaux(form.devise);
    setForm((f) => ({ ...f, taux: String(t) }));
  }, [form.devise]);

  /* Auto-calc contre_val_mad */
  useEffect(() => {
    const m = parseFloat(form.montant);
    const t = parseFloat(form.taux);
    if (Number.isFinite(m) && Number.isFinite(t) && m > 0 && t > 0) {
      setForm((f) => ({ ...f, contre_val_mad: formatMontantFr(m * t) }));
    } else {
      setForm((f) => ({ ...f, contre_val_mad: '' }));
    }
  }, [form.montant, form.taux]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function showToast(msg: string, ok: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  /* ── Submit ── */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast('Corrigez les erreurs avant d\'ajouter', false);
      return;
    }

    // Parser le montant en gérant le point comme séparateur de milliers
    // Ex: "50.000" → 50000 (pas 50)
    function parseMontantInput(raw: string): number {
      let s = raw.trim().replace(/\s/g, '');
      if (!s.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, ''); // "50.000" → "50000"
      } else {
        s = s.replace(',', '.'); // "50,5" → "50.5"
      }
      return parseFloat(s);
    }

    const m = parseMontantInput(form.montant);
    const t = parseMontantInput(form.taux);
    const newCredit: Credit = {
      id: newEntityId('credit'),
      date: form.date,
      nom: form.nom.trim(),
      devise: form.devise,
      montant: m,
      taux: t,
      contre_val_mad: form.contre_val_mad !== '' ? parseMontantInput(form.contre_val_mad) : m * t,
      note: form.note.trim(),
      statut: form.statut,
      echeance: form.echeance || undefined,
    };

    logAudit(
      AUDIT_ACTIONS.CREDIT_CREATE,
      { id: newCredit.id, nom: newCredit.nom, mad: newCredit.contre_val_mad },
      newCredit.date,
    );
    setCredits((prev) => [newCredit, ...prev]);
    showToast(`Crédit ajouté — ${newCredit.nom} · ${fmt(newCredit.contre_val_mad)} MAD`, true);
    setForm(emptyForm());
    setErrors({});
  }

  function handleReset() {
    setForm(emptyForm());
    setErrors({});
    setToast(null);
  }

  /* ── Actions ── */
  function marquerPayé(id: string) {
    const updated = settleCredit(id);
    if (!updated) return;
    setCredits(loadCredits());
    showToast(`Crédit soldé — ${fmt(updated.contre_val_mad)} MAD ajoutés à la caisse`, true);
  }

  function marquerRetard(id: string) {
    const c = credits.find((x) => x.id === id);
    setCredits((prev) =>
      prev.map((x) => (x.id === id ? { ...x, statut: 'Retard' } : x))
    );
    if (c) logAudit(AUDIT_ACTIONS.CREDIT_UPDATE, { id, action: 'marquerRetard' }, c.date);
  }

  function supprimerCredit(id: string) {
    const c = credits.find((x) => x.id === id);
    setCredits((prev) => prev.filter((x) => x.id !== id));
    setConfirmDelete(null);
    if (c) logAudit(AUDIT_ACTIONS.CREDIT_DELETE, { id, nom: c.nom }, c.date);
    showToast('Crédit supprimé', false);
  }

  /* ── Filtered rows ── */
  const filtered = credits.filter((c) => {
    if (filterStatut !== 'Tous' && c.statut !== filterStatut) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.nom.toLowerCase().includes(q) && !c.note.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ── Totals ── */
  const totaux = {
    enCours: credits.filter((c) => c.statut === 'En cours').reduce((s, c) => s + c.contre_val_mad, 0),
    paye:    credits.filter((c) => c.statut === 'Payé').reduce((s, c) => s + c.contre_val_mad, 0),
    retard:  credits.filter((c) => c.statut === 'Retard').reduce((s, c) => s + c.contre_val_mad, 0),
  };
  const nbEnCours = credits.filter((c) => c.statut === 'En cours').length;
  const nbRetard  = credits.filter((c) => c.statut === 'Retard').length;
  const totalEnAttente = totaux.enCours + totaux.retard;

  const agingRows = enrichCreditAging(credits);
  const agingById = new Map(agingRows.map((r) => [r.id, r]));
  const agingTotals = (['0-30', '31-60', '61-90', '90+'] as AgingBucket[]).map((bucket) => ({
    bucket,
    total: agingRows.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.contre_val_mad, 0),
    count: agingRows.filter((r) => r.bucket === bucket).length,
  }));

  const montantPreview = (() => {
    const m = parseFloat(form.montant);
    const t = parseFloat(form.taux);
    return Number.isFinite(m) && Number.isFinite(t) && m > 0 ? m * t : null;
  })();

  return (
    <div>
      <PageHero
        title="Crédits en cours"
        subtitle="Gestion des encours — feuille CRÉDITS V8 · données stockées séparément"
      />

      <div className="page-content mx-auto max-w-7xl space-y-6">
      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card
          className={`border-zinc-200 shadow-sm ${
            totalEnAttente > 0 ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-zinc-200'
          }`}
        >
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total crédits (en attente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold tabular-nums ${
                totalEnAttente > 0 ? 'text-red-600' : 'text-zinc-400'
              }`}
            >
              {fmt(totalEnAttente)} MAD
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {nbEnCours} en cours
              {nbRetard > 0 && (
                <span className="ml-2 font-semibold text-red-500">· {nbRetard} en retard</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-400 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-amber-700">{fmt(totaux.enCours)} MAD</p>
            <p className="text-xs text-zinc-400">{nbEnCours} crédit{nbEnCours !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              En retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-red-600">{fmt(totaux.retard)} MAD</p>
            <p className="text-xs text-zinc-400">{nbRetard} crédit{nbRetard !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Payés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-emerald-700">{fmt(totaux.paye)} MAD</p>
            <p className="text-xs text-zinc-400">
              {credits.filter((c) => c.statut === 'Payé').length} crédit{credits.filter((c) => c.statut === 'Payé').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Aging créances ── */}
      {agingRows.length > 0 && (
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">
              Ancienneté des créances (hors payé)
            </CardTitle>
            <p className="text-[10px] text-zinc-500">
              Basé sur l&apos;échéance saisie ou date + délai paramétré (Paramètres)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {agingTotals.map(({ bucket, total, count }) => (
                <div
                  key={bucket}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    {AGING_LABELS[bucket]}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-zinc-900">{fmt(total)} MAD</p>
                  <p className="text-[10px] text-zinc-400">{count} ligne(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Formulaire nouveau crédit ── */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="border-b border-zinc-100 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Plus size={15} className="text-blue-600" />
            Nouveau crédit
          </CardTitle>
          <p className="text-[10px] text-zinc-400">
            Les champs * sont obligatoires · Le taux est auto-rempli · Contre-val = Montant × Taux
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} noValidate>
            {toast && (
              <div className="mb-4">
                <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">

              <Field label="Date *" error={errors.date}>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  max={dayjs().format('YYYY-MM-DD')}
                  className={errors.date ? 'border-red-400 bg-red-50' : ''}
                />
              </Field>

              <Field label="Nom / Contrepartie *" error={errors.nom}>
                <Input
                  type="text"
                  placeholder="Ex. Ahmed Benali"
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className={errors.nom ? 'border-red-400 bg-red-50' : ''}
                />
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

              <Field label="Montant *" error={errors.montant}>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex. 500"
                  value={form.montant}
                  onChange={(e) => set('montant', e.target.value)}
                  className={errors.montant ? 'border-red-400 bg-red-50' : ''}
                />
              </Field>

              <Field
                label="Taux *"
                error={errors.taux}
                hint="Auto-rempli depuis les taux du jour"
              >
                <Input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={form.taux}
                  onChange={(e) => set('taux', e.target.value)}
                  className={errors.taux ? 'border-red-400 bg-red-50' : ''}
                />
              </Field>

              <Field label="Contre-val MAD" hint="Auto-calculé = Montant × Taux">
                <div className="relative">
                  <Input
                    type="text"
                    readOnly
                    value={form.contre_val_mad !== '' ? fmt(parseFloat(form.contre_val_mad)) : '—'}
                    className="cursor-default border-zinc-200 bg-zinc-50 text-right font-bold tabular-nums text-zinc-900"
                  />
                </div>
              </Field>

              <Field label="Statut">
                <NativeSelect
                  value={form.statut}
                  onChange={(v) => set('statut', v as CreditStatut)}
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </NativeSelect>
              </Field>

              <Field
                label="Échéance"
                hint="Optionnel — sinon délai depuis la date (paramètres)"
              >
                <Input
                  type="date"
                  value={form.echeance}
                  onChange={(e) => set('echeance', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Note" hint="Optionnel — détail, garantie, échéance…">
                <textarea
                  rows={2}
                  placeholder="Détail du crédit, numéro de bon, échéance prévue…"
                  value={form.note}
                  onChange={(e) => set('note', e.target.value)}
                  className="flex w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900
                    placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>

            {/* Preview */}
            {montantPreview !== null && form.nom.trim() && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
                <span className="font-medium text-blue-800">{form.nom}</span>
                <span className="text-blue-600">
                  {parseFloat(form.montant || '0').toLocaleString('fr-MA')} {form.devise}
                </span>
                <span className="text-zinc-400">×</span>
                <span className="text-blue-600">{fmtRate(parseFloat(form.taux || '0'))}</span>
                <span className="text-zinc-400">=</span>
                <span className="font-bold text-blue-900">
                  {montantPreview.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </span>
                <StatutBadge statut={form.statut} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
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
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={13} /> Ajouter le crédit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Tableau crédits ── */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="border-b border-zinc-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-900">
                Liste des crédits{' '}
                <span className="font-normal text-zinc-400">
                  ({filtered.length} résultat{filtered.length !== 1 ? 's' : ''})
                </span>
              </CardTitle>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre statut */}
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value as CreditStatut | 'Tous')}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Tous">Tous les statuts</option>
                {STATUTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Recherche */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Rechercher contrepartie…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-44 pl-7 text-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Totaux filtrés */}
          {filtered.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:grid-cols-3">
              <div>
                <span className="text-zinc-500">En cours : </span>
                <span className="font-bold text-amber-700">
                  {fmt(filtered.filter((c) => c.statut === 'En cours').reduce((s, c) => s + c.contre_val_mad, 0))} MAD
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Retard : </span>
                <span className="font-bold text-red-600">
                  {fmt(filtered.filter((c) => c.statut === 'Retard').reduce((s, c) => s + c.contre_val_mad, 0))} MAD
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Payés : </span>
                <span className="font-bold text-emerald-700">
                  {fmt(filtered.filter((c) => c.statut === 'Payé').reduce((s, c) => s + c.contre_val_mad, 0))} MAD
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <CreditCard size={32} className="text-zinc-200" />
              <p className="text-sm text-zinc-500">
                {credits.length === 0
                  ? 'Aucun crédit enregistré — utilisez le formulaire ci-dessus.'
                  : 'Aucun crédit ne correspond à ces filtres.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80">
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">
                      Nom / Contrepartie
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Devise</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Montant</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Taux</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                      Contre-val MAD
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Échéance</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Tranche</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Note</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-zinc-700">Statut</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const isEven = i % 2 === 0;
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 ${
                          isEven ? 'bg-white' : 'bg-zinc-50/40'
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">
                          {dayjs(c.date).format('DD/MM/YYYY')}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-zinc-900">{c.nom}</td>
                        <td className="px-3 py-2.5 font-bold text-zinc-800">{c.devise}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                          {fmt(c.montant)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                          {fmtRate(c.taux)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-zinc-900">
                          {fmt(c.contre_val_mad)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">
                          {c.echeance ? dayjs(c.echeance).format('DD/MM/YYYY') : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600">
                          {c.statut === 'Payé'
                            ? '—'
                            : agingById.has(c.id)
                              ? AGING_LABELS[agingById.get(c.id)!.bucket]
                              : '—'}
                        </td>
                        <td
                          className="max-w-[160px] truncate px-3 py-2.5 text-zinc-500"
                          title={c.note}
                        >
                          {c.note || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatutBadge statut={c.statut} />
                        </td>
                        <td className="px-3 py-2.5">
                          {confirmDelete === c.id ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <button
                                onClick={() => supprimerCredit(c.id)}
                                className="font-semibold text-red-500 hover:text-red-700"
                              >
                                Confirmer
                              </button>
                              <span className="text-zinc-400">|</span>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-zinc-500 hover:text-zinc-700"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {c.statut !== 'Payé' && (
                                <button
                                  onClick={() => marquerPayé(c.id)}
                                  title="Marquer payé"
                                  className="flex h-6 items-center gap-1 rounded bg-emerald-100 px-2 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                                >
                                  <CheckCircle size={10} /> Payé
                                </button>
                              )}
                              {c.statut === 'En cours' && (
                                <button
                                  onClick={() => marquerRetard(c.id)}
                                  title="Marquer en retard"
                                  className="flex h-6 items-center gap-1 rounded bg-red-100 px-2 text-[10px] font-semibold text-red-600 hover:bg-red-200"
                                >
                                  <AlertTriangle size={10} /> Retard
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDelete(c.id)}
                                title="Supprimer"
                                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-red-100 hover:text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Ligne totaux */}
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold">
                      <td colSpan={5} className="px-3 py-2.5 text-xs text-zinc-600">
                        Total ({filtered.length} crédit{filtered.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-zinc-900">
                        {fmt(filtered.reduce((s, c) => s + c.contre_val_mad, 0))} MAD
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note bas de page */}
      <p className="text-[10px] text-zinc-400">
        Les crédits de cette page sont stockés séparément des transactions (clé localStorage :{' '}
        <code className="rounded bg-zinc-100 px-1">credits</code>). Les transactions avec statut
        CRÉDIT restent suivies dans l'historique des transactions.
      </p>
      </div>{/* end page-content */}
    </div>
  );
}
