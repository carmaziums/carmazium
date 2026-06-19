import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDrawer } from '../context/DrawerContext';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../navigation/RootNavigator';
import { MainStackParamList } from '../navigation/MainStackNavigator';
import { TabParamList } from '../navigation/TabNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

// ─── Colour palette used exclusively inside the drawer ────────────────────────
const C = {
  bg: '#13131A',
  border: 'rgba(255,255,255,0.08)',
  accent: '#DC1F26',
  accentLight: 'rgba(220,31,38,0.14)',
  white: '#FFFFFF',
  grey1: '#E2E2EA',   // primary text
  grey2: '#A8A8B3',   // secondary text
  grey3: '#606070',   // muted
  activeRow: 'rgba(220,31,38,0.10)',
  iconBg: 'rgba(255,255,255,0.07)',
  success: '#22C55E',
  divider: 'rgba(255,255,255,0.09)',
};

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
  { id: 'messages', label: 'Messages',   icon: 'chatbubble-ellipses-outline', iconLib: 'ion', stackScreen: 'Messages' },
  { id: 'auctions', label: 'Auctions',   icon: 'gavel',                     iconLib: 'mci', tabName: 'Live'   },
  { id: 'compare',  label: 'Compare',    icon: 'git-compare-outline',       iconLib: 'ion', stackScreen: 'Compare' },
  { id: 'how-it-works', label: 'How it works', icon: 'compass-outline',     iconLib: 'ion', stackScreen: 'HowItWorks' },
  { id: 'services', label: 'Services',   icon: 'construct-outline',         iconLib: 'ion', stackScreen: 'Services' },
  { id: 'settings', label: 'Settings',   icon: 'settings-outline',          iconLib: 'ion', stackScreen: 'Settings' },
  { id: 'notif-settings', label: 'Notification settings', icon: 'notifications-circle-outline', iconLib: 'ion', stackScreen: 'NotificationSettings' },
  { id: 'pricing',  label: 'Pricing',    icon: 'pricetag-outline',          iconLib: 'ion', stackScreen: 'Pricing' },
  { id: 'about',    label: 'About',      icon: 'information-circle-outline', iconLib: 'ion', stackScreen: 'About' },
  { id: 'terms',    label: 'Terms & Conditions', icon: 'document-text-outline', iconLib: 'ion', stackScreen: 'Terms' },
];

