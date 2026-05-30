import { ENDPOINTS } from '@/constants/api';
import { apiRequest } from './client';

export interface NotificationItem {
  id:         string;
  userId:     string;
  type:       string;
  title:      string;
  message:    string;
  data:       Record<string, any> | null;
  entityType: string | null;
  entityId:   string | null;
  isRead:     boolean;
  createdAt:  string;
}

export interface PaginatedNotifications {
  data:  NotificationItem[];
  total: number;
  page:  number;
  limit: number;
}

export const notificationsApi = {
  fetchPage: (page = 1, limit = 20) =>
    apiRequest<PaginatedNotifications>(ENDPOINTS.NOTIFICATIONS, {
      params: { page, limit },
    }),

  markRead: (id: string) =>
    apiRequest<void>(ENDPOINTS.NOTIFICATION_READ(id), { method: 'PATCH' }),

  markAllRead: () =>
    apiRequest<{ count: number }>(ENDPOINTS.NOTIFICATIONS_READ_ALL, { method: 'PATCH' }),

  getUnreadCount: () =>
    apiRequest<{ count: number }>(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT),
};
