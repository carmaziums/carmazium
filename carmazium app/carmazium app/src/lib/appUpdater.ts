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

export function isGooglePlayDistribution(): boolean { return false; }

export interface AvailableUpdate {
  versionName: string;
  versionCode: number;
  url: string;
}

export function currentVersionCode(): number {
  // Expo's published JS manifest can differ from the installed APK after an
  // OTA update or ownership migration. Android's native versionCode is what
  // the package installer actually compares for in-place upgrades.
  const installed = Number(Constants.nativeBuildVersion);
  if (Number.isSafeInteger(installed) && installed > 0) return installed;
  const configured = Number(Constants.expoConfig?.android?.versionCode);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 0;
}

export function isTrustedAndroidUpdate(value: unknown): value is AvailableUpdate {
  if (!value || typeof value !== 'object') return false;
  const update = value as Partial<AvailableUpdate>;
  if (!Number.isSafeInteger(update.versionCode) || !update.versionCode ||
      update.versionCode <= 0 || update.versionCode > 2147483647 ||
      typeof update.versionName !== 'string' ||
      !/^\d+\.\d+\.\d+$/.test(update.versionName) ||
      typeof update.url !== 'string') return false;

  // The public /api/app-version derives the version and URL from an approved
  // first-party APK filename. Reject an API response with mismatched numbers
  // before opening Android's installer.
  const match = /^https:\/\/(?:www\.)?carmazium\.com\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]*-(\d+\.\d+\.\d+)-v(\d+)\.apk$/.exec(update.url);
  return !!match && match[1] === update.versionName && Number(match[2]) === update.versionCode;
}

/** Only the customer build checks (not preview/test builds or iOS). */
export function canSelfUpdate(): boolean {
  if (Platform.OS !== 'android') return false;
  // On signed APKs the native platform manifest is more authoritative than a
  // potentially stale Expo JS manifest; never offer a customer APK to a
  // differently identified app.
  const nativePackage = Constants.platform?.android?.package;
  if (nativePackage && nativePackage !== PRODUCTION_PACKAGE) return false;
  return (nativePackage || Constants.expoConfig?.android?.package) === PRODUCTION_PACKAGE;
}

export type UpdateCheckStatus =
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'up-to-date'; versionCode: number }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

/**
 * Returns a visible result for Settings and a retryable error for the launch
 * checker. The previous null-only API concealed offline and invalid responses
 * for six hours, making a failed check indistinguishable from up to date.
 */
export async function checkForUpdateStatus(): Promise<UpdateCheckStatus> {
  if (!canSelfUpdate()) return { status: 'unsupported' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(VERSION_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return { status: 'error', message: 'Could not contact CarMazium updates. Please try again.' };
    const body = (await res.json()) as { android?: AvailableUpdate | null };
    if (!isTrustedAndroidUpdate(body?.android)) {
      return { status: 'error', message: 'The latest Android release details could not be verified.' };
    }
    if (body.android.versionCode > currentVersionCode()) {
      return { status: 'available', update: body.android };
    }
    return { status: 'up-to-date', versionCode: currentVersionCode() };
  } catch {
    return { status: 'error', message: 'Could not check for updates. Check your connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

/** Compatibility wrapper for consumers that only need an available APK. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const result = await checkForUpdateStatus();
  return result.status === 'available' ? result.update : null;
}

/** Downloads the update (reporting 0–1 progress) and opens the installer. */
export async function downloadAndInstall(update: AvailableUpdate, onProgress: (p: number) => void): Promise<void> {
  if (!canSelfUpdate() || !isTrustedAndroidUpdate(update) || update.versionCode <= currentVersionCode()) {
    throw new Error('This update is not a newer approved CarMazium Android release.');
  }
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
