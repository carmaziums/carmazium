import type { AppNotification } from './notificationsApi';

/** Same local All / Unread filter used by the website notifications page. */
export function getVisibleNotifications(
  notifications: AppNotification[], filter: 'all' | 'unread',
): AppNotification[] {
  return filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
}

/** Preserve unrelated account settings and notification preferences. */
export function buildEmailNotificationPreferences(
  preferences: Record<string, unknown> | undefined | null,
  enabled: boolean,
): Record<string, unknown> {
  const previous = preferences ?? {};
  const notifications = previous.notifications &&
    typeof previous.notifications === 'object' && !Array.isArray(previous.notifications)
      ? previous.notifications as Record<string, unknown>
      : {};
  return { ...previous, notifications: { ...notifications, email: enabled } };
}
