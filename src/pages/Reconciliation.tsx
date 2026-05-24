import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHero } from '@/components/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  FileText,
  RefreshCw,
  ArrowRight,
  Info,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { DEVISES_CAISSE_V8 } from '@/lib/constants';
import {
  getSnapshotWithMAD,
  hasSnapshot,
  computeVariance,
  getReconciliation,
  saveReconciliation,
  addAuditLog,
  deviseToMAD,
  type ReconciliationRecord,
} from '@/lib/reconciliation';
import {
  calculateDailyClosure,
  getClosureByDate,
  getTransactions,
} from '@/lib/storage';
import { generateRapportPDF } from '@/lib/rapportPDF';
import { fmt, fmtNumber } from '@/lib/formatNumbers';

dayjs.locale('fr');

const DEVISES_SNAPSHOT = ['MAD', ...(DEVISES_CAISSE_V8 as readonly string[])] as string[];
const EPS = 0.01;

function fmtVariance(n: number) {
  if (Math.abs(n) < 0.001) return fmtNumber(0);
  const abs = fmt(Math.abs(n));
  return n > 0 ? `+${abs}` : `−${abs}`;
}

function generatePDF(
  day: string,
  manager: string,
  user: string,
  theoreticalByDevise: Record<string, number>,
  theoreticalMAD: number,
  physicalByDevise: Record<string, number>,
  physicalMAD: number,
  varianceMAD: number,
  status: string,
  justification: string,
  devises: string[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateLabel = dayjs(day).format('DD/MM/YYYY');
  const now = dayjs().format('DD/MM/YYYY HH:mm');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('AFROMONEY — Bureau de Change', 14, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('BORDEREAU DE CLÔTURE JOURNALIÈRE', 14, 22);
  doc.text(`Date : ${dateLabel}`, 140, 22);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(`Responsable : ${manager}`, 14, 40);
  doc.text(`Opérateur : ${user}`, 14, 46);
  doc.text(`Généré le : ${now}`, 140, 40);

  const statusColor: [number, number, number] =
    status === 'OK' ? [16, 185, 129] : status === 'ALERTE' ? [245, 158, 11] : [239, 68, 68];
  doc.setFillColor(...statusColor);
  doc.roundedRect(14, 52, 182, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const statusLabel =
    status === 'OK' ? 'CAISSE ÉQUILIBRÉE' : status === 'ALERTE' ? 'ALERTE — ÉCART DÉTECTÉ' : 'ERREUR';
  doc.text(`STATUT : ${statusLabel}`, 105, 59, { align: 'center' });

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparatif théorique / physique', 14, 72);

  const tableData = devises.map((d) => {
    const th = theoreticalByDevise[d] ?? 0;
    const ph = physicalByDevise[d] ?? 0;
    const diff = ph - th;
    const diffMAD = deviseToMAD(d, diff);
    return [d, fmt(th, 4), fmt(ph, 4), fmtVariance(diff), Math.abs(diffMAD) < EPS ? '✓' : `⚠ ${fmt(Math.abs(diffMAD))} MAD`];
  });

  autoTable(doc, {
    startY: 76,
    head: [['Devise', 'Théorique', 'Compté', 'Écart', 'Statut']],
    body: [
      ...tableData,
      ['TOTAL MAD', `${fmt(theoreticalMAD)} MAD`, `${fmt(physicalMAD)} MAD`, `${fmtVariance(varianceMAD)} MAD`, status],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 20 }, 4: { halign: 'center' } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 140;

  if (justification) {
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Justification :', 14, finalY + 16);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(justification, 182);
    doc.text(lines, 14, finalY + 22);
  }

  const sigY = Math.max(finalY + (justification ? 40 : 18), 240);
  doc.setDrawColor(40, 40, 40);
  doc.line(14, sigY + 12, 90, sigY + 12);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Signature : ${manager}`, 14, sigY + 17);
  doc.line(110, sigY + 12, 196, sigY + 12);
  doc.text('Signature : Opérateur', 110, sigY + 17);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 285, 210, 12, 'F');
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7);
  doc.text('AFROMONEY — Bordereau de clôture confidentiel', 105, 293, { align: 'center' });

  doc.save(`bordereau-cloture-${day}.pdf`);
}

export function Reconciliation() {
  const { currentUser } = useAuth();
  const [day, setDay] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [tick, setTick] = useState(0);
  const [physicalInputs, setPhysicalInputs] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState('');
  const [managerName, setManagerName] = useState('');
  const [savedRec, setSavedRec] = useState<ReconciliationRecord | null>(null);
  const [infoMsg, setInfoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [rapportPdfLoading, setRapportPdfLoading] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!infoMsg) return;
    const t = setTimeout(() => setInfoMsg(null), 6000);
    return () => clearTimeout(t);
  }, [infoMsg]);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener('afromoney-data', on);
    return () => window.removeEventListener('afromoney-data', on);
  }, [refresh]);

  useEffect(() => {
    const rec = getReconciliation(day);
    setSavedRec(rec);
    if (rec) {
      setPhysicalInputs(Object.fromEntries(Object.entries(rec.physicalByDevise).map(([k, v]) => [k, String(v)])));
      setManagerName(rec.validatedBy ?? '');
      setJustification(rec.justification ?? '');
    } else {
      setPhysicalInputs({});
      setManagerName('');
      setJustification('');
    }
  }, [day]);

  const departData  = useMemo(() => getSnapshotWithMAD(day, 'DEPART'),  [day, tick]);
  const clotureData = useMemo(() => getSnapshotWithMAD(day, 'CLOTURE'), [day, tick]);
  const finalData   = useMemo(() => getSnapshotWithMAD(day, 'FINAL'),   [day, tick]);
  const hasDepart   = useMemo(() => hasSnapshot(day, 'DEPART'),  [day, tick]);
  const hasCloture  = useMemo(() => hasSnapshot(day, 'CLOTURE'), [day, tick]);
  const hasFinal    = useMemo(() => hasSnapshot(day, 'FINAL'),   [day, tick]);

  const displayDevises = useMemo(() => {
    const active = new Set<string>(['MAD']);
    for (const [d, v] of Object.entries({ ...departData.balances, ...clotureData.balances, ...finalData.balances })) {
      if (Math.abs(v) > 0.0001) active.add(d);
    }
    return DEVISES_SNAPSHOT.filter((d) => active.has(d));
  }, [departData, clotureData, finalData]);

  const physicalByDevise = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [d, raw] of Object.entries(physicalInputs)) {
      const v = parseFloat(raw.replace(',', '.'));
      if (Number.isFinite(v) && v >= 0) out[d] = v;
    }
    return out;
  }, [physicalInputs]);

  const physicalMAD   = useMemo(() => Object.entries(physicalByDevise).reduce((s, [d, v]) => s + deviseToMAD(d, v), 0), [physicalByDevise]);
  const theoreticalMAD = clotureData.mad;
  const varianceMAD    = physicalMAD - theoreticalMAD;
  const isBalanced     = Math.abs(varianceMAD) < EPS;
  const anyPhysical    = Object.keys(physicalByDevise).length > 0;
  const status: 'OK' | 'ALERTE' = isBalanced ? 'OK' : 'ALERTE';
  const isLocked       = Boolean(savedRec?.validated);

  const dailyClosure = useMemo(
    () => getClosureByDate(day) ?? calculateDailyClosure(day),
    [day, tick],
  );

  const txDay = useMemo(
    () =>
      getTransactions()
        .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === day)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [day, tick],
  );

  const snapshotsReady = hasDepart && hasCloture;
  const canValidate =
    snapshotsReady &&
    anyPhysical &&
    managerName.trim() &&
    !isLocked &&
    (isBalanced || justification.trim().length > 0);

  function prefillFromTheoretical() {
    const next: Record<string, string> = {};
    for (const d of displayDevises) {
      const th = clotureData.balances[d] ?? 0;
      if (Math.abs(th) > 0.0001) next[d] = String(th);
    }
    setPhysicalInputs(next);
    setInfoMsg({ text: 'Montants théoriques repris — vérifiez puis ajustez si besoin.', ok: true });
  }

  async function handleRapportPDF() {
    setRapportPdfLoading(true);
    try {
      await generateRapportPDF(dailyClosure, txDay);
      setInfoMsg({ text: '📄 Rapport PDF 8 pages téléchargé.', ok: true });
    } catch (err) {
      setInfoMsg({
        text: '❌ Rapport PDF : ' + (err instanceof Error ? err.message : 'Erreur'),
        ok: false,
      });
    } finally {
      setRapportPdfLoading(false);
    }
  }

  function handleValidate() {
    if (!snapshotsReady) {
      setInfoMsg({
        text: 'Enregistrez d’abord les snapshots DÉPART et CLÔTURE (page Journée).',
        ok: false,
      });
      return;
    }
    if (!anyPhysical) {
      setInfoMsg({ text: 'Saisissez au moins un montant réel compté.', ok: false });
      return;
    }
    if (!managerName.trim()) {
      setInfoMsg({ text: 'Le nom du responsable est requis.', ok: false });
      return;
    }
    if (!isBalanced && !justification.trim()) {
      setInfoMsg({ text: 'Justification obligatoire quand il y a un écart.', ok: false });
      return;
    }

    const variance = computeVariance(clotureData.balances, physicalByDevise);
    const rec: ReconciliationRecord = {
      id: `recon_${day}`,
      date: day,
      createdAt: new Date().toISOString(),
      theoreticalByDevise: { ...clotureData.balances },
      theoreticalMAD,
      physicalByDevise,
      physicalMAD,
      varianceByDevise: variance.byDevise,
      varianceMAD: variance.totalMAD,
      status,
      justification: justification.trim() || undefined,
      validated: true,
      validatedBy: managerName.trim(),
      validatedAt: new Date().toISOString(),
      invariantValid: true,
      invariantErrors: [],
      hasDepart,
      hasCloture,
      hasFinal,
    };

    saveReconciliation(rec);
    addAuditLog({
      date: day,
      action: 'RÉCONCILIATION_VALIDÉE',
      user: currentUser?.nom ?? managerName.trim(),
      details: { théoriqueMAD: fmt(theoreticalMAD), physiqueMAD: fmt(physicalMAD), écartMAD: fmt(variance.totalMAD), statut: status, responsable: managerName.trim() },
    });

    setSavedRec(rec);
    setInfoMsg({
      text: isBalanced
        ? `✅ Validé par ${managerName.trim()} — Caisse équilibrée`
        : `⚠️ Validé — écart de ${fmt(Math.abs(variance.totalMAD))} MAD enregistré`,
      ok: true,
    });
    refresh();
  }

  function handlePDF() {
    generatePDF(day, managerName || savedRec?.validatedBy || 'N/A', currentUser?.nom ?? 'N/A', clotureData.balances, theoreticalMAD, physicalByDevise, physicalMAD, varianceMAD, status, justification || savedRec?.justification || '', displayDevises);
  }

  const SNAPSHOTS = [
    { label: 'DÉPART',   exists: hasDepart,  mad: departData.mad,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
    { label: 'CLÔTURE',  exists: hasCloture, mad: clotureData.mad, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { label: 'FINAL',    exists: hasFinal,   mad: finalData.mad,   color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200'},
  ];

  return (
    <div>
      <PageHero
        title="✅ VÉRIFIER L'ARGENT"
        subtitle="Compte l'argent et signe"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/85">
              <Calendar size={14} />
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-md border border-white/25 bg-white/12 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </label>
            <Button variant="outline" size="sm" onClick={handlePDF}
              className="gap-1.5 border-white/25 bg-white/10 text-white hover:bg-white/20">
              <Download size={14} /> Bordereau PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRapportPDF}
              disabled={rapportPdfLoading}
              className="gap-1.5 border-emerald-300/40 bg-emerald-500/20 text-white hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {rapportPdfLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              📄 Rapport PDF
            </Button>
          </div>
        }
      />

      <div className="page-content mx-auto max-w-3xl space-y-5">

        <Card className="border-cyan-200/60 bg-cyan-50/80 shadow-sm">
          <CardContent className="flex gap-3 pt-4 pb-4">
            <Info size={18} className="mt-0.5 shrink-0 text-cyan-700" />
            <div className="space-y-1.5 text-xs leading-relaxed text-zinc-700">
              <p className="font-bold text-zinc-900">Rôle de cette page</p>
              <p>
                Comptage <strong>physique</strong> vs solde <strong>théorique CLÔTURE</strong>, puis signature.
                Snapshots :{' '}
                <Link to="/journal-journee" className="font-semibold text-cyan-800 underline">
                  Journée
                </Link>
                . Clôture MAD :{' '}
                <Link to="/cloture" className="font-semibold text-cyan-800 underline">
                  Clôture journalière
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {!snapshotsReady && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle size={18} className="shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 text-sm text-amber-900">
              <p className="font-bold">Snapshots incomplets</p>
              <p className="mt-0.5 text-xs">
                {!hasDepart && 'DÉPART manquant. '}
                {!hasCloture && 'CLÔTURE manquante. '}
              </p>
            </div>
            <Link
              to="/journal-journee"
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              Journée <ArrowRight size={12} />
            </Link>
          </div>
        )}

        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Synthèse MAD — {dayjs(day).format('DD/MM/YYYY')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: 'Initial', value: dailyClosure.initialBalanceMAD, color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Théorique', value: dailyClosure.theoreticalBalance, color: 'text-zinc-800', bg: 'bg-zinc-50' },
                { label: 'Réel', value: dailyClosure.realBalance, color: 'text-cyan-800', bg: 'bg-cyan-50' },
                {
                  label: 'Écart',
                  value: dailyClosure.variance,
                  color: dailyClosure.isBalanced ? 'text-emerald-700' : 'text-red-600',
                  bg: dailyClosure.isBalanced ? 'bg-emerald-50' : 'bg-red-50',
                },
                { label: 'Bénéfice', value: dailyClosure.dailyBenefit, color: 'text-indigo-700', bg: 'bg-indigo-50' },
              ].map((k) => (
                <div key={k.label} className={cn('rounded-lg border border-zinc-100 px-2 py-2', k.bg)}>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">{k.label}</p>
                  <p className={cn('mt-0.5 text-sm font-bold tabular-nums', k.color)}>{fmt(k.value)}</p>
                </div>
              ))}
            </div>
            {dailyClosure.status === 'DRAFT' && (
              <p className="mt-2 text-[10px] text-amber-700">
                Clôture comptable non signée — notification « Clôture manquante » au démarrage.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Toast ── */}
        {infoMsg && (
          <div className={cn('flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium',
            infoMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
            {infoMsg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {infoMsg.text}
          </div>
        )}

        {/* ── Bannière validation existante ── */}
        {savedRec && (
          <div className={cn('flex items-center gap-3 rounded-xl border-2 px-4 py-3',
            savedRec.status === 'OK' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
            <CheckCircle2 size={18} className={savedRec.status === 'OK' ? 'text-emerald-600' : 'text-amber-600'} />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-zinc-800">Validé par {savedRec.validatedBy}</span>
              {savedRec.validatedAt && (
                <span className="ml-2 text-xs text-zinc-500">le {dayjs(savedRec.validatedAt).format('DD/MM à HH:mm')}</span>
              )}
              <span className="ml-2 text-xs text-zinc-500">· Écart : {fmt(savedRec.varianceMAD)} MAD</span>
            </div>
            {isLocked && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Lock size={12} /> Verrouillé
              </span>
            )}
          </div>
        )}

        {/* ══ 1. 3 SNAPSHOTS ══════════════════════════════════════ */}
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Soldes du jour
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <tbody>
                  {SNAPSHOTS.map((s) => (
                    <tr key={s.label} className="border-b border-zinc-100 last:border-0">
                      <td className={cn('px-4 py-3 font-bold w-28', s.color)}>
                        {s.label}
                      </td>
                      <td className="px-4 py-3">
                        {s.exists ? (
                          <span className={cn('inline-block rounded-lg px-3 py-1 font-mono font-bold tabular-nums text-sm', s.bg, s.color, s.border, 'border')}>
                            {fmt(s.mad)} MAD
                          </span>
                        ) : (
                          <Link to="/journal-journee" className="text-xs font-medium text-cyan-700 underline hover:text-cyan-900">
                            Non enregistré — saisir sur Journée →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ══ 2. ARGENT COMPTÉ ════════════════════════════════════ */}
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Argent compté (saisir le montant réel)
              </p>
              {!isLocked && hasCloture && (
                <Button type="button" variant="outline" size="sm" onClick={prefillFromTheoretical} className="h-7 text-xs">
                  Reprendre le théorique
                </Button>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600">Devise</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600">Théorique</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600">Réel (compté)</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {displayDevises.map((devise) => {
                    const theoretical = clotureData.balances[devise] ?? 0;
                    const rawInput = physicalInputs[devise] ?? '';
                    const parsed = parseFloat(rawInput.replace(',', '.'));
                    const physical = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                    const hasEntry = rawInput.trim() !== '';
                    const diff = hasEntry ? physical - theoretical : null;
                    const diffMAD = diff !== null ? deviseToMAD(devise, diff) : 0;
                    const hasVariance = diff !== null && Math.abs(diffMAD) >= EPS;

                    return (
                      <tr key={devise} className={cn('border-b border-zinc-100 last:border-0', hasVariance && 'bg-amber-50/60')}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex h-7 w-12 items-center justify-center rounded-md bg-zinc-900 font-mono text-[11px] font-bold text-white">
                            {devise}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-zinc-700">
                          {fmt(theoretical)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end">
                            <Input
                              className="h-8 w-28 text-right font-mono text-sm tabular-nums"
                              inputMode="decimal"
                              placeholder="—"
                              value={rawInput}
                              disabled={isLocked}
                              onChange={(e) => setPhysicalInputs((prev) => ({ ...prev, [devise]: e.target.value }))}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {diff === null ? (
                            <span className="text-zinc-300">—</span>
                          ) : (
                            <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
                              hasVariance ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700')}>
                              {hasVariance ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                              {fmtVariance(diff)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ligne total */}
                  {anyPhysical && (
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td className="px-4 py-2.5 text-xs font-bold uppercase text-zinc-700">TOTAL MAD</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-indigo-700">{fmt(theoreticalMAD)} MAD</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-zinc-900">{fmt(physicalMAD)} MAD</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-bold tabular-nums',
                          isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                          {isBalanced ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {isBalanced ? 'Équilibrée ✓' : `${fmtVariance(varianceMAD)} MAD`}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ══ 3. SIGNATURE ════════════════════════════════════════ */}
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="pt-4 pb-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Signature</p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
                Notes / observations
                {anyPhysical && !isBalanced && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                disabled={isLocked}
                rows={2}
                placeholder={
                  anyPhysical && !isBalanced
                    ? 'Justification obligatoire en cas d’écart…'
                    : 'Observations optionnelles (incidents, remarques…)…'
                }
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-zinc-100"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-600">
                  Responsable <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Votre nom"
                  value={managerName}
                  disabled={isLocked}
                  onChange={(e) => setManagerName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleValidate}
                disabled={!canValidate}
                className={cn(
                  'gap-2 font-bold',
                  canValidate ? 'bg-emerald-600 text-white hover:bg-emerald-700' : '',
                )}
              >
                <CheckCircle2 size={15} />
                {isLocked ? 'Déjà validé' : 'Valider'}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default Reconciliation;
