import { useNotificationStore } from '@/stores/notificationStore';

/**
 * Hook unifié pour déclencher des notifications depuis n'importe quel composant.
 *
 * @example
 * const notify = useNotify();
 * notify.success('Transaction enregistrée');
 * notify.error('Clôture manquante', 'Erreur critique');
 * notify.warning('Écart détecté : 50 MAD');
 * notify.info('3 crédits en attente');
 */
export function useNotify() {
  const add = useNotificationStore((s) => s.add);

  return {
    success: (msg: string, title?: string) => add('success', msg, { title }),
    error:   (msg: string, title?: string) => add('error',   msg, { title }),
    warning: (msg: string, title?: string) => add('warning', msg, { title }),
    info:    (msg: string, title?: string) => add('info',    msg, { title }),
  };
}
