import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/spacing';
import { FontFamily, FontSize, TextPresets, Type } from '../../constants/typography';

interface EmptyStateProps {
  /** Icon name from the BrandIcon Ionicons map (e.g. 'car-outline', 'bookmark') */
  icon: string;
  title: string;
  subtitle?: string;
  /** Uppercase tracked label above the title. Use it to name the surface the
   *  user is looking at ("WATCHLIST", "NO RESULTS") so the state reads as
   *  intentional rather than as a failure. */
  eyebrow?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  /**
   * Accent treatment — red-tinted orb, glow, and a filled CTA.
   *
   * Use it when the empty state is an *invitation* (an empty watchlist, no
   * bids yet) and the CTA is the thing you want tapped. Leave it off when the
   * state is merely informational (a filter returned nothing), so the two
   * don't compete.
   */
  accent?: boolean;
}

/**
 * Empty state.
 *
 * `CONTEXT.md` §8 logged that several list screens showed an icon and a line of
 * text with no way forward — a dead end at exactly the moment the user needed
 * direction. This component always supported a CTA; the screens simply never
 * passed one, so the fix is at the call sites as much as here.
 *
 * Styling follows the design kit's `screens-empty-states.jsx`: an icon orb, an
 * optional eyebrow, a headline, a constrained body line, and one CTA.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  eyebrow,
  ctaLabel,
  onCtaPress,
  accent = false,
}) => {
  const showCta = !!ctaLabel && !!onCtaPress;

  return (
    <View style={styles.container}>
      <View style={[styles.iconOrb, accent && styles.iconOrbAccent]}>
        <Ionicons
          name={icon}
          size={26}
          color={accent ? Colors.accent : Colors.textMuted}
        />
      </View>

      {eyebrow ? (
        <Text style={[styles.eyebrow, accent && styles.eyebrowAccent]}>{eyebrow}</Text>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {showCta ? (
        <TouchableOpacity
          style={[styles.cta, accent ? styles.ctaAccent : styles.ctaQuiet]}
          onPress={onCtaPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaLabel, !accent && styles.ctaLabelQuiet]}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  // 64pt orb per the kit — the previous 96pt circle with a 48pt glyph dominated
  // the screen and made an ordinary empty list feel like an error page.
  iconOrb: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconOrbAccent: {
    backgroundColor: Colors.accentAlpha12,
    borderColor: Colors.accentAlpha25,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
  },
  eyebrow: {
    ...TextPresets.eyebrow,
    fontSize: Type.nano,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  eyebrowAccent: {
    color: Colors.accent,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size17,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    lineHeight: FontSize.size12 * 1.6,
    color: Colors.textMuted,
    textAlign: 'center',
    // Caps the measure so the body stays a readable two or three lines rather
    // than one long ribbon on a wide phone.
    maxWidth: 260,
    marginBottom: 20,
  },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: Radius.inline,
  },
  ctaAccent: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  ctaQuiet: {
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.borderHi,
  },
  ctaLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ctaLabelQuiet: {
    color: Colors.textSecondary,
  },
});

export default EmptyState;
