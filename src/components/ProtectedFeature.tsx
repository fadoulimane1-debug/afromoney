import type { Role } from '@/types';
import { hasMinRole } from '@/lib/permissions';

interface Props {
  role: Role;
  /** Minimum role required — RESPONSABLE or ADMIN. */
  requires: 'RESPONSABLE' | 'ADMIN';
  children: React.ReactNode;
  /**
   * What to render when access is denied.
   * - 'hide' (default): render nothing
   * - 'disable': render children wrapped in a non-interactive overlay
   * - ReactNode: render this instead
   */
  fallback?: React.ReactNode | 'hide' | 'disable';
}

export function ProtectedFeature({ role, requires, children, fallback = 'hide' }: Props) {
  const allowed = hasMinRole(role, requires);

  if (allowed) return <>{children}</>;

  if (fallback === 'hide') return null;

  if (fallback === 'disable') {
    return (
      <div className="relative cursor-not-allowed select-none opacity-40" title={`Requis : rôle ${requires}`}>
        <div className="pointer-events-none">{children}</div>
      </div>
    );
  }

  return <>{fallback}</>;
}
