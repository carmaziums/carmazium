import { apiClient } from './apiClient';
import { Colors } from '../constants/colors';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  data?: Record<string, any> | null;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: AppNotification[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getNotifications(page = 1, limit = 30): Promise<{
  notifications: AppNotification[];
  total: number;
}> {
  const res = await apiClient<NotificationsResponse>(
    `/notifications?page=${page}&limit=${limit}`
  );
  return {
    notifications: res.data ?? [],
    total: res.pagination?.total ?? res.data?.length ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllRead(): Promise<void> {
  await apiClient('/notifications/read-all', { method: 'PATCH' });
}

export async function getUnreadCount(): Promise<number> {
  try {
    const res = await apiClient<{ success: boolean; data: { count: number } }>(
      '/notifications/unread-count'
    );
    return res.data?.count ?? 0;
  } catch {
    return 0;
  }
}

// Notification type → icon + color mapping for the UI
export function notifStyle(type: string): { icon: string; color: string; bg: string } {
  switch (type) {
    case 'AUCTION_WON':       return { icon: 'trophy', color: Colors.accentGreen, bg: Colors.accentGreenAlpha12 };
    case 'AUCTION_ENDED':     return { icon: 'hammer-outline', color: Colors.iconMuted, bg: Colors.whiteAlpha04 };
    case 'OFFER_RECEIVED':    return { icon: 'pricetag-outline', color: Colors.warning, bg: Colors.warningAlpha12 };
    case 'OFFER_ACCEPTED':    return { icon: 'checkmark-circle', color: Colors.accentGreen, bg: Colors.accentGreenAlpha12 };
    case 'OFFER_REJECTED':    return { icon: 'close', color: Colors.accent, bg: Colors.accentAlpha12 };
    case 'OFFER_COUNTERED':   return { icon: 'arrow-forward', color: Colors.infoBlue, bg: Colors.infoBlueAlpha12 };
    case 'OFFER_WITHDRAWN':   return { icon: 'arrow-back', color: Colors.iconMuted, bg: Colors.whiteAlpha04 };
    case 'MESSAGE_RECEIVED':  return { icon: 'chatbubble-outline', color: Colors.infoBlue, bg: Colors.infoBlueAlpha12 };
    case 'DEAL_CLOSED':       return { icon: 'checkmark-circle', color: Colors.accentGreen, bg: Colors.accentGreenAlpha12 };
    case 'WATCHLIST_ENDING_24H': return { icon: 'heart', color: Colors.warning, bg: Colors.warningAlpha12 };
    default:                  return { icon: 'notifications-outline', color: Colors.textSecondary, bg: Colors.whiteAlpha04 };
  }
}

export function notifTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
