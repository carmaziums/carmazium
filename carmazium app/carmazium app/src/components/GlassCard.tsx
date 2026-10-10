import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '../constants/colors';
import { useNativeAppearance } from '../theme/NativeAppearanceProvider';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Kept for API compatibility — reserved for native blur in production builds */
  intensity?: number;
  borderRadius?: number;
  padding?: number;
  hasBorder?: boolean;
  hasGlow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 20,
  borderRadius = 20,
  padding = 20,
  hasBorder = true,
  hasGlow = false,
}) => {
  const { resolvedAppearance, palette } = useNativeAppearance();
  return (
    <View
      style={[
        styles.wrapper,
        { borderRadius },
        hasBorder && [styles.border, { borderColor: palette.borderDefault }],
        hasGlow && styles.glow,
        style,
      ]}
    >
      {/* Layer 1: Base dark fill */}
      <View style={[StyleSheet.absoluteFillObject, styles.baseFill, { borderRadius, backgroundColor: palette.bgCard }]} />
      {/* Layer 2: Light shimmer overlay — simulates frosted glass */}
      <View style={[StyleSheet.absoluteFillObject, styles.shimmer, { borderRadius, backgroundColor: resolvedAppearance === 'light' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.042)' }]} />
      {/* Layer 3: Top highlight edge */}
      <View style={[styles.topHighlight, { borderRadius, backgroundColor: palette.borderHover }]} />

      <View style={[styles.content, { padding }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
  },
  border: {
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  glow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  baseFill: {
    // Deep translucent dark base. Was a hardcoded rgba(18, 18, 24, 0.82) — a
    // literal copy of the pre-redesign near-black that bypassed the tokens, so
    // this surface stayed on the old palette after the palette was corrected.
    backgroundColor: Colors.bgCard,
  },
  shimmer: {
    // Subtle white tint — mimics frosted glass scatter
    backgroundColor: 'rgba(255, 255, 255, 0.042)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  content: {
    zIndex: 1,
  },
});
