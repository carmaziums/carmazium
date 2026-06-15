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
import { getAccessToken } from './supabase';

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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://carmazium-hjoh9w.fly.dev';

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
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC1F26',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('auctions', {
      name: 'Auction alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC1F26',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('offers', {
      name: 'Offer updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC1F26',
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

    // Persist token to backend
    const accessToken = await getAccessToken();
    await fetch(`${API_URL}/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ userId, token, platform: Platform.OS }),
    }).catch(() => {
      // Non-fatal — token will be registered on next launch
    });

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
