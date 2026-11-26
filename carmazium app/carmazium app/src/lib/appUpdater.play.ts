import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Bundled instead of the direct-download updater by the Google Play workflow. */
export interface AvailableUpdate {
  versionName: string;
  versionCode: number;
  url: string;
}
export function currentVersionCode(): number {
  const installed = Number(Constants.nativeBuildVersion);
  return Number.isSafeInteger(installed) && installed > 0 ? installed : 0;
}
export function isGooglePlayDistribution(): boolean {
  return Platform.OS === 'android';
}
export function canSelfUpdate(): boolean { return false; }
export type UpdateCheckStatus =
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'up-to-date'; versionCode: number }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };
export async function checkForUpdateStatus(): Promise<UpdateCheckStatus> {
  return { status: 'unsupported' };
}
export async function checkForUpdate(): Promise<AvailableUpdate | null> { return null; }
export async function downloadAndInstall(_update: AvailableUpdate, _onProgress: (p: number) => void): Promise<void> {
  throw new Error('Google Play manages updates for this installation.');
}
