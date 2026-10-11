import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import { useAuthStore } from '../store/authStore';
import { HamburgerButton } from './HamburgerButton';
import { Logo } from './Logo';

/**
 * Single native counterpart of website src/components/layout/Header.tsx.
 * Reused across dealer workspace tabs rather than recreating a different
 * top-left hamburger/header on each screen. Account shortcut opens the
 * existing unified settings page; actual account role/permissions are
 * governed by authStore and backend, never changed by tapping this control.
 */
export const WebsiteTopBar: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Reserve room for a visible Menu label as well as dedicated notification
  // and account buttons, including on narrower Android screens.
  const logoWidth = Math.min(160, Math.max(80, windowWidth - 234));
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.accountRole);
  const initial = (user?.firstName?.trim()?.charAt(0)
    || user?.email?.trim()?.charAt(0)
    || (role === 'dealer' ? 'D' : 'C')).toUpperCase();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 7 }]}>
      <Logo size="sm" width={logoWidth} />
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          activeOpacity={0.75}
        >
          <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.accountButton}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          accessibilityHint="Opens profile, dealership, verification, notifications and security settings"
          activeOpacity={0.75}
        >
          <View style={styles.avatar}><Text style={styles.avatarLetter}>{initial}</Text></View>
          <Ionicons name="settings-outline" size={14} color={Colors.textSecondary} accessibilityElementsHidden />
        </TouchableOpacity>
        <HamburgerButton websiteStyle />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    minHeight: 65,
    paddingBottom: 9,
    paddingHorizontal: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notificationButton: {
    width: 44, height: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(51, 65, 85, 0.58)',
  },
  accountButton: {
    minWidth: 56, height: 48, paddingHorizontal: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(51, 65, 85, 0.58)',
  },
  avatar: {
    width: 31, height: 31, borderRadius: 16,
    backgroundColor: 'rgba(237, 28, 36, 0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: FontFamily.bold, fontSize: 15, color: Colors.accent },
});
