import { useMemo, useRef, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { Pencil, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppData } from '@/hooks/useAppData';
import { recapDeviseJournee } from '@/lib/bilanV8';
import { DEVISES, TAUX_PAR_DEFAUT } from '@/lib/constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { calculMontantMAD } from '@/lib/calculations';
import { fmt, fmtRate, fmtPct } from '@/lib/formatNumbers';
import { getMouvements } from '@/lib/storage';

dayjs.locale('fr');

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
}

/* ─── Inline-editable taux cell ─── */

interface EditableTauxCellProps {
  devise: string;
  field: 'tauxAchat' | 'tauxVente' | 'tauxJour';
  value: number;
  onCommit: (devise: string, field: 'tauxAchat' | 'tauxVente' | 'tauxJour', v: number) => void;
}

function EditableTauxCell({ devise, field, value, onCommit }: EditableTauxCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
    // focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const n = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) onCommit(devise, field, n);
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          step="0.0001"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
          autoFocus
          className="h-6 w-20 rounded border border-blue-400 bg-white px-1.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={commit} className="text-emerald-500 hover:text-emerald-700">
          <Check size={11} />
        </button>
        <button onClick={cancel} className="text-zinc-400 hover:text-zinc-600">
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <button
      onDoubleClick={startEdit}
      title="Double-clic pour modifier"
      className="group flex w-full items-center justify-end gap-1 rounded px-1 hover:bg-blue-50"
    >
      <span className="tabular-nums text-zinc-700">{fmtRate(value)}</span>
      <Pencil
        size={9}
        className="shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

/* ─── Page ─── */

export function Stock() {
  const { exchangeRates, updateRate, transactions } = useAppData();
  const txActives = useMemo(
    () => filterTransactionsComptables(transactions),
    [transactions],
  );

  /* Date de la dernière transaction par devise */
  const lastTxDate = useMemo(() => {
    const map = new Map<string, Date>();
    for (const tx of txActives) {
      const d = new Date(tx.date);
      const cur = map.get(tx.devise);
      if (!cur || d > cur) map.set(tx.devise, d);
    }
    return map;
  }, [txActives]);

  /* Stock cumulé (opérations valides) par devise */
const stockByDevise = useMemo(() => {
    const map = new Map<string, { achete: number; vendu: number }>();
    for (const tx of txActives) {
      if (tx.devise === 'MAD') continue;
      const e = map.get(tx.devise) ?? { achete: 0, vendu: 0 };
      if (tx.type === 'ACHAT' || tx.type === 'DEPOT') e.achete += tx.montant;
      if (tx.type === 'VENTE' || tx.type === 'RETRAIT') e.vendu += tx.montant;
      map.set(tx.devise, e);
    }
    // Alimentations et prélèvements depuis mouvements caisse
    const mouvements = getMouvements();
    for (const mv of mouvements) {
      if (mv.devise === 'MAD') continue;
      const e = map.get(mv.devise) ?? { achete: 0, vendu: 0 };
      if (mv.type === 'ALIMENTATION') e.achete += Math.abs(mv.montant);
      if (mv.type === 'PRELEVEMENT')  e.vendu  += Math.abs(mv.montant);
      map.set(mv.devise, e);
    }
    return map;
  }, [txActives]);

  /* Recap achats/ventes du jour */
  const recapJour = useMemo(
    () => recapDeviseJournee(txActives, dayjs()),
    [txActives]
  );

  /* Lignes principales — TOUTES les devises dans l'ordre DEVISES */
  const rows = useMemo(() => {
    return DEVISES.map((devise, i) => {
      const ex = exchangeRates.find((r) => r.devise === devise);
      const tauxJour = ex?.tauxJour ?? TAUX_PAR_DEFAUT[devise] ?? 1;
      const tauxAchat = ex?.tauxAchat ?? tauxJour;
      const tauxVente = ex?.tauxVente ?? tauxJour;
      const s = stockByDevise.get(devise) ?? { achete: 0, vendu: 0 };
      const stockQty = s.achete - s.vendu;
      const valeurMAD = calculMontantMAD(stockQty, tauxJour);
      const recap = recapJour.find((r) => r.devise === devise);
      return {
        idx: i + 1,
        devise,
        achete: s.achete,
        vendu: s.vendu,
        stockQty,
        tauxAchat,
        tauxVente,
        tauxJour,
        valeurMAD,
        dateMaj: lastTxDate.get(devise) ?? null,
        achatsJour: recap?.achatsJour ?? 0,
        ventesJour: recap?.ventesJour ?? 0,
        retraitsJour: recap?.retraitsJour ?? 0,
      };
    });
  }, [exchangeRates, stockByDevise, recapJour, lastTxDate]);

  /* Totaux */
  const totalValeurMAD = rows.reduce((s, r) => s + r.valeurMAD, 0);
  const totalAchete = rows.reduce((s, r) => s + r.achete, 0);
  const totalVendu = rows.reduce((s, r) => s + r.vendu, 0);

  /* Indicateurs rapides */
  const devisePositives = rows.filter((r) => r.stockQty > 0).length;
  const deviseNegatives = rows.filter((r) => r.stockQty < 0).length;

  return (
    <div>
      <PageHero
        title="Stock des devises"
        subtitle="Mémoire des positions et récap journalier — feuille MÉMOIRE V8"
      />

      <div className="page-content space-y-6">
      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-500">
              Valeur totale en stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-blue-700">
              {fmt(totalValeurMAD)} MAD
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Stock × Taux jour — {rows.filter((r) => r.valeurMAD !== 0).length} devises actives
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              <TrendingDown size={12} /> Positions positives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">{devisePositives}</p>
            <p className="text-xs text-zinc-400">devise{devisePositives !== 1 ? 's' : ''} en stock positif</p>
          </CardContent>
        </Card>

        <Card className="border-red-100 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-500">
              <TrendingUp size={12} /> Positions négatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{deviseNegatives}</p>
            <p className="text-xs text-zinc-400">devise{deviseNegatives !== 1 ? 's' : ''} en stock négatif</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tableau principal ── */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
            Mémoire des stocks
          </h2>
          <p className="text-[10px] text-zinc-400">
            Double-clic sur un taux pour l'éditer · Stock = Acheté − Vendu · Valeur = Stock × Taux jour
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="w-8 px-3 py-2.5 text-center text-zinc-500">#</th>
                <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Devise</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Total acheté</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Total vendu</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Stock (qté)</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                  Taux achat
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                  Taux vente
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                  Taux jour{' '}
                  <span className="font-normal text-zinc-400">(dbl-clic)</span>
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Valeur MAD</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Date maj</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => {
                const isNeg = r.stockQty < 0;
                const isPos = r.stockQty > 0;
                const isZero = r.stockQty === 0;
                const isEven = i % 2 === 0;

                return (
                  <tr
                    key={r.devise}
                    className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 ${
                      isEven ? 'bg-white' : 'bg-zinc-50/40'
                    }`}
                  >
                    <td className="px-3 py-2 text-center text-zinc-400">{r.idx}</td>

                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-bold text-zinc-900">{r.devise}</span>
                        {isNeg && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0 text-[9px] font-semibold text-red-600">
                            short
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                      {r.achete > 0 ? fmt(r.achete) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                      {r.vendu > 0 ? fmt(r.vendu) : '—'}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-bold tabular-nums ${
                          isNeg
                            ? 'text-red-600'
                            : isPos
                            ? 'text-emerald-700'
                            : 'text-zinc-400'
                        }`}
                      >
                        {isZero ? '—' : fmt(r.stockQty)}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      {r.devise === 'MAD' ? (
                        <span className="tabular-nums text-zinc-400">1.0000</span>
                      ) : (
                        <EditableTauxCell
                          devise={r.devise}
                          field="tauxAchat"
                          value={r.tauxAchat}
                          onCommit={updateRate}
                        />
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {r.devise === 'MAD' ? (
                        <span className="tabular-nums text-zinc-400">1.0000</span>
                      ) : (
                        <EditableTauxCell
                          devise={r.devise}
                          field="tauxVente"
                          value={r.tauxVente}
                          onCommit={updateRate}
                        />
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {r.devise === 'MAD' ? (
                        <span className="tabular-nums text-zinc-400">1.0000</span>
                      ) : (
                        <EditableTauxCell
                          devise={r.devise}
                          field="tauxJour"
                          value={r.tauxJour}
                          onCommit={updateRate}
                        />
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-bold tabular-nums ${
                          isNeg ? 'text-red-600' : isPos ? 'text-emerald-700' : 'text-zinc-400'
                        }`}
                      >
                        {isZero ? '—' : fmt(r.valeurMAD)}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right text-zinc-500">
                      {fmtDate(r.dateMaj)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ── Ligne totaux ── */}
            <tfoot>
              <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold">
                <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-zinc-700">
                  TOTAL ({rows.length} devises)
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums text-zinc-700">
                  {fmt(totalAchete)}
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums text-zinc-700">
                  {fmt(totalVendu)}
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums text-zinc-700">
                  —
                </td>
                <td colSpan={3} />
                <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-blue-700">
                  {fmt(totalValeurMAD)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Récap journalier ── */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
            Récapitulatif par devise — journée en cours
          </h2>
          <p className="text-[10px] text-zinc-400">
            {dayjs().format('dddd D MMMM YYYY')} — achats / ventes / retraits (quantités)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="px-3 py-2.5 text-left font-semibold text-zinc-700">Devise</th>
                <th className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                  Achats jour
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-amber-700">
                  Ventes jour
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-orange-600">
                  Retraits jour
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Stock soir</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Taux jour</th>
                <th className="px-3 py-2.5 text-right font-semibold text-zinc-700">Valeur MAD</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(
                  (r) =>
                    r.achatsJour > 0 ||
                    r.ventesJour > 0 ||
                    r.retraitsJour > 0 ||
                    r.stockQty !== 0
                )
                .map((r, i) => {
                  const isEven = i % 2 === 0;
                  const isNeg = r.stockQty < 0;
                  return (
                    <tr
                      key={`recap-${r.devise}`}
                      className={`border-b border-zinc-100 hover:bg-zinc-50 ${
                        isEven ? 'bg-white' : 'bg-zinc-50/40'
                      }`}
                    >
                      <td className="px-3 py-2 font-bold text-zinc-900">{r.devise}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                        {r.achatsJour > 0 ? fmt(r.achatsJour) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                        {r.ventesJour > 0 ? fmt(r.ventesJour) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-orange-600">
                        {r.retraitsJour > 0 ? fmt(r.retraitsJour) : '—'}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold tabular-nums ${
                          isNeg ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {fmt(r.stockQty)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {fmtRate(r.tauxJour)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold tabular-nums ${
                          isNeg ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {fmt(r.valeurMAD)}
                      </td>
                    </tr>
                  );
                })}
              {rows.every(
                (r) => r.achatsJour === 0 && r.ventesJour === 0 && r.retraitsJour === 0
              ) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-zinc-400"
                  >
                    Aucun mouvement de devises aujourd'hui.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.some(
              (r) => r.achatsJour > 0 || r.ventesJour > 0 || r.retraitsJour > 0
            ) && (
              <tfoot>
                <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold">
                  <td colSpan={6} className="px-3 py-2.5 text-right text-xs text-zinc-700">
                    Valeur totale du stock (MAD)
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-blue-700">
                    {fmt(totalValeurMAD)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* ── Taux de change (gestion complète) ── */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
            Gestion des taux de change
          </h2>
          <p className="text-[10px] text-zinc-400">
            Double-clic sur n'importe quelle valeur pour modifier · Mis à jour dans localStorage immédiatement
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="px-4 py-2.5 text-left font-semibold text-zinc-700">Devise</th>
                <th className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                  Taux achat
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-amber-700">
                  Taux vente
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-blue-700">
                  Taux jour
                </th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-700">Marge %</th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-700">Date màj</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRates
                .filter((r) => r.devise !== 'MAD')
                .map((rate, i) => {
                  const marge =
                    rate.tauxAchat > 0
                      ? ((rate.tauxVente - rate.tauxAchat) / rate.tauxAchat) * 100
                      : 0;
                  const isEven = i % 2 === 0;
                  return (
                    <tr
                      key={rate.devise}
                      className={`border-b border-zinc-100 hover:bg-zinc-50 ${
                        isEven ? 'bg-white' : 'bg-zinc-50/40'
                      }`}
                    >
                      <td className="px-4 py-2 font-bold text-zinc-900">{rate.devise}</td>

                      <td className="px-4 py-2 text-right">
                        <EditableTauxCell
                          devise={rate.devise}
                          field="tauxAchat"
                          value={rate.tauxAchat}
                          onCommit={updateRate}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <EditableTauxCell
                          devise={rate.devise}
                          field="tauxVente"
                          value={rate.tauxVente}
                          onCommit={updateRate}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <EditableTauxCell
                          devise={rate.devise}
                          field="tauxJour"
                          value={rate.tauxJour}
                          onCommit={updateRate}
                        />
                      </td>

                      <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                        {marge > 0 ? (
                          <span className="text-emerald-600">{marge.toFixed(2)}%</span>
                        ) : (
                          <span className="text-red-500">{fmtPct(marge)}</span>
                        )}
                      </td>

                      <td className="px-4 py-2 text-right text-zinc-400">
                        {fmtDate(rate.dateUpdate)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      </div>{/* end page-content */}
    </div>
  );
}
