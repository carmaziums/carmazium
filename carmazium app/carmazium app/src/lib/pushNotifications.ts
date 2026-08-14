/**
 * pushNotifications.ts
 * Registers the device for Expo push notifications and persists the token
 * to the backend so the server can send targeted pushes.
 *
 * Usage:
 *   import { registerForPushNotifications } from './pushNotifications';
 *   // Call once after the user is authenticated:
 *   await registerForPushNotifications(userId);
 */

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from './apiClient';
import { Colors } from '../constants/colors';

// How local notifications are presented while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission, obtain the Expo push token, and POST it to the backend.
 * Safe to call multiple times — no-ops if already registered.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulators cannot receive push notifications
    return null;
  }

  // Android needs an explicit notification channel
  if (Platform.OS === 'android') {
    // Channel IDs MUST match what the backend sends as `channelId`
    // (notifications.service.ts getChannelId): carmazium-default,
    // carmazium-bids, carmazium-messages. These were previously registered as
    // 'default'/'auctions'/'offers', so every push the backend sent named a
    // channel that didn't exist on the device — on Android 8+ a notification
    // with an unregistered channel is unreliable at best. Renaming here rather
    // than in the backend: the backend is shared with web and in production,
    // and the device side is the one that was wrong.
    await Notifications.setNotificationChannelAsync('carmazium-default', {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.accent,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('carmazium-bids', {
      name: 'Auction & bid alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.accent,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('carmazium-messages', {
      name: 'Messages & offers',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.accent,
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;

    // Persist the token where the sender actually looks for it.
    //
    // This used to POST /users/push-token, which does not exist on the backend
    // — so the call 404'd, the token was never stored, and no push could ever
    // be delivered. There is no need for a dedicated route: the sender reads
    // `user.preferences.expoPushToken` (notifications.service.ts), preferences
    // is a JSON column, and PATCH /users/me already shallow-merges into it —
    // so writing just this key preserves the user's notification settings
    // sitting alongside it.
    //
    // Routed through apiClient (not raw fetch) so it stays in sync with any
    // future change to how apiClient attaches/refreshes auth (mobile-audit.md
    // P7). Failure is non-fatal — re-registration happens on next launch.
    await apiClient('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ preferences: { expoPushToken: token } }),
    }).catch(() => {});

    return token;
  } catch {
    return null;
  }
}

/**
 * Add listeners in App.tsx root to handle taps on notifications.
 * Returns a cleanup function.
 */
export function addNotificationListeners(
  onNotification: (n: Notifications.Notification) => void,
  onResponse: (r: Notifications.NotificationResponse) => void
): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(onNotification);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
