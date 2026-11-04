import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Elevation, Radius } from '../constants/spacing';
import { useAuthStore } from '../store/authStore';
import { HamburgerButton } from './HamburgerButton';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { openSignIn } from './SignInRequired';
import { useDrawer } from '../context/DrawerContext';
import { getThemePreference, promptThemeChange, resolveThemeMode } from '../lib/themePreference';

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
  // Pages opened from somewhere (Notifications, Settings, Messages, Sell,
  // dealer Stock/Customers opened from a link) get a back arrow; bottom-tab
  // roots don't, like the website's persistent header.
  const navState = navigation.getState?.();
  const showBack = navState?.type !== 'tab' && navigation.canGoBack();
  const logoWidth = Math.min(160, Math.max(showBack ? 88 : 104, windowWidth - 249 - (showBack ? 48 : 0)));
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const role = useAuthStore(s => s.accountRole);
  const initial = (user?.firstName?.trim()?.charAt(0)
    || user?.email?.trim()?.charAt(0)
    || (role === 'dealer' ? 'D' : 'C')).toUpperCase();
  const viewRole = useAuthStore(s => s.role);
  const logout = useAuthStore(s => s.logout);
  const { setSiteMenuTop, closeDrawer } = useDrawer();
  const [accountOpen, setAccountOpen] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(0);
  const themeMode = resolveThemeMode(getThemePreference());

  // Website avatar dropdown: Signed in as · Dashboard · Account Settings ·
  // Theme · Sign Out.
  const goAccount = (fn: () => void) => { setAccountOpen(false); closeDrawer(); setTimeout(fn, 120); };
  const openDashboard = () => goAccount(() => navigation.navigate('Main', {
    screen: 'Tabs',
    params: { screen: viewRole === 'dealer' && role === 'dealer' ? 'DealerHome' : 'Profile' },
  }));
  const confirmSignOut = () => {
    setAccountOpen(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { closeDrawer(); void logout(); } },
    ]);
  };

  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + 7 }]}
      // The ☰ menu opens directly under this header, like carmazium.com.
      onLayout={(e) => {
        const bottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
        setHeaderBottom(bottom);
        setSiteMenuTop(bottom);
      }}
    >
      <View style={styles.leading}>
      {showBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
      {/* Logo goes to the marketplace homepage, as on the website. */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Main', { screen: 'Tabs', params: { screen: 'Home' } })}
        accessibilityRole="link"
        accessibilityLabel="CarMazium home"
        activeOpacity={0.8}
      >
        <Logo size="sm" width={logoWidth} />
      </TouchableOpacity>
      </View>
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
          onPress={() => setAccountOpen(v => !v)}
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          accessibilityState={{ expanded: accountOpen }}
          activeOpacity={0.75}
        >
          <View style={styles.avatar}><Text style={styles.avatarLetter}>{initial}</Text></View>
          <Ionicons name={accountOpen ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textMuted} />
        </TouchableOpacity>
        <Modal visible={accountOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAccountOpen(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAccountOpen(false)} accessibilityLabel="Close account menu" />
          <View style={[styles.dropdown, { top: headerBottom + 4 }]}>
            {/* ── User card ── */}
            <View style={styles.dropdownHead}>
              <Text style={styles.dropdownEyebrow}>SIGNED IN AS</Text>
              <Text style={styles.dropdownEmail} numberOfLines={1}>{user?.email || 'Your account'}</Text>
            </View>
            {/* Settings belongs next to the account identity, as in the
                website avatar dropdown — never buried under menu tools. */}
            <TouchableOpacity style={styles.dropdownRow} onPress={openDashboard} accessibilityRole="button">
              <Ionicons name="car-outline" size={19} color={Colors.textSecondary} />
              <Text style={styles.dropdownText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownRow}
              onPress={() => goAccount(() => navigation.navigate('Settings'))}
              accessibilityRole="button"
              accessibilityLabel="Open all account settings"
              accessibilityHint="Personal details, dealership, verification, notifications, payouts and security in one place"
            >
              <Ionicons name="person-outline" size={19} color={Colors.textSecondary} />
              <Text style={styles.dropdownText}>Account Settings</Text>
            </TouchableOpacity>
            {role === 'admin' && (
              <TouchableOpacity style={styles.dropdownRow} onPress={() => goAccount(() => navigation.navigate('Main', { screen: 'AdminDashboard' }))} accessibilityRole="button">
                <Ionicons name="shield-checkmark-outline" size={19} color={Colors.textSecondary} />
                <Text style={styles.dropdownText}>Admin Control Panel</Text>
              </TouchableOpacity>
            )}
            <View style={styles.dropdownRow}>
              <Text style={[styles.dropdownText, { marginLeft: 0 }]}>Theme</Text>
              <TouchableOpacity
                style={styles.themeChip}
                onPress={() => { setAccountOpen(false); promptThemeChange(themeMode === 'dark' ? 'light' : 'dark'); }}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`}
              >
                <Ionicons name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dropdownDivider} />
            <TouchableOpacity style={styles.dropdownRow} onPress={confirmSignOut} accessibilityRole="button">
              <Ionicons name="log-out-outline" size={19} color={Colors.accent} />
              <Text style={[styles.dropdownText, { color: Colors.accent }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Modal>
        </>)}
        <HamburgerButton websiteStyle />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dropdown: {
    position: 'absolute', right: 12, width: 260,
    backgroundColor: Colors.bgCard, borderRadius: Radius.card,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: 6,
    ...Elevation.cardHi,
  },
  dropdownHead: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownEyebrow: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 1.4, color: Colors.textMuted },
  dropdownEmail: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary, marginTop: 4 },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 16 },
  dropdownText: { flex: 1, marginLeft: 12, fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.textPrimary },
  dropdownDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  themeChip: { width: 42, height: 42, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
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
  leading: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  backButton: {
    width: 40, height: 44, marginLeft: -6,
    alignItems: 'center', justifyContent: 'center',
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
