import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { isCloudSyncEnabled } from '@/lib/cloudConfig';
import {
  checkCloudHealth,
  migrateLocalToCloudIfEmpty,
  pullAllFromCloud,
} from '@/lib/cloudSync';

const SYNC_INTERVAL_MS = 20_000;

/**
 * Au chargement : récupère les données MongoDB partagées.
 * Toutes les 20 s + au retour sur l’onglet : rafraîchit pour les autres utilisateurs.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const enabled = isCloudSyncEnabled();
  const [status, setStatus] = useState<'idle' | 'syncing' | 'ok' | 'error' | 'off'>(
    enabled ? 'idle' : 'off',
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function runSync() {
      setStatus('syncing');
      try {
        const ok = await checkCloudHealth();
        if (!ok) {
          if (!cancelled) setStatus('error');
          return;
        }
        await migrateLocalToCloudIfEmpty();
        await pullAllFromCloud();
        if (!cancelled) setStatus('ok');
      } catch (e) {
        console.error('[CloudSync]', e);
        if (!cancelled) setStatus('error');
      }
    }

    void runSync();
    const interval = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    const onFocus = () => void runSync();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  const badge =
    status === 'syncing' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
        <Loader2 size={10} className="animate-spin" /> Sync…
      </span>
    ) : status === 'ok' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
        <Cloud size={10} /> Données partagées
      </span>
    ) : status === 'error' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
        <CloudOff size={10} /> Cloud indisponible
      </span>
    ) : null;

  return (
    <>
      {badge && (
        <div className="fixed bottom-3 right-3 z-[60] shadow-sm" title="Synchronisation MongoDB — visible par tous les utilisateurs du lien">
          {badge}
        </div>
      )}
      {children}
    </>
  );
}
