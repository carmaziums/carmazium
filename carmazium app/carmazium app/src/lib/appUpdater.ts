import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * In-app updates for the CarMazium Android app installed from carmazium.com.
 *
 * The app asks the website which release is current (/api/app-version, the
 * same validated release the download page offers). If it is newer, the user
 * can tap Update: the app downloads the signed APK and opens Android's
 * installer. Android only accepts it if it is signed with the same CarMazium
 * release key, and always asks the user to confirm with one Install tap —
 * apps outside Google Play cannot update silently.
 */
const VERSION_URL = 'https://www.carmazium.com/api/app-version';
const PRODUCTION_PACKAGE = 'uk.carmazium.app';

export interface AvailableUpdate {
  versionName: string;
  versionCode: number;
  url: string;
}

export function currentVersionCode(): number {
  return Number(Constants.expoConfig?.android?.versionCode ?? 0) || 0;
}

/** Only the customer build checks (not preview/test builds or iOS). */
export function canSelfUpdate(): boolean {
  return Platform.OS === 'android' && Constants.expoConfig?.android?.package === PRODUCTION_PACKAGE;
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!canSelfUpdate()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(VERSION_URL, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { android?: AvailableUpdate | null };
    const latest = body?.android;
    if (!latest || typeof latest.versionCode !== 'number' || typeof latest.url !== 'string') return null;
    // Only ever download from CarMazium's own domain.
    if (!/^https:\/\/(www\.)?carmazium\.com\/downloads\/[A-Za-z0-9._-]+\.apk$/.test(latest.url)) return null;
    return latest.versionCode > currentVersionCode() ? latest : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Downloads the update (reporting 0–1 progress) and opens the installer. */
export async function downloadAndInstall(update: AvailableUpdate, onProgress: (p: number) => void): Promise<void> {
  const target = `${FileSystem.cacheDirectory}CarMazium-update-${update.versionCode}.apk`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  const task = FileSystem.createDownloadResumable(update.url, target, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) throw new Error('The download did not finish. Please try again.');
  onProgress(1);
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
