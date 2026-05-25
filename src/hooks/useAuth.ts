import { useAuthContext } from '@/context/AuthContext';
import type { User } from '@/types';

export const useAuth = () => {
  const { user, isAuthenticated, logout } = useAuthContext();

  const currentUser: User | null = user
    ? {
        id: user.id,
        nom: user.name,
        email: user.email,
        role: user.role as User['role'],
        dateCreation: new Date(),
      }
    : null;

  return { currentUser, isLoggedIn: isAuthenticated, logout };
};
