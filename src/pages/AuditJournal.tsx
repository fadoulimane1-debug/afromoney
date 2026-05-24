import { useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { Shield, Search, Download, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuditLogs, type AuditLogEntry } from '@/lib/auditLog';
import { exportSingleStyledSheet } from '@/lib/exportStyled';

dayjs.locale('fr');

// ── labels & couleurs ────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  TRANSACTION_CREEE: 'Transaction créée',
  TRANSACTION_MODIFIEE: 'Transaction modifiée',
  TRANSACTION_SUPPRIMEE: 'Transaction supprimée',
  CLOTURE_ENREGISTREE: 'Clôture enregistrée',
  CLOTURE_VALIDEE: 'Clôture validée',
  RECONCILIATION_VALIDEE: 'Réconciliation validée',
  PARAMETRES_MODIFIES: 'Paramètres modifiés',
  CREDIT_CREEE: 'Crédit créé',
  CREDIT_MODIFIE: 'Crédit modifié',
  CREDIT_SUPPRIMEE: 'Crédit supprimé',
  CLIENT_CREE: 'Client créé',
  CLIENT_MODIFIE: 'Client modifié',
  CLIENT_SUPPRIME: 'Client supprimé',
  RELIQUAT_CREE: 'Reliquat créé',
  RELIQUAT_VERSEMENT_ENREGISTRE: 'Versement reliquat',
  RELIQUAT_SOLDE: 'Reliquat soldé',
  RELIQUAT_SUPPRIME: 'Reliquat supprimé',
};

const ACTION_COLOR: Record<string, string> = {
  TRANSACTION_CREEE: 'bg-blue-100 text-blue-700',
  TRANSACTION_MODIFIEE: 'bg-indigo-100 text-indigo-700',
  TRANSACTION_SUPPRIMEE: 'bg-red-100 text-red-700',
  CLOTURE_ENREGISTREE: 'bg-amber-100 text-amber-700',
  CLOTURE_VALIDEE: 'bg-amber-200 text-amber-800',
  RECONCILIATION_VALIDEE: 'bg-emerald-100 text-emerald-700',
  PARAMETRES_MODIFIES: 'bg-zinc-100 text-zinc-700',
  CREDIT_CREEE: 'bg-violet-100 text-violet-700',
  CREDIT_MODIFIE: 'bg-violet-100 text-violet-600',
  CREDIT_SUPPRIMEE: 'bg-violet-100 text-violet-700',
  CLIENT_CREE: 'bg-teal-100 text-teal-700',
  CLIENT_MODIFIE: 'bg-teal-100 text-teal-600',
  CLIENT_SUPPRIME: 'bg-red-100 text-red-600',
  RELIQUAT_CREE: 'bg-orange-100 text-orange-700',
  RELIQUAT_VERSEMENT_ENREGISTRE: 'bg-orange-100 text-orange-600',
  RELIQUAT_SOLDE: 'bg-emerald-100 text-emerald-600',
  RELIQUAT_SUPPRIME: 'bg-red-100 text-red-600',
};

// ── extracteurs ──────────────────────────────────────────────────────────────

