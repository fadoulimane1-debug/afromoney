import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, ExchangeRate } from '@/types';
import { TAUX_PAR_DEFAUT, DEVISES, buildDefaultOperation } from '@/lib/constants';
import { calculMontantMAD } from '@/lib/calculations';
import { saveExchangeRates } from '@/lib/storage';

interface DataStore {
  transactions: Transaction[];
  exchangeRates: ExchangeRate[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  updateRate: (devise: string, field: 'tauxAchat' | 'tauxVente' | 'tauxJour', value: number) => void;
}

const defaultRates: ExchangeRate[] = DEVISES.filter((d) => d !== 'MAD').map((devise) => ({
  devise,
  tauxAchat: TAUX_PAR_DEFAUT[devise] ?? 1,
  tauxVente: TAUX_PAR_DEFAUT[devise] ?? 1,
  tauxJour: TAUX_PAR_DEFAUT[devise] ?? 1,
  dateUpdate: new Date(),
}));

export const useDataStore = create<DataStore>()(
  persist(
    (set) => ({
      transactions: [],
      exchangeRates: defaultRates,

      addTransaction: (tx) =>
        set((state) => {
          const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
          const jour = tx.jour ?? date.getDate();
          const mois = tx.mois ?? date.getMonth() + 1;
          const operation =
            tx.operation?.trim() ||
            buildDefaultOperation(tx.type, tx.montant, tx.devise);
          const montantMAD =
            tx.montantMAD ?? calculMontantMAD(tx.montant, tx.taux);
          return {
            transactions: [
              ...state.transactions,
              {
                ...tx,
                id: crypto.randomUUID(),
                date,
                jour,
                mois,
                operation,
                montantMAD,
              },
            ],
          };
        }),

      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id
              ? {
                  ...tx,
                  ...updates,
                  montantMAD:
                    updates.montantMAD !== undefined
                      ? updates.montantMAD
                      : calculMontantMAD(
                          updates.montant ?? tx.montant,
                          updates.taux ?? tx.taux
                        ),
                }
              : tx
          ),
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),

      updateRate: (devise, field, value) =>
        set((state) => {
          const exchangeRates = state.exchangeRates.map((r) =>
            r.devise === devise ? { ...r, [field]: value, dateUpdate: new Date() } : r
          );
          saveExchangeRates(exchangeRates);
          return { exchangeRates };
        }),
    }),
    { name: 'afromoney_data' }
  )
);
