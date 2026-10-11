import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Alert,
  ScrollView,
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
import { RootStackParamList } from '../navigation/RootNavigator';
import { MainStackParamList } from '../navigation/MainStackNavigator';
import { TabParamList } from '../navigation/TabNavigator';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

import { IconButton } from './IconButton';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const IS_QA_REVIEW_BUILD = process.env.EXPO_PUBLIC_QA_READ_ONLY === '1';

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  tabName?: keyof TabParamList;
  stackScreen?: keyof MainStackParamList;
  params?: { listingType: 'AUCTION' | 'CLASSIFIED' };
  children?: MenuItem[];
};

// Ten entry points only. Role-specific management stays inside the dashboard
// and account type/verification stays on the dedicated Settings page.
const MAIN_MENU: MenuItem[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconLib: 'ion', tabName: 'Home' },
  { id: 'valuation', label: 'Get Valuation', icon: 'speedometer-outline', iconLib: 'ion', stackScreen: 'SellLanding' },
  {
    id: 'buy', label: 'Buy Cars', icon: 'car-outline', iconLib: 'ion', children: [
      { id: 'buy-retail', label: 'Retail Listings', icon: 'pricetag-outline', iconLib: 'ion', tabName: 'Search' },
      { id: 'buy-auctions', label: 'Live Auctions', icon: 'hammer-outline', iconLib: 'ion', tabName: 'Live' },
    ],
  },
  {
    id: 'sell', label: 'Sell Cars', icon: 'storefront-outline', iconLib: 'ion', children: [
      { id: 'sell-auction', label: 'Sell by Auction · FREE', icon: 'hammer-outline', iconLib: 'ion',
        stackScreen: 'SellCarFlow', params: { listingType: 'AUCTION' } },
      { id: 'sell-retail', label: 'Retail Listing · £1', icon: 'car-outline', iconLib: 'ion',
        stackScreen: 'SellCarFlow', params: { listingType: 'CLASSIFIED' } },
    ],
  },
  { id: 'tradexchange', label: 'TradeXchange', icon: 'construct-outline', iconLib: 'ion', stackScreen: 'Services' },
  { id: 'compare', label: 'Compare', icon: 'git-compare-outline', iconLib: 'ion', stackScreen: 'Compare' },
  { id: 'pricing', label: 'Pricing', icon: 'pricetag-outline', iconLib: 'ion', stackScreen: 'Pricing' },
  { id: 'about', label: 'About', icon: 'information-circle-outline', iconLib: 'ion', stackScreen: 'About' },
  { id: 'settings', label: 'Profile Settings', icon: 'settings-outline', iconLib: 'ion', stackScreen: 'Settings' },
  { id: 'dashboard', label: 'User Dashboard', icon: 'grid-outline', iconLib: 'ion', tabName: 'Profile' },
];

