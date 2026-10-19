import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius } from '@/constants/spacing';
import { FontFamily, Type } from '@/constants/typography';
import { appearancePalette, lightReadableText, mergeAppearanceStyles } from '../../theme/appearancePalette';
import { useAppearanceStore } from '../../store/appearanceStore';

type ChipProps = {
  children: React.ReactNode;
  /** Optional leading icon element — a node, so this atom stays independent of
   *  the icon set. */
  icon?: React.ReactNode;
  /** Brand-accented variant, for the one spec that matters on a given card. */
  accent?: boolean;
  style?: ViewStyle;
};

/**
 * Spec chip — year, mileage, fuel, body type, gearbox.
 *
 * The quiet counterpart to `Badge`: `Badge` is for status and wants attention,
 * `Chip` is for facts and should recede. Every listing surface in the app had
 * its own version of this row; this is the one.
 */
export const Chip = React.memo<ChipProps>(({ children, icon, accent = false, style }) => {
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? lightStyles : styles;
  return (
    <View style={[ts.chip, accent && ts.chipAccent, style]}>
      {icon}
      <Text style={[ts.label, accent && ts.labelAccent]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
});

Chip.displayName = 'Chip';

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.chip,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  chipAccent: {
    backgroundColor: Colors.accentAlpha08,
    borderColor: Colors.borderAccent,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: Type.micro,
    color: Colors.textSecondary,
  },
  labelAccent: {
    color: Colors.accent,
  },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light mode: the 4%-white chip and #E2E8F0 label were invisible on white cards.
const lightStyles = mergeAppearanceStyles(styles, {
  chip: { backgroundColor: LIGHT_PALETTE.elevated, borderColor: LIGHT_PALETTE.border },
  label: { color: LIGHT_PALETTE.secondary },
  labelAccent: { color: lightReadableText.accent },
});
