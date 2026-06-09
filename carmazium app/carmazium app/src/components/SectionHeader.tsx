import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

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
}) => (
  <View style={styles.container}>
    <View style={styles.titleRow}>
      <View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {showSeeAll && onSeeAll && (
        <Text style={styles.seeAll} onPress={onSeeAll}>
          See all →
        </Text>
      )}
    </View>
  </View>
);

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
