import dayjs from 'dayjs';
import { getProSettings } from '@/lib/proSettings';

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface CreditAgingRow {
  id: string;
  date: string;
  echeance: string;
  nom: string;
  contre_val_mad: number;
  statut: string;
  joursRetard: number;
  bucket: AgingBucket;
}

export function creditAgingBucket(jours: number): AgingBucket {
  if (jours <= 30) return '0-30';
  if (jours <= 60) return '31-60';
  if (jours <= 90) return '61-90';
  return '90+';
}

export function enrichCreditAging<T extends { date: string; statut: string; echeance?: string }>(
  credits: T[],
): (T & { joursRetard: number; bucket: AgingBucket; echeanceCalc: string })[] {
  const s = getProSettings();
  const today = dayjs();
  return credits
    .filter((c) => c.statut !== 'Payé')
    .map((c) => {
      const echeanceCalc = c.echeance ?? dayjs(c.date).add(s.joursRetardCredit, 'day').format('YYYY-MM-DD');
      const joursRetard = Math.max(0, today.diff(dayjs(echeanceCalc), 'day'));
      return {
        ...c,
        echeanceCalc,
        joursRetard,
        bucket: creditAgingBucket(joursRetard),
      };
    });
}

export const AGING_LABELS: Record<AgingBucket, string> = {
  '0-30': '0 – 30 j',
  '31-60': '31 – 60 j',
  '61-90': '61 – 90 j',
  '90+': 'Plus de 90 j',
};
