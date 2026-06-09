import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '../constants/colors';

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
  return (
    <View
      style={[
        styles.wrapper,
        { borderRadius },
        hasBorder && styles.border,
        hasGlow && styles.glow,
        style,
      ]}
    >
      {/* Layer 1: Base dark fill */}
      <View style={[StyleSheet.absoluteFillObject, styles.baseFill, { borderRadius }]} />
      {/* Layer 2: Light shimmer overlay — simulates frosted glass */}
      <View style={[StyleSheet.absoluteFillObject, styles.shimmer, { borderRadius }]} />
      {/* Layer 3: Top highlight edge */}
      <View style={[styles.topHighlight, { borderRadius }]} />

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
    // Deep translucent dark base
    backgroundColor: 'rgba(18, 18, 24, 0.82)',
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
