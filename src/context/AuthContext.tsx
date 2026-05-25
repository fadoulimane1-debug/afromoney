import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AuthUser } from '@/types/auth';
import { setCurrentUser, logout as storageLogout } from '@/lib/storage';
import type { User } from '@/types';

interface UserEntry {
  email: string;
  password: string;
  user: AuthUser;
}

const USERS_DB: UserEntry[] = [
  {
    email: 'caissier1@afromoney.ma',
    password: 'Test2026!',
    user: { id: 'u-caissier-1', email: 'caissier1@afromoney.ma', role: 'CAISSIER', name: 'Caissier 1' },
  },
  {
    email: 'admin@afromoney.ma',
    password: 'Admin2026!',
    user: { id: 'u-admin-1', email: 'admin@afromoney.ma', role: 'ADMIN', name: 'Administrateur' },
  },
];

const STORAGE_TOKEN = 'afm_token';
const STORAGE_USER  = 'afm_user';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isCaissier: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeToken(user: AuthUser): string {
  return btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, iat: Date.now() }));
}

function syncLegacy(authUser: AuthUser): void {
  const legacy: User = {
    id: authUser.id,
    nom: authUser.name,
    email: authUser.email,
    role: authUser.role as User['role'],
    dateCreation: new Date(),
  };
  setCurrentUser(legacy);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN));

  useEffect(() => {
    if (user) syncLegacy(user);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const entry = USERS_DB.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!entry || entry.password !== password) {
      return { ok: false, error: 'Email ou mot de passe incorrect' };
    }
    const authUser = entry.user;
    const tok = makeToken(authUser);
    localStorage.setItem(STORAGE_USER, JSON.stringify(authUser));
    localStorage.setItem(STORAGE_TOKEN, tok);
    syncLegacy(authUser);
    setUser(authUser);
    setToken(tok);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
    storageLogout();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isCaissier: user?.role === 'CAISSIER',
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext doit être utilisé à l\'intérieur de AuthProvider');
  return ctx;
}
