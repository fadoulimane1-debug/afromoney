/**
 * Hooks React pour MongoDB.
 *
 * ⚠️  Ces hooks appellent mongodbService qui utilise le driver Node.js.
 *     Ils ne fonctionneront en production que si l'app est configurée
 *     avec un backend (Express / Next.js API routes) qui expose une API REST,
 *     ou si les fonctions du service sont exposées via un proxy côté serveur.
 *
 *     En développement local avec un serveur Node.js séparé ils fonctionnent.
 *     Dans une app Vite purement browser → voir src/hooks/useSupabase.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getTransactions,
  createTransaction,
  deleteTransaction  as deleteTransactionSvc,
  updateTransaction  as updateTransactionSvc,
  getReliquats,
  createReliquat,
  updateReliquat     as updateReliquatSvc,
  calculateSoldes,
  type TransactionFilters,
  type SoldesResult,
} from '@/services/mongodbService';
import type { ITransaction, IReliquat } from '@/types/mongodb';

// ============================================================
// useTransactions
// ============================================================

export interface UseTransactionsMReturn {
  data:              ITransaction[];
  loading:           boolean;
  error:             string | null;
  reload:            () => void;
  clearError:        () => void;
  addTransaction:    (tx: Omit<ITransaction, '_id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editTransaction:   (id: string, data: Partial<Omit<ITransaction, '_id' | 'createdAt'>>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
}

export function useTransactions(filters?: TransactionFilters): UseTransactionsMReturn {
  const [data,    setData]    = useState<ITransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
    console.error('[useMongoDB.useTransactions]', err);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getTransactions(filters);
      setData(rows as ITransaction[]);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters?.dateDebut?.toISOString(),
    filters?.dateFin?.toISOString(),
    filters?.devise,
    filters?.type,
    filters?.employeId,
  ]);

  useEffect(() => { void load(); }, [load]);

  const addTransaction = useCallback(
    async (tx: Omit<ITransaction, '_id' | 'createdAt' | 'updatedAt'>) => {
      try {
        await createTransaction(tx);
        await load();
      } catch (err) {
        handleError(err);
      }
    },
    [load],
  );

  const editTransaction = useCallback(
    async (id: string, data: Partial<Omit<ITransaction, '_id' | 'createdAt'>>) => {
      try {
        await updateTransactionSvc(id, data);
        setData((prev) =>
          prev.map((t) =>
            t._id === id ? { ...t, ...data, updatedAt: new Date() } : t,
          ),
        );
      } catch (err) {
        handleError(err);
      }
    },
    [],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      try {
        await deleteTransactionSvc(id);
        setData((prev) => prev.filter((t) => t._id !== id));
      } catch (err) {
        handleError(err);
      }
    },
    [],
  );

  return {
    data,
    loading,
    error,
    reload:            () => { void load(); },
    clearError:        () => setError(null),
    addTransaction,
    editTransaction,
    removeTransaction,
  };
}

// ============================================================
// useReliquats
// ============================================================

export interface UseReliquatsMReturn {
  data:          IReliquat[];
  loading:       boolean;
  error:         string | null;
  reload:        () => void;
  clearError:    () => void;
  addReliquat:   (r: Omit<IReliquat, '_id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editReliquat:  (id: string, data: Partial<Omit<IReliquat, '_id' | 'createdAt'>>) => Promise<void>;
}

export function useReliquats(filters?: {
  statut?: IReliquat['statut'];
  client?: string;
}): UseReliquatsMReturn {
  const [data,    setData]    = useState<IReliquat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
    console.error('[useMongoDB.useReliquats]', err);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getReliquats(filters);
      setData(rows as IReliquat[]);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.statut, filters?.client]);

  useEffect(() => { void load(); }, [load]);

  const addReliquat = useCallback(
    async (r: Omit<IReliquat, '_id' | 'createdAt' | 'updatedAt'>) => {
      try {
        await createReliquat(r);
        await load();
      } catch (err) {
        handleError(err);
      }
    },
    [load],
  );

  const editReliquat = useCallback(
    async (id: string, data: Partial<Omit<IReliquat, '_id' | 'createdAt'>>) => {
      try {
        await updateReliquatSvc(id, data);
        setData((prev) =>
          prev.map((r) =>
            r._id === id ? { ...r, ...data, updatedAt: new Date() } : r,
          ),
        );
      } catch (err) {
        handleError(err);
      }
    },
    [],
  );

  return {
    data,
    loading,
    error,
    reload:     () => { void load(); },
    clearError: () => setError(null),
    addReliquat,
    editReliquat,
  };
}

// ============================================================
// useSoldes
// ============================================================

export interface UseSoldesMReturn {
  soldes:     SoldesResult | null;
  loading:    boolean;
  error:      string | null;
  reload:     () => void;
  clearError: () => void;
}

export function useSoldes(filters?: {
  dateDebut?: Date;
  dateFin?: Date;
}): UseSoldesMReturn {
  const [soldes,  setSoldes]  = useState<SoldesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await calculateSoldes(filters);
      setSoldes(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useMongoDB.useSoldes]', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.dateDebut?.toISOString(), filters?.dateFin?.toISOString()]);

  useEffect(() => { void load(); }, [load]);

  return {
    soldes,
    loading,
    error,
    reload:     () => { void load(); },
    clearError: () => setError(null),
  };
}
