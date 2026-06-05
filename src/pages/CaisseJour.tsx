import { useEffect, useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, ArrowRight, TrendingUp, TrendingDown, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAppData } from '@/hooks/useAppData';
import { summarizeCaisseJourV8, recapDeviseJournee } from '@/lib/bilanV8';
import { creditsForCaisseJour, settleCredit, type Credit } from '@/lib/credits';
import { getReliquats, getMouvements } from '@/lib/storage';
import { getAllSnapshots } from '@/lib/stageCaisse/storage';
import type { Transaction, TransactionType, Reliquat } from '@/types';
import { fmt, fmtRate } from '@/lib/formatNumbers';
import { montantMadComptable } from '@/lib/calculations';

dayjs.locale('fr');

const SECTIONS: {
  type: TransactionType; title: string; borderClass: string; headerClass: string; kind: 'exchange' | 'cash' | 'charge';
}[] = [
  { type: 'ACHAT',   title: 'ACHATS DEVISES', borderClass: 'border-l-4 border-l-emerald-500', headerClass: 'bg-emerald-50', kind: 'exchange' },
  { type: 'VENTE',   title: 'VENTES DEVISES', borderClass: 'border-l-4 border-l-amber-400',   headerClass: 'bg-amber-50',   kind: 'exchange' },
  { type: 'DEPOT',   title: 'DÉPÔTS',         borderClass: 'border-l-4 border-l-sky-500',     headerClass: 'bg-sky-50',     kind: 'cash' },
  { type: 'RETRAIT', title: 'RETRAITS',       borderClass: 'border-l-4 border-l-orange-500',  headerClass: 'bg-orange-50',  kind: 'cash' },
  { type: 'CHARGES', title: 'CHARGES',        borderClass: 'border-l-4 border-l-zinc-500',    headerClass: 'bg-zinc-100',   kind: 'charge' },
];

