export interface AuthUser {
  id: string;
  email: string;
  role: 'CAISSIER' | 'ADMIN';
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}
