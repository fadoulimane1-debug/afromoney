import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { cn } from '@/lib/utils';
import {
  useNotificationStore,
  type Notification,
  type NotifType,
} from '@/stores/notificationStore';

dayjs.locale('fr');

/* ── Palette par type ── */
const CFG: Record<
  NotifType,
  { Icon: React.ElementType; dot: string; item: string; label: string; labelColor: string }
> = {
  success: {
    Icon: CheckCircle2,
    dot: 'bg-emerald-400',
    item: 'text-emerald-300',
    label: 'Succès',
    labelColor: 'bg-emerald-500/15 text-emerald-300',
  },
  error: {
    Icon: XCircle,
    dot: 'bg-red-400',
    item: 'text-red-300',
    label: 'Erreur',
    labelColor: 'bg-red-500/15 text-red-300',
  },
  warning: {
    Icon: AlertTriangle,
    dot: 'bg-amber-400',
    item: 'text-amber-300',
    label: 'Avertissement',
    labelColor: 'bg-amber-500/15 text-amber-300',
  },
  info: {
    Icon: Info,
    dot: 'bg-sky-400',
    item: 'text-sky-300',
    label: 'Info',
    labelColor: 'bg-sky-500/15 text-sky-300',
  },
};

/* ── Item liste ── */
function NotifItem({ notif }: { notif: Notification }) {
  const { markRead, remove } = useNotificationStore();
  const { Icon, item, dot, labelColor, label } = CFG[notif.type];

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
        notif.read ? 'opacity-50 hover:opacity-70' : 'hover:bg-white/5'
      )}
      onClick={() => markRead(notif.id)}
    >
      <Icon size={14} className={cn('mt-0.5 shrink-0', item)} />

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', labelColor)}>
            {label}
          </span>
          {notif.title && (
            <span className="text-[11px] font-semibold text-slate-200">{notif.title}</span>
          )}
        </div>
        <p className="text-[12px] leading-snug text-slate-300">{notif.message}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {dayjs(notif.timestamp).format('HH:mm · DD MMM')}
        </p>
      </div>

      {!notif.read && (
        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      )}

      <button
        type="button"
        className="absolute right-2 top-2 hidden rounded p-0.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300 group-hover:flex"
        onClick={(e) => {
          e.stopPropagation();
          remove(notif.id);
        }}
        title="Supprimer"
      >
        <X size={11} />
      </button>
    </div>
  );
}

/* ── Composant principal ── */
export function NotificationBell() {
  const { notifications, markAllRead, clear } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const unread = notifications.filter((n) => !n.read).length;

  /* Calcul position du panneau (identique au UserMenu) */
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ''}`}
      >
        <Bell size={15} strokeWidth={2} />

        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white shadow-lg shadow-red-900/40">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
        )}
      </button>

      {open &&
        createPortal(
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[1040]"
              aria-hidden
              onClick={() => setOpen(false)}
            />

            {/* Panneau */}
            <div
              className="fixed z-[1050] w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900/96 shadow-2xl shadow-black/60 backdrop-blur-xl"
              style={{ top: pos.top, right: pos.right }}
              role="dialog"
              aria-label="Centre de notifications"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-cyan-400" />
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  {unread > 0 && (
                    <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                      {unread} nouvelle{unread > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      title="Tout marquer comme lu"
                    >
                      <Check size={10} />
                      Tout lire
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clear}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      title="Effacer tout"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Corps */}
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                      <Bell size={20} className="text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-500">Aucune notification</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 p-2">
                    {notifications.map((n) => (
                      <NotifItem key={n.id} notif={n} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
