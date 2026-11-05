import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Ionicons } from '@/components/BrandIcon';
import { useAuthStore } from '../store/authStore';
import { Colors, themeStatusBarStyle } from '../constants/colors';
import { Elevation, Radius } from '../constants/spacing';
import { Button } from './Button';
import { FontFamily, FontSize } from '../constants/typography';

/**
 * Routes a signed-out visitor can use, exactly like the public pages of
 * carmazium.com. Every other Main-stack route renders <SignInRequired />
 * instead of its screen until the visitor signs in (MainStackNavigator's
 * `screenLayout`), so a guest never lands on a screen whose API calls can only
 * fail with NO_SESSION.
 */
export const GUEST_ROUTES = new Set<string>([
  'Tabs',
  'VehicleDetail',
  'VehicleDeepLink',
  'Search',
  'Compare',
  'Services',
  'Terms',
  'PrivacyPolicy',
  'HowItWorks',
  'About',
  'Contact',
  'ReportProblem',
  'Pricing',
  'Reviews',
  'Finance',
  'SellLanding',
  'SellerProfile',
  'SellerAllListings',
]);

/** Bottom tabs a guest can use. Saved and Dashboard need an account. */
export const GUEST_TABS = new Set<string>(['Home', 'Search', 'Live']);

/**
 * Opens Login (or Signup) over the guest app and remembers where the visitor
 * was, so RootNavigator returns them there after signing in (AUTH-034 path).
 */
export function openSignIn(
  navigation: { navigate: (...args: any[]) => void },
  screen: 'Login' | 'Signup' = 'Login',
  returnTo?: { name: string; params?: object } | null,
) {
  useAuthStore.getState().setPostLoginRedirect(returnTo ?? null);
  navigation.navigate('Auth', { screen });
}

export const SignInRequired: React.FC<{
  routeName: string;
  routeParams?: object;
  title?: string;
  message?: string;
  showBack?: boolean;
}> = ({
  routeName,
  routeParams,
  title = 'Sign in to continue',
  message = 'Create a free CarMazium account or sign in to use this part of the app. Browsing cars, valuations and guides stays open to everyone.',
  showBack = true,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  // Tab screens are restored through the Tabs route; stack screens directly.
  const returnTo = { name: routeName, params: routeParams };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}>
        <View style={styles.panel}>
        <View style={styles.orb}>
          <Ionicons name="lock-closed-outline" size={30} color={Colors.accent} />
        </View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <Button
          label="Sign In"
          onPress={() => openSignIn(navigation, 'Login', returnTo)}
          variant="primary"
          size="lg"
          fullWidth
        />
        <Button
          label="Create Free Account"
          onPress={() => openSignIn(navigation, 'Signup', returnTo)}
          variant="outline"
          size="lg"
          fullWidth
          style={styles.secondaryBtn}
        />
        </View>
        {showBack && navigation.canGoBack() && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' },
  orb: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSubtle,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  panel: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 28,
    ...Elevation.cardHi,
  },
  secondaryBtn: {
    marginTop: 12,
  },
  linkBtn: { marginTop: 18, padding: 8 },
  linkText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textMuted },
});
