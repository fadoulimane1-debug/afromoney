import type { Role } from '@/types';

const ROLE_LEVEL: Record<Role, number> = {
  CAISSIER:    1,
  RESPONSABLE: 2,
  ADMIN:       3,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

/** Normalise les anciens rôles stockés (EMPLOYEE → CAISSIER, ADMIN reste ADMIN). */
export function normalizeRole(raw: string): Role {
  if (raw === 'ADMIN') return 'ADMIN';
  if (raw === 'RESPONSABLE') return 'RESPONSABLE';
  return 'CAISSIER';
}

// ─── Permission checks ────────────────────────────────────────────────────────

export function canEditRates(role: Role): boolean      { return hasMinRole(role, 'RESPONSABLE'); }
export function canAccessCoffre(role: Role): boolean   { return hasMinRole(role, 'RESPONSABLE'); }
export function canCloseDay(role: Role): boolean       { return hasMinRole(role, 'RESPONSABLE'); }
export function canViewAudit(role: Role): boolean      { return hasMinRole(role, 'RESPONSABLE'); }
export function canManageUsers(role: Role): boolean    { return role === 'ADMIN'; }
export function canAccessParams(role: Role): boolean   { return role === 'ADMIN'; }

// ─── Permission map (for display) ────────────────────────────────────────────

export interface PermissionEntry {
  label: string;
  check: (role: Role) => boolean;
}

export const PERMISSION_LIST: PermissionEntry[] = [
  { label: 'Opérations ACHAT/VENTE',    check: () => true },
  { label: 'Solder reliquats',           check: () => true },
  { label: 'Comptage ouverture/clôture', check: () => true },
  { label: 'Modifier taux de change',    check: canEditRates },
  { label: 'Mouvements coffre',          check: canAccessCoffre },
  { label: 'Clôturer la journée',        check: canCloseDay },
  { label: 'Audit complet',              check: canViewAudit },
  { label: 'Paramètres système',         check: canAccessParams },
  { label: 'Gérer les utilisateurs',     check: canManageUsers },
];
