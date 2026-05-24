import type { StatutPaiement, Transaction, TransactionType } from '@/types';
import { calculMontantMAD } from '@/lib/calculations';
import { buildDefaultOperation } from '@/lib/constants';
import { parseMontantStr } from '@/lib/parseMontant';

function asNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseMontantStr(v);
  return Number(v);
}

function asType(v: unknown): TransactionType {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '_');
  if (s === 'CHARGES_AGENCE' || s.includes('CHARGES')) return 'CHARGES';
  if (s === 'ACHAT') return 'ACHAT';
  if (s === 'VENTE') return 'VENTE';
  if (s === 'DEPOT' || s === 'DÉPÔT') return 'DEPOT';
  if (s === 'RETRAIT') return 'RETRAIT';
  return 'ACHAT';
}

function asStatut(v: unknown): StatutPaiement {
  if (v === 'CRÉDIT' || v === 'CREDIT') return 'CRÉDIT';
  if (v === 'NON-PAYÉ' || v === 'NON_PAYÉ') return 'NON-PAYÉ';
  return 'PAYÉ';
}

export function normalizeTransaction(raw: Record<string, unknown>): Transaction {
  const date = raw.date ? new Date(raw.date as string) : new Date();
  const d = new Date(date);
  let montant = asNumber(raw.montant);
  if (!Number.isFinite(montant)) montant = 0;
  let taux = asNumber(raw.taux);
  if (!Number.isFinite(taux) || taux <= 0) taux = 1;
  const type = asType(raw.type);
  const devise = String(raw.devise ?? 'MAD').toUpperCase();

  const expectedMad = calculMontantMAD(montant, taux);
  let montantMAD =
    raw.montantMAD !== undefined && raw.montantMAD !== null
      ? asNumber(raw.montantMAD)
      : expectedMad;

  if (!Number.isFinite(montantMAD)) montantMAD = expectedMad;

  // Corrige les anciennes saisies « 2.157,14 » lues comme 2,157 par Number()
  if ((type === 'ACHAT' || type === 'VENTE') && montant > 0 && expectedMad > 0) {
    const ratio = montantMAD / expectedMad;
    if (ratio > 20 || ratio < 0.05) montantMAD = expectedMad;
  }

  const operation =
    typeof raw.operation === 'string' && raw.operation.trim()
      ? raw.operation.trim()
      : buildDefaultOperation(type, montant, devise);

  return {
    id: String(raw.id ?? crypto.randomUUID()),
    numero: raw.numero ? String(raw.numero) : undefined,
    date,
    caisseDepart:
      raw.caisseDepart !== undefined && raw.caisseDepart !== null && raw.caisseDepart !== ''
        ? Number(raw.caisseDepart)
        : undefined,
    jour: raw.jour !== undefined && raw.jour !== null ? Number(raw.jour) : d.getDate(),
    mois: raw.mois !== undefined && raw.mois !== null ? Number(raw.mois) : d.getMonth() + 1,
    employeId: String(raw.employeId ?? ''),
    employeNom: raw.employeNom != null ? String(raw.employeNom) : undefined,
    type,
    operation,
    devise,
    montant,
    taux,
    montantMAD,
    montantAPayer:
      raw.montantAPayer !== undefined && raw.montantAPayer !== null && raw.montantAPayer !== ''
        ? (() => {
            const p = asNumber(raw.montantAPayer);
            return Number.isFinite(p) ? p : undefined;
          })()
        : undefined,
    note: String(raw.note ?? ''),
    statut: asStatut(raw.statut),
    moment:
      raw.moment === 'MATIN' || raw.moment === 'JOURNEE' || raw.moment === 'SOIR'
        ? (raw.moment as 'MATIN' | 'JOURNEE' | 'SOIR')
        : undefined,
    beneficiaire: raw.beneficiaire ? String(raw.beneficiaire) : undefined,
  };
}
