import dayjs from 'dayjs';
import { getProSettings } from '@/lib/proSettings';
import { getTransactions, getClosures, getClosureByDate, calculateDailyClosure, getExchangeRates } from '@/lib/storage';
import { calculStock } from '@/lib/calculations';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { fmtMad, fmtDevise, fmtInt } from '@/lib/formatNumbers';

export type AlertLevel = 'info' | 'warning' | 'error';

export interface ProAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  href?: string;
}

function loadCreditsRaw(): { id?: string; date: string; statut: string; contre_val_mad: number; echeance?: string }[] {
  try {
    const raw = localStorage.getItem('credits');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Alertes métier pour tableau de bord et notifications */
export function computeProAlerts(): ProAlert[] {
  const s = getProSettings();
  const alerts: ProAlert[] = [];
  const today = dayjs().format('YYYY-MM-DD');
  const txs = filterTransactionsComptables(getTransactions());
  const rates = getExchangeRates();
  const stocks = calculStock(txs, rates);

  const todayClosure = getClosureByDate(today);
  if (!todayClosure || todayClosure.status === 'DRAFT') {
    alerts.push({
      id: 'closure-draft',
      level: 'warning',
      title: 'Clôture du jour',
      message: `Clôture du ${dayjs().format('DD/MM/YYYY')} non validée.`,
      href: '/cloture',
    });
  }

  const errorClosures = getClosures().filter((c) => c.status === 'ERROR');
  for (const c of errorClosures) {
    alerts.push({
      id: `closure-err-${c.id}`,
      level: 'error',
      title: 'Écart de caisse MAD',
      message: `${c.date} : écart ${c.variance != null ? fmtMad(c.variance) : '?'} MAD (seuil ${fmtMad(s.seuilEcartClotureMAD)}).`,
      href: '/cloture',
    });
  }

  const fresh = calculateDailyClosure(today);
  const varToday = Math.abs(fresh.variance ?? 0);
  if (varToday >= s.seuilEcartClotureMAD && fresh.status !== 'VALIDATED' && fresh.status !== 'ERROR') {
    alerts.push({
      id: 'closure-variance-today',
      level: 'error',
      title: 'Écart clôture aujourd\'hui',
      message: `Écart théorique/réel : ${fmtMad(fresh.variance ?? 0)} MAD (seuil ${fmtMad(s.seuilEcartClotureMAD)}).`,
      href: '/cloture',
    });
  }

  for (const st of stocks) {
    if (st.devise === 'MAD') continue;
    if (st.stockActuel < 0) {
      alerts.push({
        id: `stock-neg-${st.devise}`,
        level: 'error',
        title: `Stock ${st.devise} négatif`,
        message: `Position négative : ${fmtDevise(st.stockActuel)} ${st.devise}.`,
        href: '/stock',
      });
      continue;
    }
    if (st.stockActuel < s.seuilStockMinUnites) {
      alerts.push({
        id: `stock-low-${st.devise}`,
        level: 'warning',
        title: `Stock ${st.devise} bas`,
        message: `Stock actuel : ${fmtDevise(st.stockActuel)} ${st.devise} (seuil ${fmtInt(s.seuilStockMinUnites)}).`,
        href: '/stock',
      });
    }
  }

  const todayTxs = txs.filter((t) => {
    const d = t.date instanceof Date ? t.date.toISOString() : String(t.date);
    return d.slice(0, 10) === today;
  });
  for (const t of todayTxs) {
    if (t.montantMAD >= s.seuilMontantMAD) {
      alerts.push({
        id: `big-tx-${t.id}`,
        level: 'info',
        title: 'Opération importante',
        message: `${t.type} ${fmtDevise(t.montant)} ${t.devise} = ${fmtMad(t.montantMAD)} MAD.`,
        href: '/transactions',
      });
    }
  }

  const creditsOuverts = txs.filter((t) => t.statut === 'CRÉDIT' || t.statut === 'NON-PAYÉ');
  if (creditsOuverts.length > 0) {
    alerts.push({
      id: 'tx-credit-open',
      level: 'warning',
      title: 'Impayés / crédits transactions',
      message: `${creditsOuverts.length} ligne(s) non soldée(s) dans l'historique.`,
      href: '/transactions',
    });
  }

  const credits = loadCreditsRaw().filter((c) => c.statut !== 'Payé');
  for (const c of credits) {
    const due = c.echeance ? dayjs(c.echeance) : dayjs(c.date).add(s.joursRetardCredit, 'day');
    if (due.isBefore(dayjs(), 'day')) {
      alerts.push({
        id: `credit-late-${c.id ?? `${c.date}-${c.contre_val_mad}`}`,
        level: 'warning',
        title: 'Créance en retard',
        message: `Créance ${fmtMad(c.contre_val_mad)} MAD — échéance dépassée.`,
        href: '/credits',
      });
    }
  }

  return alerts;
}
