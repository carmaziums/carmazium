import { create } from 'zustand';

export interface NotificationItem {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  data:      Record<string, any> | null;
  isRead:    boolean;
  createdAt: string;
}

interface NotificationsState {
  unreadCount:   number;
  notifications: NotificationItem[];
  pendingDeepLink: string | null;

  setUnreadCount:       (n: number) => void;
  incrementUnread:      () => void;
  addNotification:      (n: NotificationItem) => void;
  markRead:             (id: string) => void;
  markAllRead:          () => void;
  setPendingDeepLink:   (link: string) => void;
  clearPendingDeepLink: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unreadCount:     0,
  notifications:   [],
  pendingDeepLink: null,

  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),

  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 100),
      unreadCount:   s.unreadCount + 1,
    })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount:   0,
    })),

  setPendingDeepLink:   (link) => set({ pendingDeepLink: link }),
  clearPendingDeepLink: ()     => set({ pendingDeepLink: null }),
}));
