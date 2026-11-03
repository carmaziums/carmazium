import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { themeMode } from '../constants/colors';

// Real brand asset from the web app (public/assets/images/logo.png) — the
// mobile app previously rendered a hand-approximated "red circle + CAR/MAZIUM"
// glyph that didn't match the real logo's stylized C-cutout mark. Using the
// actual PNG here keeps mobile and web visually identical.
// Source dimensions: 370 x 82 (aspect ratio ≈ 4.51:1).
// logo.png has white "CAR" lettering for dark grounds; logo-light.png
// (1068 x 234) has charcoal lettering, matching the website header's
// logo-light.webp in light mode.
const LOGO_SOURCE = require('../../assets/images/logo.png');
const LOGO_LIGHT_SOURCE = require('../../assets/images/logo-light.png');
const LOGO_DARK = { source: LOGO_SOURCE, aspect: 370 / 82 };
const LOGO_LIGHT = { source: LOGO_LIGHT_SOURCE, aspect: 1068 / 234 };

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  /** Optional exact rendered width for tight site-matched mobile headers. */
  width?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', style, width: overrideWidth }) => {
  // Widths chosen to preserve the visual footprint of the old hand-drawn
  // component at each preset (which was circleSize + gap + text width).
  const width = overrideWidth ?? (size === 'sm' ? 120 : size === 'lg' ? 260 : 180);
  const logo = themeMode === 'dark' ? LOGO_DARK : LOGO_LIGHT;
  const height = width / logo.aspect;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={logo.source}
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
