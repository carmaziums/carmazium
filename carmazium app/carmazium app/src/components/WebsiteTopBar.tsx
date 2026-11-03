import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Radius } from '../constants/spacing';
import { useAuthStore } from '../store/authStore';
import { HamburgerButton } from './HamburgerButton';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { openSignIn } from './SignInRequired';

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
  // Web Header.tsx renders a ~160px logo on mobile. Keep that footprint
  // except where a narrow device needs room for the theme toggle plus three
  // 44dp action targets.
  const logoWidth = Math.min(160, Math.max(104, windowWidth - 249));
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const role = useAuthStore(s => s.accountRole);
  const initial = (user?.firstName?.trim()?.charAt(0)
    || user?.email?.trim()?.charAt(0)
    || (role === 'dealer' ? 'D' : 'C')).toUpperCase();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 7 }]}>
      <Logo size="sm" width={logoWidth} />
      <View style={styles.actions}>
        <ThemeToggle />
        {/* Signed-out visitors see Login, like the website header's
            Sign Up / Login, instead of a bell and an account avatar. */}
        {!isAuthenticated ? (
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => openSignIn(navigation, 'Login')}
            accessibilityRole="button"
            accessibilityLabel="Log in or create an account"
            activeOpacity={0.8}
          >
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>
        ) : (<>
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
          accessibilityLabel="Account settings"
          accessibilityHint="Opens profile, dealership, verification, notifications and security settings"
          activeOpacity={0.75}
        >
          <View style={styles.avatar}><Text style={styles.avatarLetter}>{initial}</Text></View>
          <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
        </TouchableOpacity>
        </>)}
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
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notificationButton: {
    width: 44, height: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
  loginButton: {
    height: 44, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
  },
  loginText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.onAccent },
  accountButton: {
    minWidth: 65, height: 44, paddingHorizontal: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
  avatar: {
    width: 31, height: 31, borderRadius: 16,
    backgroundColor: Colors.accentAlpha14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: FontFamily.bold, fontSize: 15, color: Colors.accent },
});
