/**
 * Native introduction is acknowledged on this installation independently
 * of the website tour. A user who completed the website tour should still
 * receive the Android tour once on their first native sign-in.
 */
export const NATIVE_GUIDED_TOUR_VERSION = 3;
export const nativeGuidedTourKey = (userId: string) =>
  `carmazium:native-guided-tour:v${NATIVE_GUIDED_TOUR_VERSION}:${userId}`;

export function shouldAutoRunNativeTour(saved: string | null): boolean {
  return saved !== 'skipped' && saved !== 'completed';
}
