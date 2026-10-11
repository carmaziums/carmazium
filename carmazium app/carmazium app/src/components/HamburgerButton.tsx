import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useDrawer } from '../context/DrawerContext';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import { Ionicons } from '@/components/BrandIcon';

interface HamburgerButtonProps {
  color?: string;
  /** Show an explicit, familiar Menu entry point in the shared top bar. */
  websiteStyle?: boolean;
}

export const HamburgerButton: React.FC<HamburgerButtonProps> = ({
  color = Colors.white,
  websiteStyle = false,
}) => {
  const { isOpen, openDrawer } = useDrawer();

  return (
    <TouchableOpacity
      style={[styles.btn, websiteStyle && styles.websiteButton]}
      activeOpacity={0.7}
      onPress={openDrawer}
      disabled={isOpen}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={websiteStyle ? 'Menu' : 'Open navigation menu'}
      accessibilityHint="Opens the CarMazium navigation menu"
      accessibilityState={websiteStyle ? { expanded: isOpen } : undefined}
      accessible
    >
      {websiteStyle ? (
        <>
          <Ionicons name="menu" size={22} color={color} accessibilityElementsHidden />
          <Text style={styles.websiteLabel} maxFontSizeMultiplier={2}>Menu</Text>
        </>
      ) : (
        <>
          {/* Preserve the existing non-header button for legacy screens. */}
          <View style={[styles.bar, { backgroundColor: color, width: 18 }]} />
          <View style={[styles.bar, { backgroundColor: color, width: 13 }]} />
          <View style={[styles.bar, { backgroundColor: color, width: 9 }]} />
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    paddingLeft: 10,
  },
  websiteButton: {
    minWidth: 90,
    minHeight: 48,
    flexDirection: 'row',
    backgroundColor: Colors.whiteAlpha06,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 7,
    paddingLeft: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  websiteLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.white,
  },
  bar: {
    height: 2,
    borderRadius: 2,
  },
});
