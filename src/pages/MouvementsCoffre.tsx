import { useEffect, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { Modal } from '@/components/Modal';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  Lock,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Vault,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getMouvements,
  getSoldeDevise,
  appendAlimentation,
  appendPrelevement,
} from '@/lib/storage';
import { DEVISES } from '@/lib/constants';
import type { MouvementCaisse, ContexteCoffre } from '@/types';
import { fmt } from '@/lib/formatNumbers';

dayjs.locale('fr');

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CONTEXTE_LABELS: Record<ContexteCoffre, string> = {
  AVANT_OUVERTURE: 'Avant ouverture (7h)',
  EN_SEANCE:       'En séance (8h–18h)',
  APRES_CLOTURE:   'Après clôture (19h)',
};

function detectContexte(): ContexteCoffre {
  const h = new Date().getHours();
  if (h < 8) return 'AVANT_OUVERTURE';
  if (h < 18) return 'EN_SEANCE';
  return 'APRES_CLOTURE';
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function signPrefix(n: number) {
  return n > 0 ? '+' : '';
}

function signClass(n: number) {
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-red-600';
  return 'text-zinc-500';
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

const TYPE_CFG = {
  ALIMENTATION: { label: 'ALIM.', badgeClass: 'bg-cyan-100 text-cyan-800 ring-cyan-200' },
  PRELEVEMENT:  { label: 'PRÉL.', badgeClass: 'bg-rose-100 text-rose-800 ring-rose-200' },
};

function TypeBadge({ type }: { type: 'ALIMENTATION' | 'PRELEVEMENT' }) {
  const cfg = TYPE_CFG[type];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

// ─── ContexteBadge ───────────────────────────────────────────────────────────

const CTX_CFG: Record<ContexteCoffre, { label: string; cls: string }> = {
  AVANT_OUVERTURE: { label: 'AVANT OUV.', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  EN_SEANCE:       { label: 'EN SÉANCE',  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  APRES_CLOTURE:   { label: 'APRÈS CLÔ.', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
};

function ContexteBadge({ contexte }: { contexte?: ContexteCoffre }) {
  if (!contexte) return <span className="text-xs text-zinc-400">—</span>;
  const cfg = CTX_CFG[contexte];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-2">
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <div className="text-right text-xs">{children}</div>
    </div>
  );
}

// ─── CoffreModal ─────────────────────────────────────────────────────────────

interface ModalForm {
  devise: string;
  montant: string;
  raison: string;
  contexte: ContexteCoffre;
  signature: string;
}

type ModalMode = 'ALIMENTATION' | 'PRELEVEMENT';

interface CoffreModalProps {
  open: boolean;
  mode: ModalMode;
  soldeCourant: Record<string, number>;
  onClose: () => void;
  onDone: () => void;
}

function CoffreModal({ open, mode, soldeCourant, onClose, onDone }: CoffreModalProps) {
  const isAlim = mode === 'ALIMENTATION';

  const [form, setForm] = useState<ModalForm>({
    devise: 'MAD',
    montant: '',
    raison: '',
    contexte: detectContexte(),
    signature: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ModalForm, string>>>({});
  const [warned, setWarned] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({ devise: 'MAD', montant: '', raison: '', contexte: detectContexte(), signature: '' });
      setErrors({});
      setWarned(false);
    }
  }, [open]);

  function field<K extends keyof ModalForm>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErrors((er) => ({ ...er, [k]: undefined }));
      if (k !== 'montant') setWarned(false);
    };
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof ModalForm, string>> = {};
    const montant = parseFloat(form.montant);
    if (!form.montant || !Number.isFinite(montant) || montant <= 0) {
      errs.montant = 'Montant requis (> 0)';
    }
    if (!form.devise) errs.devise = 'Devise requise';
    if (form.raison.trim().length < 10) errs.raison = 'Raison requise (minimum 10 caractères)';
    if (!form.signature.trim()) errs.signature = 'Signature requise';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const montant = parseFloat(form.montant);
    const solde = soldeCourant[form.devise] ?? 0;

    if (!isAlim && montant > solde) {
      if (!warned) {
        setWarned(true);
        return;
      }
      if (!window.confirm(`⚠️ Prélèvement (${fmt(montant)} ${form.devise}) supérieur au solde caisse (${fmt(solde)} ${form.devise}).\n\nConfirmer malgré tout ?`)) {
        return;
      }
    }

    const params = {
      montant,
      devise: form.devise,
      note: form.raison.trim(),
      contexte: form.contexte,
      signature: form.signature.trim(),
    };

    if (isAlim) {
      appendAlimentation(params);
    } else {
      appendPrelevement(params);
    }

    onDone();
  }

  const montantNum = parseFloat(form.montant);
  const solde = soldeCourant[form.devise] ?? 0;
  const showSoldeWarning = !isAlim && Number.isFinite(montantNum) && montantNum > 0 && montantNum > solde;

  return (
    <Modal
      open={open}
      onClose={onClose}
      headerClass={isAlim ? 'bg-cyan-600' : 'bg-rose-600'}
      maxWidth="max-w-lg"
      title={
        <div className="flex items-center gap-2.5">
          {isAlim
            ? <Plus size={18} className="text-white" />
            : <Minus size={18} className="text-white" />
          }
          <span className="text-base font-bold text-white">
            {isAlim ? 'Alimentation — Ajouter au coffre' : 'Prélèvement — Retirer du coffre'}
          </span>
        </div>
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            className={isAlim ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
            onClick={handleSubmit}
          >
            {isAlim ? <Plus size={14} className="mr-1" /> : <Minus size={14} className="mr-1" />}
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Devise + Montant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Devise *</label>
            <select
              value={form.devise}
              onChange={field('devise')}
              className={`flex h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.devise ? 'border-red-400' : 'border-zinc-300'}`}
            >
              {['MAD', ...DEVISES.filter((d) => d !== 'MAD')].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.devise && <p className="text-[10px] text-red-500">{errors.devise}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Montant *</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={form.montant}
              onChange={field('montant')}
              className={errors.montant ? 'border-red-400' : ''}
            />
            {errors.montant && <p className="text-[10px] text-red-500">{errors.montant}</p>}
          </div>
        </div>

        {/* Solde courant */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
          <span className="text-zinc-500">Solde actuel {form.devise} : </span>
          <span className={`font-bold tabular-nums ${solde < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {signPrefix(solde)}{fmt(solde)}
          </span>
        </div>

        {/* Warning prélèvement > solde */}
        {showSoldeWarning && (
          <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${warned ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>
              {warned
                ? `Deuxième avertissement — ce prélèvement (${fmt(montantNum)} ${form.devise}) dépasse le solde disponible (${fmt(solde)} ${form.devise}). Cliquez à nouveau pour forcer.`
                : `Attention : prélèvement supérieur au solde disponible (${fmt(solde)} ${form.devise}). Cliquez une deuxième fois pour confirmer.`
              }
            </span>
          </div>
        )}

        {/* Raison */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Raison *</label>
          <textarea
            rows={2}
            placeholder="Ex. : Apport comptoir ouverture, Dépôt banque, Retrait privé…"
            value={form.raison}
            onChange={field('raison')}
            className={`flex w-full resize-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.raison ? 'border-red-400' : 'border-zinc-300'}`}
          />
          <div className="flex items-center justify-between">
            {errors.raison
              ? <p className="text-[10px] text-red-500">{errors.raison}</p>
              : <span />
            }
            <p className={`text-[10px] tabular-nums ${form.raison.trim().length < 10 ? 'text-zinc-400' : 'text-emerald-600'}`}>
              {form.raison.trim().length}/10 min.
            </p>
          </div>
        </div>

        {/* Contexte */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Contexte</label>
          <select
            value={form.contexte}
            onChange={field('contexte')}
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(Object.entries(CONTEXTE_LABELS) as [ContexteCoffre, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-400">Détecté automatiquement · modifiable si nécessaire</p>
        </div>

        {/* Signature */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Signature (responsable) *</label>
          <Input
            placeholder="Nom du responsable"
            value={form.signature}
            onChange={field('signature')}
            className={errors.signature ? 'border-red-400' : ''}
          />
          {errors.signature && <p className="text-[10px] text-red-500">{errors.signature}</p>}
        </div>
      </div>
    </Modal>
  );
}

// ─── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({ open, mv, onClose }: { open: boolean; mv: MouvementCaisse | null; onClose: () => void }) {
  const isAlim = mv?.type === 'ALIMENTATION';

  return (
    <Modal
      open={open}
      onClose={onClose}
      headerClass={isAlim ? 'bg-cyan-600' : 'bg-rose-600'}
      maxWidth="max-w-sm"
      title={`${isAlim ? '💵 Alimentation' : '💸 Prélèvement'} — Détail`}
      footer={<Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>}
    >
      {mv && (
        <div className="space-y-3">
          <Row label="Type">
            <TypeBadge type={mv.type as 'ALIMENTATION' | 'PRELEVEMENT'} />
          </Row>
          <Row label="Devise">
            <span className="font-mono font-bold text-zinc-900">{mv.devise}</span>
          </Row>
          <Row label="Montant">
            <span className={`font-bold tabular-nums ${signClass(mv.montant)}`}>
              {signPrefix(mv.montant)}{fmt(Math.abs(mv.montant))} {mv.devise}
            </span>
          </Row>
          <Row label="Solde avant">
            <span className="tabular-nums text-zinc-700">{fmt(mv.soldeAvant)} {mv.devise}</span>
          </Row>
          <Row label="Solde après">
            <span className={`font-semibold tabular-nums ${signClass(mv.soldeApres)}`}>
              {fmt(mv.soldeApres)} {mv.devise}
            </span>
          </Row>
          <Row label="Raison">
            <span className="text-zinc-800">{mv.note ?? '—'}</span>
          </Row>
          {mv.contexte && (
            <Row label="Contexte">
              <ContexteBadge contexte={mv.contexte} />
            </Row>
          )}
          <Row label="Par">
            <span className="font-medium text-zinc-800">{mv.caissier}</span>
          </Row>
          <Row label="Heure">
            <span className="font-mono text-zinc-700">{dayjs(mv.timestamp).format('DD/MM/YYYY HH:mm:ss')}</span>
          </Row>
          <Row label="Statut">
            <span className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-zinc-700">
              <Lock size={10} /> VERROUILLÉ
            </span>
          </Row>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function MouvementsCoffre() {
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>(getMouvements);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [detail, setDetail] = useState<MouvementCaisse | null>(null);
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterType, setFilterType] = useState<'TOUS' | 'ALIMENTATION' | 'PRELEVEMENT'>('TOUS');
  const [filterDevise, setFilterDevise] = useState('TOUS');
  const [page, setPage] = useState(1);

  function refresh() {
    setMouvements(getMouvements());
    setPage(1);
    setModal(null);
  }

  useEffect(() => {
    const handler = () => setMouvements(getMouvements());
    window.addEventListener('afromoney-mouvements', handler);
    return () => window.removeEventListener('afromoney-mouvements', handler);
  }, []);

  const coffreMouvements = mouvements.filter(
    (m) => m.type === 'ALIMENTATION' || m.type === 'PRELEVEMENT'
  );

  const devisesList = ['MAD', ...DEVISES.filter((d) => d !== 'MAD')];
  const soldeCourant = Object.fromEntries(
    devisesList.map((d) => [d, getSoldeDevise(d, mouvements)])
  );
  const devisesActives = devisesList.filter((d) => soldeCourant[d] !== 0);
  const devisesDispos = [...new Set(coffreMouvements.map((m) => m.devise))].sort();

  const filtered = coffreMouvements
    .filter((m) => {
      if (filterDate && !m.timestamp.startsWith(filterDate)) return false;
      if (filterType !== 'TOUS' && m.type !== filterType) return false;
      if (filterDevise !== 'TOUS' && m.devise !== filterDevise) return false;
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAlim = coffreMouvements.filter((m) => m.type === 'ALIMENTATION').reduce((s, m) => s + m.montant, 0);
  const totalPrel = coffreMouvements.filter((m) => m.type === 'PRELEVEMENT').reduce((s, m) => s + Math.abs(m.montant), 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Mouvements Coffre"
        subtitle="Alimentations & Prélèvements · Traçabilité complète 🔒"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={() => setModal('ALIMENTATION')}
            >
              <Plus size={14} className="mr-1" /> Alimentation
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => setModal('PRELEVEMENT')}
            >
              <Minus size={14} className="mr-1" /> Prélèvement
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── KPI coffre ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Opérations</p>
              <p className="mt-0.5 text-2xl font-bold text-zinc-900">{coffreMouvements.length}</p>
              <p className="text-[10px] text-zinc-400">total coffre</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Alimentations</p>
              <p className="mt-0.5 text-xl font-bold text-cyan-700 tabular-nums">+{fmt(totalAlim)}</p>
              <p className="text-[10px] text-zinc-400">total MAD entré</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Prélèvements</p>
              <p className="mt-0.5 text-xl font-bold text-rose-700 tabular-nums">-{fmt(totalPrel)}</p>
              <p className="text-[10px] text-zinc-400">total MAD sorti</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Net coffre</p>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${totalAlim - totalPrel >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {signPrefix(totalAlim - totalPrel)}{fmt(totalAlim - totalPrel)}
              </p>
              <p className="text-[10px] text-zinc-400">MAD net</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Soldes courants ── */}
        {devisesActives.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {devisesActives.map((d) => {
              const s = soldeCourant[d];
              return (
                <Card key={d} className={s < 0 ? 'border-red-200' : 'border-zinc-200'}>
                  <CardContent className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Vault size={10} className="shrink-0 text-zinc-400" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{d}</p>
                    </div>
                    <p className={`mt-0.5 text-lg font-bold tabular-nums ${s < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                      {signPrefix(s)}{fmt(s)}
                    </p>
                    <p className="text-[9px] text-zinc-400">solde caisse</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Filtres ── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
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

              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as typeof filterType); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Tous types</option>
                <option value="ALIMENTATION">Alimentation</option>
                <option value="PRELEVEMENT">Prélèvement</option>
              </select>

              <select
                value={filterDevise}
                onChange={(e) => { setFilterDevise(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Toutes devises</option>
                {devisesDispos.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── Table ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              Mouvements coffre
              <span className="ml-2 font-normal text-zinc-400">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400">
                {coffreMouvements.length === 0
                  ? 'Aucun mouvement coffre. Créez votre première alimentation ou votre premier prélèvement.'
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
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Contexte</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Devise</th>
                        <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Montant</th>
                        <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Solde après</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Raison</th>
                        <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Par</th>
                        <th className="px-3 py-2.5 text-center font-medium text-zinc-500">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {pageRows.map((m, i) => (
                        <tr
                          key={m.id}
                          onClick={() => setDetail(m)}
                          className={`cursor-pointer transition-colors hover:bg-zinc-100 ${i % 2 === 0 ? '' : 'bg-zinc-50/50'}`}
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">
                            <div className="font-mono">{dayjs(m.timestamp).format('HH:mm')}</div>
                            <div className="text-[10px] text-zinc-400">{dayjs(m.timestamp).format('DD/MM/YY')}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <TypeBadge type={m.type as 'ALIMENTATION' | 'PRELEVEMENT'} />
                          </td>
                          <td className="px-3 py-2.5">
                            <ContexteBadge contexte={m.contexte} />
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-zinc-700">
                            {m.devise}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={`font-bold ${signClass(m.montant)}`}>
                              {signPrefix(m.montant)}{fmt(Math.abs(m.montant))}
                            </span>
                          </td>
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
                          <td className="max-w-[160px] truncate px-3 py-2.5 italic text-zinc-500" title={m.note}>
                            {m.note ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600">{m.caissier}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold text-white">
                              <Lock size={8} /> LOCK
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500">
                    <span>Page {page} / {totalPages}</span>
                    <div className="flex gap-1">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded border border-zinc-300 p-1 disabled:opacity-40 hover:bg-zinc-100"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded border border-zinc-300 p-1 disabled:opacity-40 hover:bg-zinc-100"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modals ── */}
      <CoffreModal
        open={modal !== null}
        mode={modal ?? 'ALIMENTATION'}
        soldeCourant={soldeCourant}
        onClose={() => setModal(null)}
        onDone={refresh}
      />
      <DetailModal
        open={detail !== null}
        mv={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
