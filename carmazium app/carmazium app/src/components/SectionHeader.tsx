import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { lightReadableText, appearancePalette, mergeAppearanceStyles } from '../theme/appearancePalette';
import { useAppearanceStore } from '../store/appearanceStore';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  showSeeAll?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  onSeeAll,
  showSeeAll = true,
}) => {
  const mode = useAppearanceStore(state => state.mode);
  const ts = mode === 'light' ? lightStyles : styles;
  return (
    <View style={ts.container}>
      <View style={ts.titleRow}>
        <View>
          {subtitle && <Text style={ts.subtitle}>{subtitle}</Text>}
          <Text style={ts.title}>{title}</Text>
        </View>
        {showSeeAll && onSeeAll && (
          <Text style={ts.seeAll} onPress={onSeeAll} accessibilityRole="link">
            See all →
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
});

const LIGHT_PALETTE = appearancePalette('light');
const lightStyles = mergeAppearanceStyles(styles, {
  subtitle: { color: lightReadableText.accent },
  title: { color: LIGHT_PALETTE.text },
  seeAll: { color: LIGHT_PALETTE.secondary },
});
