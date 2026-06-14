import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Safe cross-platform haptics wrapper.
 * All methods are guarded with try/catch so they never throw
 * on simulators, emulators, or devices where haptics are unavailable.
 */
export const haptics = {
  light(): void {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },

  medium(): void {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },

  success(): void {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
