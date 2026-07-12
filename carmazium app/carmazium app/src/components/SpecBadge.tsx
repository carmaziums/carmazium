import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface SpecBadgeProps {
  icon: IconName;
  value: string;
  variant?: 'default' | 'accent' | 'success';
}

export const SpecBadge: React.FC<SpecBadgeProps> = ({
  icon,
  value,
  variant = 'default',
}) => {
  const iconColor =
    variant === 'accent'
      ? Colors.accent
      : variant === 'success'
      ? Colors.success
      : Colors.textMuted;

  const textColor =
    variant === 'accent'
      ? Colors.accent
      : variant === 'success'
      ? Colors.success
      : Colors.textSecondary;

  return (
    <View style={[styles.badge, variant === 'accent' && styles.badgeAccent]}>
      <Ionicons name={icon} size={11} color={iconColor} />
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  badgeAccent: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accentAlpha25,
  },
  value: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    letterSpacing: 0.2,
  },
});
