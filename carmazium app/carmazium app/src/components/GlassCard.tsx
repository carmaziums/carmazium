import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '../constants/colors';
import { useAppearanceStore } from '../store/appearanceStore';
import { mergeAppearanceStyles } from '../theme/appearancePalette';

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
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? mergeAppearanceStyles(styles, lightGlassStyles) : styles;
  return (
    <View
      style={[
        ts.wrapper,
        { borderRadius },
        hasBorder && ts.border,
        hasGlow && ts.glow,
        style,
      ]}
    >
      {/* Layer 1: Base dark fill */}
      <View style={[StyleSheet.absoluteFillObject, ts.baseFill, { borderRadius }]} />
      {/* Layer 2: Light shimmer overlay — simulates frosted glass */}
      <View style={[StyleSheet.absoluteFillObject, ts.shimmer, { borderRadius }]} />
      {/* Layer 3: Top highlight edge */}
      <View style={[ts.topHighlight, { borderRadius }]} />

      <View style={[ts.content, { padding }]}>{children}</View>
    </View>
  );
};

const lightGlassStyles = StyleSheet.create({
  border: {borderColor: '#D5E1EC'},
  baseFill: {backgroundColor: '#FFFFFF'},
  shimmer: {backgroundColor: 'rgba(255,255,255,0.02)'},
  topHighlight: {backgroundColor: '#D5E1EC'},
});

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
