import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useDrawer } from '../context/DrawerContext';
import { Colors } from '../constants/colors';

interface HamburgerButtonProps {
  color?: string;
}

export const HamburgerButton: React.FC<HamburgerButtonProps> = ({
  color = Colors.white,
}) => {
  const { openDrawer } = useDrawer();

  return (
    <TouchableOpacity
      style={styles.btn}
      activeOpacity={0.7}
      onPress={openDrawer}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Three bars — full / shorter / shortest, all left-aligned */}
      <View style={[styles.bar, { backgroundColor: color, width: 18 }]} />
      <View style={[styles.bar, { backgroundColor: color, width: 13 }]} />
      <View style={[styles.bar, { backgroundColor: color, width: 9  }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    paddingLeft: 10,
  },
  bar: {
    height: 2,
    borderRadius: 2,
  },
});