export const GlobalDrawer: React.FC = () => {
  const { isOpen, closeDrawer } = useDrawer();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const accountRole = useAuthStore((s) => s.accountRole);
  const dealerMode = accountRole === 'dealer' && role === 'dealer';
  const [expandedMenu, setExpandedMenu] = useState<'buy' | 'sell' | null>(null);
  const insets = useSafeAreaInsets();
  // Navigation is always the same ten-item right drawer, regardless of role.
  // Dealer-specific tools now live on the separate DealerMore tab.
  // Use live viewport dimensions so orientation changes cannot expose a sheet.
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(windowWidth * 0.82, 320);
  const navigation = useNavigation<NavProp>();
  // Prevent a drawer destination queued during dismissal from navigating a
  // new account/session after fast logout, role changes, or screen unmount.
  const pendingNavigation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQaShare = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountId = user?.id;

  useEffect(() => {
    return () => {
      if (pendingNavigation.current) clearTimeout(pendingNavigation.current);
      if (pendingQaShare.current) clearTimeout(pendingQaShare.current);
      pendingNavigation.current = null;
      pendingQaShare.current = null;
    };
  }, [accountId, role, accountRole]);

  // Every fresh Menu session should start with Buy and Sell collapsed; a
  // prior expansion must not persist after dismissing via X, Back, or backdrop.
  useEffect(() => {
    if (!isOpen) setExpandedMenu(null);
  }, [isOpen]);

  const translateX = useSharedValue(drawerWidth);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = isOpen
      ? withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 })
      : withTiming(drawerWidth, { duration: 200 });
    backdropOpacity.value = withTiming(isOpen ? 1 : 0, { duration: isOpen ? 220 : 180 });
  }, [isOpen, drawerWidth, translateX, backdropOpacity]);

  // The Modal is not mounted into the visible native window while closed.
  // Android Back dismisses it via onRequestClose; outside taps and X also close.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
    if (item.children) {
      setExpandedMenu(open => open === item.id ? null : item.id as 'buy' | 'sell');
      return;
    }
    closeDrawer();
    setExpandedMenu(null);
    if (pendingNavigation.current) clearTimeout(pendingNavigation.current);
    const sourceAccountId = accountId;
    const sourceRole = role;
    const sourceAccountRole = accountRole;
    const destination = item.id === 'dashboard' && dealerMode
      ? 'DealerHome'
      : item.tabName;
    pendingNavigation.current = setTimeout(() => {
      pendingNavigation.current = null;
      const currentAuth = useAuthStore.getState();
      if (!currentAuth.isAuthenticated
        || currentAuth.user?.id !== sourceAccountId
        || currentAuth.role !== sourceRole
        || currentAuth.accountRole !== sourceAccountRole) return;
      if (item.stackScreen) {
        navigation.navigate('Main', { screen: item.stackScreen, params: item.params } as never);
      } else if (destination) {
        navigation.navigate('Main', { screen: 'Tabs', params: { screen: destination } });
      }
    }, 160);
  };

  // This is a local share sheet only. No issue report, screenshot, account
  // identity or device data is transmitted automatically by CarMazium.
  // The user decides whether and where to share the review notes.
  const handleShareQaFeedback = () => {
    closeDrawer();
    if (pendingQaShare.current) clearTimeout(pendingQaShare.current);
    const sourceAccountId = accountId;
    const sourceSha = process.env.EXPO_PUBLIC_QA_COMMIT_SHA || 'unknown';
    pendingQaShare.current = setTimeout(() => {
      pendingQaShare.current = null;
      const currentAuth = useAuthStore.getState();
      if (!currentAuth.isAuthenticated || currentAuth.user?.id !== sourceAccountId) return;
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
          style={[styles.backdrop, backdropStyle]}
        />
      </TouchableWithoutFeedback>

      {/* The header Menu is the only navigation drawer for every account role. */}
      <Animated.View
        style={[
          styles.panel,
          styles.sidePanel,
          panelStyle,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* ── Close button ─────────────────────────────── */}
        <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={20} color={Colors.paleBlue_e2e2ea} />} onPress={closeDrawer} accessibilityLabel="Close navigation menu" />

        {/* ── User card ────────────────────────────────── */}
        <View style={styles.userCard}>
          <View style={[styles.avatar, role === 'dealer' && styles.avatarDealer, role === 'seller' && styles.avatarSeller]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} maxFontSizeMultiplier={2} numberOfLines={2}>{userName}</Text>
            {!!userEmail && (
              <Text style={styles.userEmail} numberOfLines={1} maxFontSizeMultiplier={2} ellipsizeMode="middle">{userEmail}</Text>
            )}
          </View>
          {(user?.isAddressVerified === true && user?.isVerified === true) && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={18} color={role === 'dealer' ? Colors.warning : role === 'seller' ? Colors.infoBlue : Colors.success} />
            </View>
          )}
        </View>

        {/* Ten primary destinations. Nested choices are shown only when the
            corresponding Buy or Sell parent is expanded; no duplicate tool
            groups or 'show more' controls compete for attention. */}
        <ScrollView
          key={`simple-app-menu-${role}`}
          style={styles.scroll}
          contentContainerStyle={styles.simpleMenuContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.groupLabel}>EXPLORE CARMAZIUM</Text>
          {MAIN_MENU.map(item => {
            const expanded = item.children && expandedMenu === item.id;
            const active = !!item.tabName
              && (item.id === 'dashboard' && dealerMode ? activeTab === 'DealerHome' : item.tabName === activeTab);
            return (
              <View key={item.id}>
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => handleItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.id === 'dashboard' && dealerMode ? 'Dealer Dashboard' : item.label}
                  accessibilityHint={item.children
                    ? (expanded ? 'Collapse ' + item.label + ' choices' : 'Expand ' + item.label + ' choices')
                    : 'Opens ' + (item.id === 'dashboard' && dealerMode ? 'Dealer Dashboard' : item.label)}
                  accessibilityState={item.children ? { expanded: !!expanded } : { selected: active }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.bar, active && styles.barActive]} />
                  <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                    {renderIcon(item, active)}
                  </View>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]} maxFontSizeMultiplier={2}>{item.label}</Text>
                  {item.children ? (
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18}
                      color={Colors.lightGrey} accessibilityElementsHidden />
                  ) : (
                    <Ionicons name="chevron-forward" size={15}
                      color={Colors.iconMuted} accessibilityElementsHidden />
                  )}
                </TouchableOpacity>
                {!!expanded && (
                  <View style={styles.subMenu} accessibilityLabel={item.label + ' choices'}>
                    {item.children!.map(child => (
                      <TouchableOpacity
                        key={child.id}
                        style={styles.subMenuRow}
                        onPress={() => handleItem(child)}
                        accessibilityRole="button"
                        accessibilityLabel={child.label}
                        accessibilityHint={item.label + ', ' + child.label}
                        activeOpacity={0.75}
                      >
                        <View style={styles.subMenuIcon}>{renderIcon(child, false)}</View>
                        <Text style={styles.subMenuText} maxFontSizeMultiplier={2}>{child.label}</Text>
                        <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} accessibilityElementsHidden />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {/* Test-only feedback is outside the navigation hierarchy. */}
          {IS_QA_REVIEW_BUILD && (
            <TouchableOpacity style={styles.qaFeedback} onPress={handleShareQaFeedback}
              accessibilityRole="button" accessibilityLabel="Share QA feedback">
              <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.qaFeedbackText} maxFontSizeMultiplier={2}>Share private QA feedback</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── Footer brand ─────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CARMAZIUM</Text>
          <Text style={styles.footerTagline}>Auction FREE · Retail £1</Text>
        </View>
      </Animated.View>
    </>
  );

  return (
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
    width: '82%',
    maxWidth: 320,
    borderLeftWidth: 1,
    borderLeftColor: Colors.whiteAlpha08,
    shadowOffset: { width: -6, height: 0 },
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
    minWidth: 0,
  },
  userName: {
    flexShrink: 1,
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

  simpleMenuContent: { paddingBottom: 18 },
  subMenu: {
    marginLeft: 46, marginRight: 14, marginBottom: 10,
    paddingVertical: 5, paddingHorizontal: 10,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    backgroundColor: Colors.whiteAlpha04,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  subMenuRow: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 48, gap: 10, paddingVertical: 7, paddingHorizontal: 4,
  },
  subMenuIcon: { width: 28, alignItems: 'center' },
  subMenuText: { flex: 1, minWidth: 0, flexShrink: 1, color: Colors.white, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  qaFeedback: { marginTop: 14, marginHorizontal: 15, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 9 },
  qaFeedbackText: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
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
    minWidth: 0,
    flexShrink: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.medium,
    color: Colors.lightGrey,
  },
  // Avoid illegible 3:1 red text on the dark dropdown. Brand-red active
  // indicator and icon remain, while the menu destination stays readable.
  rowLabelActive: {
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
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
