import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { getOrCreateSupportRoom } from '../lib/chatApi';
import { RootStackParamList } from '../navigation/RootNavigator';
import { MainStackParamList } from '../navigation/MainStackNavigator';
import { TabParamList } from '../navigation/TabNavigator';
import { Colors } from '../constants/colors';
import { getBottomTabBarHeight } from '../lib/nativeLayoutParity';
import { FontFamily, FontSize } from '../constants/typography';
import { useDealerAccess } from '../hooks/useDealerAccess';
import { getThemePreference, promptThemeChange, resolveThemeMode } from '../lib/themePreference';
import type { FilterTab as DealerStockStatus } from '../screens/main/DealerInventoryScreen';
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
  /** Params for a tab screen, e.g. DealerStock's status filter. */
  tabStackParams?: Record<string, unknown>;
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

// ─── Website main menu (src/components/layout/Header.tsx mobile menu) ───────
// Same items, wording and order: Home, Buy Cars ▾, Sell Cars ▾, Get Valuation,
// TradeXchange ▾, Compare, Pricing, About. A group expands in place, exactly
// like the website accordion.
interface NavGroup { id: string; label: string; item?: MenuItem; children?: MenuItem[] }
const SITE_NAV: NavGroup[] = [
  { id: 'home', label: 'Home', item: { id: 'home', label: 'Home', icon: 'home-outline', iconLib: 'ion', tabName: 'Home' } },
  { id: 'buy', label: 'Buy Cars', children: [
    { id: 'buy-retail', label: 'Retail Listings', icon: 'car-outline', iconLib: 'ion', tabName: 'Search' },
    { id: 'buy-auctions', label: 'Live Auctions', icon: 'gavel', iconLib: 'mci', tabName: 'Live' },
  ] },
  { id: 'sell', label: 'Sell Cars', children: [
    { id: 'sell-retail', label: 'Retail Listing', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'SellCarFlow', stackParams: { listingType: 'CLASSIFIED' } },
    { id: 'sell-auction', label: 'Auction Listing', icon: 'gavel', iconLib: 'mci', stackScreen: 'SellCarFlow', stackParams: { listingType: 'AUCTION' } },
  ] },
  { id: 'valuation', label: 'Get Valuation', item: { id: 'valuation', label: 'Get Valuation', icon: 'calculator-outline', iconLib: 'ion', stackScreen: 'SellLanding' } },
  { id: 'trade', label: 'TradeXchange', children: [
    { id: 'tx-overview', label: 'TradeXchange Overview', icon: 'grid-outline', iconLib: 'ion', stackScreen: 'Services' },
    { id: 'tx-auctions', label: 'Vehicle Auctions', icon: 'gavel', iconLib: 'mci', stackScreen: 'HowItWorks' },
    { id: 'tx-delivery', label: 'Delivery & Recovery', icon: 'car-sport-outline', iconLib: 'ion', stackScreen: 'CreateServiceJob', stackParams: { serviceType: 'DELIVERY' } },
    { id: 'tx-inspection', label: 'Vehicle Inspection', icon: 'search-outline', iconLib: 'ion', stackScreen: 'CreateServiceJob', stackParams: { serviceType: 'INSPECTION' } },
    { id: 'tx-finance', label: 'Vehicle Finance', icon: 'card-outline', iconLib: 'ion', stackScreen: 'Finance' },
  ] },
  { id: 'compare', label: 'Compare', item: { id: 'compare', label: 'Compare', icon: 'git-compare-outline', iconLib: 'ion', stackScreen: 'Compare' } },
  { id: 'pricing', label: 'Pricing', item: { id: 'pricing', label: 'Pricing', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'Pricing' } },
  { id: 'about', label: 'About', item: { id: 'about', label: 'About', icon: 'information-circle-outline', iconLib: 'ion', stackScreen: 'About' } },
];

