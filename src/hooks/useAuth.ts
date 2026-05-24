import { getCurrentUser, setCurrentUser, logout as storageLogout } from '@/lib/storage';
import { UTILISATEURS_TEST } from '@/lib/constants';
import type { User } from '@/types';

const DEFAULT_ADMIN: User = {
  ...UTILISATEURS_TEST[0],
  dateCreation: new Date(),
};

/** Auto-initialise l'admin si aucun utilisateur n'est stocké. */
function getOrInitUser(): User {
  const stored = getCurrentUser();
  if (stored) return stored;
  setCurrentUser(DEFAULT_ADMIN);
  return DEFAULT_ADMIN;
}

export const useAuth = () => {
  const currentUser = getOrInitUser();

  const logout = () => {
    storageLogout();
  };

  return { currentUser, isLoggedIn: true, logout };
};
