import { useEffect, useState, useMemo } from 'react';
import { PageHero } from '@/components/PageHero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, FileText, FileDown, Lock, CheckCheck, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SignatureBox, type SigState } from '@/components/SignatureBox';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  calculateDailyClosure,
  getClosureByDate,
  getTransactions,
  saveClosure,
  detectVariance,
  validateClosure,
} from '@/lib/storage';
import { generateBordereauPDF } from '@/lib/bordereauxPDF';
import { generateRapportPDF } from '@/lib/rapportPDF';
import type { DailyClosure } from '@/types';
import { ClosureChecklist } from '@/components/ClosureChecklist';
import { fmt } from '@/lib/formatNumbers';
import { getAllSnapshots, upsertSnapshot } from '@/lib/stageCaisse/storage';
import { calculStock } from '@/lib/calculations';
import { getExchangeRates } from '@/lib/storage';

dayjs.locale('fr');

const today = dayjs().format('YYYY-MM-DD');

const STATUS_CONFIG = {
  DRAFT:               { label: 'Brouillon',        color: 'text-zinc-500',   icon: FileText,      bg: 'bg-zinc-50 border-zinc-200' },
  PENDING_VALIDATION:  { label: 'En attente',        color: 'text-amber-500',  icon: Clock,         bg: 'bg-amber-50 border-amber-200' },
  VALIDATED:           { label: 'Validée',           color: 'text-emerald-500',icon: CheckCircle,   bg: 'bg-emerald-50 border-emerald-200' },
  ERROR:               { label: 'Écart détecté',     color: 'text-red-500',    icon: AlertTriangle, bg: 'bg-red-50 border-red-200' },
} as const;

