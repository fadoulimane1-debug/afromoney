import type { ReactNode } from 'react';

/** Login bypassed — toutes les routes sont accessibles directement. */
export const ProtectedRoute = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);
