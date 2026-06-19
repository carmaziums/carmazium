import { createNavigationContainerRef } from '@react-navigation/native';

// Module-level ref — safe to use from any component, including those
// that sit outside any screen (e.g. GlobalAIChatBot, GlobalDrawer).
export const navigationRef = createNavigationContainerRef<any>();

export function getCurrentRouteName(): string {
  try {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute()?.name ?? '';
    }
  } catch {
    // Navigation not ready yet
  }
  return '';
}
