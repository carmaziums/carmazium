import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  bids:               boolean;
  offers:             boolean;
  messages:           boolean;
  system:             boolean;
  quietHoursEnabled:  boolean;
  quietStart:         string; // "22:00"
  quietEnd:           string; // "08:00"
}

const PREFS_KEY = 'notification_preferences';

export const DEFAULT_PREFS: NotificationPreferences = {
  bids:              true,
  offers:            true,
  messages:          true,
  system:            true,
  quietHoursEnabled: false,
  quietStart:        '22:00',
  quietEnd:          '08:00',
};

// ─── Preference Helpers ───────────────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const current = await getNotificationPreferences();
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

// ─── Quiet Hours ─────────────────────────────────────────────────────────────

export function isQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins   = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  // Handles overnight ranges (e.g. 22:00–08:00)
  if (startMins <= endMins) return nowMins >= startMins && nowMins < endMins;
  return nowMins >= startMins || nowMins < endMins;
}

// ─── Category Mapper ─────────────────────────────────────────────────────────

export function getNotificationCategory(
  type: string,
): keyof Pick<NotificationPreferences, 'bids' | 'offers' | 'messages' | 'system'> {
  if (type.includes('BID') || type.includes('AUCTION')) return 'bids';
  if (type.includes('OFFER'))                            return 'offers';
  if (type.includes('MESSAGE') || type.includes('CHAT')) return 'messages';
  return 'system';
}

// ─── Local Notification Scheduler ────────────────────────────────────────────

export async function scheduleLocalNotification(
  title:     string,
  body:      string,
  data:      Record<string, unknown>,
  channelId = 'carmazium-default',
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      // categoryIdentifier: iOS-only identifier, safe on all platforms
      categoryIdentifier: channelId,
      // android.channelId: required for correct importance on Android 8+
      android: {
        channelId,
      },
    } as any,
    trigger: null, // deliver immediately
  });
}
