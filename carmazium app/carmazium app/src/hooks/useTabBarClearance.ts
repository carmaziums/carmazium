import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomTabBarHeight } from '../lib/nativeLayoutParity';

/**
 * Height the floating (absolutely positioned) bottom tab bar covers, plus a
 * little breathing room. Tab screens pad their scroll content by at least
 * this much so the last row isn't hidden behind the bar; the bar grows with
 * the system font size, so a fixed spacer is not enough on large text.
 */
export const useTabBarClearance = (extra = 16): number => {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return getBottomTabBarHeight(fontScale, insets.bottom) + extra;
};
