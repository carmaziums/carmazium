/**
 * Shared layout measures for narrow-screen and large-text parity.
 *
 * React Native dp is already density-independent. Allow accessible font scaling
 * without shrinking labels to illegible sizes or covering dealer More controls.
 * The drawer and tab bar must derive the SAME height.
 */
export const getBottomTabItemHeight = (fontScale: number): number =>
  fontScale >= 1.6 ? 76 : fontScale >= 1.3 ? 64 : 48;

export const getBottomTabBarHeight = (fontScale: number, bottomInset = 0): number =>
  getBottomTabItemHeight(fontScale) + 16 + Math.max(0, bottomInset);

export const useSingleColumnSettings = (width: number, fontScale: number): boolean =>
  width < 360 || fontScale >= 1.5;

export const getScrollableStageHeight = (fontScale: number): number =>
  fontScale >= 1.6 ? 82 : fontScale >= 1.3 ? 68 : 54;
