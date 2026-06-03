import { useCallback, useEffect, useState } from 'react';
import {
  fetchAndSaveRates,
  getCachedMeta,
  type RatesFetchOutcome,
  type RatesMeta,
} from '@/lib/bkamRates';

interface UseBKAMRatesResult {
  meta: RatesMeta | null;
  loading: boolean;
  refresh: (options?: { force?: boolean }) => Promise<RatesFetchOutcome>;
}

/**
 * Hook pour consulter l'état des taux BKAM et déclencher un refresh manuel.
 * Se synchronise automatiquement avec l'événement `afromoney-data`.
 */
export function useBKAMRates(): UseBKAMRatesResult {
  const [meta, setMeta] = useState<RatesMeta | null>(() => getCachedMeta());
  const [loading, setLoading] = useState(false);

  // Sync quand saveExchangeRates() émet l'événement afromoney-data
  useEffect(() => {
    const handler = () => setMeta(getCachedMeta());
    window.addEventListener('afromoney-data', handler);
    return () => window.removeEventListener('afromoney-data', handler);
  }, []);

  const refresh = useCallback(async (options?: { force?: boolean }): Promise<RatesFetchOutcome> => {
    setLoading(true);
    try {
      const outcome = await fetchAndSaveRates(options);
      setMeta(getCachedMeta());
      return outcome;
    } finally {
      setLoading(false);
    }
  }, []);

  return { meta, loading, refresh };
}
