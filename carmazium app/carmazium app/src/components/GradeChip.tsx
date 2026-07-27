import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, FontSize } from '../constants/typography';

// Grade is auto-computed server-side from DamageRecord count on every
// POST /damage/:listingId/save — never seller-set. Mapping mirrors web
// exactly. 1 = Excellent ... 5 = Below Average.
const GRADE_CFG: Record<number, { color: string; label: string }> = {
  1: { color: '#10b981', label: 'Excellent' },     // emerald
  2: { color: '#84cc16', label: 'Great' },         // lime
  3: { color: '#f59e0b', label: 'Good' },          // amber
  4: { color: '#f97316', label: 'Average' },       // orange
  5: { color: '#ef4444', label: 'Below Average' }, // red
};

interface GradeChipProps {
  grade: number | null | undefined;
  /** 'chip' = compact "Grade N" dot pill for cards. 'pill' = full "Grade N — Label" for detail-page headers. */
  variant?: 'chip' | 'pill';
}

// Hidden entirely when grade is null — no fallback, no "ungraded" state.
export const GradeChip: React.FC<GradeChipProps> = ({ grade, variant = 'chip' }) => {
  if (grade == null || !GRADE_CFG[grade]) return null;
  const cfg = GRADE_CFG[grade];

  if (variant === 'pill') {
    return (
      <View style={[styles.pill, { borderColor: `${cfg.color}55`, backgroundColor: `${cfg.color}1A` }]}>
        <View style={[styles.dot, { backgroundColor: cfg.color }]} />
        <Text style={[styles.pillText, { color: cfg.color }]}>Grade {grade} — {cfg.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chip, { borderColor: `${cfg.color}55`, backgroundColor: `${cfg.color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.chipText, { color: cfg.color }]}>Grade {grade}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    letterSpacing: 0.2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
