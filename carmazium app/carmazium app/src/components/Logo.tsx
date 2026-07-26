import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

// Real brand asset from the web app (public/assets/images/logo.png) — the
// mobile app previously rendered a hand-approximated "red circle + CAR/MAZIUM"
// glyph that didn't match the real logo's stylized C-cutout mark. Using the
// actual PNG here keeps mobile and web visually identical.
// Source dimensions: 370 x 82 (aspect ratio ≈ 4.51:1).
const LOGO_ASPECT = 370 / 82;
const LOGO_SOURCE = require('../../assets/images/logo.png');

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', style }) => {
  // Widths chosen to preserve the visual footprint of the old hand-drawn
  // component at each preset (which was circleSize + gap + text width).
  const width = size === 'sm' ? 120 : size === 'lg' ? 260 : 180;
  const height = width / LOGO_ASPECT;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={LOGO_SOURCE}
        style={{ width, height }}
        contentFit="contain"
        accessibilityLabel="Carmazium"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
