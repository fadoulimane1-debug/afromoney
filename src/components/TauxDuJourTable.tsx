import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Eye, Pencil, RefreshCw } from 'lucide-react';
import { getExchangeRates, saveExchangeRates } from '@/lib/storage';
import { repairAllRatesSpread, type RatesMeta, type RatesSource } from '@/lib/bkamRates';
import type { useNotify } from '@/hooks/useNotify';

const DEVISES_ORDER = ['EUR', 'USD', 'GBP', 'CAD', 'SAR', 'AED', 'CHF', 'KWD'] as const;

const DEVISE_LABELS: Record<string, string> = {
  EUR: 'Euro',
  USD: 'Dollar U.S.A.',
  GBP: 'Livre Sterling',
  CAD: 'Dollar Canadien',
  SAR: 'Riyal Saoudien',
  AED: 'Dirham E.A.U.',
  CHF: 'Franc Suisse',
  KWD: 'Dinar Koweïtien',
};

const SAVED_DATE_KEY = 'exchangeRatesSavedDate';

interface RateRow {
  devise: string;
  label: string;
  tauxAchat: number;
  tauxVente: number;
}

type EditState = Record<string, { achat: string; vente: string }>;

function hasFlatSpread(rows: RateRow[]): boolean {
  return rows.some((r) => r.tauxAchat > 0 && Math.abs(r.tauxVente - r.tauxAchat) < 0.01);
}

function fmtRate(n: number): string {
  if (n <= 0) return '—';
  return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 4, maximumFractionDigits: 5 }).format(n);
}

function getLastSavedDate(): string | null {
  return localStorage.getItem(SAVED_DATE_KEY);
}

function setLastSavedDate(isoString: string): void {
  localStorage.setItem(SAVED_DATE_KEY, isoString);
}

function loadRows(): RateRow[] {
  let rates = getExchangeRates();
  const snapshot = DEVISES_ORDER.map((devise) => {
    const r = rates.find((x) => x.devise === devise);
    return {
      devise,
      label: DEVISE_LABELS[devise] ?? devise,
      tauxAchat: r?.tauxAchat ?? 0,
      tauxVente: r?.tauxVente ?? 0,
    };
  });
  if (hasFlatSpread(snapshot)) rates = repairAllRatesSpread();
  return DEVISES_ORDER.map((devise) => {
    const r = rates.find((x) => x.devise === devise);
    return {
      devise,
      label: DEVISE_LABELS[devise] ?? devise,
      tauxAchat: r?.tauxAchat ?? 0,
      tauxVente: r?.tauxVente ?? 0,
    };
  });
}

function rowsToEditState(rows: RateRow[]): EditState {
  return Object.fromEntries(
    rows.map((r) => [
      r.devise,
      { achat: r.tauxAchat > 0 ? String(r.tauxAchat) : '', vente: r.tauxVente > 0 ? String(r.tauxVente) : '' },
    ]),
  );
}

