import { useEffect, useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  Lock,
  ShieldCheck,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportSingleStyledSheet, downloadWordReport } from '@/lib/exportStyled';
import { fmt, fmtRate } from '@/lib/formatNumbers';
import { getTransactions, getMouvements, getClients, annulerTransaction } from '@/lib/storage';
import { verifyHash, getStatutAudit, type StatutAudit } from '@/lib/audit';
import { UTILISATEURS_TEST } from '@/lib/constants';
import type { Transaction, MouvementCaisse, Client } from '@/types';

dayjs.locale('fr');

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TYPE_CFG: Record<string, { label: string; badgeClass: string }> = {
  ACHAT:      { label: 'ACHAT',      badgeClass: 'bg-blue-100 text-blue-800 ring-blue-200' },
  VENTE:      { label: 'VENTE',      badgeClass: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  DEPOT:      { label: 'DÉPÔT',      badgeClass: 'bg-violet-100 text-violet-800 ring-violet-200' },
  RETRAIT:    { label: 'RETRAIT',    badgeClass: 'bg-orange-100 text-orange-800 ring-orange-200' },
  CHARGES:    { label: 'CHARGES',    badgeClass: 'bg-red-100 text-red-800 ring-red-200' },
  ANNULATION: { label: 'ANNULATION', badgeClass: 'bg-zinc-200 text-zinc-700 ring-zinc-300' },
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function employeName(id: string) {
  return UTILISATEURS_TEST.find((u) => u.id === id)?.nom ?? id;
}

// ─── Small components ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CFG[type];
  if (!cfg) return <span className="text-xs text-zinc-400">{type}</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cfg.badgeClass}`}>{cfg.label}</span>;
}

function StatutBadge({ statut }: { statut: StatutAudit }) {
  if (statut === 'ANNULEE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
        <XCircle size={9} /> ANNULÉE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
      <CheckCircle size={9} /> VALIDE
    </span>
  );
}

function HashBadge({ tx }: { tx: Transaction }) {
  if (!tx.hash) {
    return <span className="font-mono text-[9px] text-zinc-400">—</span>;
  }
  const valid = verifyHash(tx);
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[9px] ${valid ? 'text-emerald-600' : 'text-red-500'}`}
      title={`Hash: ${tx.hash}`}
    >
      {valid ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
      {tx.hash.slice(0, 12)}…
    </span>
  );
}

// ─── AnnulationModal ─────────────────────────────────────────────────────────

