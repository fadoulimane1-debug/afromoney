import { create } from 'zustand';

export type NotifType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  type: NotifType;
  title?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  add: (type: NotifType, message: string, opts?: { title?: string; autoClose?: boolean }) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  remove: (id: number) => void;
  clear: () => void;
}

const AUTO_CLOSE_DELAY: Record<NotifType, number | false> = {
  success: 4000,
  info:    6000,
  warning: false,
  error:   false,
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  add: (type, message, opts = {}) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const notif: Notification = {
      id,
      type,
      title: opts.title,
      message,
      timestamp: new Date(),
      read: false,
    };

    set((s) => ({ notifications: [notif, ...s.notifications].slice(0, 50) }));

    const autoClose = opts.autoClose ?? AUTO_CLOSE_DELAY[type];
    if (autoClose !== false) {
      const delay = typeof autoClose === 'number' ? autoClose : (AUTO_CLOSE_DELAY[type] as number);
      setTimeout(() => get().remove(id), delay);
    }
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),
}));