function fmtNum(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractClient(d: Record<string, unknown>): string {
  const v = d.clientNom ?? d.client ?? d.nom ?? d.beneficiaire;
  const s = String(v ?? '').trim();
  return s || '—';
}

// TX_CREATE stores only { type, devise, montantMAD } — no raw montant/taux
function extractMontant(action: string, d: Record<string, unknown>): string {
  if (action.startsWith('TRANSACTION')) return fmtNum(d.montantMAD);
  if (action.startsWith('RELIQUAT')) return fmtNum(d.montant);
  if (action === 'CREDIT_CREEE') return fmtNum(d.mad);
  if (action === 'CLOTURE_VALIDEE') return fmtNum(d.realBalance);
  return fmtNum(d.montant ?? d.montantMAD);
}

// montant column always in MAD for transactions (montantMAD is what's stored)
function extractDevise(action: string, d: Record<string, unknown>): string {
  if (action.startsWith('TRANSACTION')) return 'MAD';
  if (action.startsWith('RELIQUAT')) return String(d.devise ?? 'MAD');
  if (action === 'CLOTURE_VALIDEE') return 'MAD';
  return String(d.devise ?? '—');
}

function extractOperation(d: Record<string, unknown>): string {
  if (d.numero) return String(d.numero);
  if (d.operationRef) return String(d.operationRef);
  if (d.operation) return String(d.operation).slice(0, 32);
  return '—';
}

// ── helpers notes ─────────────────────────────────────────────────────────────

function txTypeIcon(type: string): string {
  switch (String(type).toUpperCase()) {
    case 'ACHAT': return '📥';
    case 'VENTE': return '📤';
    case 'DEPOT': return '💰';
    case 'RETRAIT': return '💸';
    case 'CHARGES': return '🧾';
    default: return '📝';
  }
}

function clientSuffix(d: Record<string, unknown>): string {
  const c = extractClient(d);
  return c !== '—' ? ` (${c})` : '';
}

// extractNotes: produces a short human-readable summary matched to what's
// actually stored in each action's details object.
function extractNotes(action: string, d: Record<string, unknown>): string {
  switch (action) {
    // ── Transactions ──────────────────────────────────────────────────────────
    case 'TRANSACTION_CREEE': {
      // stored: { id, type, devise, montantMAD }
      const icon = txTypeIcon(String(d.type ?? ''));
      const type = String(d.type ?? '?');
      const devise = String(d.devise ?? '');
      const mad = fmtNum(d.montantMAD);
      return `${icon} ${type} ${devise} → ${mad} MAD`;
    }
    case 'TRANSACTION_MODIFIEE': {
      // stored: { id, updates, before: { statut, montantMAD } }
      const before = d.before as Record<string, unknown> | undefined;
      const prevMAD = before ? fmtNum(before.montantMAD) : '—';
      const prevStatut = before ? String(before.statut ?? '') : '';
      return `✏️ Avant : ${prevMAD} MAD${prevStatut ? ` · ${prevStatut}` : ''}`;
    }
    case 'TRANSACTION_SUPPRIMEE': {
      // stored: { id, type, montantMAD }
      const icon = txTypeIcon(String(d.type ?? ''));
      const mad = fmtNum(d.montantMAD);
      return `${icon}🗑️ ${String(d.type ?? '')} supprimé · ${mad} MAD`;
    }

    // ── Clôtures ──────────────────────────────────────────────────────────────
    case 'CLOTURE_VALIDEE': {
      // stored: { closureId, date, realBalance, manager }
      const date = d.date ? dayjs(String(d.date)).format('DD/MM/YYYY') : '—';
      const balance = fmtNum(d.realBalance);
      const mgr = d.manager ? String(d.manager) : null;
      return `🔒 ${date} · Solde : ${balance} MAD${mgr ? ` · ${mgr}` : ''}`;
    }
    case 'CLOTURE_ENREGISTREE': {
      const date = d.date ? dayjs(String(d.date)).format('DD/MM/YYYY') : '';
      return `📋 Clôture enregistrée${date ? ` : ${date}` : ''}`;
    }

    // ── Reliquats ─────────────────────────────────────────────────────────────
    case 'RELIQUAT_CREE': {
      // stored: { client, devise, montant, operationRef }
      const montant = fmtNum(d.montant);
      const devise = String(d.devise ?? 'MAD');
      return `⚠️ Créance créée : ${montant} ${devise}${clientSuffix(d)}`;
    }
    case 'RELIQUAT_VERSEMENT_ENREGISTRE': {
      // stored: { id, client, montant (= versement amount), restant? }
      const versement = fmtNum(d.montant);
      const restant = d.restant != null ? ` · Restant : ${fmtNum(d.restant)} MAD` : '';
      return `💳 Versement : ${versement} MAD${clientSuffix(d)}${restant}`;
    }
    case 'RELIQUAT_SOLDE': {
      // stored: { id, client, montant, restant }
      const montant = fmtNum(d.montant);
      return `✅ Soldé : ${montant} MAD${clientSuffix(d)}`;
    }
    case 'RELIQUAT_SUPPRIME':
      return '🗑️ Reliquat supprimé';

    // ── Clients ───────────────────────────────────────────────────────────────
    case 'CLIENT_CREE': {
      // stored: { id, nom, categorie }
      const nom = String(d.nom ?? '—');
      const cat = d.categorie ? ` (${d.categorie})` : '';
      return `👤 ${nom}${cat}`;
    }
    case 'CLIENT_MODIFIE': {
      const nom = String(d.nom ?? '—');
      const cat = d.categorie ? ` → ${d.categorie}` : '';
      return `✏️ ${nom}${cat}`;
    }
    case 'CLIENT_SUPPRIME':
      return '🗑️ Client supprimé';

    // ── Crédits ───────────────────────────────────────────────────────────────
    case 'CREDIT_CREEE': {
      // stored: { id, nom, mad }
      const nom = String(d.nom ?? '—');
      const mad = fmtNum(d.mad);
      return `💳 ${nom} · ${mad} MAD`;
    }
    case 'CREDIT_MODIFIE': {
      // stored: { id, action: 'marquerPayé' | 'marquerRetard' }
      if (d.action === 'marquerPayé') return '✅ Marqué payé';
      if (d.action === 'marquerRetard') return '⚠️ Marqué en retard';
      return '✏️ Crédit modifié';
    }
    case 'CREDIT_SUPPRIMEE': {
      const nom = String(d.nom ?? '—');
      return `🗑️ ${nom} supprimé`;
    }

    // ── Paramètres ────────────────────────────────────────────────────────────
    case 'PARAMETRES_MODIFIES':
      if (d.action === 'PURGE_TRANSACTIONS') return '🗑️ Purge données test';
      return '⚙️ Paramètres mis à jour';

    // ── Réconciliation ────────────────────────────────────────────────────────
    case 'RECONCILIATION_VALIDEE':
      return '✅ Réconciliation validée';

    // ── Défaut ────────────────────────────────────────────────────────────────
    default: {
      // Some user operations are logged with TX_* codes and carry d.action
      const act = String(d.action ?? '');
      if (act === 'USER_CREATE') return `👤 Utilisateur créé : ${d.nom ?? ''}`;
      if (act === 'USER_UPDATE') return '✏️ Utilisateur modifié';
      if (act === 'USER_DELETE') return '🗑️ Utilisateur supprimé';
      if (d.note && String(d.note).trim()) return String(d.note);
      return '—';
    }
  }
}

function fmtTs(iso: string) {
  return dayjs(iso).format('DD/MM/YYYY HH:mm:ss');
}

// ── component ─────────────────────────────────────────────────────────────────

export function AuditJournal() {
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getAuditLogs());
  const [modal, setModal] = useState<AuditLogEntry | null>(null);

  function refresh() {
    setLogs(getAuditLogs(dateFilter || undefined));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = dateFilter ? logs.filter((l) => l.date === dateFilter) : logs;
    if (q) {
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.user.toLowerCase().includes(q) ||
          extractClient(l.details).toLowerCase().includes(q) ||
          extractNotes(l.action, l.details).toLowerCase().includes(q) ||
          JSON.stringify(l.details).toLowerCase().includes(q),
      );
    }
    return [...list].reverse();
  }, [logs, search, dateFilter]);

  function exportExcel() {
    exportSingleStyledSheet(
      {
        sheetName: 'Journal audit',
        documentTitle: "Journal d'audit — Historique des modifications",
        periodLabel: dateFilter
          ? dayjs(dateFilter).format('DD/MM/YYYY')
          : `${filtered.length} entrée(s)`,
        headers: ['Date', 'Heure', 'Action', 'Utilisateur', 'Client', 'Montant', 'Devise', 'N° Opération', 'Notes'],
        rows: filtered.map((l) => [
          l.date,
          dayjs(l.timestamp).format('HH:mm:ss'),
          ACTION_LABELS[l.action] ?? l.action,
          l.user,
          extractClient(l.details),
          extractMontant(l.action, l.details),
          extractDevise(l.action, l.details),
          extractOperation(l.details),
          extractNotes(l.action, l.details),
        ]),
        colWidths: [12, 10, 22, 18, 20, 14, 8, 20, 40],
      },
      `journal_audit_${dayjs().format('YYYY-MM-DD')}.xlsx`,
    );
  }

  function exportCsv() {
    const header = 'Date;Heure;Action;Utilisateur;Client;Montant;Devise;N° Opération;Notes';
    const rows = filtered.map((l) =>
      [
        l.date,
        dayjs(l.timestamp).format('HH:mm:ss'),
        ACTION_LABELS[l.action] ?? l.action,
        l.user,
        extractClient(l.details),
        extractMontant(l.action, l.details),
        extractDevise(l.action, l.details),
        extractOperation(l.details),
        `"${extractNotes(l.action, l.details).replace(/"/g, '""')}"`,
      ].join(';'),
    );
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHero
        title="Journal d'audit"
        subtitle="Traçabilité des opérations sensibles — modifications, clôtures, réconciliations"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={exportExcel} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700">
              <Download size={14} /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download size={14} /> CSV
            </Button>
          </div>
        }
      />

      <div className="page-content mx-auto max-w-7xl space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield size={16} className="text-cyan-600" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setLogs(getAuditLogs(e.target.value || undefined));
              }}
              className="w-40"
            />
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Action, utilisateur, client, opération…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              Actualiser
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
              <span className="ml-auto text-xs font-normal text-zinc-400">
                Cliquez une ligne pour le détail complet
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-3 py-2 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 whitespace-nowrap">Heure</th>
                  <th className="px-3 py-2 whitespace-nowrap">Action</th>
                  <th className="px-3 py-2 whitespace-nowrap">Utilisateur</th>
                  <th className="px-3 py-2 whitespace-nowrap">Client</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Montant</th>
                  <th className="px-3 py-2 whitespace-nowrap">Devise</th>
                  <th className="px-3 py-2 whitespace-nowrap">N° Opération</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      Aucune entrée d'audit pour ces filtres.
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => (
                    <tr
                      key={l.id}
                      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      onClick={() => setModal(l)}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-zinc-600">
                        {dayjs(l.timestamp).format('DD/MM/YYYY')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-zinc-400">
                        {dayjs(l.timestamp).format('HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[l.action] ?? 'bg-zinc-100 text-zinc-600'}`}
                        >
                          {ACTION_LABELS[l.action] ?? l.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">{l.user}</td>
                      <td className="px-3 py-2 text-xs font-medium text-zinc-800">
                        {extractClient(l.details)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-medium text-zinc-800">
                        {extractMontant(l.action, l.details)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                        {extractDevise(l.action, l.details)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                        {extractOperation(l.details)}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-xs text-zinc-500">
                        {extractNotes(l.action, l.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── Modal détail ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête modal */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ACTION_COLOR[modal.action] ?? 'bg-zinc-100 text-zinc-600'}`}
                >
                  {ACTION_LABELS[modal.action] ?? modal.action}
                </span>
                <span className="text-sm text-zinc-500">{fmtTs(modal.timestamp)}</span>
              </div>
              <button
                onClick={() => setModal(null)}
                className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Grille metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="mb-1 text-xs text-zinc-400">Utilisateur</p>
                  <p className="font-semibold text-zinc-800">{modal.user}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="mb-1 text-xs text-zinc-400">Client</p>
                  <p className="font-semibold text-zinc-800">{extractClient(modal.details)}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="mb-1 text-xs text-zinc-400">Montant</p>
                  <p className="font-semibold tabular-nums text-zinc-800">
                    {extractMontant(modal.action, modal.details)}{' '}
                    <span className="font-mono text-zinc-500">
                      {extractDevise(modal.action, modal.details)}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="mb-1 text-xs text-zinc-400">N° Opération</p>
                  <p className="font-mono text-zinc-800">{extractOperation(modal.details)}</p>
                </div>
              </div>

              {/* Résumé */}
              {extractNotes(modal.action, modal.details) !== '—' && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <p className="mb-1 text-xs text-blue-400">Résumé</p>
                  <p className="text-sm text-blue-800">
                    {extractNotes(modal.action, modal.details)}
                  </p>
                </div>
              )}

              {/* Détails techniques */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Détails techniques
                </p>
                <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-emerald-400">
                  {JSON.stringify(modal.details, null, 2)}
                </pre>
              </div>

              <p className="break-all font-mono text-[10px] text-zinc-300">ID : {modal.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