function AnnulationModal({
  tx,
  onClose,
  onDone,
}: {
  tx: Transaction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [raison, setRaison] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleConfirm() {
    if (raison.trim().length < 5) {
      setError('Raison requise (minimum 5 caractères)');
      return;
    }
    setLoading(true);
    try {
      annulerTransaction(tx.id, raison.trim());
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'annulation');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl bg-red-700 px-5 py-4">
          <h2 className="text-base font-bold text-white">Annuler l'opération</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            <p className="font-mono font-bold text-zinc-800">{tx.numero ?? tx.id}</p>
            <p className="mt-0.5 text-zinc-600">{tx.operation} — {fmt(tx.montant)} {tx.devise}</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <strong>Attention :</strong> l'annulation crée une nouvelle opération inverse (nouveau numéro BCH). L'opération originale reste intacte dans l'historique.
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Raison de l'annulation *</label>
            <Input
              placeholder="Ex. : Erreur de saisie, annulation client…"
              value={raison}
              onChange={(e) => { setRaison(e.target.value); setError(''); }}
              className={error ? 'border-red-400' : ''}
            />
            {error && <p className="text-[10px] text-red-500">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3.5">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            className="bg-red-700 hover:bg-red-800 text-white"
            onClick={handleConfirm}
            disabled={loading}
          >
            Confirmer l'annulation
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({
  tx,
  statut,
  mouvements,
  clients,
  allTx,
  onClose,
  onAnnuler,
}: {
  tx: Transaction;
  statut: StatutAudit;
  mouvements: MouvementCaisse[];
  clients: Client[];
  allTx: Transaction[];
  onClose: () => void;
  onAnnuler: () => void;
}) {
  const client = tx.clientId ? clients.find((c) => c.id === tx.clientId) : undefined;
  const txMouvements = mouvements.filter((m) => m.operationRef === tx.id);
  const hashValid = tx.hash ? verifyHash(tx) : null;

  // If this is an ANNULATION, find the original
  const origTx = tx.annulationRef ? allTx.find((t) => t.id === tx.annulationRef) : undefined;
  // If this tx was annulled, find the annulation
  const annulTx = statut === 'ANNULEE' ? allTx.find((t) => t.type === 'ANNULATION' && t.annulationRef === tx.id) : undefined;

  const canAnnuler = statut === 'VALIDE' && tx.type !== 'ANNULATION';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-zinc-900 px-5 py-4">
          <div>
            <p className="font-mono text-sm font-bold text-white">{tx.numero ?? tx.id}</p>
            <p className="text-xs text-zinc-400">{tx.operation}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 px-5 py-5">

            {/* Operation details */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <Row label="Type"><TypeBadge type={tx.type} /></Row>
              <Row label="Statut"><StatutBadge statut={statut} /></Row>
              <Row label="Date">{dayjs(tx.date).format('DD/MM/YYYY HH:mm:ss')}</Row>
              <Row label="Caissier">{tx.employeNom ?? employeName(tx.employeId)}</Row>
              <Row label="Devise"><span className="font-mono font-bold">{tx.devise}</span></Row>
              <Row label="Montant"><span className="tabular-nums font-semibold">{fmt(tx.montant)}</span></Row>
              <Row label="Taux"><span className="tabular-nums">{fmtRate(tx.taux)}</span></Row>
              <Row label="Total MAD"><span className="tabular-nums font-bold">{fmt(tx.montantMAD)} MAD</span></Row>
              {tx.montantAPayer != null && (
                <Row label="Montant payé"><span className="tabular-nums">{fmt(tx.montantAPayer)} MAD</span></Row>
              )}
              {client && (
                <Row label="Client">
                  <span className="font-medium">{client.nom}</span>
                  <span className="ml-1 text-zinc-400">({client.categorie})</span>
                </Row>
              )}
              {tx.note && <Row label="Note">{tx.note}</Row>}
            </div>

            {/* Annulation cross-references */}
            {origTx && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                <p className="font-semibold text-zinc-600">Annule l'opération :</p>
                <p className="mt-0.5 font-mono text-blue-700">{origTx.numero ?? origTx.id}</p>
                <p className="text-zinc-500">{origTx.operation}</p>
                {tx.annulationRaison && <p className="mt-1 italic text-zinc-600">Raison : {tx.annulationRaison}</p>}
              </div>
            )}
            {annulTx && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
                <p className="font-semibold text-red-600">Annulée par :</p>
                <p className="mt-0.5 font-mono text-red-700">{annulTx.numero ?? annulTx.id}</p>
                {annulTx.annulationRaison && <p className="mt-1 italic text-red-500">Raison : {annulTx.annulationRaison}</p>}
              </div>
            )}

            {/* Mouvements caisse */}
            {txMouvements.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-600">Mouvements caisse :</p>
                <div className="space-y-1">
                  {txMouvements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs">
                      <span className="font-mono font-semibold text-zinc-600">{m.devise}</span>
                      <span className={`tabular-nums font-bold ${m.montant > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.montant > 0 ? '+' : ''}{fmt(m.montant)}
                      </span>
                      <span className="text-zinc-400">
                        Solde après : <span className="font-semibold text-zinc-700">{fmt(m.soldeApres)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hash integrity */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Lock size={12} className="shrink-0 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-600">Intégrité R1</span>
                {hashValid === true && <span className="ml-auto text-[10px] font-bold text-emerald-600">✓ VALIDE</span>}
                {hashValid === false && <span className="ml-auto text-[10px] font-bold text-red-500">✗ INVALIDE</span>}
                {hashValid === null && <span className="ml-auto text-[10px] text-zinc-400">non disponible</span>}
              </div>
              {tx.hash && (
                <p className="mt-1.5 break-all font-mono text-[9px] text-zinc-400">{tx.hash}</p>
              )}
              <p className="mt-1 text-[9px] text-zinc-400">🔒 LOCKED — opération immuable</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 border-t border-zinc-100 px-5 py-3.5">
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
          {canAnnuler && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onAnnuler}
            >
              <XCircle size={13} className="mr-1" /> Annuler l'opération
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-800">{children}</span>
    </div>
  );
}

// ─── TimelineView ─────────────────────────────────────────────────────────────

function TimelineView({ txs, allTx }: { txs: Transaction[]; allTx: Transaction[] }) {
  if (txs.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">Aucune opération pour cette date.</p>;
  }
  const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="relative ml-3 space-y-0">
      {sorted.map((tx, i) => {
        const statut = getStatutAudit(tx, allTx);
        const cfg = TYPE_CFG[tx.type];
        return (
          <div key={tx.id} className="relative flex gap-4 pb-4">
            {/* Vertical line */}
            {i < sorted.length - 1 && (
              <div className="absolute left-[7px] top-6 bottom-0 w-px bg-zinc-200" />
            )}
            {/* Dot */}
            <div className={`relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${statut === 'ANNULEE' ? 'bg-red-400' : (cfg?.badgeClass.split(' ')[0] ?? 'bg-zinc-300')}`}>
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-500">{dayjs(tx.date).format('HH:mm')}</span>
                <TypeBadge type={tx.type} />
                {statut === 'ANNULEE' && <StatutBadge statut="ANNULEE" />}
              </div>
              <p className="mt-0.5 text-xs text-zinc-700">
                {tx.numero && <span className="mr-2 font-mono text-[10px] text-blue-700">{tx.numero}</span>}
                {tx.operation} — {fmt(tx.montant)} {tx.devise} / {fmt(tx.montantMAD)} MAD
              </p>
              <p className="text-[10px] text-zinc-400">{tx.employeNom ?? employeName(tx.employeId)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

type FilterStatut = 'TOUS' | 'VALIDE' | 'ANNULEE';
type ViewMode = 'table' | 'timeline';

export function AuditTrail() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterDateTo, setFilterDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterType, setFilterType] = useState('TOUS');
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('TOUS');
  const [filterCaissier, setFilterCaissier] = useState('TOUS');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [annulerTx, setAnnulerTx] = useState<Transaction | null>(null);

  function load() {
    setTxs(getTransactions());
    setMouvements(getMouvements());
    setClients(getClients());
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const h = () => { load(); };
    window.addEventListener('afromoney-data', h);
    window.addEventListener('afromoney-mouvements', h);
    return () => {
      window.removeEventListener('afromoney-data', h);
      window.removeEventListener('afromoney-mouvements', h);
    };
  }, []);

  // Statut d'audit pour chaque transaction
  const statutMap = useMemo(() => {
    const m = new Map<string, StatutAudit>();
    txs.forEach((tx) => m.set(tx.id, getStatutAudit(tx, txs)));
    return m;
  }, [txs]);

  // Filtered
  const processed = useMemo(() => {
    return txs
      .filter((tx) => {
        const d = dayjs(tx.date).format('YYYY-MM-DD');
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        if (filterType !== 'TOUS' && tx.type !== filterType) return false;
        const statut = statutMap.get(tx.id) ?? 'VALIDE';
        if (filterStatut !== 'TOUS' && statut !== filterStatut) return false;
        if (filterCaissier !== 'TOUS' && tx.employeId !== filterCaissier) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !(tx.numero ?? '').toLowerCase().includes(q) &&
            !tx.operation.toLowerCase().includes(q) &&
            !(tx.note ?? '').toLowerCase().includes(q) &&
            !(tx.employeNom ?? '').toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [txs, statutMap, filterDateFrom, filterDateTo, filterType, filterStatut, filterCaissier, search]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const pageRows = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI
  const totalValides  = txs.filter((tx) => tx.type !== 'ANNULATION' && (statutMap.get(tx.id) === 'VALIDE')).length;
  const totalAnnulees = txs.filter((tx) => tx.type !== 'ANNULATION' && (statutMap.get(tx.id) === 'ANNULEE')).length;
  const totalAnnulOps = txs.filter((tx) => tx.type === 'ANNULATION').length;
  const hashOk = txs.filter((tx) => tx.hash && verifyHash(tx)).length;

  // Caissiers for filter
  const caissiers = useMemo(() => [...new Set(txs.map((tx) => tx.employeId))], [txs]);

  // ── Exports ──
  function auditExportRows() {
    return processed.map((tx) => [
      tx.numero ?? '',
      dayjs(tx.date).format('DD/MM/YYYY HH:mm:ss'),
      tx.type,
      tx.devise,
      tx.montant,
      tx.taux,
      tx.montantMAD,
      tx.employeNom ?? employeName(tx.employeId),
      statutMap.get(tx.id) ?? 'VALIDE',
      tx.hash ? (verifyHash(tx) ? 'OK' : 'INVALIDE') : '—',
      tx.note ?? '',
    ]);
  }

  const AUDIT_HEADERS = [
    'N°',
    'Date',
    'Type',
    'Devise',
    'Montant',
    'Taux',
    'MAD',
    'Caissier',
    'Statut',
    'Hash',
    'Note',
  ];

  function exportExcel() {
    const period =
      filterDateFrom || filterDateTo
        ? `${filterDateFrom || '…'} → ${filterDateTo || '…'}`
        : 'Toutes dates';
    exportSingleStyledSheet(
      {
        sheetName: 'Audit Trail',
        documentTitle: 'Registre des opérations — Audit Trail R1',
        periodLabel: `${processed.length} opération(s) · ${period}`,
        headers: AUDIT_HEADERS,
        rows: auditExportRows(),
        colWidths: [10, 18, 10, 8, 12, 9, 12, 16, 10, 10, 24],
      },
      `audit_trail_${dayjs().format('YYYY-MM-DD')}.xlsx`,
    );
  }

  function exportWord() {
    downloadWordReport({
      title: 'Audit Trail — Registre des opérations',
      subtitle: `${processed.length} opération(s) · généré le ${dayjs().format('DD/MM/YYYY HH:mm')}`,
      sections: [
        {
          heading: 'Opérations filtrées',
          headers: AUDIT_HEADERS,
          rows: auditExportRows().map((r) =>
            r.map((c) => (typeof c === 'number' ? fmt(c, c % 1 === 0 ? 0 : 2) : String(c))),
          ),
        },
      ],
      filename: `audit_trail_${dayjs().format('YYYY-MM-DD')}.doc`,
    });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const dateStr = dayjs().format('DD/MM/YYYY HH:mm');
    const period =
      filterDateFrom || filterDateTo
        ? `${filterDateFrom || '…'} → ${filterDateTo || '…'}`
        : 'Toutes dates';

    // ── En-tête navy ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('AFROMONEY — Bureau de Change', 10, 10.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Audit Trail R1 · Généré le ${dateStr}`, W - 10, 10.5, { align: 'right' });

    // ── Titre ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Registre des Opérations — Audit Trail', 10, 25);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Période : ${period} · ${processed.length} opération(s) filtrée(s)`, 10, 31);

    // ── KPI boxes ──
    const kpis = [
      { label: 'Total opérations', value: String(txs.length),      r: 59,  g: 130, b: 246 },
      { label: 'Valides',          value: String(totalValides),     r: 16,  g: 185, b: 129 },
      { label: 'Annulées',         value: String(totalAnnulees),    r: 239, g: 68,  b: 68  },
      { label: 'Hash R1 valides',  value: `${hashOk}/${txs.filter((t) => !!t.hash).length}`, r: 99, g: 102, b: 241 },
    ];
    const boxW = 60;
    const boxY = 36;
    kpis.forEach((k, i) => {
      const x = 10 + i * (boxW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(k.r, k.g, k.b);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, boxY, boxW, 13, 1.5, 1.5, 'FD');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, x + 3, boxY + 5);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(k.r, k.g, k.b);
      doc.text(k.value, x + 3, boxY + 11);
    });

    // ── Tableau ──
    autoTable(doc, {
      startY: boxY + 17,
      head: [AUDIT_HEADERS],
      body: auditExportRows().map((r) =>
        r.map((c) => (typeof c === 'number' ? fmt(c, c % 1 === 0 ? 0 : 2) : String(c)))
      ),
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 23, 42] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 18 },
        3: { cellWidth: 12 },
        4: { cellWidth: 20, halign: 'right' as const },
        5: { cellWidth: 14, halign: 'right' as const },
        6: { cellWidth: 22, halign: 'right' as const },
        7: { cellWidth: 22 },
        8: { cellWidth: 16, halign: 'center' as const },
        9: { cellWidth: 18 },
        10: { cellWidth: 'auto' as unknown as number },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 8) return;
        const v = String(data.cell.raw);
        if (v === 'ANNULEE') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (v === 'VALIDE') { data.cell.styles.textColor = [5, 150, 105]; data.cell.styles.fontStyle = 'bold'; }
      },
      margin: { left: 10, right: 10 },
    });

    // ── Pied de page ──
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Document confidentiel — AFROMONEY Bureau de Change · Page ${i}/${pages}`,
        W / 2,
        doc.internal.pageSize.getHeight() - 4,
        { align: 'center' }
      );
    }

    doc.save(`Audit_Trail_${dayjs().format('DD-MM-YYYY')}.pdf`);
  }

  function handleAnnulDone() {
    setAnnulerTx(null);
    setDetail(null);
    load();
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Audit Trail — Immuable"
        subtitle="Traçabilité complète R1 · Aucune opération ne peut être modifiée 🔒"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow"
              onClick={exportExcel}
            >
              <Download size={13} className="mr-1.5" /> Excel
            </Button>
            <Button
              size="sm"
              className="bg-slate-600 hover:bg-slate-700 text-white font-semibold shadow"
              onClick={exportWord}
            >
              <Download size={13} className="mr-1.5" /> Word
            </Button>
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white font-semibold shadow"
              onClick={exportPDF}
            >
              <Download size={13} className="mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── KPI ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total opérations</p>
              <p className="mt-0.5 text-2xl font-bold text-zinc-900">{txs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Valides</p>
              <p className="mt-0.5 text-2xl font-bold text-emerald-700">{totalValides}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Annulées</p>
              <p className="mt-0.5 text-2xl font-bold text-red-700">{totalAnnulees}</p>
              <p className="text-[10px] text-zinc-400">{totalAnnulOps} op. annulation</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Hash R1 valides</p>
              <p className="mt-0.5 text-2xl font-bold text-blue-700">{hashOk}/{txs.filter((t) => !!t.hash).length}</p>
              <p className="text-[10px] text-zinc-400">intégrité vérifiée</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filtres ── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Date range */}
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              />
              <span className="text-xs text-zinc-400">→</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              />
              <button
                type="button"
                onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-600 hover:border-zinc-400"
              >
                Tout
              </button>

              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Tous types</option>
                {Object.keys(TYPE_CFG).map((t) => (
                  <option key={t} value={t}>{TYPE_CFG[t].label}</option>
                ))}
              </select>

              {/* Statut */}
              <select
                value={filterStatut}
                onChange={(e) => { setFilterStatut(e.target.value as FilterStatut); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Tous statuts</option>
                <option value="VALIDE">Valides</option>
                <option value="ANNULEE">Annulées</option>
              </select>

              {/* Caissier */}
              <select
                value={filterCaissier}
                onChange={(e) => { setFilterCaissier(e.target.value); setPage(1); }}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-900"
              >
                <option value="TOUS">Tous caissiers</option>
                {caissiers.map((id) => (
                  <option key={id} value={id}>{employeName(id)}</option>
                ))}
              </select>

              {/* Recherche */}
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="N° BCH, opération, note…"
                className="h-8 w-44 text-xs"
              />

              {/* View toggle */}
              <div className="ml-auto flex overflow-hidden rounded-md border border-zinc-300 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 font-semibold transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
                >
                  📊 Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={`px-3 py-1.5 font-semibold transition-colors ${viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
                >
                  <Clock size={12} className="mr-1 inline" /> Timeline
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Main view ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              Opérations
              <span className="ml-2 font-normal text-zinc-400">({processed.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {viewMode === 'timeline' ? (
              <div className="px-5 py-4">
                <TimelineView txs={processed} allTx={txs} />
              </div>
            ) : (
              <>
                {processed.length === 0 ? (
                  <p className="py-16 text-center text-sm text-zinc-400">Aucune opération pour ces filtres.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b border-zinc-200 bg-zinc-50">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Heure</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">N° BCH</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Type</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Caissier</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Devise</th>
                            <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Montant</th>
                            <th className="px-3 py-2.5 text-right font-medium text-zinc-500">MAD</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Statut</th>
                            <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Hash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {pageRows.map((tx, i) => {
                            const statut = statutMap.get(tx.id) ?? 'VALIDE';
                            const isAnnulee = statut === 'ANNULEE';
                            return (
                              <tr
                                key={tx.id}
                                onClick={() => setDetail(tx)}
                                className={`cursor-pointer transition-colors hover:bg-zinc-100 ${i % 2 === 0 ? '' : 'bg-zinc-50/50'} ${isAnnulee ? 'opacity-60' : ''}`}
                              >
                                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">
                                  <div className="font-mono">{dayjs(tx.date).format('HH:mm:ss')}</div>
                                  <div className="text-[10px] text-zinc-400">{dayjs(tx.date).format('DD/MM/YY')}</div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-semibold text-blue-700">
                                  {tx.numero ?? '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                  <TypeBadge type={tx.type} />
                                </td>
                                <td className="px-3 py-2.5 text-zinc-600">
                                  {tx.employeNom ?? employeName(tx.employeId)}
                                </td>
                                <td className="px-3 py-2.5 font-mono font-semibold text-zinc-700">{tx.devise}</td>
                                <td className={`px-3 py-2.5 text-right tabular-nums ${isAnnulee ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                                  {fmt(tx.montant)}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${isAnnulee ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                                  {fmt(tx.montantMAD)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatutBadge statut={statut} />
                                </td>
                                <td className="px-3 py-2.5">
                                  <HashBadge tx={tx} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500">
                        <span>Page {page} / {totalPages} · {processed.length} résultats</span>
                        <div className="flex gap-1">
                          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                            className="rounded border border-zinc-300 p-1 disabled:opacity-40 hover:bg-zinc-100">
                            <ChevronLeft size={13} />
                          </button>
                          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                            className="rounded border border-zinc-300 p-1 disabled:opacity-40 hover:bg-zinc-100">
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modals ── */}
      {detail && !annulerTx && (
        <DetailModal
          tx={detail}
          statut={statutMap.get(detail.id) ?? 'VALIDE'}
          mouvements={mouvements}
          clients={clients}
          allTx={txs}
          onClose={() => setDetail(null)}
          onAnnuler={() => setAnnulerTx(detail)}
        />
      )}
      {annulerTx && (
        <AnnulationModal
          tx={annulerTx}
          onClose={() => setAnnulerTx(null)}
          onDone={handleAnnulDone}
        />
      )}
    </div>
  );
}
