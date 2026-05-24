import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { UTILISATEURS_TEST } from '@/lib/constants';
import { normalizeRole } from '@/lib/permissions';

interface AuthStore {
  currentUser: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUser: null,

      login: (email, password) => {
        void password;
        const found = UTILISATEURS_TEST.find((u) => u.email === email);
        if (!found) return false;
        const user: User = {
          ...found,
          role: normalizeRole(found.role),
          dateCreation: new Date(),
        };
        set({ currentUser: user });
        return true;
      },

      logout: () => set({ currentUser: null }),
    }),
    {
      name: 'afromoney_auth',
      // Normalize role on rehydration (handles stored 'EMPLOYEE' values)
      onRehydrateStorage: () => (state) => {
        if (state?.currentUser) {
          state.currentUser.role = normalizeRole(state.currentUser.role as string);
        }
      },
    }
  )
);
