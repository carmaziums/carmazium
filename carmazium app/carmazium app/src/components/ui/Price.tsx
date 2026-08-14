import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontFamily, Type } from '@/constants/typography';

type PriceProps = Omit<TextProps, 'children'> & {
  value: number | string | null | undefined;
  /** Font size. Defaults to the design system's price size. */
  size?: number;
  currency?: string;
  /** Renders in the secondary text colour — for struck-through or "was" prices. */
  muted?: boolean;
  /** Shown when `value` is null/undefined. */
  fallback?: string;
};

const formatValue = (value: number | string | null | undefined, fallback: string) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('en-GB') : fallback;
  }
  return value;
};

/**
 * Big mono price.
 *
 * Prices and countdowns are mono at heavy weight throughout the CarMazium
 * brand — it's one of the few things that makes a listing card read as *this*
 * product rather than any dark-mode marketplace. The app was rendering prices
 * in the same body font as everything else.
 *
 * The design also gradient-clips this white -> slate. React Native can't
 * gradient-fill text without @react-native-masked-view, which isn't installed
 * and would require a native prebuild, so this ships the solid-colour base.
 * If the masked-view dep is ever added, the gradient goes here and every call
 * site inherits it.
 */
export const Price = React.memo<PriceProps>(
  ({ value, size = Type.h2, currency = '£', muted = false, fallback = '—', style, ...rest }) => {
    const formatted = formatValue(value, fallback);
    const isFallback = formatted === fallback;

    return (
      <Text
        {...rest}
        style={[styles.price, { fontSize: size }, muted && styles.muted, style]}
      >
        {isFallback ? formatted : `${currency}${formatted}`}
      </Text>
    );
  }
);

Price.displayName = 'Price';

const styles = StyleSheet.create({
  price: {
    fontFamily: FontFamily.monoExtraBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  muted: {
    color: Colors.textSecondary,
  },
});
