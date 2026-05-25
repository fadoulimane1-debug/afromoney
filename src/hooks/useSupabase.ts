import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getTransactions,
  createTransaction,
  getReliquats,
  createReliquat,
  updateReliquat,
  calculateSoldes,
  type TransactionFilters,
  type SoldesResult,
} from '@/services/supabaseService';
import type { Transaction, ReliquatDB } from '@/types/supabase';

// ============================================================
// useTransactions
// ============================================================

export interface UseTransactionsReturn {
  data: Transaction[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<Transaction | null>;
  deleteTransaction: (id: string) => Promise<void>;
}

export function useTransactions(filters?: TransactionFilters): UseTransactionsReturn {
  const [data,    setData]    = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getTransactions(filters);
      setData(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement transactions';
      setError(msg);
      console.error('[useTransactions]', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters?.dateDebut,
    filters?.dateFin,
    filters?.devise,
    filters?.type,
    filters?.employeId,
  ]);

  useEffect(() => { void load(); }, [load]);

  const addTransactionFn = useCallback(
    async (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction | null> => {
      const result = await createTransaction(tx);
      if (result) await load();
      return result;
    },
    [load],
  );

  const deleteTransactionFn = useCallback(
    async (id: string): Promise<void> => {
      const { error: err } = await supabase.from('transactions').delete().eq('id', id);
      if (err) {
        console.error('[useTransactions] deleteTransaction:', err);
        setError(err.message);
        return;
      }
      setData((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  return {
    data,
    loading,
    error,
    reload: () => { void load(); },
    addTransaction: addTransactionFn,
    deleteTransaction: deleteTransactionFn,
  };
}

// ============================================================
// useReliquats
// ============================================================

export interface UseReliquatsReturn {
  data: ReliquatDB[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  createReliquat: (r: Omit<ReliquatDB, 'id' | 'created_at' | 'updated_at'>) => Promise<ReliquatDB | null>;
  updateReliquat: (id: string, updates: Partial<Omit<ReliquatDB, 'id' | 'created_at'>>) => Promise<ReliquatDB | null>;
}

export function useReliquats(): UseReliquatsReturn {
  const [data,    setData]    = useState<ReliquatDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getReliquats();
      setData(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement reliquats';
      setError(msg);
      console.error('[useReliquats]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createReliquatFn = useCallback(
    async (r: Omit<ReliquatDB, 'id' | 'created_at' | 'updated_at'>): Promise<ReliquatDB | null> => {
      const result = await createReliquat(r);
      if (result) await load();
      return result;
    },
    [load],
  );

  const updateReliquatFn = useCallback(
    async (
      id: string,
      updates: Partial<Omit<ReliquatDB, 'id' | 'created_at'>>,
    ): Promise<ReliquatDB | null> => {
      const result = await updateReliquat(id, updates);
      if (result) {
        setData((prev) => prev.map((r) => (r.id === id ? result : r)));
      }
      return result;
    },
    [],
  );

  return {
    data,
    loading,
    error,
    reload: () => { void load(); },
    createReliquat: createReliquatFn,
    updateReliquat: updateReliquatFn,
  };
}

// ============================================================
// useSoldes
// ============================================================

export interface UseSoldesReturn {
  soldes: SoldesResult | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSoldes(filters?: Pick<TransactionFilters, 'dateDebut' | 'dateFin'>): UseSoldesReturn {
  const [soldes,  setSoldes]  = useState<SoldesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await calculateSoldes(filters);
      setSoldes(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur calcul soldes';
      setError(msg);
      console.error('[useSoldes]', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.dateDebut, filters?.dateFin]);

  useEffect(() => { void load(); }, [load]);

  return {
    soldes,
    loading,
    error,
    reload: () => { void load(); },
  };
}
