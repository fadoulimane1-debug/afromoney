import { RefreshCw, Radio } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { cn } from '@/lib/utils';
import { useBKAMRates } from '@/hooks/useBKAMRates';
import { useNotify } from '@/hooks/useNotify';
import type { RatesSource } from '@/lib/bkamRates';

dayjs.locale('fr');

/* ── Config visuelle par source ── */
const SOURCE_CFG: Record<
  RatesSource,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  BKAM:    { label: 'BKAM officiel',     dot: 'bg-emerald-400 shadow-[0_0_6px_#34d399]', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CDN:     { label: 'International CDN', dot: 'bg-sky-400     shadow-[0_0_6px_#38bdf8]', text: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200'     },
  cache:   { label: 'Cache local',       dot: 'bg-amber-400',                              text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  default: { label: 'Taux par défaut',   dot: 'bg-zinc-400',                               text: 'text-zinc-600',    bg: 'bg-zinc-50',     border: 'border-zinc-200'    },
};

interface RatesBadgeProps {
  /** Si true, s'affiche en mode compact (pour la Navbar). */
  compact?: boolean;
  className?: string;
}

/**
 * Badge indiquant la source et la date des taux de change actifs.
 * Inclut un bouton de refresh manuel.
 */
export function RatesBadge({ compact = false, className }: RatesBadgeProps) {
  const { meta, loading, refresh } = useBKAMRates();
  const notify = useNotify();

  const source: RatesSource = meta?.source ?? 'default';
  const cfg = SOURCE_CFG[source];

  async function handleRefresh() {
    const { source: src } = await refresh({ force: true });
const label = SOURCE_CFG[src].label;
    if (src === 'BKAM' || src === 'CDN') {
      notify.success(`Taux actualisés depuis ${label}.`, 'Taux du jour');
    } else {
      notify.warning(`Impossible d'atteindre les serveurs de taux. Source : ${label}.`, 'Taux du jour');
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        title={`Taux : ${cfg.label}${meta ? ` · ${dayjs(meta.fetchedAt).format('HH:mm')}` : ''} — cliquer pour rafraîchir`}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
          'hover:brightness-95 disabled:opacity-60',
          cfg.text, cfg.bg, cfg.border,
          className
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
        <span>{source}</span>
        {meta && <span className="font-normal opacity-70">· {dayjs(meta.fetchedAt).format('HH:mm')}</span>}
        <RefreshCw size={9} className={cn('shrink-0', loading && 'animate-spin')} />
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', cfg.bg, cfg.border, className)}>
      <Radio size={13} className={cfg.text} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[11px] font-semibold', cfg.text)}>
          {cfg.label}
        </p>
        {meta ? (
          <p className="text-[10px] text-zinc-500">
            Actualisés le {dayjs(meta.fetchedAt).format('DD/MM/YYYY à HH:mm')}
          </p>
        ) : (
          <p className="text-[10px] text-zinc-400">Aucune synchronisation récente</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
          'border',
          cfg.border, cfg.text,
          'hover:brightness-90 disabled:opacity-50'
        )}
        title="Rafraîchir les taux"
      >
        <RefreshCw size={11} className={cn(loading && 'animate-spin')} />
        <span>{loading ? 'Sync…' : 'Actualiser'}</span>
      </button>
    </div>
  );
}
