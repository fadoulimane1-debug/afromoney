import { useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppData } from '@/hooks/useAppData';
import { summarizeCaisseJourV8, recapDeviseJournee } from '@/lib/bilanV8';
import type { Transaction, TransactionType } from '@/types';
import { fmt, fmtRate } from '@/lib/formatNumbers';
import { getAllSnapshots } from '@/lib/stageCaisse/storage';

dayjs.locale('fr');

const SECTIONS: {
  type: TransactionType;
  title: string;
  borderClass: string;
  headerClass: string;
  kind: 'exchange' | 'cash' | 'charge';
}[] = [
  { type: 'ACHAT',   title: 'ACHATS DEVISES', borderClass: 'border-l-4 border-l-emerald-500', headerClass: 'bg-emerald-50', kind: 'exchange' },
  { type: 'VENTE',   title: 'VENTES DEVISES', borderClass: 'border-l-4 border-l-amber-400',   headerClass: 'bg-amber-50',   kind: 'exchange' },
  { type: 'DEPOT',   title: 'DÉPÔTS',         borderClass: 'border-l-4 border-l-sky-500',     headerClass: 'bg-sky-50',     kind: 'cash'     },
  { type: 'RETRAIT', title: 'RETRAITS',        borderClass: 'border-l-4 border-l-orange-500',  headerClass: 'bg-orange-50',  kind: 'cash'     },
  { type: 'CHARGES', title: 'CHARGES',         borderClass: 'border-l-4 border-l-zinc-500',    headerClass: 'bg-zinc-100',   kind: 'charge'   },
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
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t, i) => (
            <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
              <TableCell className="font-mono text-[10px] font-semibold text-blue-700 whitespace-nowrap">{t.numero ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
              <TableCell className="font-bold text-zinc-900">{t.devise}</TableCell>
              <TableCell className="text-right font-bold tabular-nums text-zinc-900">
                {fmt(t.montant)} {t.devise}
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

export function CaisseJour() {
  const navigate = useNavigate();
  const { transactions } = useAppData();
  const [day, setDay] = useState(() => dayjs().format('YYYY-MM-DD'));
  const dayJs = useMemo(() => dayjs(day), [day]);

  const txJour = useMemo(
    () => transactions
      .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === day)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions, day]
  );

  const recap = useMemo(() => recapDeviseJournee(transactions, dayJs), [transactions, dayJs]);
  const kpi = useMemo(() => summarizeCaisseJourV8(transactions, dayJs), [transactions, dayJs]);

  // ── Départ MAD : lit le snapshot DEPART du jour (saisi dans /journal-journee) ──
  const caisseDepart = useMemo(() => {
    const snapshots = getAllSnapshots();
    const departMAD = snapshots
      .filter((s) => s.type_solde === 'DEPART' && s.date_comptable === day && s.devise_code === 'MAD')
      .reduce((sum, s) => sum + s.montant, 0);
    return departMAD;
  }, [day]);

  const chargesJour = txJour.filter((t) => t.type === 'CHARGES').reduce((s, t) => s + t.montantMAD, 0);

  // Caisse fin = Départ MAD + (Ventes MAD encaissées) - (Achats MAD décaissés) + Dépôts MAD - Retraits MAD - Charges
  const caisseFinMAD = useMemo(() => {
    const ventesMad  = txJour.filter((t) => t.type === 'VENTE').reduce((s, t) => s + t.montantMAD, 0);
    const achatsMad  = txJour.filter((t) => t.type === 'ACHAT').reduce((s, t) => s + t.montantMAD, 0);
    const depotsMad  = txJour.filter((t) => t.type === 'DEPOT' && t.devise === 'MAD').reduce((s, t) => s + t.montant, 0);
    const retraitsMad = txJour.filter((t) => t.type === 'RETRAIT' && t.devise === 'MAD').reduce((s, t) => s + t.montant, 0);
    return caisseDepart + ventesMad - achatsMad + depotsMad - retraitsMad - chargesJour;
  }, [caisseDepart, txJour, chargesJour]);
  const creditsDuJour = txJour.filter((t) => t.statut === 'CRÉDIT');

  function rowsForType(type: TransactionType): Transaction[] {
    return txJour.filter((t) => t.type === type);
  }

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
          <div className="space-y-5">

            {SECTIONS.map(({ type, title, borderClass, headerClass, kind }) => {
              const rows = rowsForType(type);
              const total = rows.reduce((s, t) => s + t.montantMAD, 0);
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
                  {kind === 'cash' && <TableCash rows={rows} />}
                  {kind === 'charge' && <TableCharges rows={rows} />}
                </section>
              );
            })}

            {creditsDuJour.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm border-l-4 border-l-violet-500">
                <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50 px-4 py-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">Crédits accordés</h2>
                  <span className="ml-auto text-xs text-zinc-500">{creditsDuJour.length} ligne(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-zinc-50">
                        <TableHead className="w-16">Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right font-semibold">MAD</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditsDuJour.map((t, i) => (
                        <TableRow key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                          <TableCell className="whitespace-nowrap text-zinc-500">{dayjs(t.date).format('HH:mm')}</TableCell>
                          <TableCell className="font-medium">{t.type}</TableCell>
                          <TableCell className="font-bold">{t.devise}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">{fmt(t.montantMAD)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-zinc-500">{t.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-400">
                  Les crédits sont suivis séparément — ils n'affectent pas le solde MAD de la caisse.
                </p>
              </section>
            )}

            {/* ── Récap par devise — FIX: affiche Stock soir + Alimentations ── */}
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900">Récapitulatif mouvements par devise — journée</h2>
              <p className="mb-3 text-xs text-zinc-400">Achats / ventes / dépôts / alimentations et stock soir.</p>
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-zinc-50">
                      <TableHead>Devise</TableHead>
                      <TableHead className="text-right">Achats</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">Retraits</TableHead>
                      <TableHead className="text-right text-cyan-700">Alim.</TableHead>
                      <TableHead className="text-right font-semibold text-blue-700">Stock soir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recap
                      .filter((r) => r.achatsJour > 0 || r.ventesJour > 0 || r.retraitsJour > 0 || r.alimentationsJour > 0 || r.stockSoir > 0)
                      .map((r, i) => (
                        <TableRow key={r.devise} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                          <TableCell className="font-bold text-zinc-900">{r.devise}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-700">{fmt(r.achatsJour)}</TableCell>
                          <TableCell className="text-right tabular-nums text-amber-700">{fmt(r.ventesJour)}</TableCell>
                          <TableCell className="text-right tabular-nums text-orange-600">{fmt(r.retraitsJour)}</TableCell>
                          <TableCell className="text-right tabular-nums text-cyan-700">{fmt(r.alimentationsJour)}</TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-blue-700">{fmt(r.stockSoir)}</TableCell>
                        </TableRow>
                      ))}
                    {recap.every((r) => r.achatsJour === 0 && r.ventesJour === 0 && r.retraitsJour === 0 && r.alimentationsJour === 0 && r.stockSoir === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-zinc-400 py-4">
                          Aucun mouvement de devises ce jour.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="border-blue-100 bg-gradient-to-b from-blue-50/80 to-white shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-900">Totaux journée</CardTitle>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{dayJs.format('dddd D MMMM YYYY')}</p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-emerald-50">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <TrendingDown size={12} /> Total achats (MAD)
                  </span>
                  <span className="font-bold tabular-nums text-emerald-800">{fmt(kpi.totalAchatsMad)}</span>
                </div>
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-amber-50">
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                    <TrendingUp size={12} /> Total ventes (MAD)
                  </span>
                  <span className="font-bold tabular-nums text-amber-800">{fmt(kpi.totalVentesMad)}</span>
                </div>
                <div className="border-t border-zinc-100 pt-1" />
              <div className="px-2 py-1.5">
  <span className="text-xs text-zinc-600">Total dépôts</span>
  {txJour.filter((t) => t.type === 'DEPOT').length === 0 ? (
    <div className="text-right font-semibold tabular-nums text-sky-700">0,00</div>
  ) : (
    Object.entries(
      txJour.filter((t) => t.type === 'DEPOT').reduce((acc, t) => {
        acc[t.devise] = (acc[t.devise] ?? 0) + t.montant;
        return acc;
      }, {} as Record<string, number>)
    ).map(([devise, total]) => (
      <div key={devise} className="flex justify-between gap-2">
        <span className="text-xs text-zinc-400">{devise}</span>
        <span className="font-semibold tabular-nums text-sky-700">{fmt(total)}</span>
      </div>
    ))
  )}
</div>
<div className="px-2 py-1.5">
  <span className="text-xs text-zinc-600">Total retraits</span>
  {txJour.filter((t) => t.type === 'RETRAIT').length === 0 ? (
    <div className="text-right font-semibold tabular-nums text-orange-600">0,00</div>
  ) : (
    Object.entries(
      txJour.filter((t) => t.type === 'RETRAIT').reduce((acc, t) => {
        acc[t.devise] = (acc[t.devise] ?? 0) + t.montant;
        return acc;
      }, {} as Record<string, number>)
    ).map(([devise, total]) => (
      <div key={devise} className="flex justify-between gap-2">
        <span className="text-xs text-zinc-400">{devise}</span>
        <span className="font-semibold tabular-nums text-orange-600">{fmt(total)}</span>
      </div>
    ))
  )}
</div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Total charges</span>
                  <span className="font-semibold tabular-nums text-zinc-700">{fmt(chargesJour)}</span>
                </div>
                <div className="flex justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-zinc-600">Crédits accordés</span>
                  <span className="font-semibold tabular-nums text-violet-700">{fmt(kpi.creditsAccordesMad)}</span>
                </div>
                <div className="border-t border-zinc-200 pt-2 mt-1" />
                <div className="flex justify-between gap-2 rounded-md px-2 py-2 bg-zinc-50">
                  <span className="text-xs font-semibold text-zinc-700">Bénéfice estimé</span>
                  <span className={`font-bold tabular-nums text-sm ${kpi.beneficeEstime >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(kpi.beneficeEstime)}
                  </span>
                </div>
                <p className="px-2 text-[10px] text-zinc-400 leading-tight">= Ventes − Achats − Charges</p>
                <div className="border-t-2 border-blue-300 pt-3 mt-2" />
                <div className="flex justify-between gap-2 rounded-lg bg-blue-600 px-3 py-3">
                  <span className="text-xs font-bold text-blue-100">Caisse fin de journée (estim.)</span>
                  <span className="text-sm font-bold tabular-nums text-white">{fmt(caisseFinMAD)}</span>
                </div>
                <p className="px-1 text-[10px] text-zinc-400 leading-tight">= Départ + Dépôts − Retraits − Charges</p>
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
