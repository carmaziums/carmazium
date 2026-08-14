import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Ionicons } from '@/components/BrandIcon';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

const LOCKED_FEATURES = [
  'List Vehicles',
  'Manage Inventory',
  'Run Auctions',
  'Bulk Import',
  'Analytics',
  'Offer Management',
];

/**
 * Gates dealer feature screens behind KYC verification.
 *
 * Web hard-gates every /dashboard/dealer/* route in its layout
 * (dashboard/dealer/layout.tsx); mobile registered every Dealer* screen bare,
 * so a user with role === 'dealer' who had never completed KYC could reach the
 * full dealer suite from the drawer, a deep link or a notification tap.
 *
 * Two things this deliberately gets right, either of which would otherwise
 * lock out legitimate users:
 *
 * 1. Staff members pass. Someone who works for a verified dealership has no
 *    dealerProfile of their own, so their own `isVerified` is false. Gating on
 *    that alone would bar every employee of every verified dealer. Web uses
 *    `dealerProfile.isVerified || isStaffMember` and so does this.
 * 2. There is always a way out. The wall offers Start KYC and a route back to
 *    the buyer side, so a user who reaches it by mistake — including through a
 *    field misread — is inconvenienced rather than trapped.
 *
 * Scope note: this wraps the dealer FEATURE screens, not DealerKYC /
 * DealerOnboarding (which are how a user becomes verified) and not the
 * dealer profile tab. Web gates its dealer overview too, but on mobile that
 * screen is a bottom-tab destination and also the entry point to KYC, so
 * walling it risks stranding the user in their own profile tab. The
 * security-meaningful part — no access to inventory, offers, leads, team,
 * earnings, finance, purchases or analytics — is fully enforced.
 */
export const DealerGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isVerified = useAuthStore((s) => s.user?.isVerified);
  const isDealerStaff = useAuthStore((s) => s.user?.isDealerStaff);

  if (isVerified || isDealerStaff) return <>{children}</>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockOrb}>
          <Ionicons name="lock-closed-outline" size={34} color={Colors.warning} />
        </View>

        <Text style={styles.title}>Dealer Features Locked</Text>
        <Text style={styles.blurb}>
          Complete KYC verification to unlock your dealer dashboard and start
          listing vehicles, managing inventory, and accessing auction tools.
        </Text>
        <Text style={styles.eta}>Verification typically takes less than 24 hours</Text>

        <View style={styles.featureGrid}>
          {LOCKED_FEATURES.map((f) => (
            <View key={f} style={styles.featureChip}>
              <Ionicons name="lock-closed-outline" size={11} color={Colors.warning} />
              <Text style={styles.featureText} numberOfLines={1}>{f}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('DealerKYC')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Start KYC verification</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Tabs')}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Changed your mind? Go back to browsing</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

/** Wraps a screen component in the gate — used at navigator registration so
 *  every entry path (drawer, deep link, notification tap) is covered, not just
 *  the ones that go through a menu. */
export const withDealerGate = <P extends object>(Screen: React.ComponentType<P>) => {
  const Gated: React.FC<P> = (props) => (
    <DealerGate>
      <Screen {...props} />
    </DealerGate>
  );
  Gated.displayName = `withDealerGate(${Screen.displayName || Screen.name || 'Screen'})`;
  return Gated;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  lockOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  blurb: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 8,
  },
  eta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 28,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.inline,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.65,
  },
  featureText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size11_5,
    color: Colors.textMuted,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 18,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  secondaryText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