// Website footer links — one small line instead of a second menu.
const FOOTER_LINKS: MenuItem[] = [
  { id: 'f-how', label: 'How It Works', icon: '', iconLib: 'ion', stackScreen: 'HowItWorks' },
  { id: 'f-reviews', label: 'Reviews', icon: '', iconLib: 'ion', stackScreen: 'Reviews' },
  { id: 'f-contact', label: 'Contact', icon: '', iconLib: 'ion', stackScreen: 'Contact' },
  { id: 'f-terms', label: 'Terms', icon: '', iconLib: 'ion', stackScreen: 'Terms' },
  { id: 'f-privacy', label: 'Privacy', icon: '', iconLib: 'ion', stackScreen: 'PrivacyPolicy' },
];

// Website provider sidebar (DashboardSidebar.tsx `provider` links).
const PROVIDER_ITEMS: MenuItem[] = [
  { id: 'provider-home', section: 'Business', label: 'Partner Home', icon: 'business-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'provider-overview', section: 'Services', label: 'Service Overview', icon: 'grid-outline', iconLib: 'ion', stackScreen: 'ProviderCapabilities' },
  { id: 'provider-jobs', section: 'Services', label: 'Available Jobs', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'ProviderJobs' },
  { id: 'provider-leads', section: 'Services', label: 'Finance & Warranty Enquiries', icon: 'clipboard-outline', iconLib: 'ion', stackScreen: 'ProviderLeads' },
  { id: 'provider-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'ProviderMessages' },
  { id: 'provider-settings', section: 'Account', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
];

// Website DashboardSidebar `unifiedLinks` — buyer and seller share one
// dashboard. Same sections, labels and order.
const USER_ITEMS: MenuItem[] = [
  { id: 'user-dashboard', section: 'Dashboard', label: 'Home', icon: 'grid-outline', iconLib: 'ion', tabName: 'Profile' },
  { id: 'user-cars', section: 'Selling', label: 'My Cars', icon: 'car-outline', iconLib: 'ion', stackScreen: 'MyCars' },
  { id: 'user-incoming-offers', section: 'Selling', label: 'Offers Received', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'SellerOffers' },
  { id: 'user-earnings', section: 'Selling', label: 'Sales & Earnings', icon: 'wallet-outline', iconLib: 'ion', stackScreen: 'Earnings' },
  { id: 'user-performance', section: 'Selling', label: 'Listing Performance', icon: 'bar-chart-outline', iconLib: 'ion', stackScreen: 'SellerPerformance' },
  { id: 'user-sent-offers', section: 'Buying', label: 'My Offers', icon: 'hammer-outline', iconLib: 'ion', stackScreen: 'BuyerOffers' },
  { id: 'user-watchlist', section: 'Buying', label: 'Saved Cars', icon: 'heart-outline', iconLib: 'ion', tabName: 'Saved' },
  { id: 'user-purchases', section: 'Buying', label: 'Purchases', icon: 'receipt-outline', iconLib: 'ion', stackScreen: 'BuyerPurchaseHistory' },
  { id: 'user-service-jobs', section: 'Services', label: 'Delivery & Inspections', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'CustomerServiceJobs' },
  { id: 'user-cancellations', section: 'Account', label: 'Sale Cancellations', icon: 'shield-checkmark-outline', iconLib: 'ion', stackScreen: 'SaleCancellations' },
  { id: 'user-messages', section: 'Account', label: 'Messages', icon: 'chatbubbles-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'user-settings', section: 'Account', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
];

// ADMIN accounts: "Admin Control Panel" is the website user-dropdown label.
const ADMIN_ITEMS: MenuItem[] = [
  { id: 'admin-dashboard', label: 'Admin Control Panel', icon: 'shield-checkmark', iconLib: 'ion', stackScreen: 'AdminDashboard' },
];

// Website dealer sidebar (src/config/dealerRouteConfig.ts + DashboardSidebar
// "More" sheet): Dashboard › Sell › Buy › Business › Services, same labels and
// order. Permissions are filtered before rendering, so staff never gain access.
const DEALER_ITEMS: MenuItem[] = [
  { id: 'dealer-home', section: 'Dashboard', label: 'Home', icon: 'grid-outline', iconLib: 'ion', tabName: 'DealerHome' },
  { id: 'dealer-stock', section: 'Sell', label: 'Stock', icon: 'car-outline', iconLib: 'ion', requiredPermission: 'VIEW_INVENTORY', tabName: 'DealerStock' },
  { id: 'dealer-customers', section: 'Sell', label: 'Customers', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_CRM', tabName: 'DealerCustomers' },
  { id: 'dealer-auctions', section: 'Sell', label: 'My Auctions', icon: 'gavel', iconLib: 'mci', requiredPermission: 'VIEW_TRADE', stackScreen: 'SellerAuctions' },
  { id: 'dealer-offers', section: 'Sell', label: 'Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerOffers' },
  { id: 'dealer-live', section: 'Buy', label: 'Live Auctions', icon: 'gavel', iconLib: 'mci', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'live' } },
  { id: 'dealer-wishlist', section: 'Buy', label: 'Saved', icon: 'heart-outline', iconLib: 'ion', tabName: 'Saved' },
  { id: 'dealer-bids', section: 'Buy', label: 'Bids & Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'VIEW_TRADE', tabName: 'DealerBuyBid', tabParams: { initialSection: 'bids' } },
  { id: 'dealer-offers-only', section: 'Buy', label: 'Bids & Offers', icon: 'pricetag-outline', iconLib: 'ion', requiredPermission: 'MANAGE_OFFERS', stackScreen: 'DealerMyOffers' },
  { id: 'dealer-purchases', section: 'Buy', label: 'Purchases', icon: 'bag-outline', iconLib: 'ion', requiredPermission: 'VIEW_PURCHASES', stackScreen: 'DealerPurchases' },
  { id: 'dealer-messages', section: 'Business', label: 'Messages', icon: 'chatbubble-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'dealer-team', section: 'Business', label: 'Team', icon: 'people-outline', iconLib: 'ion', requiredPermission: 'MANAGE_TEAM', stackScreen: 'DealerTeam' },
  { id: 'dealer-settings', section: 'Business', label: 'Account Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings', stackParams: { section: 'business' } },
  { id: 'dealer-finance', section: 'Business', label: 'Finance Applications', icon: 'cash-outline', iconLib: 'ion', stackScreen: 'DealerFinance' },
  { id: 'dealer-analytics', section: 'Business', label: 'Analytics', icon: 'bar-chart-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerAnalytics' },
  { id: 'dealer-earnings', section: 'Business', label: 'Earnings', icon: 'receipt-outline', iconLib: 'ion', requiredPermission: 'VIEW_ANALYTICS', stackScreen: 'DealerEarnings' },
  { id: 'dealer-partner', section: 'Services', label: 'Partner Account', icon: 'grid-outline', iconLib: 'ion', stackScreen: 'PartnerDashboard' },
  { id: 'dealer-service-addons', section: 'Services', label: 'Service Add-ons', icon: 'construct-outline', iconLib: 'ion', stackScreen: 'ProviderCapabilities' },
  { id: 'dealer-service-jobs', section: 'Services', label: 'Service Jobs', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'ProviderJobs' },
  { id: 'dealer-service-leads', section: 'Services', label: 'Service Enquiries', icon: 'briefcase-outline', iconLib: 'ion', stackScreen: 'ProviderLeads' },
];

// Website Stock submenu (DashboardSidebar dealer-stock-submenu).
const STOCK_SUBMENU: { label: string; status: DealerStockStatus }[] = [
  { label: 'All Inventory', status: 'All' },
  { label: 'Live', status: 'Live' },
  { label: 'Under Review', status: 'Under Review' },
  { label: 'Rejected', status: 'Rejected' },
  { label: 'Drafts', status: 'Draft' },
  { label: 'Sold', status: 'Sold' },
];

/** Screens that belong to the account dashboard, where web shows its sidebar. */
const DASHBOARD_ROUTES = new Set<string>([
  'Profile', ...USER_ITEMS.map(i => i.stackScreen).filter(Boolean) as string[],
  ...PROVIDER_ITEMS.map(i => i.stackScreen).filter(Boolean) as string[],
  'BuyerBids', 'BuyerDeliveryRequests', 'SellerListings',
]);

const ADD_VEHICLE: MenuItem = { id: 'add-vehicle', label: 'Add Vehicle', icon: 'add-circle-outline', iconLib: 'ion', stackScreen: 'SellCarFlow' };

export const GlobalDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useDrawer();
  const user         = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = !isAuthenticated;
  const logout       = useAuthStore((s) => s.logout);
  const [supportLoading, setSupportLoading] = useState(false);
  // 'site' = website main menu; 'dashboard' = website dashboard sidebar.
  const [view, setView] = useState<'site' | 'dashboard'>('site');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);

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
      (item.id !== 'dealer-offers-only' || (!dealerAccessLoading && !hasDealerPermission('VIEW_TRADE')))
      && (!item.requiredPermission
        || (!dealerAccessLoading && hasDealerPermission(item.requiredPermission))),
  );
  const canAddVehicle = !dealerAccessLoading && hasDealerPermission('MANAGE_INVENTORY');
  // Service providers (CONTRACTOR accounts) get the website provider sidebar.
  const isProvider = accountRole === 'contractor';
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
  // Closed position must clear the tab bar too: the sheet is anchored at
  // `bottom: dealerTabBarHeight`, so moving it down by only its own height
  // left its top strip (handle, close button, business name) parked over the
  // tab bar on every screen.
  const sheetHiddenY = sheetHeight + dealerTabBarHeight + 48;
  const translateY = useSharedValue(sheetHiddenY);
  const panelOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      if (dealerMode) {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
        panelOpacity.value = withTiming(1, { duration: 120 });
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
      }
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withTiming(DRAWER_WIDTH, { duration: 200 });
      translateY.value = withTiming(sheetHiddenY, { duration: 200 });
      panelOpacity.value = withTiming(0, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isOpen, dealerMode, sheetHiddenY, translateX, translateY, panelOpacity, backdropOpacity]);

  // Dealer overlay is inline so the original bottom tab bar stays visible and
  // tappable. A Modal would intercept taps on More even with transparent pixels.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, closeDrawer]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => (dealerMode
    ? { transform: [{ translateY: translateY.value }], opacity: panelOpacity.value }
    // Always set opacity: a Reanimated prop that was animated to 0 while in
    // dealer mode (closed sheet) otherwise stays 0 after switching to the
    // buyer side drawer, which then opened as an invisible panel behind a
    // dark backdrop.
    : { transform: [{ translateX: translateX.value }], opacity: 1 }));

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

  const getCurrentRoute = (): string => {
    try {
      let st: any = navigation.getState();
      let name = '';
      while (st?.routes) {
        const r = st.routes[st.index ?? st.routes.length - 1];
        if (!r) break;
        name = r.name;
        st = r.state;
      }
      return name;
    } catch {
      return '';
    }
  };
  const currentRoute = getCurrentRoute();

  // Like the website: the dashboard sidebar inside the dashboard, the main
  // site menu everywhere else. Dealers live in their dashboard.
  useEffect(() => {
    if (!isOpen) return;
    setView(dealerMode || DASHBOARD_ROUTES.has(currentRoute) || DASHBOARD_ROUTES.has(activeTab) ? 'dashboard' : 'site');
    setOpenGroup(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dealerMode]);

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
        navigation.navigate('Main', { screen: 'Tabs', params: { screen: item.tabName, params: item.tabStackParams } } as never);
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

  // Confirm while the drawer is still open, then close and sign out. The
  // old order (close, then Alert 160ms later) raised the dialog while the
  // drawer Modal was dismissing, and on Android it could vanish with it, so
  // tapping Sign Out appeared to do nothing.
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          closeDrawer();
          void logout();
        },
      },
    ]);
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
  const initials  = userName
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('') || 'C';
  // Website formatRole(): dealers and contractors are "Partner Account".
  const accountTypeLabel = accountRole === 'admin' ? 'ADMIN ACCOUNT'
    : (isActualDealer || isDealerStaff || isProvider) ? 'PARTNER ACCOUNT'
    : 'BUYER/SELLER ACCOUNT';

  const themeMode = resolveThemeMode(getThemePreference());
  const toggleTheme = () => promptThemeChange(themeMode === 'dark' ? 'light' : 'dark');

  const renderRow = (item: MenuItem, opts: { active?: boolean; chevron?: boolean; onPress?: () => void } = {}) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.row, opts.active && styles.rowActiveFilled]}
      onPress={opts.onPress ?? (() => handleItem(item))}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: !!opts.active }}
    >
      <View style={styles.iconWrap}>
        {item.iconLib === 'mci'
          ? <MaterialCommunityIcons name={item.icon} size={19} color={opts.active ? Colors.onAccent : Colors.textSecondary} />
          : <Ionicons name={item.icon} size={19} color={opts.active ? Colors.onAccent : Colors.textSecondary} />}
      </View>
      <Text style={[styles.rowLabel, opts.active && styles.rowLabelOnAccent]} numberOfLines={1}>{item.label}</Text>
      {opts.chevron !== false && (
        <Ionicons name="chevron-forward" size={15} color={opts.active ? Colors.onAccent : Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
      )}
    </TouchableOpacity>
  );

  const renderSections = (items: MenuItem[], isActive: (item: MenuItem) => boolean, extra?: (item: MenuItem) => React.ReactNode) =>
    items.map((item, index) => (
      <React.Fragment key={item.id}>
        {item.section && item.section !== items[index - 1]?.section && (
          <Text style={styles.dealerSectionLabel} accessibilityRole="header">{item.section.toUpperCase()}</Text>
        )}
        {extra?.(item) ?? renderRow(item, { active: isActive(item) })}
      </React.Fragment>
    ));

  const signOutButton = !isGuest && (
    <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8} accessibilityRole="button">
      <Ionicons name="log-out-outline" size={18} color={Colors.accent} />
      <Text style={styles.signOutText}>Sign Out</Text>
    </TouchableOpacity>
  );

  const supportRow = !isGuest && (
    <TouchableOpacity style={styles.supportRow} onPress={handleContactSupport} activeOpacity={0.7} disabled={supportLoading} accessibilityRole="button">
      {supportLoading
        ? <ActivityIndicator size="small" color={Colors.accent} />
        : <Ionicons name="help-buoy-outline" size={19} color={Colors.accent} />}
      <Text style={styles.supportText}>Contact CarMazium Support</Text>
    </TouchableOpacity>
  );

  const switchViewRow = (label: string, icon: string, next: 'site' | 'dashboard') => (
    <TouchableOpacity style={styles.switchRow} onPress={() => setView(next)} activeOpacity={0.8} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.switchText}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={Colors.iconMuted} />
    </TouchableOpacity>
  );

  // ── Website dealer sidebar (DashboardSidebar "More") ──────────────────────
  const dealerDashboard = (
    <>
      {renderSections(visibleDealerItems, (item) => !!item.tabName && item.tabName === activeTab && item.id !== 'dealer-bids', (item) => {
        if (item.id !== 'dealer-stock') return null;
        const active = activeTab === 'DealerStock';
        return (
          <View key={item.id}>
            <TouchableOpacity
              style={[styles.row, active && !stockOpen && styles.rowActiveFilled]}
              onPress={() => setStockOpen(v => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: stockOpen }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="car-outline" size={19} color={active && !stockOpen ? Colors.onAccent : Colors.textSecondary} />
              </View>
              <Text style={[styles.rowLabel, active && !stockOpen && styles.rowLabelOnAccent]}>Stock</Text>
              <Ionicons name={stockOpen ? 'chevron-down' : 'chevron-forward'} size={15} color={active && !stockOpen ? Colors.onAccent : Colors.iconMuted} />
            </TouchableOpacity>
            {stockOpen && (
              <View style={styles.submenu}>
                {STOCK_SUBMENU.map(sub => (
                  <TouchableOpacity
                    key={sub.label}
                    style={styles.subRow}
                    onPress={() => handleItem({ id: `stock-${sub.status}`, label: sub.label, icon: '', iconLib: 'ion', tabName: 'DealerStock', tabStackParams: { status: sub.status } })}
                    accessibilityRole="button"
                  >
                    <Text style={styles.subLabel}>{sub.label}</Text>
                  </TouchableOpacity>
                ))}
                {canAddVehicle && (
                  <TouchableOpacity style={styles.subRow} onPress={() => handleItem(ADD_VEHICLE)} accessibilityRole="button">
                    <Text style={styles.subLabel}>Add Vehicle</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
      {accountRole === 'admin' && (
        <>
          <Text style={styles.dealerSectionLabel} accessibilityRole="header">ADMIN</Text>
          {ADMIN_ITEMS.map(item => renderRow(item))}
        </>
      )}
      <View style={styles.footerActions}>
        {supportRow}
        {canAddVehicle && (
          <TouchableOpacity style={styles.addVehicleBtn} onPress={() => handleItem(ADD_VEHICLE)} activeOpacity={0.85} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={Colors.onAccent} />
            <Text style={styles.addVehicleText}>Add Vehicle</Text>
          </TouchableOpacity>
        )}
        {switchViewRow('Browse CarMazium', 'globe-outline', 'site')}
        {signOutButton}
      </View>
    </>
  );

  // ── Website buyer/seller dashboard sidebar ────────────────────────────────
  const userDashboard = (
    <>
      {renderSections(isProvider ? PROVIDER_ITEMS : USER_ITEMS, (item) =>
        (!!item.tabName && item.tabName === activeTab) || (!!item.stackScreen && item.stackScreen === currentRoute))}
      {accountRole === 'admin' && (
        <>
          <Text style={styles.dealerSectionLabel} accessibilityRole="header">ADMIN</Text>
          {ADMIN_ITEMS.map(item => renderRow(item))}
        </>
      )}
      <View style={styles.footerActions}>
        {supportRow}
        {switchViewRow('Browse CarMazium', 'globe-outline', 'site')}
        {signOutButton}
      </View>
    </>
  );

  // ── Website main menu (Header mobile menu + avatar dropdown) ─────────────
  const siteMenu = (
    <>
      {SITE_NAV.map(group => {
        if (group.item) {
          const active = !!group.item.tabName && group.item.tabName === activeTab;
          return (
            <TouchableOpacity key={group.id} style={styles.navRow} onPress={() => handleItem(group.item!)} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{group.label}</Text>
            </TouchableOpacity>
          );
        }
        const open = openGroup === group.id;
        return (
          <View key={group.id}>
            <TouchableOpacity style={styles.navRow} onPress={() => setOpenGroup(open ? null : group.id)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
              <Text style={styles.navLabel}>{group.label}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            {open && (
              <View style={styles.navGroupBody}>
                {group.children!.map(child => renderRow(child))}
              </View>
            )}
          </View>
        );
      })}
      <View style={styles.footerActions}>
        {!isGuest && (dealerMode || isActualDealer || isDealerStaff
          ? switchViewRow('Dealer Dashboard', 'grid-outline', 'dashboard')
          : switchViewRow('My Dashboard', 'grid-outline', 'dashboard'))}
        {signOutButton}
      </View>
      <View style={styles.footerLinks}>
        {FOOTER_LINKS.map(link => (
          <TouchableOpacity key={link.id} onPress={() => handleItem(link)} accessibilityRole="link" hitSlop={6}>
            <Text style={styles.footerLinkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

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
        <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.textPrimary} />} onPress={closeDrawer} accessibilityLabel="Close" />

        {/* ── User card ──────────────────────────────────────────────────
            Identity: website dashboard header / avatar dropdown. */}
        {isGuest ? (
          <View style={styles.accountShortcuts}>
            <Text style={styles.signedInLabel}>WELCOME TO CARMAZIUM</Text>
            <TouchableOpacity style={styles.guestPrimaryBtn} onPress={() => { closeDrawer(); setTimeout(() => openSignIn(navigation, 'Login'), 160); }} accessibilityRole="button">
              <Text style={styles.guestPrimaryText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.guestSecondaryBtn} onPress={() => { closeDrawer(); setTimeout(() => openSignIn(navigation, 'Signup'), 160); }} accessibilityRole="button">
              <Text style={styles.guestSecondaryText}>Create Free Account</Text>
            </TouchableOpacity>
          </View>
        ) : view === 'dashboard' ? (
          <View style={styles.userCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.userMeta}>
              <Text style={styles.userName} numberOfLines={1}>{userName.toUpperCase()}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{accountTypeLabel}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.accountShortcuts}>
            <Text style={styles.signedInLabel}>SIGNED IN AS</Text>
            <Text style={styles.signedInEmail} numberOfLines={1}>{userEmail || userName}</Text>
            {/* Settings belongs next to the account identity, as in the
                website avatar dropdown — never buried under menu tools. */}
            <View style={styles.accountMenu}>
              {renderRow({ id: 'acct-dashboard', label: 'Dashboard', icon: 'car-outline', iconLib: 'ion' }, { chevron: false, onPress: () => setView('dashboard') })}
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleItem({ id: 'account-settings', label: 'Account settings', icon: 'person-outline', iconLib: 'ion', stackScreen: 'Settings' })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open all account settings"
                accessibilityHint="Personal details, dealership, verification, notifications, payouts and security in one place"
              >
                <View style={styles.iconWrap}><Ionicons name="person-outline" size={19} color={Colors.textSecondary} /></View>
                <Text style={styles.rowLabel}>Account Settings</Text>
              </TouchableOpacity>
              {IS_QA_REVIEW_BUILD && (
                <TouchableOpacity style={styles.row} onPress={handleShareQaFeedback} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Share QA screenshot and interface feedback" accessibilityHint="Opens the device share sheet with a build-specific feedback template. No information is sent automatically.">
                  <View style={styles.iconWrap}><Ionicons name="share-social-outline" size={19} color={Colors.textSecondary} /></View>
                  <Text style={styles.rowLabel}>Share QA feedback</Text>
                </TouchableOpacity>
              )}
              {accountRole === 'admin' && renderRow(ADMIN_ITEMS[0], { chevron: false })}
              <TouchableOpacity style={styles.row} onPress={toggleTheme} accessibilityRole="button" accessibilityLabel={`Theme: ${themeMode}. Tap to switch`}>
                <View style={styles.iconWrap}><Ionicons name={themeMode === 'dark' ? 'moon-outline' : 'sunny-outline'} size={19} color={Colors.textSecondary} /></View>
                <Text style={styles.rowLabel}>Theme</Text>
                <View style={styles.themeChip}><Ionicons name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={17} color={Colors.textPrimary} /></View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <ScrollView key={`drawer-scroll-${role}-${view}`} style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
          {/* A dealer previewing as a buyer keeps a one-tap way back. */}
          {!isGuest && isActualDealer && role !== 'dealer' && (
            <TouchableOpacity style={styles.switchRow} onPress={() => { closeDrawer(); setTimeout(() => setRole('dealer'), 160); }} accessibilityRole="button">
              <Ionicons name="briefcase-outline" size={18} color={Colors.accent} />
              <Text style={[styles.switchText, { color: Colors.accent }]}>Switch to Dealer Mode</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.iconMuted} />
            </TouchableOpacity>
          )}
          {view === 'site' || isGuest
            ? siteMenu
            : (dealerMode ? dealerDashboard : userDashboard)}
        </ScrollView>

        {/* ── Footer brand ─────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CARMAZIUM</Text>
          <Text style={styles.footerTagline}>Auction FREE · Retail £1</Text>
        </View>
      </Animated.View>
    </>
  );

  // Always mounted, never a Modal: a Modal re-created the whole menu (~50 rows
  // of SVG icons) on every open, so tapping the menu felt like the app hung.
  // Now opening only animates. Closed = invisible and untouchable.
  return (
    <View
      style={styles.dealerOverlay}
      pointerEvents={isOpen ? 'box-none' : 'none'}
    >
      {drawerContent}
    </View>
  );
};

const styles = StyleSheet.create({
  guestPrimaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.inline,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestPrimaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.onAccent },
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
    // Above the elevated tab bar/cards on Android, which order by elevation.
    elevation: 50,
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
    backgroundColor: Colors.bgDropdown,
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
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentAlpha15,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarDealer: {},
  avatarSeller: {},
  avatarText: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    color: Colors.accent,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
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
    flex: 1, color: Colors.textPrimary, fontFamily: FontFamily.semiBold,
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
    color: Colors.textMuted,
    letterSpacing: 1.6,
    marginLeft: 24,
    marginBottom: 8,
  },

  // Menu rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 50,
    marginBottom: 2,
    borderRadius: Radius.inline,
  },
  // Website active item: solid brand fill, white label (DashboardSidebar).
  rowActiveFilled: { backgroundColor: Colors.accent },
  rowLabelOnAccent: { color: Colors.onAccent, fontFamily: FontFamily.semiBold },
  submenu: { marginLeft: 34, marginRight: 12, borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 12, marginBottom: 4 },
  subRow: { minHeight: 44, justifyContent: 'center' },
  subLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.textPrimary },
  // Website mobile main menu: large centred links, accordion groups.
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54 },
  navLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  navLabelActive: { color: Colors.accent },
  navGroupBody: { marginHorizontal: 12, marginBottom: 8, paddingVertical: 4, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  footerActions: { paddingHorizontal: 12, paddingTop: 14, gap: 10 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 10 },
  supportText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.accent },
  addVehicleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
    borderRadius: Radius.inline, backgroundColor: Colors.accent,
  },
  addVehicleText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.onAccent },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 14, marginHorizontal: 0,
    borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  switchText: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
    borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderHi,
  },
  signOutText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.accent },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  footerLinkText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  // Website avatar dropdown: "SIGNED IN AS" + email, then account actions.
  signedInLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 1.4, color: Colors.textMuted, marginTop: 4 },
  signedInEmail: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary, marginTop: 4, marginBottom: 6 },
  accountMenu: { marginHorizontal: -12 },
  themeChip: { width: 40, height: 40, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconWrapActive: {
    backgroundColor: Colors.accentAlpha15,
  },
  iconWrapRed: {
    backgroundColor: Colors.accentAlpha08,
  },
  iconWrapGold: {
    backgroundColor: Colors.whiteAlpha07,
  },
  iconWrapBlue: {
    backgroundColor: Colors.whiteAlpha07,
  },

  // Labels
  rowLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
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
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
  },
  rowLabelSeller: {
    flex: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
  },
  groupLabelDealer: {
    color: Colors.textMuted,
  },
  dealerSectionLabel: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginLeft: 24,
    marginTop: 10,
    marginBottom: 4,
  },
  groupLabelSeller: {
    color: Colors.textMuted,
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
    color: Colors.onAccent,
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
