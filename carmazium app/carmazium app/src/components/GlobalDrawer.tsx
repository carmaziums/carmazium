import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  useWindowDimensions,
  BackHandler,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDrawer } from '../context/DrawerContext';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';
import { getOrCreateSupportRoom } from '../lib/chatApi';
import { RootStackParamList } from '../navigation/RootNavigator';
import { MainStackParamList } from '../navigation/MainStackNavigator';
import { TabParamList } from '../navigation/TabNavigator';
import { Colors } from '../constants/colors';
import { getBottomTabBarHeight } from '../lib/nativeLayoutParity';
import { FontFamily, FontSize } from '../constants/typography';
import { useDealerAccess } from '../hooks/useDealerAccess';
import type { DealerPermission } from '../lib/dealerAccessApi';

import { IconButton } from './IconButton';
import { openSignIn } from './SignInRequired';
import { Radius } from '../constants/spacing';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

const IS_QA_REVIEW_BUILD = process.env.EXPO_PUBLIC_QA_READ_ONLY === '1';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  tabName?: keyof TabParamList;
  tabParams?: { initialSection: 'live' | 'bids' };
  stackScreen?: keyof MainStackParamList;
  /** Params for `stackScreen` (e.g. CreateServiceJob's serviceType). */
  stackParams?: Record<string, unknown>;
  action?: 'alert';
  alertTitle?: string;
  alertMsg?: string;
  requiredPermission?: DealerPermission;
  /**
   * Menu group heading. Public items use the website header's dropdown
   * groups (Buy Cars / Sell Cars / TradeXchange); account items use the
   * website DashboardSidebar sections, in the same order.
   */
  section?: string;
}