// ─── RowStat : ligne de stat dans le tableau transactions ───────────────────
function RowStat({
  label, value, colorClass,
}: { label: string; value: number; colorClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors px-1">
      <span className="text-sm text-zinc-600 font-medium">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${colorClass ?? 'text-zinc-800'}`}>
        {fmt(value)} <span className="text-xs font-normal text-zinc-400">MAD</span>
      </span>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export function Cloture() {
  const [closure, setClosure]           = useState<DailyClosure | null>(null);
  const [realBalance, setRealBalance]   = useState(0);
  const [notes, setNotes]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [sigState, setSigState]         = useState<SigState>({ value: null, nom: '', isReady: false });
  const [toast, setToast]               = useState<{ ok: boolean; msg: string } | null>(null);

  // Stock devises réel saisi par le caissier à la clôture
  const DEVISES = ['EUR', 'USD', 'GBP', 'CAD', 'SAR', 'AED', 'CHF', 'KWD'] as const;
  const [realDevises, setRealDevises] = useState<Record<string, string>>({});

  // Stock théorique depuis calculStock
  const stockTheorique = useMemo(() => {
    const txs = getTransactions();
    const rates = getExchangeRates();
    return calculStock(txs, rates);
  }, []);

  // Charger les valeurs réelles déjà saisies (snapshot CLOTURE)
  useEffect(() => {
    const snaps = getAllSnapshots();
    const init: Record<string, string> = {};
    for (const s of snaps) {
      if (s.type_solde === 'CLOTURE' && s.date_comptable === today && s.devise_code !== 'MAD') {
        init[s.devise_code] = String(s.montant);
      }
    }
    setRealDevises(init);
  }, []);
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    const existing = getClosureByDate(today);
    if (existing && existing.status !== 'DRAFT') {
      setClosure(existing);
      setRealBalance(existing.realBalance);
      setNotes(existing.notes || '');
    } else {
      const fresh = calculateDailyClosure(today);
      setClosure(fresh);
      setRealBalance(fresh.theoreticalBalance);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('afromoney-data', load);
    return () => window.removeEventListener('afromoney-data', load);
  }, []);

  const variance    = realBalance - (closure?.theoreticalBalance ?? 0);
  const isBalanced  = Math.abs(variance) < 0.01;
  const isValidated = closure?.status === 'VALIDATED';
  const canSign     = isBalanced && sigState.isReady && !isValidated;

  const handleValidate = async () => {
    if (!sigState.nom.trim()) {
      showToast(false, '❌ Nom du responsable requis');
      return;
    }
    if (!closure) {
      showToast(false, '❌ Clôture introuvable');
      return;
    }
    if (!isBalanced) {
      showToast(false, `❌ Écart: ${fmt(variance)} MAD. Justifiez ou corrigez.`);
      return;
    }
    if (!sigState.isReady || !sigState.value) {
      showToast(false, '❌ Signature requise — confirmez votre signature ci-dessous');
      return;
    }

    setIsSubmitting(true);

    try {
      let updated = detectVariance({ ...closure }, realBalance);
      updated = { ...updated, notes: notes.trim() };
      saveClosure(updated);

      const validated = validateClosure(updated.id, sigState.nom.trim(), sigState.value);
      if (!validated) {
        showToast(false, '❌ Erreur lors de la signature');
        setIsSubmitting(false);
        return;
      }

      const final = getClosureByDate(today);
      setClosure(final);
      showToast(true, `✅ Clôture VALIDÉE et signée par ${sigState.nom}`);

      setTimeout(() => setNotes(''), 500);
    } catch (err) {
      showToast(false, '❌ Erreur: ' + (err instanceof Error ? err.message : 'Inconnue'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalc = () => {
    const draft = calculateDailyClosure(today);
    setClosure(draft);
    setRealBalance(draft.theoreticalBalance);
    showToast(true, '🔄 Données recalculées depuis les transactions');
  };

  const handleRapportPDF = async () => {
    if (!closure) return;
    setPdfLoading(true);
    try {
      const txs = getTransactions().filter(
        (t) => dayjs(t.date).format('YYYY-MM-DD') === closure.date
      );
      await generateRapportPDF(closure, txs);
      showToast(true, '📄 Rapport PDF téléchargé');
    } catch (err) {
      showToast(false, '❌ PDF : ' + (err instanceof Error ? err.message : 'Erreur'));
    } finally {
      setPdfLoading(false);
    }
  };

  if (!closure) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-3 flex justify-center">
            <RefreshCw size={24} className="text-blue-500" />
          </div>
          <p className="text-zinc-400 text-sm">Chargement de la clôture…</p>
        </div>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[closure.status].icon;

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        title="Clôture journalière"
        subtitle={`${dayjs(closure.date).format('dddd D MMMM YYYY')} — contrôle de fin de journée`}
        tall
        actions={
          <>
            <button
              className="btn-gradient flex items-center gap-1.5 hover:shadow-lg transition-shadow"
              onClick={handleRecalc}
              disabled={isValidated}
            >
              <RefreshCw size={14} /> Recalculer
            </button>
            <button
              className="btn-glass flex items-center gap-1.5 hover:shadow-lg transition-shadow"
              onClick={() => closure && generateBordereauPDF(closure)}
              title="Télécharger le bordereau PDF officiel"
            >
              <FileDown size={14} /> Bordereau PDF
            </button>
            <button
              className="btn-glass flex items-center gap-1.5 hover:shadow-lg transition-shadow disabled:opacity-50"
              onClick={handleRapportPDF}
              disabled={pdfLoading || !closure}
              title="Rapport PDF professionnel 8 pages"
            >
              {pdfLoading ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              📄 Rapport PDF
            </button>
          </>
        }
      />

      <div className="page-content space-y-6">
        {/* ── Toast ── */}
        {toast && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
              toast.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm'
                : 'border-red-300 bg-red-50 text-red-800 shadow-sm'
            }`}
          >
            {toast.msg}
          </div>
        )}

        <Card className="border-cyan-200/60 bg-cyan-50/80 shadow-sm">
          <CardContent className="flex gap-3 pt-4 pb-4">
            <Info size={18} className="mt-0.5 shrink-0 text-cyan-700" />
            <div className="space-y-1 text-xs leading-relaxed text-zinc-700">
              <p className="font-bold text-zinc-900">Clôture comptable MAD (feuille Excel « CLÔTURES »)</p>
              <p>
                Recalcule les soldes depuis les <strong>transactions</strong>, compare le <strong>réel compté</strong> au{' '}
                <strong>théorique</strong>, puis faites signer le responsable. Complément physique par devise :{' '}
                <Link to="/reconciliation" className="font-semibold text-cyan-800 underline">
                  Vérifier l&apos;argent
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Statut rapide ── */}
        <div className={`flex items-center gap-3 rounded-xl border-2 px-5 py-4 backdrop-blur-sm shadow-sm transition-all ${STATUS_CONFIG[closure.status].bg}`}>
          <StatusIcon size={20} className={STATUS_CONFIG[closure.status].color} />
          <span className={`text-sm font-bold ${STATUS_CONFIG[closure.status].color}`}>
            {STATUS_CONFIG[closure.status].label}
          </span>
          {closure.manager && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="text-sm text-zinc-600">Signé par <strong>{closure.manager}</strong></span>
            </>
          )}
          {closure.validatedAt && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="text-xs text-zinc-500 font-mono">
                {dayjs(closure.validatedAt).format('DD/MM HH:mm')}
              </span>
            </>
          )}
          {isValidated && (
            <span className="ml-auto flex items-center gap-1 text-emerald-600 text-xs font-bold">
              <Lock size={14} /> Verrouillée
            </span>
          )}
        </div>

        <ClosureChecklist date={today} />

        {/* ── Tableau stock devises ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              💱 Stock devises — Comptage physique
            </CardTitle>
            <p className="text-xs text-zinc-500 mt-1">Saisissez le stock réel compté pour chaque devise, puis comparez avec le théorique système.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase text-zinc-500">Devise</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase text-zinc-500">Stock système</th>
                    <th className="px-3 py-2 text-center text-xs font-bold uppercase text-emerald-600">Stock réel compté</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase text-zinc-500">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {DEVISES.map((devise) => {
                    const theorique = stockTheorique.find((s) => s.devise === devise)?.stockActuel ?? 0;
                    const rawReal = realDevises[devise] ?? '';
                    const reel = rawReal !== '' ? parseFloat(rawReal) : null;
                    const ecart = reel !== null ? reel - theorique : null;
                    const isOk = ecart !== null && Math.abs(ecart) < 0.01;
                    const isKo = ecart !== null && Math.abs(ecart) >= 0.01;
                    return (
                      <tr key={devise} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-zinc-700">{devise}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                          {theorique > 0 ? theorique.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            value={rawReal}
                            disabled={isValidated}
                            placeholder="—"
                            onChange={(e) => {
                              const val = e.target.value;
                              setRealDevises((prev) => ({ ...prev, [devise]: val }));
                              const n = parseFloat(val);
                              if (Number.isFinite(n)) {
                                upsertSnapshot(1, today, 'CLOTURE', devise, n);
                              }
                            }}
                            className={`w-full rounded border-2 px-2 py-1 text-center font-mono text-sm tabular-nums outline-none transition-all
                              ${isOk ? 'border-emerald-400 bg-emerald-50' : isKo ? 'border-red-400 bg-red-50' : 'border-zinc-200 bg-zinc-50'}
                              focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-200
                              disabled:bg-zinc-100 disabled:text-zinc-400`}
                          />
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold tabular-nums ${isOk ? 'text-emerald-600' : isKo ? 'text-red-600' : 'text-zinc-400'}`}>
                          {ecart === null ? '—' : `${ecart >= 0 ? '+' : ''}${ecart.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          {isOk && <span className="ml-1 text-xs">✅</span>}
                          {isKo && <span className="ml-1 text-xs">⚠️</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-zinc-400">Les valeurs saisies sont automatiquement sauvegardées comme snapshot CLÔTURE.</p>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* === SOLDES === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                💰 Soldes caisse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Solde initial */}
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 px-4 py-3 border border-blue-200">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Solde initial (J-1)</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums text-blue-700">
                  {fmt(closure.initialBalanceMAD)}
                  <span className="text-sm font-normal text-blue-500 ml-1">MAD</span>
                </p>
              </div>

              {/* Solde théorique */}
              <div className="rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100/50 px-4 py-3 border border-zinc-200">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-600">Solde théorique</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums text-zinc-800">
                  {fmt(closure.theoreticalBalance)}
                  <span className="text-sm font-normal text-zinc-500 ml-1">MAD</span>
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 leading-tight">
                  Initial + Dépôts − Retraits − Charges + Bénéfice
                </p>
              </div>

              {/* Solde réel (saisie) */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Solde réel constaté <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={realBalance}
                  onChange={(e) => setRealBalance(parseFloat(e.target.value) || 0)}
                  disabled={isValidated}
                  className={`w-full rounded-lg border-2 px-4 py-3 text-lg font-bold tabular-nums outline-none transition-all ${
                    isBalanced
                      ? 'border-emerald-400 bg-emerald-50/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                      : 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  } disabled:bg-zinc-100 disabled:text-zinc-400`}
                />
              </div>

              {/* Écart */}
              <div className={`rounded-lg border-2 px-4 py-3 transition-all ${
                isBalanced
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-red-300 bg-red-50'
              }`}>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-600">Écart (Réel − Théorique)</p>
                <p className={`mt-1.5 text-3xl font-bold tabular-nums ${
                  isBalanced ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {variance >= 0 ? '+' : ''}{fmt(variance)}
                  <span className="text-sm font-normal ml-1">MAD</span>
                </p>
                <p className={`mt-1 text-xs font-bold ${
                  isBalanced ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {isBalanced ? '✅ Caisse équilibrée' : '⚠️ Écart à justifier'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* === TRANSACTIONS DU JOUR === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                📊 Transactions du jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5 mb-1">
                <RowStat label="Achats devises"  value={closure.transactions.totalBuys}        colorClass="text-red-500" />
                <RowStat label="Ventes devises"  value={closure.transactions.totalSells}       colorClass="text-emerald-600" />
                <RowStat label="Dépôts"          value={closure.transactions.totalDeposits}    colorClass="text-blue-500" />
                <RowStat label="Retraits"        value={closure.transactions.totalWithdrawals} colorClass="text-orange-500" />
                <RowStat label="Charges"         value={closure.transactions.totalCharges}     colorClass="text-zinc-500" />
              </div>

              {/* Bénéfice du jour */}
              <div className="mt-5 rounded-lg border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Bénéfice du jour</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${
                  closure.dailyBenefit >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {closure.dailyBenefit >= 0 ? '+' : ''}{fmt(closure.dailyBenefit)}
                  <span className="text-sm font-normal text-blue-500 ml-1">MAD</span>
                </p>
                <p className="mt-1 text-[10px] text-blue-500 font-medium">
                  = Total ventes − Total achats
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* === SIGNATURE & VALIDATION === */}
        <Card className={isValidated ? 'border-emerald-200 bg-emerald-50/30' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              {isValidated ? (
                <>
                  <CheckCheck size={16} className="text-emerald-600" />
                  Clôture signée et verrouillée
                </>
              ) : (
                <>✏️ Signature du responsable</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">

              {/* SignatureBox */}
              <SignatureBox
                savedValue={closure.signature}
                nomFallback={closure.manager}
                timestampFallback={closure.validatedAt}
                disabled={isValidated}
                onChange={setSigState}
              />

              {/* Écart warning */}
              {!isBalanced && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
                  <p className="text-xs font-bold text-red-700">⚠️ Validation bloquée</p>
                  <p className="mt-1 text-xs text-red-600">
                    L'écart dépasse 0,01 MAD ({fmt(variance)} MAD). Corrigez le solde réel ou justifiez dans les notes.
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Notes / Justification écart
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isValidated}
                  rows={3}
                  placeholder="Motif de l'écart, observations, incidents du jour…"
                  className="w-full resize-none rounded-lg border-2 border-zinc-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </div>

              {/* Valider & Signer */}
              {!isValidated && (
                <div className="flex gap-3">
                  <button
                    onClick={handleValidate}
                    disabled={!canSign || isSubmitting}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all ${
                      canSign && !isSubmitting
                        ? 'bg-emerald-500 hover:bg-emerald-600 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]'
                        : 'cursor-not-allowed bg-zinc-300 text-zinc-400'
                    }`}
                  >
                    {isSubmitting ? (
                      <><RefreshCw size={14} className="animate-spin" /> Signature en cours…</>
                    ) : (
                      <><CheckCircle size={16} /> Valider &amp; Signer la clôture</>
                    )}
                  </button>
                  <button
                    onClick={handleRecalc}
                    disabled={isSubmitting}
                    title="Recalculer depuis les transactions"
                    className="rounded-xl border-2 border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}

              {!canSign && !isValidated && sigState.isReady && !isBalanced && (
                <p className="text-center text-xs text-red-500">
                  Corrigez l'écart de caisse pour pouvoir valider
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
