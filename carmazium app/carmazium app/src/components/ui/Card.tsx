import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Elevation, Radius } from '@/constants/spacing';

export type CardVariant =
  /** Default translucent glass surface. Use for content on a photographic or
   *  gradient ground. */
  | 'glass'
  /** Opaque surface. Use where a translucent card would sit on another card, or
   *  over a scrolling list where see-through reads as a rendering bug. */
  | 'solid'
  /** No fill, border only. For grouping without adding visual weight. */
  | 'outline';

type CardProps = ViewProps & {
  variant?: CardVariant;
  /** Raises the card. Off by default — elevation should mark hierarchy, not be
   *  sprayed on every surface. */
  elevated?: boolean;
  /** Brand-accented border, for the selected/active card in a set. */
  active?: boolean;
  /** Clip children to the radius. Needed when the card contains a full-bleed
   *  image; costs a layer, so it's opt-in. */
  clip?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
};

/**
 * The card surface.
 *
 * There is one card in this app and this is it. Before this, `VehicleCard`,
 * `LiveBidCard` and `GlassCard` each hardcoded `rgba(18, 18, 24, 0.8x)` — a
 * literal copy of the pre-redesign near-black that bypassed the design tokens
 * entirely, so the single most-rendered surface in the product stayed on the
 * old palette after the palette was corrected. Everything else rolled its own
 * radius and border per screen.
 *
 * Two notes on the RN translation of the design:
 *
 * - The design calls for `backdrop-filter: blur()`. That needs `expo-blur`,
 *   which isn't installed and would require a native prebuild to add, so
 *   `glass` is a translucent fill without the blur. It reads close on a dark
 *   ground. If `expo-blur` is ever added, wrap this one component and every
 *   call site inherits real glass.
 * - Elevation ships iOS `shadow*` and Android `elevation` together — see
 *   `Elevation` in constants/spacing. Using one without the other is how the
 *   app previously had no card shadow on either platform.
 */
export const Card = React.memo<CardProps>(
  ({
    variant = 'glass',
    elevated = false,
    active = false,
    clip = false,
    padded = false,
    style,
    children,
    ...rest
  }) => {
    const surface = [
      styles.base,
      variantStyles[variant],
      padded && styles.padded,
      clip && styles.clip,
      active && styles.active,
    ];

    // iOS clips a view's shadow to its own `overflow: 'hidden'`, so a card that
    // both clips its content and casts a shadow silently loses the shadow. The
    // trap is easy to hit (any card with a full-bleed image needs clipping) and
    // invisible without a device, so it's handled here once.
    //
    // Split ONLY on iOS. Android's `elevation` is not clipped by overflow, so
    // the single-view path is already correct there — and Android draws no
    // elevation shadow behind a transparent background, so wrapping it would
    // trade an iOS bug for an Android one.
    //
    // On the split path the wrapper owns the fill and the shadow, and the inner
    // view owns the border, radius and clipping with no fill of its own —
    // otherwise a translucent `glass` card would paint its fill twice and come
    // out at double opacity.
    if (elevated && clip && Platform.OS === 'ios') {
      return (
        <View
          {...rest}
          style={[styles.shadowHost, variantStyles[variant], Elevation.card, style]}
        >
          <View style={[styles.base, styles.clip, styles.transparent, padded && styles.padded, active && styles.active]}>
            {children}
          </View>
        </View>
      );
    }

    return (
      <View {...rest} style={[surface, elevated && Elevation.card, style]}>
        {children}
      </View>
    );
  }
);

Card.displayName = 'Card';

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  /** Carries the shadow when the surface itself has to clip. Matches the
   *  surface radius so the shadow follows the card's real silhouette. */
  shadowHost: {
    borderRadius: Radius.card,
  },
  /** Used on the split path only — the wrapper already painted the fill. */
  transparent: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  padded: {
    padding: 16,
  },
  clip: {
    overflow: 'hidden',
  },
  active: {
    borderColor: Colors.borderAccent,
  },
});

const variantStyles = StyleSheet.create({
  glass: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
  },
  solid: {
    backgroundColor: Colors.bgCardSolid,
    borderColor: Colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
});