// Same top-level structure, wording and order as the website header
// (src/components/layout/Header.tsx NAV + its Buy/Sell/TradeXchange
// dropdowns) and footer, so the app and carmazium.com read as one product.
const ITEMS: MenuItem[] = [
  { id: 'home',     label: 'Home',       icon: 'home-outline',              iconLib: 'ion', tabName: 'Home'   },
  { id: 'buy',      section: 'Buy Cars', label: 'Retail Listings', icon: 'car-outline', iconLib: 'ion', tabName: 'Search' },
  { id: 'auctions', section: 'Buy Cars', label: 'Live Auctions',   icon: 'gavel',       iconLib: 'mci', tabName: 'Live'   },
  { id: 'sell',     section: 'Sell Cars', label: 'Get Valuation & Sell', icon: 'storefront-outline', iconLib: 'ion', stackScreen: 'SellLanding' },
  { id: 'services', section: 'TradeXchange', label: 'TradeXchange Overview', icon: 'construct-outline', iconLib: 'ion', stackScreen: 'Services' },
  { id: 'post-delivery', section: 'TradeXchange', label: 'Delivery & Recovery', icon: 'car-sport-outline', iconLib: 'ion', stackScreen: 'CreateServiceJob', stackParams: { serviceType: 'DELIVERY' } },
  { id: 'post-inspection', section: 'TradeXchange', label: 'Vehicle Inspection', icon: 'search-outline', iconLib: 'ion', stackScreen: 'CreateServiceJob', stackParams: { serviceType: 'INSPECTION' } },
  // No mobile equivalent existed at all — not even a stub (mobile-production-
  // readiness-plan.md F14). See ReviewsScreen.tsx/FinanceScreen.tsx for why
  // these deliberately don't port web's fabricated testimonials/fake lenders.
  { id: 'finance',  section: 'TradeXchange', label: 'Vehicle Finance', icon: 'card-outline', iconLib: 'ion', stackScreen: 'Finance' },
  { id: 'partner',  section: 'TradeXchange', label: 'Partner Account', icon: 'business-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'compare',  section: 'Explore', label: 'Compare',    icon: 'git-compare-outline',       iconLib: 'ion', stackScreen: 'Compare' },
  { id: 'pricing',  section: 'Explore', label: 'Pricing',    icon: 'pricetag-outline',          iconLib: 'ion', stackScreen: 'Pricing' },
  { id: 'about',    section: 'Explore', label: 'About',      icon: 'information-circle-outline', iconLib: 'ion', stackScreen: 'About' },
  { id: 'how-it-works', section: 'Explore', label: 'How It Works', icon: 'compass-outline',     iconLib: 'ion', stackScreen: 'HowItWorks' },
  { id: 'reviews',  section: 'Explore', label: 'Feedback & Reviews', icon: 'star-outline',      iconLib: 'ion', stackScreen: 'Reviews' },
  { id: 'contact',  section: 'Help & Legal', label: 'Contact',    icon: 'call-outline',          iconLib: 'ion', stackScreen: 'Contact' },
  // Built but previously unreachable from anywhere in the app — no nav entry
  // existed at all (mobile-production-readiness-plan.md F13).
  { id: 'terms',    section: 'Help & Legal', label: 'Terms & Conditions', icon: 'document-text-outline', iconLib: 'ion', stackScreen: 'Terms' },
  { id: 'privacy',  section: 'Help & Legal', label: 'Privacy Policy', icon: 'shield-checkmark-outline', iconLib: 'ion', stackScreen: 'PrivacyPolicy' },
];

/** Website header groups shown before "More pages & information". */
const PRIMARY_PUBLIC_SECTIONS = new Set([undefined, 'Buy Cars', 'Sell Cars', 'TradeXchange']);

// Website provider sidebar (DashboardSidebar.tsx `provider` links).
const PROVIDER_ITEMS: MenuItem[] = [
  { id: 'provider-home', section: 'Business', label: 'Partner Home', icon: 'business-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'provider-overview', section: 'Services', label: 'Service Overview', icon: 'grid-outline', iconLib: 'ion', stackScreen: 'ProviderCapabilities' },
  { id: 'provider-jobs', section: 'Services', label: 'Available Jobs', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'ProviderJobs' },
  { id: 'provider-leads', section: 'Services', label: 'Finance & Warranty Enquiries', icon: 'clipboard-outline', iconLib: 'ion', stackScreen: 'ProviderLeads' },
  { id: 'provider-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'ProviderMessages' },
];

// The website's dealer mobile navigation has four primary destinations
// (Home, Stock, Customers, Buy & Bid), with More for secondary functions.
// Match that first-run information hierarchy instead of showing a public
// Buy/Sell/Explore menu in the dealer workspace.
const DEALER_PRIMARY_ITEMS: MenuItem[] = [
  { id: 'dealer-home-tab', label: 'Home', icon: 'grid-outline', iconLib: 'ion', tabName: 'DealerHome' },
  { id: 'dealer-stock-tab', label: 'Stock', icon: 'car-outline', iconLib: 'ion', tabName: 'DealerStock', requiredPermission: 'VIEW_INVENTORY' },
  { id: 'dealer-customers-tab', label: 'Customers', icon: 'people-outline', iconLib: 'ion', tabName: 'DealerCustomers', requiredPermission: 'MANAGE_CRM' },
  { id: 'dealer-auctions-tab', label: 'Live Auctions', icon: 'gavel', iconLib: 'mci', tabName: 'DealerBuyBid', tabParams: { initialSection: 'live' }, requiredPermission: 'VIEW_TRADE' },
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
  // Same sections, labels and order as the website DashboardSidebar
  // `unifiedLinks` (Dashboard › Selling › Buying › Services › Account).
  // "My Bids" and "Delivery Requests" are app extras with no separate web
  // sidebar entry; they stay because buyers otherwise lose their way back.
  { id: 'user-dashboard', section: 'Dashboard', label: 'Home', icon: 'speedometer-outline', iconLib: 'ion', tabName: 'Profile' },
  { id: 'user-cars', section: 'Selling', label: 'My Cars', icon: 'car-outline', iconLib: 'ion', stackScreen: 'MyCars' },
  { id: 'user-incoming-offers', section: 'Selling', label: 'Offers Received', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'SellerOffers' },
  { id: 'user-earnings', section: 'Selling', label: 'Sales & Earnings', icon: 'wallet-outline', iconLib: 'ion', stackScreen: 'Earnings' },
  { id: 'user-performance', section: 'Selling', label: 'Listing Performance', icon: 'bar-chart-outline', iconLib: 'ion', stackScreen: 'SellerPerformance' },
  { id: 'user-sent-offers', section: 'Buying', label: 'My Offers', icon: 'send-outline', iconLib: 'ion', stackScreen: 'BuyerOffers' },
  { id: 'user-bids', section: 'Buying', label: 'My Bids', icon: 'hammer-outline', iconLib: 'ion', stackScreen: 'BuyerBids' },
  // Points at the Saved tab, not the deleted WatchlistScreen (BUY-021).
  { id: 'user-watchlist', section: 'Buying', label: 'Saved Cars', icon: 'heart-outline', iconLib: 'ion', tabName: 'Saved' },
  { id: 'user-purchases', section: 'Buying', label: 'Purchases', icon: 'receipt-outline', iconLib: 'ion', stackScreen: 'BuyerPurchaseHistory' },
  { id: 'user-service-jobs', section: 'Services', label: 'Delivery & Inspections', icon: 'construct-outline', iconLib: 'ion', stackScreen: 'CustomerServiceJobs' },
  { id: 'user-deliveries', section: 'Services', label: 'Delivery Requests', icon: 'cube-outline', iconLib: 'ion', stackScreen: 'BuyerDeliveryRequests' },
  { id: 'user-cancellations', section: 'Account', label: 'Sale Cancellations', icon: 'close-circle-outline', iconLib: 'ion', stackScreen: 'SaleCancellations' },
  { id: 'user-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'user-settings', section: 'Account', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
];

// Grouped Sell, Buy, Business: the same groups and order as the website
// dealer sidebar (src/config/dealerRouteConfig.ts DEALER_SECTION_ORDER).
// Permissions are still filtered before the menu is rendered, so reordering
// never grants staff additional access.
const DEALER_ITEMS: MenuItem[] = [
  { id: 'dealer-inventory', section: 'Sell', label: 'Stock', icon: 'albums-outline', iconLib: 'ion', requiredPermission: 'VIEW_INVENTORY', stackScreen: 'DealerInventory' },
  { id: 'dealer-leads', section: 'Sell', label: 'Customers', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_CRM', stackScreen: 'DealerLeads' },
  { id: 'dealer-offers', section: 'Sell', label: 'Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerOffers' },
  { id: 'dealer-auctions', section: 'Sell', label: 'My Auctions', icon: 'gavel', iconLib: 'mci', requiredPermission: 'MANAGE_INVENTORY', stackScreen: 'SellerAuctions' },
  { id: 'dealer-live', section: 'Buy', label: 'Live Auctions', icon: 'flame-outline', iconLib: 'ion', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'live' } },
  { id: 'dealer-wishlist', section: 'Buy', label: 'Saved', icon: 'heart-outline', iconLib: 'ion', tabName: 'Saved' },
  { id: 'dealer-bids', section: 'Buy', label: 'Bids & Offers', icon: 'receipt-outline', iconLib: 'ion', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'bids' } },
  { id: 'dealer-offers-only', section: 'Buy', label: 'Bids & Offers', icon: 'send-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerMyOffers' },
  { id: 'dealer-purchases', section: 'Buy', label: 'Purchases', icon: 'receipt-outline', iconLib: 'ion', requiredPermission: 'VIEW_PURCHASES', stackScreen: 'DealerPurchases' },
  { id: 'dealer-messages', section: 'Business', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'dealer-team', section: 'Business', label: 'Team', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_TEAM', stackScreen: 'DealerTeam' },
  { id: 'dealer-analytics', section: 'Business', label: 'Analytics', icon: 'bar-chart-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerAnalytics' },
  { id: 'dealer-earnings', section: 'Business', label: 'Earnings', icon: 'wallet-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerEarnings' },
  { id: 'dealer-finance', section: 'Business', label: 'Finance Applications', icon: 'calculator-outline', iconLib: 'ion', stackScreen: 'DealerFinance' },
  { id: 'dealer-kyc', section: 'Business', label: 'Business verification', icon: 'shield-checkmark-outline', iconLib: 'ion', requiredPermission: 'MANAGE_KYC', stackScreen: 'DealerKYC' },
  { id: 'dealer-onboarding', section: 'Business', label: 'Dealer onboarding', icon: 'trail-sign-outline', iconLib: 'ion', requiredPermission: 'MANAGE_KYC', stackScreen: 'DealerOnboarding' },
  { id: 'dealer-settings', section: 'Business', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings', stackParams: { section: 'business' } },
  // Website dealer "Services" group (dealerRouteConfig.ts).
  { id: 'dealer-partner', section: 'Services', label: 'Partner Account', icon: 'business-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'dealer-service-addons', section: 'Services', label: 'Service Add-ons', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'ProviderCapabilities' },
  { id: 'dealer-service-jobs', section: 'Services', label: 'Service Jobs', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'ProviderJobs' },
  { id: 'dealer-service-leads', section: 'Services', label: 'Service Enquiries', icon: 'clipboard-outline', iconLib: 'ion', stackScreen: 'ProviderLeads' },
];

export const GlobalDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useDrawer();
  const user         = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = !isAuthenticated;
  const logout       = useAuthStore((s) => s.logout);
  const [supportLoading, setSupportLoading] = useState(false);
  const [showMorePages, setShowMorePages] = useState(false);
  const [showAllDealerTools, setShowAllDealerTools] = useState(false);

  const handleContactSupport = async () => {
    if (supportLoading) return;
    setSupportLoading(true);
    try {
      const room = await getOrCreateSupportRoom();
      closeDrawer();
      navigation.navigate('Main', { screen: 'ChatScreen', params: { threadId: room.id } });
    } catch (err: any) {
      Alert.alert('Could not open support', err?.message || 'Please try again in a moment.');
    } finally {
      setSupportLoading(false);
    }
  };
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
  const dealerMode = isActualDealer && role === 'dealer';
  const isDealerStaff = !!user?.isDealerStaff;
  const {
    loading: dealerAccessLoading,
    hasPermission: hasDealerPermission,
  } = useDealerAccess(isActualDealer || isDealerStaff);
  const visibleDealerItems = DEALER_ITEMS.filter(
    (item) =>
      // The main dealer tabs already provide Stock/Customers; don't bury
      // duplicate entries in More while hiding account-level actions.
      (!dealerMode || !['dealer-inventory', 'dealer-leads'].includes(item.id))
      && (item.id !== 'dealer-offers-only' || !hasDealerPermission('VIEW_TRADE'))
      && (!item.requiredPermission
        || (!dealerAccessLoading && hasDealerPermission(item.requiredPermission))),
  );
  const visiblePrimaryDealerItems = DEALER_PRIMARY_ITEMS.filter(
    item => !item.requiredPermission
      || (!dealerAccessLoading && hasDealerPermission(item.requiredPermission)),
  );
  const primaryDrawerItems = dealerMode
    ? (showMorePages ? [...visiblePrimaryDealerItems, ...ITEMS] : visiblePrimaryDealerItems)
    : ITEMS.filter(item => showMorePages || PRIMARY_PUBLIC_SECTIONS.has(item.section));
  // Service providers (CONTRACTOR accounts) get the website provider sidebar.
  const isProvider = accountRole === 'contractor';
  const [switchingDealer, setSwitchingDealer] = React.useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // Website DashboardSidebar opens More above the bottom tabs, across the
  // screen width. Only dealer workspace uses that presentation; preserve
  // established consumer drawer navigation and deep-link behaviour.
  // Web drawer max-height is 68vh and sits just above its fixed bottom tabs.
  const dealerTabBarHeight = getBottomTabBarHeight(fontScale, insets.bottom);
  const sheetHeight = Math.min(720, Math.round(windowHeight * 0.68));
  const navigation = useNavigation<NavProp>();

  const translateX = useSharedValue(DRAWER_WIDTH);
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      if (dealerMode) {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
      }
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withTiming(DRAWER_WIDTH, { duration: 200 });
      translateY.value = withTiming(sheetHeight, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isOpen, dealerMode, sheetHeight, translateX, translateY, backdropOpacity]);

  // Dealer overlay is inline so the original bottom tab bar stays visible and
  // tappable. A Modal would intercept taps on More even with transparent pixels.
  useEffect(() => {
    if (!dealerMode || !isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => subscription.remove();
  }, [dealerMode, isOpen, closeDrawer]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: dealerMode
      ? [{ translateY: translateY.value }]
      : [{ translateX: translateX.value }],
  }));

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
        navigation.navigate('Main', { screen: item.stackScreen, params: item.stackParams } as never);
        return;
      }
      if (item.tabName === 'DealerBuyBid') {
        navigation.navigate('Main', { screen: 'Tabs',
          params: { screen: 'DealerBuyBid', params: item.tabParams } });
      } else if (item.tabName) {
        navigation.navigate('Main', { screen: 'Tabs', params: { screen: item.tabName } } as never);
      }
    }, 160);
  };

  // This is a local share sheet only. No issue report, screenshot, account
  // identity or device data is transmitted automatically by CarMazium.
  // The user decides whether and where to share the review notes.
  const handleShareQaFeedback = () => {
    closeDrawer();
    const sourceSha = process.env.EXPO_PUBLIC_QA_COMMIT_SHA || 'unknown';
    setTimeout(() => {
      void Share.share({
        title: 'CarMazium QA interface feedback',
        message: [
          'CarMazium QA — website/app comparison',
          'Build source: ' + sourceSha,
          'Platform: ' + Platform.OS + ' ' + String(Platform.Version),
          'Screen or journey:',
          'What differs from carmazium.com:',
          'What I expected:',
          'Steps to reproduce:',
          '',
          'Please attach a screenshot or screen recording separately.',
          'Do not include real customer information, passwords or payment data.',
        ].join('\n'),
      }).catch(() => Alert.alert('Cannot open share sheet', 'You can describe the issue with a screenshot directly in ChatGPT.'));
    }, 220);
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

  const drawerContent = (
    <>
      {/* Keep the dealer tab bar above the backdrop, like the website. */}
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View
          style={[
            styles.backdrop,
            dealerMode && { bottom: dealerTabBarHeight },
            backdropStyle,
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Dealer website uses a full-width bottom More panel; consumer
          navigation keeps the existing right drawer. Both retain all links. */}
      <Animated.View
        style={[
          styles.panel,
          dealerMode ? styles.dealerBottomSheet : styles.sidePanel,
          panelStyle,
          dealerMode
            ? { height: sheetHeight, bottom: dealerTabBarHeight, paddingTop: 10, paddingBottom: 10 }
            : { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {dealerMode && <View style={styles.sheetHandle} accessibilityElementsHidden />}
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
          {(user?.isAddressVerified === true && user?.isVerified === true) && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={18} color={role === 'dealer' ? Colors.warning : role === 'seller' ? Colors.infoBlue : Colors.success} />
            </View>
          )}
        </View>

        {/* Settings belongs next to the account identity, not underneath
            dozens of buyer/dealer tools at the very bottom of this drawer. */}
        {isGuest && (
          <View style={styles.accountShortcuts}>
            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              onPress={() => { closeDrawer(); setTimeout(() => openSignIn(navigation, 'Login'), 160); }}
              accessibilityRole="button"
            >
              <Text style={styles.guestPrimaryText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              onPress={() => { closeDrawer(); setTimeout(() => openSignIn(navigation, 'Signup'), 160); }}
              accessibilityRole="button"
            >
              <Text style={styles.guestSecondaryText}>Create Free Account</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isGuest && <View style={styles.accountShortcuts}>
          <TouchableOpacity
            style={styles.accountShortcut}
            onPress={() => handleItem({ id: 'account-settings', label: 'Account settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open all account settings"
            accessibilityHint="Personal details, dealership, verification, notifications, payouts and security in one place"
          >
            <Ionicons name="settings-outline" size={20} color={Colors.accent} />
            <Text style={styles.accountShortcutText}>Account settings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          {IS_QA_REVIEW_BUILD && (
            <TouchableOpacity
              style={styles.accountShortcut}
              onPress={handleShareQaFeedback}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Share QA screenshot and interface feedback"
              accessibilityHint="Opens the device share sheet with a build-specific feedback template. No information is sent automatically."
            >
              <Ionicons name="share-social-outline" size={20} color={Colors.accent} />
              <Text style={styles.accountShortcutText}>Share QA feedback</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>}

        <View style={styles.divider} />

        {/* ── Nav items ────────────────────────────────── */}
        <ScrollView
          key={`drawer-scroll-${role}`}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.groupLabel}>{dealerMode ? 'DEALER WORKSPACE' : 'BUY, SELL & EXPLORE'}</Text>

          {primaryDrawerItems.map((item, index, shown) => {
            const active = item.tabName === activeTab;
            return (
              <React.Fragment key={item.id}>
              {item.section && item.section !== shown[index - 1]?.section && (
                <Text style={styles.dealerSectionLabel} accessibilityRole="header">{item.section.toUpperCase()}</Text>
              )}
              <TouchableOpacity
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
              </React.Fragment>
            );
          })}
          <TouchableOpacity
            style={styles.moreToggle}
            onPress={() => setShowMorePages(v => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMorePages }}
            activeOpacity={0.8}
          >
            <Text style={styles.moreToggleText}>{showMorePages ? 'Fewer pages' : dealerMode ? 'Marketplace & information' : 'More pages & information'}</Text>
            <Ionicons name={showMorePages ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Unified Buyer/Seller toolset — web treats BUYER and SELLER as the
              same entity with one shared dashboard, so mobile does too now.
              Dealer keeps its own dedicated DEALER CONTROLS group below. */}
          {!isGuest && (role === 'buyer' || role === 'seller') && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelSeller]}>{isProvider ? 'PARTNER DASHBOARD' : 'MY DASHBOARD'}</Text>
              {(isProvider ? PROVIDER_ITEMS : USER_ITEMS).map((item, index, shown) => (
                <React.Fragment key={item.id}>
                {item.section && item.section !== shown[index - 1]?.section && (
                  <Text style={styles.dealerSectionLabel} accessibilityRole="header">{item.section.toUpperCase()}</Text>
                )}
                <TouchableOpacity
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
                </React.Fragment>
              ))}
            </>
          )}

          {(role === 'dealer' || isActualDealer || isDealerStaff) && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelDealer]}>DEALER CONTROLS</Text>
              {visibleDealerItems.slice(0, showAllDealerTools ? visibleDealerItems.length : 6).map((item, index, shown) => (
                <React.Fragment key={item.id}>
                {item.section && item.section !== shown[index - 1]?.section && (
                  <Text style={styles.dealerSectionLabel} accessibilityRole="header">{item.section.toUpperCase()}</Text>
                )}
                <TouchableOpacity
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
                </React.Fragment>
              ))}
              {visibleDealerItems.length > 6 && (
                <TouchableOpacity style={styles.moreToggle} onPress={() => setShowAllDealerTools(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: showAllDealerTools }} activeOpacity={0.8}>
                  <Text style={styles.moreToggleText}>{showAllDealerTools ? 'Fewer dealer tools' : 'All dealer tools'}</Text>
                  <Ionicons name={showAllDealerTools ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              {/* Preserve dealer access even in buyer preview. */}
              {role === 'dealer' && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => { closeDrawer(); setTimeout(() => setRole('buyer'), 160); }}
                activeOpacity={0.7}
              >
                <View style={styles.bar} />
                <View style={[styles.iconWrap, styles.iconWrapGold]}>
                  <Ionicons name="swap-horizontal-outline" size={19} color={Colors.warning} />
                </View>
                <Text style={styles.rowLabelDealer}>Preview buyer dashboard</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
              </TouchableOpacity>
              )}
            </>
          )}

          {/* ── Dealer toggle — visible for all non-dealer users ── */}
          {!isGuest && role !== 'dealer' && (accountRole === 'buyer' || accountRole === 'seller' || isActualDealer) && (
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
          {/* Contact Support (DASH-024). Web has had this in its sidebar for
              every role; mobile had no in-app route to support at all. Opens
              the support chat room rather than an email client, matching web
              and keeping the conversation in the product. */}
          {!isGuest && <TouchableOpacity style={styles.row} onPress={handleContactSupport} activeOpacity={0.7} disabled={supportLoading}>
            <View style={styles.bar} />
            <View style={styles.iconWrap}>
              {supportLoading
                ? <ActivityIndicator size="small" color={Colors.accent} />
                : <Ionicons name="help-buoy-outline" size={19} color={Colors.accent} />}
            </View>
            <Text style={styles.rowLabel}>Contact Support</Text>
          </TouchableOpacity>}

          {/* Sign Out row */}
          {!isGuest && <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.bar} />
            <View style={[styles.iconWrap, styles.iconWrapRed]}>
              <Ionicons name="log-out-outline" size={19} color={Colors.accent} />
            </View>
            <Text style={styles.rowLabelRed}>Sign Out</Text>
          </TouchableOpacity>}
        </ScrollView>

        {/* ── Footer brand ─────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CARMAZIUM</Text>
          <Text style={styles.footerTagline}>Auction FREE · Retail £1</Text>
        </View>
      </Animated.View>
    </>
  );

  return dealerMode ? (
    <View
      style={styles.dealerOverlay}
      pointerEvents={isOpen ? 'box-none' : 'none'}
    >
      {drawerContent}
    </View>
  ) : (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeDrawer}
    >
      {drawerContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  guestPrimaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  guestSecondaryBtn: {
    marginTop: 8,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestSecondaryText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  // Dealer overlay belongs to the same RN view hierarchy as the tabs, so
  // touches on those existing tabs are not swallowed by another window.
  dealerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.blackAlpha75,
  },

  // Sliding panel
  panel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#243047',
    shadowColor: Colors.black,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 24,
  },
  sidePanel: {
    top: 0,
    width: DRAWER_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: Colors.whiteAlpha08,
    shadowOffset: { width: -6, height: 0 },
  },
  dealerBottomSheet: {
    left: 0,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -6 },
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: Colors.textMuted,
    marginBottom: 2,
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

  // Always-visible, prominent shortcut for unified settings and QA review.
  accountShortcuts: { paddingHorizontal: 14, paddingVertical: 2 },
  accountShortcut: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48,
    paddingHorizontal: 12, gap: 10, borderRadius: 12,
  },
  accountShortcutText: {
    flex: 1, color: Colors.white, fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha09,
    marginHorizontal: 20,
    marginVertical: 8,
  },

  // Scroll container
  moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginHorizontal: 12, marginVertical: 6, paddingHorizontal: 14, backgroundColor: Colors.bgSecondary, borderColor: Colors.borderSubtle, borderWidth: 1, borderRadius: 12 },
  moreToggleText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
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
    paddingVertical: 9,
    minHeight: 52,
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
  dealerSectionLabel: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
    marginLeft: 24,
    marginTop: 10,
    marginBottom: 4,
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
