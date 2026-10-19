import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

import { Colors } from '@/constants/colors';
import { TextPresets } from '@/constants/typography';
import { appearancePalette, themedColor } from '../../theme/appearancePalette';
import { useAppearanceStore } from '../../store/appearanceStore';

type EyebrowProps = TextProps & {
  children: React.ReactNode;
  /** Defaults to muted. Pass `Colors.accent` for the brand-accented variant. */
  color?: string;
};

/**
 * Uppercase tracked label — the design system's signature label treatment,
 * used above section headers, on card meta rows, and inside chips.
 *
 * The app previously had no such role: every small label was just "some small
 * text at whatever size the screen author picked", which is a large part of
 * why the UI read as untyped. Anything that would otherwise be a 9-10px
 * all-caps label should be this.
 */
export const Eyebrow = React.memo<EyebrowProps>(({ children, color, style, ...rest }) => {
  const mode = useAppearanceStore(state => state.mode);
  // Callers pass dark-palette colours (e.g. Colors.accent); translate them so
  // the label stays readable on light surfaces. Identity in dark mode.
  return (
    <Text {...rest} style={[mode === 'light' ? lightStyles.eyebrow : styles.eyebrow, color ? { color: themedColor(mode, color) } : null, style]}>
      {children}
    </Text>
  );
});

Eyebrow.displayName = 'Eyebrow';

const styles = StyleSheet.create({
  eyebrow: {
    ...TextPresets.eyebrow,
    color: Colors.textMuted,
  },
});

const LIGHT_PALETTE = appearancePalette('light');
const lightStyles = StyleSheet.create({ eyebrow: { ...TextPresets.eyebrow, color: LIGHT_PALETTE.muted } });
