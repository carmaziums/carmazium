import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors, themeMode } from '../constants/colors';
import { Radius } from '../constants/spacing';
import { promptThemeChange } from '../lib/themePreference';

/**
 * Native counterpart of website src/components/ui/ThemeToggle.tsx: a sun in
 * dark mode, a moon in light mode, flipping to the other explicit theme.
 * The palette is fixed for the life of the JS bundle, so the switch confirms
 * and then reloads (see lib/themePreference.ts).
 */
export const ThemeToggle: React.FC = () => {
  const isDark = themeMode === 'dark';
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => promptThemeChange(isDark ? 'light' : 'dark')}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      activeOpacity={0.75}
    >
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={Colors.textPrimary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 44,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
});
