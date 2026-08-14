import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDrawer } from '../context/DrawerContext';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';
import { RootStackParamList } from '../navigation/RootNavigator';
import { MainStackParamList } from '../navigation/MainStackNavigator';
import { TabParamList } from '../navigation/TabNavigator';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

import { IconButton } from './IconButton';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  tabName?: keyof TabParamList;
  stackScreen?: keyof MainStackParamList;
  action?: 'alert';
  alertTitle?: string;
  alertMsg?: string;
}

const ITEMS: MenuItem[] = [
  { id: 'home',     label: 'Home',       icon: 'home-outline',              iconLib: 'ion', tabName: 'Home'   },
  { id: 'buy',      label: 'Buy Cars',   icon: 'car-outline',               iconLib: 'ion', tabName: 'Search' },
  { id: 'sell',     label: 'Sell Cars',  icon: 'storefront-outline',        iconLib: 'ion', stackScreen: 'MyListingDashboard' },
  { id: 'auctions', label: 'Auctions',   icon: 'gavel',                     iconLib: 'mci', tabName: 'Live'   },
  { id: 'compare',  label: 'Compare',    icon: 'git-compare-outline',       iconLib: 'ion', stackScreen: 'Compare' },
  { id: 'pricing',  label: 'Pricing',    icon: 'pricetag-outline',          iconLib: 'ion', stackScreen: 'Pricing' },
  // No mobile equivalent existed at all — not even a stub (mobile-production-
  // readiness-plan.md F14). See ReviewsScreen.tsx/FinanceScreen.tsx for why
  // these deliberately don't port web's fabricated testimonials/fake lenders.
  { id: 'reviews',  label: 'Trust & Reviews', icon: 'star-outline',         iconLib: 'ion', stackScreen: 'Reviews' },
  { id: 'finance',  label: 'Vehicle Finance', icon: 'card-outline',         iconLib: 'ion', stackScreen: 'Finance' },
  { id: 'about',    label: 'About',      icon: 'information-circle-outline', iconLib: 'ion', stackScreen: 'About' },
  { id: 'how-it-works', label: 'How It Works', icon: 'compass-outline',     iconLib: 'ion', stackScreen: 'HowItWorks' },
  { id: 'services', label: 'Services',   icon: 'construct-outline',         iconLib: 'ion', stackScreen: 'Services' },
  { id: 'contact',  label: 'Contact',    icon: 'call-outline',              iconLib: 'ion', stackScreen: 'Contact' },
  // Built but previously unreachable from anywhere in the app — no nav entry
  // existed at all (mobile-production-readiness-plan.md F13).
  { id: 'terms',    label: 'Terms of Service', icon: 'document-text-outline', iconLib: 'ion', stackScreen: 'Terms' },
];

// Web (DashboardSidebar.tsx) treats BUYER and SELLER as the same unified
// entity — same 9-tab dashboard, same "Buyer/Seller Account" label. Mobile
// previously hid this whole group from buyers. This is now shown to both
// roles so buyers can reach their own sent offers, watchlist, earnings-if-any
// etc. — every entry here is backed by a role-agnostic screen that fetches
// by the current user's id (SellerListingsScreen shows the caller's listings
// whether that's zero or many, SellerOffersScreen shows incoming offers on
// the caller's listings, etc.).
const USER_ITEMS: MenuItem[] = [
  {
    id: 'user-dashboard',
    label: 'Dashboard',
    icon: 'speedometer-outline',
    iconLib: 'ion',
    stackScreen: 'SellerDashboard',
  },
  {
    id: 'user-listings',
    label: 'My listings',
    icon: 'car-outline',
    iconLib: 'ion',
    stackScreen: 'SellerListings',
  },
  {
    id: 'user-sent-offers',
    label: 'My sent offers',
    icon: 'send-outline',
    iconLib: 'ion',
    stackScreen: 'BuyerOffers',
  },
  {
    id: 'user-incoming-offers',
    label: 'Incoming offers',
    icon: 'pricetag-outline',
    iconLib: 'ion',
    stackScreen: 'SellerOffers',
  },
  {
    id: 'user-auctions',
    label: 'My auctions',
    icon: 'gavel',
    iconLib: 'mci',
    stackScreen: 'SellerAuctions',
  },
  // The next three screens were fully built and registered in
  // MainStackNavigator but had no drawer entry, so nothing in the app
  // navigated to them — a buyer could place bids, buy a car and request
  // delivery, then have no way back to any of it. Web exposes all three
  // (/dashboard/buyer/bids, /history, and the delivery requests view).
  {
    id: 'user-bids',
    label: 'My bids',
    icon: 'hammer-outline',
    iconLib: 'ion',
    stackScreen: 'BuyerBids',
  },
  {
    id: 'user-purchases',
    label: 'Purchase history',
    icon: 'receipt-outline',
    iconLib: 'ion',
    stackScreen: 'BuyerPurchaseHistory',
  },
  {
    id: 'user-deliveries',
    label: 'Delivery requests',
    icon: 'cube-outline',
    iconLib: 'ion',
    stackScreen: 'BuyerDeliveryRequests',
  },
  {
    id: 'user-watchlist',
    label: 'Watchlist',
    icon: 'heart-outline',
    iconLib: 'ion',
    stackScreen: 'Watchlist',
  },
  {
    id: 'user-earnings',
    label: 'Earnings',
    icon: 'wallet-outline',
    iconLib: 'ion',
    stackScreen: 'Earnings',
  },
  {
    id: 'user-performance',
    label: 'Performance analytics',
    icon: 'bar-chart-outline',
    iconLib: 'ion',
    stackScreen: 'SellerPerformance',
  },
];

