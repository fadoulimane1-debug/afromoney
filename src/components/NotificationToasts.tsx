import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore, type Notification, type NotifType } from '@/stores/notificationStore';

const CFG: Record<
  NotifType,
  { Icon: React.ElementType; bg: string; border: string; text: string; icon: string }
> = {
  success: {
    Icon: CheckCircle2,
    bg: 'bg-emerald-950/95',
    border: 'border-emerald-500/35',
    text: 'text-emerald-50',
    icon: 'text-emerald-400',
  },
  error: {
    Icon: XCircle,
    bg: 'bg-red-950/95',
    border: 'border-red-500/35',
    text: 'text-red-50',
    icon: 'text-red-400',
  },
  warning: {
    Icon: AlertTriangle,
    bg: 'bg-amber-950/95',
    border: 'border-amber-500/35',
    text: 'text-amber-50',
    icon: 'text-amber-400',
  },
  info: {
    Icon: Info,
    bg: 'bg-sky-950/95',
    border: 'border-sky-500/35',
    text: 'text-sky-50',
    icon: 'text-sky-400',
  },
};

function Toast({ notif }: { notif: Notification }) {
  const remove = useNotificationStore((s) => s.remove);
  const markRead = useNotificationStore((s) => s.markRead);
  const { Icon, bg, border, text, icon } = CFG[notif.type];

  function dismiss() {
    markRead(notif.id);
    remove(notif.id);
  }

  return (
    <div
      className={cn(
        'notif-slide-in flex min-w-72 max-w-sm items-start gap-3 rounded-xl border px-4 py-3',
        'shadow-2xl shadow-black/50 backdrop-blur-xl',
        bg,
        border
      )}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', icon)} />

      <div className="min-w-0 flex-1">
        {notif.title && (
          <p className={cn('mb-0.5 text-[11px] font-semibold', text)}>{notif.title}</p>
        )}
        <p className={cn('text-[13px] leading-snug', text)}>{notif.message}</p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-white/35 transition-colors hover:text-white/80"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Stack de toasts fixe bas-droite. À rendre une seule fois dans Layout.
 * Affiche les 5 notifications non lues les plus récentes.
 */
export function NotificationToasts() {
  const notifications = useNotificationStore((s) => s.notifications);
  // Afficher seulement les notifications success et info en popup
  // Les erreurs et avertissements restent dans la cloche uniquement
  const unread = notifications
    .filter((n) => !n.read && (n.type === 'success' || n.type === 'info'))
    .slice(0, 5);

  if (unread.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[2000] flex flex-col gap-2">
      {unread.map((n) => (
        <Toast key={n.id} notif={n} />
      ))}
    </div>,
    document.body
  );
}
