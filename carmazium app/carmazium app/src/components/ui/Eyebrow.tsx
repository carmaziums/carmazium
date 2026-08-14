import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

import { Colors } from '@/constants/colors';
import { TextPresets } from '@/constants/typography';

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
export const Eyebrow = React.memo<EyebrowProps>(({ children, color, style, ...rest }) => (
  <Text {...rest} style={[styles.eyebrow, color ? { color } : null, style]}>
    {children}
  </Text>
));

Eyebrow.displayName = 'Eyebrow';

const styles = StyleSheet.create({
  eyebrow: {
    ...TextPresets.eyebrow,
    color: Colors.textMuted,
  },
});