const DEALER_ITEMS: MenuItem[] = [
  { 
    id: 'dealer-onboarding', 
    label: 'Dealer onboarding', 
    icon: 'trail-sign-outline', 
    iconLib: 'ion', 
    stackScreen: 'DealerOnboarding',
  },
  { 
    id: 'dealer-kyc', 
    label: 'KYC Verified identity', 
    icon: 'shield-checkmark-outline', 
    iconLib: 'ion', 
    stackScreen: 'DealerKYC',
  },
  {
    // SellerAuctionsScreen is role-agnostic (fetches /auctions/my/list) and
    // already reachable for dealers via DealerInventoryScreen's "PUT ON
    // AUCTION" button and DealerProfileScreen's "Manage auctions" row — this
    // entry used to show a "Coming Soon" alert that was stale by the time
    // those two entry points shipped (mobile-production-readiness-plan.md F17).
    id: 'dealer-auctions',
    label: 'Dealer auction manager',
    icon: 'gavel',
    iconLib: 'mci',
    stackScreen: 'SellerAuctions',
  },
  { 
    id: 'dealer-leads', 
    label: 'Dealer leads', 
    icon: 'people-outline', 
    iconLib: 'ion', 
    stackScreen: 'DealerLeads',
  },
  {
    id: 'dealer-inventory',
    label: 'Dealer inventory',
    icon: 'albums-outline',
    iconLib: 'ion',
    stackScreen: 'DealerInventory',
  },
  {
    // Same screen the buyer/seller group's "Watchlist" entry (id:
    // user-watchlist, above) already points at — the watchlist backend
    // (GET/DELETE /watchlist) and WatchlistScreen.tsx are both role-agnostic,
    // matching web's dealer wishlist page reusing the same endpoints rather
    // than introducing a separate one. Dealers previously had no entry point
    // to this screen at all.
    id: 'dealer-wishlist',
    label: 'Wishlist',
    icon: 'heart-outline',
    iconLib: 'ion',
    stackScreen: 'Watchlist',
  },
  {
    id: 'dealer-analytics',
    label: 'Dealer Analytics',
    icon: 'bar-chart-outline',
    iconLib: 'ion',
    stackScreen: 'DealerAnalytics',
  },
  {
    id: 'dealer-team',
    label: 'Team Management',
    icon: 'people-outline',
    iconLib: 'ion',
    stackScreen: 'DealerTeam',
  },
  {
    id: 'dealer-offers',
    label: 'Direct offers',
    icon: 'pricetag-outline',
    iconLib: 'ion',
    stackScreen: 'DealerOffers',
  },
  {
    id: 'dealer-my-offers',
    label: 'My offers',
    icon: 'send-outline',
    iconLib: 'ion',
    stackScreen: 'DealerMyOffers',
  },
  {
    id: 'dealer-purchases',
    label: 'Purchases',
    icon: 'receipt-outline',
    iconLib: 'ion',
    stackScreen: 'DealerPurchases',
  },
  // Earnings and Finance are both built and registered, but were the only two
  // dealer features missing from this list — reachable solely from a card on
  // DealerProfileScreen. A dealer could reach Purchases and then had no path
  // to the money side, one item further down the same menu.
  {
    id: 'dealer-earnings',
    label: 'Earnings',
    icon: 'wallet-outline',
    iconLib: 'ion',
    stackScreen: 'DealerEarnings',
  },
  {
    id: 'dealer-finance',
    label: 'Finance applications',
    icon: 'calculator-outline',
    iconLib: 'ion',
    stackScreen: 'DealerFinance',
  },
  {
    id: 'dealer-notif-settings',
    label: 'Notification settings', 
    icon: 'notifications-circle-outline', 
    iconLib: 'ion', 
    stackScreen: 'Settings',
  },
];