const SELLER_ITEMS: MenuItem[] = [
  {
    id: 'seller-dashboard',
    label: 'Seller dashboard',
    icon: 'speedometer-outline',
    iconLib: 'ion',
    stackScreen: 'SellerDashboard',
  },
  {
    id: 'seller-listings',
    label: 'My listings',
    icon: 'car-outline',
    iconLib: 'ion',
    stackScreen: 'SellerListings',
  },
  {
    id: 'seller-offers',
    label: 'Incoming offers',
    icon: 'pricetag-outline',
    iconLib: 'ion',
    stackScreen: 'SellerOffers',
  },
  {
    id: 'seller-auctions',
    label: 'My auctions',
    icon: 'gavel',
    iconLib: 'mci',
    stackScreen: 'SellerAuctions',
  },
  {
    id: 'seller-earnings',
    label: 'Earnings',
    icon: 'wallet-outline',
    iconLib: 'ion',
    stackScreen: 'Earnings',
  },
  {
    id: 'seller-performance',
    label: 'Performance analytics',
    icon: 'bar-chart-outline',
    iconLib: 'ion',
    stackScreen: 'SellerPerformance',
  },
  {
    id: 'seller-apply-dealer',
    label: 'Apply for dealer account',
    icon: 'trail-sign-outline',
    iconLib: 'ion',
    stackScreen: 'DealerOnboarding',
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
    id: 'dealer-auctions', 
    label: 'Dealer auction manager', 
    icon: 'gavel', 
    iconLib: 'mci', 
    action: 'alert', 
    alertTitle: 'Dealer Auction Manager', 
    alertMsg: 'Schedule and manage active vehicle auctions, adjust reserve prices, and view historical sales data.' 
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
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const role    = useAuthStore((s) => s.role);
  const setRole = useAuthStore((s) => s.setRole);
  const isActualDealer = user?.role === 'DEALER';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.7,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

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
  const userName  = realName || (role === 'dealer' ? 'Dealer Account' : role === 'seller' ? 'Seller Account' : 'Guest');
  const userEmail = user?.email || '';
  const initial   = userName.charAt(0).toUpperCase();

  const renderIcon = (item: MenuItem, active: boolean, goldMode?: boolean, blueMode?: boolean) => {
    const color = active ? C.accent : goldMode ? '#F59E0B' : blueMode ? '#3B82F6' : C.grey2;
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
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Slide-in panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX }],
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* ── Close button ─────────────────────────────── */}
        <TouchableOpacity style={styles.closeBtn} onPress={closeDrawer} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.grey1} />
        </TouchableOpacity>

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
          <View style={styles.verifiedDot}>
            <Ionicons name="checkmark-circle" size={18} color={role === 'dealer' ? '#F59E0B' : role === 'seller' ? '#3B82F6' : C.success} />
          </View>
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

          {role === 'seller' && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelSeller]}>SELLER TOOLS</Text>
              {SELLER_ITEMS.map((item) => (
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
                  <Ionicons name="chevron-forward" size={14} color="#606070" />
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
                  <Ionicons name="chevron-forward" size={14} color="#606070" />
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
                  <Ionicons name="swap-horizontal-outline" size={19} color="#F59E0B" />
                </View>
                <Text style={styles.rowLabelDealer}>Browse as buyer</Text>
                <Ionicons name="chevron-forward" size={14} color="#606070" />
              </TouchableOpacity>
            </>
          )}

          {/* Dealer account browsing in buyer mode — show switch-back banner */}
          {isActualDealer && role !== 'dealer' && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.groupLabel, styles.groupLabelDealer]}>DEALER ACCOUNT</Text>
              <TouchableOpacity
                style={styles.row}
                onPress={() => { closeDrawer(); setTimeout(() => setRole('dealer'), 160); }}
                activeOpacity={0.7}
              >
                <View style={styles.bar} />
                <View style={[styles.iconWrap, styles.iconWrapGold]}>
                  <Ionicons name="briefcase-outline" size={19} color="#F59E0B" />
                </View>
                <Text style={styles.rowLabelDealer}>Switch to dealer mode</Text>
                <Ionicons name="chevron-forward" size={14} color="#606070" />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider} />

          {/* Sign Out row */}
          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.bar} />
            <View style={[styles.iconWrap, styles.iconWrapRed]}>
              <Ionicons name="log-out-outline" size={19} color={C.accent} />
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
    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  // Sliding panel
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: C.bg,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    shadowColor: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.border,
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
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarDealer: {
    backgroundColor: '#B8860B',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  avatarSeller: {
    backgroundColor: '#1D4ED8',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 11,
    fontWeight: '400',
    color: '#A8A8B3',
  },
  verifiedDot: {
    padding: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: C.divider,
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
    fontSize: 9,
    fontWeight: '700',
    color: '#606070',
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
    backgroundColor: 'rgba(220,31,38,0.10)',
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
    backgroundColor: '#DC1F26',
  },

  // Icon wrapper
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(220,31,38,0.15)',
  },
  iconWrapRed: {
    backgroundColor: 'rgba(220,31,38,0.08)',
  },
  iconWrapGold: {
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  iconWrapBlue: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },

  // Labels
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#A8A8B3',
  },
  rowLabelActive: {
    fontWeight: '700',
    color: '#DC1F26',
  },
  rowLabelRed: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#DC1F26',
  },
  rowLabelDealer: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#D4A017',
  },
  rowLabelSeller: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#60A5FA',
  },
  groupLabelDealer: {
    color: '#F59E0B',
  },
  groupLabelSeller: {
    color: '#3B82F6',
  },

  // Active pill badge
  activePill: {
    backgroundColor: '#DC1F26',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  footerBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC1F26',
    letterSpacing: 2,
    marginBottom: 2,
  },
  footerTagline: {
    fontSize: 10,
    fontWeight: '400',
    color: '#606070',
    letterSpacing: 0.2,
  },
});
