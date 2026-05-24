import { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { calculStock, calculRapportMensuel } from '@/lib/calculations';
import {
  getTransactions,
  getExchangeRates,
  updateTransaction as storageUpdateTransaction,
  deleteTransaction as storageDeleteTransaction,
} from '@/lib/storage';
import dayjs from 'dayjs';

/**
 * Source de vérité : transactions et taux dans `localStorage` (saisie / historique).
 * Zustand sert de repli pour les taux par défaut si le stockage est vide.
 */
export function useAppData() {
  const store = useDataStore();
  const [dataRev, setDataRev] = useState(0);

  useEffect(() => {
    const onChange = () => setDataRev((n) => n + 1);
    window.addEventListener('afromoney-data', onChange);
    return () => window.removeEventListener('afromoney-data', onChange);
  }, []);

  const transactions = useMemo(() => {
    void dataRev;
    return getTransactions();
  }, [dataRev]);
  const exchangeRates = useMemo(() => {
    void dataRev;
    const fromLs = getExchangeRates();
    return fromLs.length > 0 ? fromLs : store.exchangeRates;
  }, [dataRev, store.exchangeRates]);

  const stock = useMemo(
    () => calculStock(transactions, exchangeRates),
    [transactions, exchangeRates]
  );

  const currentMonthReport = useMemo(
    () => calculRapportMensuel(transactions, dayjs().format('YYYY-MM')),
    [transactions]
  );

  const transactionsEnCredit = useMemo(
    () => transactions.filter((tx) => tx.statut === 'CRÉDIT'),
    [transactions]
  );

  return {
    ...store,
    transactions,
    exchangeRates,
    updateTransaction: storageUpdateTransaction,
    deleteTransaction: storageDeleteTransaction,
    stock,
    currentMonthReport,
    transactionsEnCredit,
  };
}