export const GlobalDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useDrawer();
  const user         = useAuthStore((s) => s.user);
  const logout       = useAuthStore((s) => s.logout);
  const role         = useAuthStore((s) => s.role);
  const accountRole  = useAuthStore((s) => s.accountRole);
  const setRole      = useAuthStore((s) => s.setRole);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  // Real account status, not the buyer-preview toggle (`role`) — a dealer
  // browsing with "VIEW MY PROFILE" would otherwise look like a non-dealer
  // here and get routed back through onboarding/KYC on every tap
  // (mobile-production-readiness-plan.md F38's accountRole fix, extended to
  // this file too).
  const isActualDealer = accountRole === 'dealer';
  const [switchingDealer, setSwitchingDealer] = React.useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const translateX = useSharedValue(DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withTiming(DRAWER_WIDTH, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isOpen, translateX, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // Determine which tab is active
  const getActiveTab = (): string => {
    try {
      const state = navigation.getState();
      interface NavRouteLike {
        name?: string;
        state?: { index?: number; routes?: NavRouteLike[] };
      }
      const findTab = (routes: NavRouteLike[]): string => {
        for (const r of routes) {
          if (r.name === 'Tabs' && r.state) {
            const idx = r.state.index ?? 0;
            return r.state.routes?.[idx]?.name ?? '';
          }
          if (r.state?.routes) {
            const found = findTab(r.state.routes);
            if (found) return found;
          }
        }
        return '';
      };
      return findTab(state?.routes ?? []);
    } catch {
      return '';
    }
  };

  const activeTab = getActiveTab();

  const handleItem = (item: MenuItem) => {
    closeDrawer();
    setTimeout(() => {
      if (item.action === 'alert') {
        Alert.alert(item.alertTitle!, item.alertMsg!);
        return;
      }
      if (item.stackScreen) {
        // `stackScreen` is a dynamic union of route names — React Navigation's
        // recommended pattern for variable screen names is `as never`.
        navigation.navigate('Main', { screen: item.stackScreen } as never);
        return;
      }
      if (item.tabName) {
        navigation.navigate('Main', {
          screen: 'Tabs',
          params: { screen: item.tabName },
        });
      }
    }, 160);
  };

  const handleSignOut = () => {
    closeDrawer();
    setTimeout(() => {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    }, 160);
  };

  // Always prefer the real authenticated user's data — never overwrite it with
  // demo/placeholder branding. The previous version hardcoded "Knightsbridge
  // Motors" / "dealer@knightsbridge.co.uk" for ANY dealer-role account, so
  // every real dealer saw fake identity info instead of their own name/email.
  // The role-based fallback strings below only apply while `user` is still
  // loading (e.g. right after login, before /users/me resolves).
  const realName  = user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : null;
  // Matches web's formatRole(): buyer and seller share the "Buyer/Seller Account"
  // label since they're the same unified entity across the platform.
  const userName  = realName || (role === 'dealer' ? 'Dealer Account' : role === 'seller' ? 'Buyer/Seller Account' : 'Guest');
  const userEmail = user?.email || '';
  const initial   = userName.charAt(0).toUpperCase();

  const renderIcon = (item: MenuItem, active: boolean, goldMode?: boolean, blueMode?: boolean) => {
    const color = active ? Colors.accent : goldMode ? Colors.warning : blueMode ? Colors.infoBlue : Colors.lightGrey;
    return item.iconLib === 'mci'
      ? <MaterialCommunityIcons name={item.icon} size={19} color={color} />
      : <Ionicons name={item.icon} size={19} color={color} />;
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeDrawer}
    >
      {/* Dimmed backdrop */}
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      {/* Slide-in panel */}
      <Animated.View
        style={[
          styles.panel,
          panelStyle,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* ── Close button ─────────────────────────────── */}
        <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.paleBlue_e2e2ea} />} onPress={closeDrawer} accessibilityLabel="Close" />

        {/* ── User card ────────────────────────────────── */}
        <View style={styles.userCard}>
          <View style={[styles.avatar, role === 'dealer' && styles.avatarDealer, role === 'seller' && styles.avatarSeller]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName}>{userName}</Text>
            {!!userEmail && (
              <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
            )}
          </View>
          {(user?.isAddressVerified === true) && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={18} color={role === 'dealer' ? Colors.warning : role === 'seller' ? Colors.infoBlue : Colors.success} />
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* ── Nav items ────────────────────────────────── */}
        <ScrollView
          key={`drawer-scroll-${role}`}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.groupLabel}>NAVIGATION</Text>

          {ITEMS.map((item) => {
            const active = item.tabName === activeTab;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => handleItem(item)}
                activeOpacity={0.7}
              >
                {/* Left active bar */}
                <View style={[styles.bar, active && styles.barActive]} />

                {/* Icon */}
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  {renderIcon(item, active)}
                </View>

                {/* Label */}
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                  {item.label}
                </Text>

                {/* Active pill */}
                {active && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Unified Buyer/Seller toolset — web treats BUYER and SELLER as the
              same entity with one shared dashboard, so mobile does too now.
              Dealer keeps its own dedicated DEALER CONTROLS group below. */}
          {(role === 'buyer' || role === 'seller') && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelSeller]}>MY DASHBOARD</Text>
              {USER_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.row}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bar} />
                  <View style={[styles.iconWrap, styles.iconWrapBlue]}>
                    {renderIcon(item, false, false, true)}
                  </View>
                  <Text style={styles.rowLabelSeller}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
                </TouchableOpacity>
              ))}
            </>
          )}

          {role === 'dealer' && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelDealer]}>DEALER CONTROLS</Text>
              {DEALER_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.row}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bar} />
                  <View style={[styles.iconWrap, styles.iconWrapGold]}>
                    {renderIcon(item, false, true)}
                  </View>
                  <Text style={styles.rowLabelDealer}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
                </TouchableOpacity>
              ))}
              {/* Allow dealer to browse as a regular buyer */}
              <TouchableOpacity
                style={styles.row}
                onPress={() => { closeDrawer(); setTimeout(() => setRole('buyer'), 160); }}
                activeOpacity={0.7}
              >
                <View style={styles.bar} />
                <View style={[styles.iconWrap, styles.iconWrapGold]}>
                  <Ionicons name="swap-horizontal-outline" size={19} color={Colors.warning} />
                </View>
                <Text style={styles.rowLabelDealer}>Browse as buyer</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
              </TouchableOpacity>
            </>
          )}

          {/* ── Dealer toggle — visible for all non-dealer users ── */}
          {role !== 'dealer' && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.dealerToggleCard}
                activeOpacity={0.8}
                disabled={switchingDealer}
                onPress={async () => {
                  // user?.isVerified is checked FIRST, independent of
                  // accountRole/isActualDealer — DealerProfile/KYC persist
                  // per-user forever, never reset by switching away from
                  // dealer (confirmed: backend's /users/elevate only ever
                  // touches the `role` column). Web's equivalent gate
                  // (dashboard/dealer/layout.tsx) checks isVerified alone
                  // for exactly this reason. Previously this only checked
                  // isVerified inside the isActualDealer branch, and
                  // isActualDealer used the buyer-preview-mutable `role`
                  // instead of accountRole, so a previously-verified dealer
                  // who'd switched to buyer/seller view was always sent
                  // through onboarding/KYC again on this tap
                  // (mobile-production-readiness-plan.md — KYC-forced-again
                  // finding, 2026-07-18).
                  if (user?.isVerified) {
                    if (isActualDealer) {
                      closeDrawer();
                      setTimeout(() => setRole('dealer'), 160);
                      return;
                    }
                    // Verified from a past dealer stint but the backend role
                    // isn't DEALER right now — re-elevate silently (no form,
                    // matching web) then switch the view.
                    setSwitchingDealer(true);
                    try {
                      await apiClient('/users/elevate', {
                        method: 'POST',
                        body: JSON.stringify({ newRole: 'DEALER' }),
                      });
                      await initializeAuth();
                      setRole('dealer');
                      closeDrawer();
                    } catch (err: any) {
                      Alert.alert('Could not switch to dealer mode', err?.message || 'Please try again.');
                    } finally {
                      setSwitchingDealer(false);
                    }
                    return;
                  }
                  closeDrawer();
                  setTimeout(() => {
                    if (isActualDealer) {
                      // Already elevated but not yet verified — resume at KYC (step 2).
                      navigation.navigate('Main', { screen: 'DealerKYC' } as never);
                    } else {
                      // Never a dealer at all — start at onboarding (step 1), which
                      // grants the DEALER role before KYC. Sending these users
                      // straight to DealerKYC skipped the role-elevation step entirely.
                      navigation.navigate('Main', { screen: 'DealerOnboarding' } as never);
                    }
                  }, 160);
                }}
              >
                <View style={styles.dealerToggleIcon}>
                  <Ionicons name="briefcase-outline" size={20} color={Colors.warning} />
                </View>
                <View style={styles.dealerToggleText}>
                  <Text style={styles.dealerToggleTitle}>
                    {user?.isVerified ? 'Switch to Dealer Mode' : isActualDealer ? 'Complete Verification' : 'Become a Dealer'}
                  </Text>
                  <Text style={styles.dealerToggleSub}>
                    {user?.isVerified
                      ? 'Your account is verified — tap to switch'
                      : isActualDealer
                      ? 'Complete KYC to unlock dealer features'
                      : 'Set up your dealership to unlock dealer features'}
                  </Text>
                </View>
                {switchingDealer
                  ? <ActivityIndicator size="small" color={Colors.warning} />
                  : <Ionicons name="chevron-forward" size={15} color={Colors.warning} accessibilityElementsHidden importantForAccessibility="no" />
                }
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider} />

          {/* Sign Out row */}
          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.bar} />
            <View style={[styles.iconWrap, styles.iconWrapRed]}>
              <Ionicons name="log-out-outline" size={19} color={Colors.accent} />
            </View>
            <Text style={styles.rowLabelRed}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Footer brand ─────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CARMAZIUM</Text>
          <Text style={styles.footerTagline}>Premium Automotive Marketplace</Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.blackAlpha75,
  },

  // Sliding panel
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.deepBlue_13131a,
    borderLeftWidth: 1,
    borderLeftColor: Colors.whiteAlpha08,
    shadowColor: Colors.black,
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 24,
  },

  // Close button
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: 18,
    marginBottom: 6,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha07,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarDealer: {
    backgroundColor: Colors.midOrange_b8860b,
    borderWidth: 1.5,
    borderColor: Colors.warning,
  },
  avatarSeller: {
    backgroundColor: Colors.midBlue_1d4ed8,
    borderWidth: 1.5,
    borderColor: Colors.infoBlue,
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.bold,
    color: Colors.white,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.lightGrey,
  },
  verifiedDot: {
    padding: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha09,
    marginHorizontal: 20,
    marginVertical: 8,
  },

  // Scroll container
  scroll: {
    flex: 1,
    paddingTop: 4,
  },

  // Group label
  groupLabel: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.iconMuted,
    letterSpacing: 1.6,
    marginLeft: 24,
    marginBottom: 8,
    marginTop: 4,
  },

  // Menu rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingVertical: 12,
    marginBottom: 2,
  },
  rowActive: {
    backgroundColor: Colors.accentAlpha10,
    borderRadius: 12,
    marginHorizontal: 8,
    paddingRight: 10,
  },

  // Left active indicator bar
  bar: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginRight: 12,
  },
  barActive: {
    backgroundColor: Colors.accent,
  },

  // Icon wrapper
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha07,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  iconWrapActive: {
    backgroundColor: Colors.accentAlpha15,
  },
  iconWrapRed: {
    backgroundColor: Colors.accentAlpha08,
  },
  iconWrapGold: {
    backgroundColor: Colors.warningAlpha12,
  },
  iconWrapBlue: {
    backgroundColor: Colors.infoBlueAlpha12,
  },

  // Labels
  rowLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.lightGrey,
  },
  rowLabelActive: {
    fontFamily: FontFamily.bold,
    color: Colors.accent,
  },
  rowLabelRed: {
    flex: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.accent,
  },
  rowLabelDealer: {
    flex: 1,
    fontSize: FontSize.size14,
    fontFamily: FontFamily.medium,
    color: Colors.midOrange_d4a017,
  },
  rowLabelSeller: {
    flex: 1,
    fontSize: FontSize.size14,
    fontFamily: FontFamily.medium,
    color: Colors.infoBlueLight,
  },
  groupLabelDealer: {
    color: Colors.warning,
  },
  groupLabelSeller: {
    color: Colors.infoBlue,
  },

  // Active pill badge
  activePill: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: FontSize.size8,
    fontFamily: FontFamily.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // Dealer toggle card
  dealerToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  dealerToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.warningAlpha15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dealerToggleText: {
    flex: 1,
    gap: 3,
  },
  dealerToggleTitle: {
    fontSize: FontSize.size14,
    fontFamily: FontFamily.bold,
    color: Colors.warning,
  },
  dealerToggleSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.midOrange_a0783a,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha09,
  },
  footerBrand: {
    fontSize: FontSize.size12,
    fontFamily: FontFamily.extraBold,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 2,
  },
  footerTagline: {
    fontSize: FontSize.size10,
    fontFamily: FontFamily.regular,
    color: Colors.iconMuted,
    letterSpacing: 0.2,
  },
});
