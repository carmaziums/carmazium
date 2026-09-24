import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export interface MobileReleaseIdentity {
  releaseId: string;
  runtimeVersion: string | null;
  updateId: string | null;
  appVersion: string | null;
}

export function getMobileReleaseIdentity(): MobileReleaseIdentity {
  const releaseId =
    process.env.EXPO_PUBLIC_RELEASE_ID ||
    Updates.updateId ||
    Constants.expoConfig?.version ||
    'unknown';

  return {
    releaseId,
    runtimeVersion: Updates.runtimeVersion || null,
    updateId: Updates.updateId || null,
    appVersion: Constants.expoConfig?.version || null,
  };
}