function TableExchange({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-zinc-400">Aucune ligne pour ce jour.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="w-28">N° Op.</TableHead>
            <TableHead className="w-16">Heure</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">Taux</TableHead>
            <TableHead className="text-right font-semibold">MAD</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="font-mono text-[10px] font-semibold text-blue-700 whitespace-nowrap">{t.numero ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
              <TableCell className="font-medium text-zinc-700">{t.type}</TableCell>
              <TableCell className="font-bold text-zinc-900">{t.devise}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(t.montant)}</TableCell>
              <TableCell className="text-right tabular-nums text-zinc-500">{fmtRate(t.taux)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-zinc-900">{fmt(t.montantMAD)}</TableCell>
              <TableCell>
                {t.statut === 'CRÉDIT' && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">CRÉDIT</span>
                )}
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-zinc-500" title={t.note}>{t.note || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableCash({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-zinc-400">Aucune ligne pour ce jour.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="w-28">N° Op.</TableHead>
            <TableHead className="w-16">Heure</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="text-right font-semibold">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="font-mono text-[10px] font-semibold text-blue-700 whitespace-nowrap">{t.numero ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
              <TableCell className="font-bold text-zinc-900">{t.devise}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-zinc-900">{fmt(t.devise === 'MAD' ? t.montant : t.montantMAD)}</TableCell>
              <TableCell>
                {t.statut === 'CRÉDIT' && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">CRÉDIT</span>
                )}
                {t.statut === 'NON PAYÉ' && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">NON PAYÉ</span>
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-zinc-500" title={t.note}>{t.note || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableCharges({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-zinc-400">Aucune charge enregistrée ce jour.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="w-28">N° Op.</TableHead>
            <TableHead className="w-16">Heure</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right font-semibold">Montant MAD</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="font-mono text-[10px] font-semibold text-blue-700 whitespace-nowrap">{t.numero ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
              <TableCell className="font-medium text-zinc-800">{t.operation || t.note || 'Charge agence'}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-zinc-900">{fmt(t.montantMAD)}</TableCell>
              <TableCell className="max-w-[200px] truncate text-zinc-500" title={t.note}>{t.note || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function reliquatsForCaisseJour(day: string): Reliquat[] {
  return getReliquats().filter(
    (r) => r.dateCreation === day || r.dateMaj === day || r.versements.some((v) => v.date === day),
  );
}

const RELIQUAT_STATUT: Record<string, string> = {
  NON_SOLDE: 'Non soldé', PARTIELLEMENT_SOLDE: 'Partiel', SOLDE: 'Soldé',
};

function TableCreditsCaisse({ rows, onSettle }: { rows: Credit[]; onSettle: (id: string) => void }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-zinc-400">Aucun crédit créé ou soldé ce jour.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead className="w-16">Heure</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="text-right font-semibold">MAD</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c, i) => (
            <TableRow key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="whitespace-nowrap text-zinc-500">{c.date}</TableCell>
              <TableCell className="font-medium text-zinc-900">{c.nom}</TableCell>
              <TableCell className="font-bold">{c.devise}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(c.montant)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(c.contre_val_mad)}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.statut === 'Payé' ? 'bg-emerald-100 text-emerald-800' : c.statut === 'Retard' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                  {c.statut}{c.dateSolde ? ` · ${dayjs(c.dateSolde).format('DD/MM')}` : ''}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {c.statut !== 'Payé' ? (
                  <button type="button" onClick={() => onSettle(c.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">
                    <CheckCircle size={10} /> Solder
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-600">En caisse</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableReliquatsCaisse({ rows }: { rows: Reliquat[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-zinc-400">Aucun reliquat pour ce jour.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-zinc-50">
            <TableHead>Client</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="text-right">Initial</TableHead>
            <TableHead className="text-right">Restant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Réf.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="font-medium">{r.client}</TableCell>
              <TableCell className="font-bold">{r.devise}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.montantInitial)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-red-600">{fmt(r.montantRestant)}</TableCell>
              <TableCell className="text-[10px]">{RELIQUAT_STATUT[r.statut] ?? r.statut}</TableCell>
              <TableCell className="font-mono text-[10px] text-zinc-500">{r.operationNumero || r.operationRef}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CaisseJour() {
  const navigate = useNavigate();
  const { transactions } = useAppData();
  const [day, setDay] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    const bump = () => setDataTick((n) => n + 1);
    window.addEventListener('afromoney-data', bump);
    window.addEventListener('afromoney-credits', bump);
    window.addEventListener('afromoney-mouvements', bump);
    return () => {
      window.removeEventListener('afromoney-data', bump);
      window.removeEventListener('afromoney-credits', bump);
      window.removeEventListener('afromoney-mouvements', bump);
    };
  }, []);

  const dayJs = useMemo(() => dayjs(day), [day]);

  const txJour = useMemo(
    () => transactions.filter((t) => dayjs(t.date).format('YYYY-MM-DD') === day).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions, day]
  );

  const recap = useMemo(() => recapDeviseJournee(transactions, dayJs), [transactions, dayJs]);
  const kpi   = useMemo(() => summarizeCaisseJourV8(transactions, dayJs), [transactions, dayJs]);

  // ── Départ MAD depuis snapshot DEPART ──
  const caisseDepart = useMemo(() => {
    const snapshots = getAllSnapshots();
    return snapshots
      .filter((s) => s.type_solde === 'DEPART' && s.date_comptable === day && s.devise_code === 'MAD')
      .reduce((sum, s) => sum + s.montant, 0);
  }, [day]);

  const chargesJour = txJour.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + t.montantMAD, 0);

  // ── Caisse fin corrigée ──
  const caisseFinMAD = useMemo(() => {
    // Ventes PAYÉES encaissent MAD (pas les crédits, pas taux=1 devise)
    const ventesMad = txJour
      .filter((t) => t.type === 'VENTE' && t.statut !== 'CRÉDIT' && !(t.devise !== 'MAD' && t.taux === 1))
      .reduce((s, t) => s + t.montantMAD, 0);
    // Achats PAYÉS débitent MAD
    const achatsMad = txJour
      .filter((t) => t.type === 'ACHAT' && t.statut !== 'CRÉDIT' && !(t.devise !== 'MAD' && t.taux === 1))
      .reduce((s, t) => s + t.montantMAD, 0);
    // Dépôts MAD payés seulement
    const depotsMad = txJour
      .filter((t) => t.type === 'DEPOT' && t.devise === 'MAD' && t.statut === 'PAYÉ')
      .reduce((s, t) => s + t.montant, 0);
    // Retraits MAD
    const retraitsMad = txJour
      .filter((t) => t.type === 'RETRAIT' && t.devise === 'MAD')
      .reduce((s, t) => s + t.montant, 0);
    // Alimentations MAD du jour
    const alimentationsMAD = getMouvements()
      .filter((m) => m.type === 'ALIMENTATION' && m.devise === 'MAD' && dayjs(m.timestamp).format('YYYY-MM-DD') === day)
      .reduce((s, m) => s + Math.abs(m.montant), 0);
    // Prélèvements MAD du jour
    const prelevementsMAD = getMouvements()
      .filter((m) => m.type === 'PRELEVEMENT' && m.devise === 'MAD' && dayjs(m.timestamp).format('YYYY-MM-DD') === day)
      .reduce((s, m) => s + Math.abs(m.montant), 0);
    // Crédits soldés
    const creditsSoldes = kpi.creditsSoldesMad ?? 0;
    return caisseDepart + ventesMad - achatsMad + depotsMad - retraitsMad + alimentationsMAD - prelevementsMAD - chargesJour + creditsSoldes;
  }, [caisseDepart, txJour, chargesJour, day, kpi.creditsSoldesMad]);

  const creditsJour  = useMemo(() => { void dataTick; return creditsForCaisseJour(day); }, [day, dataTick]);
  const reliquatsJour = useMemo(() => { void dataTick; return reliquatsForCaisseJour(day); }, [day, dataTick]);
  const creditsTxJour = txJour.filter((t) => t.statut === 'CRÉDIT');

  function handleSettleCredit(id: string) { settleCredit(id); setDataTick((n) => n + 1); }
  function rowsForType(type: TransactionType): Transaction[] { return txJour.filter((t) => t.type === type); }

  return (
    <div>
      <PageHero
        title="Caisse journalière"
        subtitle={`Opérations du jour — ${dayJs.format('dddd D MMMM YYYY')}`}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <Calendar size={14} />
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            <button className="btn-gradient flex items-center gap-1.5" onClick={() => navigate('/transactions')}>
              <Plus size={14} /> Saisie / historique
            </button>
          </>
        }
      />

      <div className="page-content mx-auto max-w-7xl space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_minmax(280px,320px)]">

          {/* ─── Colonne gauche ─── */}
          <div className="space-y-5">
            {SECTIONS.map(({ type, title, borderClass, headerClass, kind }) => {
              const rows = rowsForType(type);
              const total = rows.reduce((s, t) => s + montantMadComptable(t), 0);
              return (
                <section key={type} className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${borderClass}`}>
                  <div className={`flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 ${headerClass}`}>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">{title}</h2>
                    <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
                      <span>{rows.length} ligne{rows.length !== 1 ? 's' : ''}</span>
                      {rows.length > 0 && <span className="font-bold text-zinc-800">Total : {fmt(total)} MAD</span>}
                    </span>
                  </div>
                  {kind === 'exchange' && <TableExchange rows={rows} />}
                  {kind === 'cash'     && <TableCash rows={rows} />}
                  {kind === 'charge'   && <TableCharges rows={rows} />}
                </section>
              );
            })}

            {/* Crédits */}
            <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm border-l-4 border-l-violet-500">
              <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50 px-4 py-2.5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">Crédits</h2>
                <span className="ml-auto text-xs text-zinc-500">{creditsJour.length} ligne(s)</span>
                <button type="button" onClick={() => navigate('/credits')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 hover:underline">
                  Gérer <ExternalLink size={10} />
                </button>
              </div>
              <TableCreditsCaisse rows={creditsJour} onSettle={handleSettleCredit} />
              <p className="border-t border-violet-100 px-4 py-2 text-[10px] text-violet-800">
                ⚠️ Crédit en devise (taux=1) → ne touche pas les MAD, soustrait uniquement du stock devise.
              </p>
            </section>

            {creditsTxJour.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Opérations en crédit (historique)</h2>
                  <span className="ml-auto text-xs text-zinc-500">{creditsTxJour.length} ligne(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-zinc-50">
                        <TableHead className="w-16">Heure</TableHead>
                        <TableHead>N° Op.</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right font-semibold">MAD</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditsTxJour.map((t, i) => (
                        <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                          <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
                          <TableCell className="font-mono text-[10px]">{t.numero ?? '—'}</TableCell>
                          <TableCell className="font-bold">{t.devise}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">{fmt(t.montantMAD)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-zinc-500">{t.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            {/* Reliquats */}
            <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm border-l-4 border-l-amber-500">
              <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">Reliquats</h2>
                <span className="ml-auto text-xs text-zinc-500">{reliquatsJour.length} ligne(s)</span>
                <button type="button" onClick={() => navigate('/reliquats')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:underline">
                  Gérer <ExternalLink size={10} />
                </button>
              </div>
              <TableReliquatsCaisse rows={reliquatsJour} />
              <p className="border-t border-amber-100 px-4 py-2 text-[10px] text-amber-800">
                Reliquats créés, mis à jour ou avec versement ce jour.
              </p>
            </section>

            {/* Récap par devise */}
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900">Récapitulatif mouvements par devise — journée</h2>
              <p className="mb-3 text-xs text-zinc-400">Quantités achetées / vendues / retirées ce jour.</p>
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-zinc-50">
                      <TableHead>Devise</TableHead>
                      <TableHead className="text-right">Achats</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">Retraits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recap.filter((r) => r.achatsJour > 0 || r.ventesJour > 0 || r.retraitsJour > 0).map((r, i) => (
                      <TableRow key={r.devise} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                        <TableCell className="font-bold text-zinc-900">{r.devise}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">{fmt(r.achatsJour)}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-700">{fmt(r.ventesJour)}</TableCell>
                        <TableCell className="text-right tabular-nums text-orange-600">{fmt(r.retraitsJour)}</TableCell>
                      </TableRow>
                    ))}
                    {recap.every((r) => r.achatsJour === 0 && r.ventesJour === 0 && r.retraitsJour === 0) && (
                      <TableRow><TableCell colSpan={4} className="text-center text-zinc-400 py-4">Aucun mouvement de devises ce jour.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          {/* ─── Colonne droite ─── */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="border-blue-100 bg-gradient-to-b from-blue-50/80 to-white shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-900">Totaux journée</CardTitle>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{dayJs.format('dddd D MMMM YYYY')}</p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-emerald-50">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium"><TrendingDown size={12} /> Total achats (MAD)</span>
                  <span className="font-bold tabular-nums text-emerald-800">{fmt(kpi.totalAchatsMad)}</span>
                </div>
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-amber-50">
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium"><TrendingUp size={12} /> Total ventes (MAD)</span>
                  <span className="font-bold tabular-nums text-amber-800">{fmt(kpi.totalVentesMad)}</span>
                </div>
                <div className="border-t border-zinc-100 pt-1" />
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Total dépôts</span>
                  <span className="font-semibold tabular-nums text-sky-700">{fmt(kpi.totalDepotsMad)}</span>
                </div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Total retraits</span>
                  <span className="font-semibold tabular-nums text-orange-600">{fmt(kpi.totalRetraitsMad)}</span>
                </div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Total charges</span>
                  <span className="font-semibold tabular-nums text-zinc-700">{fmt(chargesJour)}</span>
                </div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Crédits accordés</span>
                  <span className="font-semibold tabular-nums text-violet-700">{fmt(kpi.creditsAccordesMad)}</span>
                </div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Crédits soldés</span>
                  <span className="font-semibold tabular-nums text-emerald-700">+{fmt(kpi.creditsSoldesMad)}</span>
                </div>
                <div className="border-t border-zinc-200 pt-2 mt-1" />
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-zinc-50">
                  <span className="text-xs font-semibold text-zinc-700">Bénéfice estimé</span>
                  <span className={`font-bold tabular-nums text-sm ${kpi.beneficeEstime >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(kpi.beneficeEstime)}</span>
                </div>
                <p className="px-2 text-[10px] text-zinc-400 leading-tight">= Ventes − Achats − Charges</p>
                <div className="border-t-2 border-blue-300 pt-3 mt-2" />
                <div className="flex justify-between gap-2 rounded-lg bg-blue-600 px-3 py-3">
                  <span className="text-xs font-bold text-blue-100">Caisse fin de journée (estim.)</span>
                  <span className="text-sm font-bold tabular-nums text-white">{fmt(caisseFinMAD)}</span>
                </div>
                <p className="px-1 text-[10px] text-zinc-400 leading-tight">
                  = Départ + Ventes − Achats + Dépôts MAD + Alimentations − Prélèvements − Charges + Crédits soldés
                </p>
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full gap-2 border-zinc-200" onClick={() => navigate('/stock')}>
              Mémoire stocks <ArrowRight size={14} />
            </Button>
            <Button variant="ghost" className="w-full gap-2 text-zinc-500 text-xs" onClick={() => navigate('/transactions')}>
              <Plus size={12} /> Ajouter une transaction
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
