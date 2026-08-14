import React from 'react';
import {
  AccessibilityProps,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius } from '@/constants/spacing';

type GlassPillProps = AccessibilityProps & {
  children: React.ReactNode;
  onPress?: () => void;
  /** Diameter. 38 is the design system's default; 34 is the header variant. */
  size?: number;
  /** Darker fill, for controls sitting on top of a photo. */
  onImage?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Circular glass control — back, share, favourite, more.
 *
 * The design system uses this for every floating control over imagery. The app
 * had a mix of bare `TouchableOpacity`s and one-off circular `View`s with
 * per-screen fills, which is why the back button looked different on half the
 * screens.
 *
 * Hit target is enforced at 44pt via `hitSlop` even at size 34, so the small
 * variant stays accessible.
 */
export const GlassPill = React.memo<GlassPillProps>(
  ({ children, onPress, size = 38, onImage = false, disabled = false, style, ...a11y }) => {
    const slop = Math.max(0, (44 - size) / 2);

    return (
      <Pressable
        {...a11y}
        accessibilityRole={a11y.accessibilityRole ?? 'button'}
        onPress={onPress}
        disabled={disabled}
        hitSlop={slop}
        style={({ pressed }) => [
          styles.pill,
          { width: size, height: size },
          onImage ? styles.onImage : styles.onSurface,
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
);

GlassPill.displayName = 'GlassPill';

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  onSurface: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.borderHi,
  },
  onImage: {
    backgroundColor: Colors.blackAlpha55,
    borderColor: Colors.whiteAlpha12,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
