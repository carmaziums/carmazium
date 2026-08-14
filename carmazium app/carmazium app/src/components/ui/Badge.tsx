import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { Radius } from '@/constants/spacing';
import { FontFamily, Type } from '@/constants/typography';

export type BadgeKind =
  | 'live'
  | 'featured'
  | 'premium'
  | 'standard'
  | 'verified'
  | 'neutral'
  | 'dark';

type BadgeProps = {
  kind?: BadgeKind;
  children: React.ReactNode;
  /** Optional leading icon element. Kept as a node so this atom doesn't depend
   *  on the icon set. */
  icon?: React.ReactNode;
  style?: ViewStyle;
};

const PULSE_MS = 700;

/** The pulsing white dot on a LIVE badge. Opacity-only, so it runs on the UI
 *  thread and costs nothing on the JS thread even with many badges on screen. */
const LiveDot = () => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: PULSE_MS }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.liveDot, animatedStyle]} />;
};

/**
 * Status badge — live / featured / premium / standard / verified / neutral.
 *
 * Replaces the per-screen badge styles that had accumulated across the app
 * (each listing surface had its own slightly different "FEATURED" pill). The
 * variants and their colours come from the design system's mobile kit.
 */
export const Badge = React.memo<BadgeProps>(({ kind = 'neutral', children, icon, style }) => (
  <View style={[styles.base, variantContainer[kind], style]}>
    {kind === 'live' && <LiveDot />}
    {icon}
    <Text style={[styles.label, variantLabel[kind]]} numberOfLines={1}>
      {children}
    </Text>
  </View>
));

Badge.displayName = 'Badge';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FontFamily.extraBold,
    fontSize: Type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
  },
});

const variantContainer = StyleSheet.create({
  live: {
    backgroundColor: Colors.accent,
    // The red glow is the point of this badge; iOS-only, Android can't tint
    // elevation so it falls back to a flat red pill.
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  featured: {
    backgroundColor: Colors.warningLight,
  },
  premium: {
    backgroundColor: Colors.warningAlpha15,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
  },
  standard: {
    backgroundColor: Colors.infoBlueAlpha15,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha30,
  },
  verified: {
    backgroundColor: Colors.successAlpha15,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha30,
  },
  neutral: {
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dark: {
    backgroundColor: Colors.blackAlpha55,
    borderWidth: 1,
    borderColor: Colors.borderHi,
  },
});

const variantLabel = StyleSheet.create({
  live: { color: Colors.white },
  // Amber is a light fill — needs dark text to stay legible.
  featured: { color: Colors.bgBody },
  premium: { color: Colors.warningLight },
  standard: { color: Colors.infoLight },
  verified: { color: Colors.successLight },
  neutral: { color: Colors.textSecondary },
  dark: { color: Colors.white },
});
