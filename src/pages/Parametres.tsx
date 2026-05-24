import { useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { Settings, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PRO_SETTINGS,
  getProSettings,
  saveProSettings,
  type ProSettings,
} from '@/lib/proSettings';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';

const PURGEABLE_KEYS = [
  'transactions',
  'operationCounter',
  'mouvementsCaisse',
  'reliquats',
  'closures',
  'lastClosure',
  'caisseDepartJour',
] as const;

function purgerDonneesTest() {
  PURGEABLE_KEYS.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event('afromoney-data'));
  window.dispatchEvent(new Event('afromoney-mouvements'));
}

export function Parametres() {
  const [form, setForm] = useState<ProSettings>(() => getProSettings());
  const [saved, setSaved] = useState(false);
  const [purgeStep, setPurgeStep] = useState<0 | 1 | 2>(0);
  const [purgeConfirm, setPurgeConfirm] = useState('');

  function set<K extends keyof ProSettings>(key: K, value: ProSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveProSettings(form);
    logAudit(AUDIT_ACTIONS.SETTINGS, { settings: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function resetDefaults() {
    setForm({ ...DEFAULT_PRO_SETTINGS });
    setSaved(false);
  }

  return (
    <div>
      <PageHero
        title="Paramètres professionnels"
        subtitle="Seuils d'alerte, contrôles de cohérence et règles métier"
      />

      <form onSubmit={handleSave} className="page-content mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings size={16} /> Seuils & alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FieldNum
              label="Montant opération (MAD) — alerte"
              value={form.seuilMontantMAD}
              onChange={(v) => set('seuilMontantMAD', v)}
              hint="Au-delà : alerte « opération importante »"
            />
            <FieldNum
              label="Stock minimum (unités devise)"
              value={form.seuilStockMinUnites}
              onChange={(v) => set('seuilStockMinUnites', v)}
            />
            <FieldNum
              label="Écart clôture max (MAD)"
              value={form.seuilEcartClotureMAD}
              onChange={(v) => set('seuilEcartClotureMAD', v)}
            />
            <FieldNum
              label="Jours avant retard créance"
              value={form.joursRetardCredit}
              onChange={(v) => set('joursRetardCredit', v)}
              step={1}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contrôles à la saisie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.exigerNoteGrosMontant}
                onChange={(e) => set('exigerNoteGrosMontant', e.target.checked)}
                className="rounded border-zinc-300"
              />
              Exiger une note pour les gros montants
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.bloquerVenteStockInsuffisant}
                onChange={(e) => set('bloquerVenteStockInsuffisant', e.target.checked)}
                className="rounded border-zinc-300"
              />
              Bloquer une vente si le stock devise est insuffisant
            </label>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="gap-1.5">
            <Save size={14} /> Enregistrer
          </Button>
          <Button type="button" variant="outline" onClick={resetDefaults}>
            Réinitialiser
          </Button>
          {saved && (
            <span className="self-center text-sm font-medium text-emerald-600">
              Paramètres enregistrés.
            </span>
          )}
        </div>
      </form>

      {/* ── Zone Danger ── */}
      <div className="page-content mx-auto max-w-2xl pb-10">
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle size={16} /> Zone Danger — Données
            </CardTitle>
            <p className="text-xs text-red-600">
              Ces actions sont irréversibles. Réservées au test et à la remise à zéro de démonstration.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Compteur */}
            <div className="rounded-lg border border-red-100 bg-white p-4 space-y-2">
              <p className="text-sm font-semibold text-zinc-800">
                Transactions actuellement stockées
              </p>
              <p className="text-xs text-zinc-500">
                {(() => {
                  try {
                    const raw = localStorage.getItem('transactions');
                    const arr = raw ? JSON.parse(raw) : [];
                    return `${arr.length} transaction(s) dans le localStorage`;
                  } catch {
                    return 'Erreur lecture localStorage';
                  }
                })()}
              </p>
            </div>

            {/* Bouton purge + confirmation 2 étapes */}
            {purgeStep === 0 && (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100 gap-1.5"
                onClick={() => setPurgeStep(1)}
              >
                <Trash2 size={14} /> Purger toutes les transactions de test
              </Button>
            )}

            {purgeStep === 1 && (
              <div className="rounded-lg border-2 border-red-300 bg-white p-4 space-y-3">
                <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={15} /> Confirmation requise
                </p>
                <p className="text-xs text-zinc-600">
                  Cette action supprime <strong>toutes les transactions, clôtures, mouvements et reliquats</strong> du localStorage.
                  Les taux de change et paramètres sont conservés.
                </p>
                <p className="text-xs text-zinc-600">
                  Tapez <code className="rounded bg-zinc-100 px-1 font-mono text-red-600">PURGER</code> pour confirmer :
                </p>
                <input
                  type="text"
                  value={purgeConfirm}
                  onChange={(e) => setPurgeConfirm(e.target.value)}
                  placeholder="PURGER"
                  className="flex h-9 w-full rounded-md border border-red-300 bg-white px-3 text-sm font-mono text-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setPurgeStep(0); setPurgeConfirm(''); }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={purgeConfirm !== 'PURGER'}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 gap-1.5"
                    onClick={() => {
                      purgerDonneesTest();
                      logAudit(AUDIT_ACTIONS.SETTINGS, { action: 'PURGE_TRANSACTIONS' });
                      setPurgeStep(2);
                      setPurgeConfirm('');
                    }}
                  >
                    <Trash2 size={13} /> Confirmer la purge
                  </Button>
                </div>
              </div>
            )}

            {purgeStep === 2 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                ✅ Données purgées avec succès. Rechargez la page pour voir les compteurs mis à jour.
                <button
                  type="button"
                  className="ml-3 text-xs underline"
                  onClick={() => window.location.reload()}
                >
                  Recharger maintenant →
                </button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldNum({
  label,
  value,
  onChange,
  hint,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-600">{label}</label>
      <Input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}
