import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useDrawer } from '../context/DrawerContext';
import { Colors } from '../constants/colors';
import { Ionicons } from '@/components/BrandIcon';

interface HamburgerButtonProps {
  color?: string;
  /** Match the website's 28px menu/close icon without the pill background. */
  websiteStyle?: boolean;
  showLabel?: boolean;
}

export const HamburgerButton: React.FC<HamburgerButtonProps> = ({
  color = Colors.white,
  websiteStyle = false,
  showLabel = false,
}) => {
  const { isOpen, openDrawer, closeDrawer } = useDrawer();

  return (
    <TouchableOpacity
      style={[styles.btn, websiteStyle && styles.websiteButton, showLabel && styles.labelledMenu]}
      activeOpacity={0.7}
      onPress={websiteStyle && isOpen ? closeDrawer : openDrawer}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={websiteStyle && isOpen ? "Close navigation menu" : "Open navigation menu"}
      accessibilityHint={websiteStyle ? "Opens or closes the CarMazium menu" : "Opens the CarMazium navigation drawer"}
      accessibilityState={websiteStyle ? { expanded: isOpen } : undefined}
      accessible
    >
      {websiteStyle ? (
        <>
          <Ionicons name={isOpen ? 'close' : 'menu'} size={24} color={color} />
          {showLabel && <Text style={styles.menuText}>{isOpen ? 'Close' : 'Menu'}</Text>}
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
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingLeft: 0,
    alignItems: 'center',
  },
  labelledMenu: { width: 78, minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: 'rgba(51,65,85,0.58)' },
  menuText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  bar: {
    height: 2,
    borderRadius: 2,
  },
});
