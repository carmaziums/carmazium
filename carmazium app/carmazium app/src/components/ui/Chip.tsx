import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius } from '@/constants/spacing';
import { FontFamily, Type } from '@/constants/typography';

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
export const Chip = React.memo<ChipProps>(({ children, icon, accent = false, style }) => (
  <View style={[styles.chip, accent && styles.chipAccent, style]}>
    {icon}
    <Text style={[styles.label, accent && styles.labelAccent]} numberOfLines={1}>
      {children}
    </Text>
  </View>
));

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
