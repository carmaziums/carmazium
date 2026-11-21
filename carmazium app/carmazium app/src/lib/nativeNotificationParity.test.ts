import { buildEmailNotificationPreferences, getVisibleNotifications } from './nativeNotificationParity';
import type { AppNotification } from './notificationsApi';

const notification = (id: string, isRead: boolean): AppNotification =>
  ({ id, isRead, title: '', message: '', type: 'SYSTEM', userId: 'test', createdAt: '2026-11-21T10:00:00Z' });

describe('native notifications match website controls', () => {
  test('All keeps the complete fetched page and Unread hides read rows', () => {
    const data = [notification('a', true), notification('b', false), notification('c', false)];
    expect(getVisibleNotifications(data, 'all')).toHaveLength(3);
    expect(getVisibleNotifications(data, 'unread').map(n => n.id)).toEqual(['b', 'c']);
    expect(data).toHaveLength(3);
  });
  test('email toggle preserves other account preferences and notifications', () => {
    const settings = {
      marketing: { popupHidden: true },
      notifications: { sms: true, email: true, auction: false },
    };
    const next = buildEmailNotificationPreferences(settings, false);
    expect(next).toEqual({
      marketing: { popupHidden: true },
      notifications: { sms: true, email: false, auction: false },
    });
    expect(settings.notifications.email).toBe(true);
  });
  test('email toggle defaults safely if preferences are missing', () => {
    expect(buildEmailNotificationPreferences(null, false)).toEqual({ notifications: { email: false } });
    expect(buildEmailNotificationPreferences({ notifications: null }, true)).toEqual({ notifications: { email: true } });
  });
});
