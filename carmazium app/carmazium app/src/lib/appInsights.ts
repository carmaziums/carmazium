import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { apiClient } from './apiClient';

/**
 * App install counting and customer problem reports.
 * - First open: one anonymous `app_first_open` event per installation (a
 *   random install id, never the account or a hardware id). Retried on the
 *   next launch if offline.
 * - Problem reports: POST /analytics/problem-report (guests allowed).
 */
const INSTALL_ID_KEY = 'carmazium.installId';
const FIRST_OPEN_SENT_KEY = 'carmazium.firstOpenReported';

export const appVersion = (): string =>
  String(Constants.expoConfig?.version ?? '1.0.0');

export const appPlatform = (): 'android' | 'ios' => (Platform.OS === 'ios' ? 'ios' : 'android');

export const deviceSummary = (): string =>
  [Device.manufacturer, Device.modelName, `${Platform.OS} ${Platform.Version}`].filter(Boolean).join(' · ');

const randomId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export async function reportFirstOpenOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(FIRST_OPEN_SENT_KEY)) return;
    let installId = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (!installId) {
      installId = randomId();
      await AsyncStorage.setItem(INSTALL_ID_KEY, installId);
    }
    await apiClient('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({
        type: 'app_first_open',
        payload: { platform: appPlatform(), installId, appVersion: appVersion() },
      }),
      timeoutMs: 8000,
    });
    await AsyncStorage.setItem(FIRST_OPEN_SENT_KEY, new Date().toISOString());
  } catch {
    // Offline or API unavailable: try again on the next launch.
  }
}

export type ProblemCategory =
  | 'not_working' | 'sign_in' | 'payments' | 'listings' | 'auctions' | 'messages' | 'other';

export async function submitProblemReport(input: {
  category: ProblemCategory;
  message: string;
  contactEmail?: string;
  screen?: string;
}): Promise<void> {
  await apiClient('/analytics/problem-report', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      contactEmail: input.contactEmail?.trim() || undefined,
      platform: appPlatform(),
      appVersion: appVersion(),
      device: deviceSummary(),
    }),
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────
export interface AppStats {
  installs: { android: number; androidApp: number; androidWebApp: number; ios: number; iosApp: number; iosWebApp: number; windows: number };
  installsTotal: number;
  androidAppInstalls: number;
  androidAppInstalls30d: number;
  iosAppFirstOpens: number;
  iosAppFirstOpens30d: number;
  webInstalls: Record<string, number>;
  webInstallsTotal: number;
  webInstalls30d: number;
  downloadClicks: Record<string, number>;
  downloadClicksTotal: number;
  downloadClicks30d: number;
  apkDownloads: number | null;
  problemReports: { open: number; total: number };
}

export interface ProblemReport {
  id: string;
  createdAt: string;
  payload: {
    category: ProblemCategory; message: string; contactEmail?: string | null;
    platform?: string; appVersion?: string | null; device?: string | null; screen?: string | null;
    status?: 'new' | 'resolved';
  };
  user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; role?: string } | null;
}

export const getAppStats = () => apiClient<AppStats>('/analytics/app-stats');

export const getProblemReports = (status: 'open' | 'resolved' | 'all' = 'open', page = 1) =>
  apiClient<{ reports: ProblemReport[]; total: number; pages: number }>(
    `/analytics/problem-reports?page=${page}&limit=30${status === 'all' ? '' : `&status=${status}`}`,
  );

export const setProblemReportStatus = (id: string, status: 'new' | 'resolved') =>
  apiClient(`/analytics/problem-reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

// ── Online now (admin count) ─────────────────────────────────────────────────
// In-memory id for this app session only — nothing is stored on the device.
const sessionVisitorId = randomId();

/** "Still here" ping while the app is in the foreground (about once a minute). */
export async function sendOnlineHeartbeat(_signedIn: boolean): Promise<void> {
  try {
    await apiClient('/analytics/heartbeat', {
      method: 'POST',
      // The server verifies the Authorization token supplied by apiClient.
      // It never trusts a self-reported signed-in flag.
      body: JSON.stringify({ visitorId: sessionVisitorId, surface: 'app', platform: appPlatform() }),
      timeoutMs: 8000,
    });
  } catch {
    // Best effort only.
  }
}

export interface OnlineNow {
  total: number;
  web: { total: number; signedIn: number; desktop: number; mobile: number; installed: number };
  app: { total: number; signedIn: number; android: number; ios: number };
  updatedAt: string;
}

export const getOnlineNow = () => apiClient<OnlineNow>('/analytics/online');
