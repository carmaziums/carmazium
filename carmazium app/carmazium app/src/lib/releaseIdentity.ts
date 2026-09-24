import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { GENERATED_RELEASE_ID } from '../generated/releaseIdentity';

export interface MobileReleaseIdentity {
  releaseId: string;
  runtimeVersion: string | null;
  updateId: string | null;
  appVersion: string | null;
}

export function getMobileReleaseIdentity(): MobileReleaseIdentity {
  const releaseId =
    GENERATED_RELEASE_ID !== 'development'
      ? GENERATED_RELEASE_ID
      : (Updates.updateId || Constants.expoConfig?.version || 'development');

  return {
    releaseId,
    runtimeVersion: Updates.runtimeVersion || null,
    updateId: Updates.updateId || null,
    appVersion: Constants.expoConfig?.version || null,
  };
}
