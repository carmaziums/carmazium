import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from '@/lib/api/client';
import { ENDPOINTS } from '@/constants/api';

/**
 * Registers the device for Expo push notifications and saves the token to the backend.
 * Must only be called after a successful user session is established.
 * Returns the Expo push token, or null on simulator / permission denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Guard: Expo push token hangs indefinitely on iOS Simulator
  if (!Device.isDevice) {
    console.log('[Push] Skipping token registration — not a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // Requires extra.eas.projectId in app.json — set via `eas build:configure`
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  if (!projectId || projectId === 'REPLACE_WITH_REAL_PROJECT_ID_FROM_EAS_DASHBOARD') {
    console.error('[Push] EAS projectId not configured in app.json — run eas build:configure');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;
  console.log('[Push] Token:', token);

  // PATCH /users/me — shallow-merges preferences (preferences merge fixed in Plan 01-02)
  try {
    await apiRequest(ENDPOINTS.USERS_ME, {
      method: 'PATCH' as any,
      body: { preferences: { expoPushToken: token } },
    });
    console.log('[Push] Token saved to backend');
  } catch (err) {
    console.error('[Push] Failed to save token to backend', err);
  }

  return token;
}
