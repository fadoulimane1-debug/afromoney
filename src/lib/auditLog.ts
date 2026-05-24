/**
 * Journal d'audit central — traçabilité des actions sensibles.
 */
import { addAuditLog as addReconAudit, getAuditLogs, type AuditLogEntry } from '@/lib/reconciliation';
import { getCurrentUser } from '@/lib/storage';

export type { AuditLogEntry };
export { getAuditLogs };

function actor(): string {
  return getCurrentUser()?.nom ?? 'Système';
}

export function logAudit(
  action: string,
  details: Record<string, unknown>,
  date?: string,
): AuditLogEntry {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return addReconAudit({
    date: d,
    action,
    user: actor(),
    details,
  });
}

export const AUDIT_ACTIONS = {
  TX_CREATE: 'TRANSACTION_CREEE',
  TX_UPDATE: 'TRANSACTION_MODIFIEE',
  TX_DELETE: 'TRANSACTION_SUPPRIMEE',
  CLOSURE_SAVE: 'CLOTURE_ENREGISTREE',
  CLOSURE_VALIDATE: 'CLOTURE_VALIDEE',
  RECON_VALIDATE: 'RECONCILIATION_VALIDEE',
  SETTINGS: 'PARAMETRES_MODIFIES',
  CREDIT_CREATE: 'CREDIT_CREEE',
  CREDIT_UPDATE: 'CREDIT_MODIFIE',
  CREDIT_DELETE: 'CREDIT_SUPPRIMEE',
  CLIENT_CREATE: 'CLIENT_CREE',
  CLIENT_UPDATE: 'CLIENT_MODIFIE',
  CLIENT_DELETE: 'CLIENT_SUPPRIME',
  RELIQUAT_CREATE: 'RELIQUAT_CREE',
  RELIQUAT_VERSEMENT: 'RELIQUAT_VERSEMENT_ENREGISTRE',
  RELIQUAT_SOLDE: 'RELIQUAT_SOLDE',
  RELIQUAT_DELETE: 'RELIQUAT_SUPPRIME',
} as const;