export function TauxDuJourTable({
  meta,
  loading,
  onRefresh,
  notify,
}: {
  meta: RatesMeta | null;
  loading: boolean;
  onRefresh: () => Promise<RatesSource>;
  notify: ReturnType<typeof useNotify>;
}) {
  const [rows, setRows] = useState<RateRow[]>(() => loadRows());
  const [editState, setEditState] = useState<EditState>(() => rowsToEditState(loadRows()));
  const [lastSaved, setLastSaved] = useState<string | null>(() => getLastSavedDate());

  useEffect(() => {
    function reload() {
      const r = loadRows();
      setRows(r);
      setEditState(rowsToEditState(r));
    }
    reload();
    window.addEventListener('afromoney-data', reload);
    return () => window.removeEventListener('afromoney-data', reload);
  }, []);

  async function handleRefresh() {
    const src = await onRefresh();
    if (src === 'BKAM') notify.success('Taux Bank Al-Maghrib chargés.', 'Taux du jour');
    else if (src === 'CDN') {
      repairAllRatesSpread();
      notify.info('Taux CDN + marge bureau appliqués.', 'Taux du jour');
    } else notify.warning('BKAM inaccessible — cache ou saisie manuelle.', 'Taux du jour');
  }

  function setField(devise: string, field: 'achat' | 'vente', value: string) {
    setEditState((prev) => ({ ...prev, [devise]: { ...prev[devise], [field]: value } }));
  }

  function handleSave() {
    const now = new Date().toISOString();

    const all = getExchangeRates();
    const errors: string[] = [];
    const dateUpdate = new Date();
    const updated = [...all];

    for (const devise of DEVISES_ORDER) {
      const raw = editState[devise];
      if (!raw) continue;
      const achat = parseFloat(raw.achat.replace(',', '.'));
      const vente = parseFloat(raw.vente.replace(',', '.'));
      if (!Number.isFinite(achat) || achat <= 0 || !Number.isFinite(vente) || vente <= 0) continue;
      if (vente <= achat) {
        errors.push(`${devise} : vente ≤ achat`);
        continue;
      }
      const tauxJour = parseFloat(((achat + vente) / 2).toFixed(5));
      const row = { devise, tauxAchat: achat, tauxVente: vente, tauxJour, dateUpdate };
      const idx = updated.findIndex((r) => r.devise === devise);
      if (idx >= 0) updated[idx] = { ...updated[idx], ...row };
      else updated.push(row);
    }

    if (errors.length > 0) {
      notify.error(`Erreur : ${errors.join(' / ')}`, 'Taux invalides');
      return;
    }

    saveExchangeRates(updated);
    setLastSavedDate(now);
    setLastSaved(now);
    const r = loadRows();
    setRows(r);
    setEditState(rowsToEditState(r));
    notify.success(`Taux sauvegardés à ${dayjs(now).format('HH:mm')}`, 'Édition manuelle');
  }

  const isBKAM = meta?.source === 'BKAM';
  const isCDN = meta?.source === 'CDN';
  const isCache = meta?.source === 'cache';
  const isApprox = !meta || meta.source === 'default';
  const flatSpread = hasFlatSpread(rows);

  const syncLabel = meta
    ? isBKAM
      ? `BKAM · ${dayjs(meta.fetchedAt).format('HH:mm')}`
      : isCDN
        ? `CDN · ${dayjs(meta.fetchedAt).format('HH:mm')}`
        : isCache
          ? `Cache · ${dayjs(meta.fetchedAt).format('HH:mm')}`
          : 'Défaut'
    : 'Non sync.';

  const savedFullLabel = lastSaved ? dayjs(lastSaved).format('DD/MM/YYYY [à] HH:mm') : null;

  return (
    <div className="space-y-2">
      {(isApprox || isCache || flatSpread) && (
        <div className="space-y-1">
          {isApprox && (
            <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800">
              <span>⚠️</span>
              BKAM indisponible — rafraîchir ou saisir manuellement.
            </div>
          )}
          {isCache && !isApprox && (
            <div className="flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-800">
              <span>ℹ️</span>
              Cache local.
            </div>
          )}
          {flatSpread && (
            <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] text-red-800">
              <span>❌</span>
              Achat = vente —{' '}
              <button
                type="button"
                className="ml-0.5 font-bold underline"
                onClick={() => {
                  repairAllRatesSpread();
                  window.dispatchEvent(new Event('afromoney-data'));
                  notify.success('Écart corrigé.', 'Taux');
                }}
              >
                Corriger
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {/* Affichage (lecture seule) */}
        <div className="h-fit w-full self-start overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-zinc-400" />
              <span className="text-[12px] font-semibold text-zinc-600">Affichage</span>
              <span className="text-[11px] text-zinc-400">· {syncLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Synchro…' : 'Rafraîchir'}
            </button>
          </div>

          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase text-zinc-400">Devise</th>
                <th className="px-2 py-1 text-right text-[11px] font-semibold uppercase text-zinc-400">Achat</th>
                <th className="px-2 py-1 text-right text-[11px] font-semibold uppercase text-zinc-400">Vente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.devise} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-100/50">
                  <td className="px-2 py-[5px]">
                    <span className="font-mono text-[11px] font-bold text-zinc-500">{row.devise}</span>
                    <span className="ml-1.5 text-[11px] text-zinc-500">{row.label}</span>
                  </td>
                  <td className="px-2 py-[5px] text-right font-mono text-[13px] tabular-nums text-zinc-800">
                    {fmtRate(row.tauxAchat)}
                  </td>
                  <td className="px-2 py-[5px] text-right font-mono text-[13px] tabular-nums text-zinc-800">
                    {fmtRate(row.tauxVente)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-zinc-200 px-3 py-1 text-[10px] text-zinc-400">
            MAD/unité · Vente &gt; Achat ·{' '}
            <a
              href="https://www.bkam.ma/Marche-des-changes/Taux-de-change"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Réf. BKAM
            </a>
          </div>
        </div>

        {/* Édition manuelle */}
        <div className="h-fit w-full self-start overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <Pencil size={13} className="text-zinc-400" />
              <span className="text-[12px] font-semibold text-zinc-600">Édition manuelle</span>
            </div>
            {savedFullLabel && (
              <span className="text-[10px] text-zinc-400">Sauvegardé : {savedFullLabel}</span>
            )}
          </div>

          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase text-zinc-400">Devise</th>
                <th className="px-2 py-1 text-center text-[11px] font-semibold uppercase text-zinc-400">Achat</th>
                <th className="px-2 py-1 text-center text-[11px] font-semibold uppercase text-zinc-400">Vente</th>
              </tr>
            </thead>
            <tbody>
              {DEVISES_ORDER.map((devise) => (
                <tr key={devise} className="border-b border-zinc-100 last:border-0">
                  <td className="px-2 py-[3px]">
                    <span className="font-mono text-[12px] font-bold text-zinc-700">{devise}</span>
                  </td>
                  <td className="px-1 py-[3px]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editState[devise]?.achat ?? ''}
                      onChange={(e) => setField(devise, 'achat', e.target.value)}
                      placeholder={fmtRate(rows.find((r) => r.devise === devise)?.tauxAchat ?? 0)}
                      className="w-full rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-center font-mono text-[12px] tabular-nums focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    />
                  </td>
                  <td className="px-1 py-[3px]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editState[devise]?.vente ?? ''}
                      onChange={(e) => setField(devise, 'vente', e.target.value)}
                      placeholder={fmtRate(rows.find((r) => r.devise === devise)?.tauxVente ?? 0)}
                      className="w-full rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-center font-mono text-[12px] tabular-nums focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-2 border-t border-zinc-200 px-3 py-2">
            {lastSaved && (
              <p className="text-[11px] text-zinc-500">
                Dernière sauvegarde :{' '}
                <span className="font-medium text-zinc-700">{savedFullLabel}</span>
                {' '}— vous pouvez modifier et sauvegarder à nouveau.
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="w-full rounded bg-emerald-600 py-1.5 text-[13px] font-bold text-white transition hover:bg-emerald-700 active:bg-emerald-800"
            >
              Sauvegarder les taux
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
