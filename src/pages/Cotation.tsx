import { useMemo, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { Calculator, ArrowLeftRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DEVISES } from '@/lib/constants';
import { getExchangeRates } from '@/lib/storage';
import { formatMontantFr, parseMontantStr } from '@/lib/parseMontant';
import { fmtRate } from '@/lib/formatNumbers';

type Sens = 'devise_to_mad' | 'mad_to_devise';

export function Cotation() {
  const [devise, setDevise] = useState('EUR');
  const [montant, setMontant] = useState('100');
  const [sens, setSens] = useState<Sens>('devise_to_mad');

  const rates = getExchangeRates();
  const rateRow = rates.find((r) => r.devise === devise);
  const tauxAchat = rateRow?.tauxAchat ?? 1;
  const tauxVente = rateRow?.tauxVente ?? 1;

  const result = useMemo(() => {
    const m = parseMontantStr(montant);
    if (!Number.isFinite(m) || m <= 0) return null;
    if (sens === 'devise_to_mad') {
      return { achat: m * tauxAchat, vente: m * tauxVente };
    }
    return { achat: m / tauxAchat, vente: m / tauxVente };
  }, [montant, sens, tauxAchat, tauxVente]);

  const unit = sens === 'devise_to_mad' ? 'MAD' : devise;

  return (
    <>
      <PageHero
        title="Cotation rapide"
        subtitle="Simulation sans enregistrement — taux achat et vente du jour"
      />

      <div className="page-content mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator size={18} className="text-cyan-600" />
              Convertisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600">Devise</label>
              <select
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
              >
                {DEVISES.filter((d) => d !== 'MAD').map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600">Sens</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSens('devise_to_mad')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    sens === 'devise_to_mad'
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  Devise → MAD
                </button>
                <button
                  type="button"
                  onClick={() => setSens('mad_to_devise')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    sens === 'mad_to_devise'
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  MAD → Devise
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600">
                Montant {sens === 'devise_to_mad' ? `(${devise})` : '(MAD)'}
              </label>
              <Input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="text-right font-bold tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              <div>
                Taux achat : <strong className="text-zinc-900">{fmtRate(tauxAchat)}</strong>
              </div>
              <div>
                Taux vente : <strong className="text-zinc-900">{fmtRate(tauxVente)}</strong>
              </div>
            </div>

            {result && (
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase text-zinc-500">
                  <ArrowLeftRight size={12} /> Résultat indicatif
                </p>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-800">Client vous vend la devise (vous achetez)</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-900">
                    {formatMontantFr(result.achat)} {unit}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-800">Client vous achète la devise (vous vendez)</p>
                  <p className="text-lg font-bold tabular-nums text-blue-900">
                    {formatMontantFr(result.vente)} {unit}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
