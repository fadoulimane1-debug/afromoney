import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { AppFooter } from './AppFooter';
import { NotificationToasts } from './NotificationToasts';
import {
  initializeDefaultRates,
  getClosureByDate,
  calculateDailyClosure,
  saveClosure,
  getClosures,
  getTransactions,
} from '@/lib/storage';
import { useNotificationStore } from '@/stores/notificationStore';
import { smartFetchRates, fetchAndSaveRates, msUntilNineAM } from '@/lib/bkamRates';
import { computeProAlerts } from '@/lib/alerts';
import dayjs from 'dayjs';

const PAGE_TITLES: Record<string, string> = {
  '/':                  'Accueil',
  '/dashboard':         'Synthèse',
  '/caisse':            'Caisse journalière',
  '/journal-journee':   'Journée — 3 snapshots',
  '/reconciliation':  'Réconciliation',
  '/transactions':      'Historique & saisie',
  '/stock':             'Mémoire des stocks',
  '/reports':           'Bilan & TCD',
  '/credits':           'Crédits en cours',
  '/cloture':           'Clôture journalière',
  '/clotures-history':  'Historique des clôtures',
  '/cotation':           'Cotation rapide',
  '/audit':              'Journal d\'audit',
  '/parametres':         'Paramètres',
};

export function Layout() {
  const location = useLocation();
  const addNotif = useNotificationStore((s) => s.add);

  useEffect(() => {
    initializeDefaultRates();

    // Créer un DRAFT de clôture pour aujourd'hui s'il n'en existe pas encore
    const todayStr = dayjs().format('YYYY-MM-DD');
    if (!getClosureByDate(todayStr)) {
      saveClosure(calculateDailyClosure(todayStr));
    }

    // ── Vérifications intelligentes au démarrage ──
    const timer = setTimeout(() => {
      const todayClosure = getClosureByDate(todayStr);
      if (!todayClosure || todayClosure.status === 'DRAFT') {
        addNotif('warning', `Clôture du ${dayjs().format('DD/MM/YYYY')} non encore validée.`, {
          title: 'Clôture manquante',
        });
      }

      const errorClosures = getClosures().filter((c) => c.status === 'ERROR');
      if (errorClosures.length > 0) {
        addNotif(
          'error',
          `${errorClosures.length} clôture${errorClosures.length > 1 ? 's' : ''} avec écart de caisse détecté.`,
          { title: 'Écarts détectés' }
        );
      }

      const credits = getTransactions().filter((t) => t.statut === 'CRÉDIT');
      if (credits.length > 0) {
        addNotif(
          'info',
          `${credits.length} transaction${credits.length > 1 ? 's' : ''} en crédit non réglée${credits.length > 1 ? 's' : ''}.`,
          { title: 'Crédits en cours' }
        );
      }

      const proAlerts = computeProAlerts().filter((a) => a.level === 'error').slice(0, 3);
      for (const a of proAlerts) {
        addNotif('error', a.message, { title: a.title });
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Taux de change : fetch intelligent + planification 09:00 ──
  useEffect(() => {
    // Fetch immédiat si cache périmé (> 4 h)
    smartFetchRates().then((source) => {
      if (source === 'BKAM') {
        addNotif('success', 'Taux officiels BKAM chargés.', { title: 'Taux du jour' });
      } else if (source === 'CDN') {
        addNotif('info', 'Taux internationaux chargés (CDN).', { title: 'Taux du jour' });
      }
    });

    // Scheduler le fetch forcé à 09:00 chaque matin
    let nineTimer: ReturnType<typeof setTimeout>;
    function scheduleNineAM() {
      const delay = msUntilNineAM();
      nineTimer = setTimeout(async () => {
        const source = await fetchAndSaveRates();
        addNotif(
          source === 'BKAM' || source === 'CDN' ? 'success' : 'warning',
          source === 'BKAM'
            ? 'Taux BKAM mis à jour automatiquement à 09:00.'
            : source === 'CDN'
            ? 'Taux CDN mis à jour automatiquement à 09:00.'
            : 'Mise à jour automatique : serveurs inaccessibles, taux en cache conservés.',
          { title: 'Mise à jour 09:00' }
        );
        scheduleNineAM(); // Replanifier pour le lendemain
      }, delay);
    }
    scheduleNineAM();

    return () => clearTimeout(nineTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = PAGE_TITLES[location.pathname];
    document.title = t ? `AFROMONEY — ${t}` : 'AFROMONEY — Bureau de change';
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col pt-16 lg:pt-20">
      <Navbar />

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>

      <AppFooter />
      <NotificationToasts />
    </div>
  );
}
