import React, { useEffect, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { TextPresets } from '../constants/typography';
import { useReduceMotionPreference } from '../hooks/useReduceMotionPreference';

// Main screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { SearchScreen } from '../screens/main/SearchScreen';
import { LiveScreen } from '../screens/main/LiveScreen';
import { SavedScreen } from '../screens/main/SavedScreen';
import { DealerProfileScreen } from '../screens/main/DealerProfileScreen';
import { DealerInventoryScreen } from '../screens/main/DealerInventoryScreen';
import { DealerLeadsScreen } from '../screens/main/DealerLeadsScreen';
import { useDrawer } from '../context/DrawerContext';
import { useDealerAccess } from '../hooks/useDealerAccess';
import { UnifiedDashboardScreen } from '../screens/account/UnifiedDashboardScreen';
import { BuyerDashboardScreen } from '../screens/buyer/BuyerDashboardScreen';
import { AccountRoleHomeScreen } from '../screens/account/AccountRoleHomeScreen';
import { LegacyPartnerDashboardScreen } from '../screens/account/LegacyPartnerDashboardScreen';
import { DealerBuyBidScreen } from '../screens/main/DealerBuyBidScreen';
import { PartnerDashboardScreen } from '../screens/main/PartnerDashboardScreen';
import { useAuthStore } from '../store/authStore';

// Stable wrapper so the Profile tab's component prop never changes reference,
// preventing React Navigation from unmounting + remounting the tab when role loads.
const ProfileTabScreen: React.FC<any> = React.memo((props) => {
  const role = useAuthStore((s) => s.role);
  const accountRole = useAuthStore((s) => s.accountRole);
  // Buyers get the buyer-specific dashboard (DASH-004 / OQ-29). It was fully
  // built and completely unreachable — zero navigate() call sites and absent
  // from the drawer's 33 stackScreen targets — while carrying the richer tile
  // set (Active Offers, Watching, Live Bids, Auctions Won, Total Spent) and the
  // 7d/30d period toggle that the live screen lacks (DASH-005).
  //
  // Sellers keep UnifiedDashboard, which is where the inventory/revenue tiles
  // live. A buyer-role user who also lists still reaches every seller screen
  // from the drawer — only the tiles differ, not the access.
  // Business/platform roles must never be silently presented as a personal
  // Buyer simply because the mobile preview role is intentionally narrower.
  // Route each operational role to the same backend-backed workspace it has
  // on web. Admin remains intentionally web-only (product-parity.json).
  if (accountRole === 'contractor') {
    return <PartnerDashboardScreen {...props} />;
  }
  if (accountRole === 'finance_partner' || accountRole === 'insurance_partner') {
    return <LegacyPartnerDashboardScreen {...props} />;
  }
  if (accountRole === 'admin') {
    return <AccountRoleHomeScreen {...props} />;
  }

  // DEALER can deliberately preview the personal buyer experience via the
  // existing "View my profile" control, so the preview role still wins for
  // buyer/dealer presentation while accountRole remains authoritative for
  // permissions.
  if (role === 'dealer') return <DealerProfileScreen {...props} />;
  if (role === 'buyer') return <BuyerDashboardScreen {...props} />;
  return <UnifiedDashboardScreen {...props} />;
});

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Live: undefined;
  Saved: undefined;
  Profile: undefined;
  // Dealer-only mobile shortcuts, mirroring web DashboardSidebar mobile tabs.
  // Core routes above are retained for deep links and buyer-preview switching.
  DealerHome: undefined;
  DealerStock: undefined;
  DealerCustomers: undefined;
  DealerBuyBid: undefined;
  DealerMore: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_CONFIG: {
  name: keyof TabParamList;
  icon: string;
  iconActive: string;
  label: string;
  iconType: 'ionicons' | 'material-community';
}[] = [
  { name: 'Home', icon: 'home-outline', iconActive: 'home', label: 'HOME', iconType: 'ionicons' },
  { name: 'Search', icon: 'car-outline', iconActive: 'car', label: 'BUY CARS', iconType: 'ionicons' },
  { name: 'Live', icon: 'gavel', iconActive: 'gavel', label: 'AUCTIONS', iconType: 'material-community' },
  { name: 'Saved', icon: 'heart-outline', iconActive: 'heart', label: 'SAVED', iconType: 'ionicons' },
  { name: 'Profile', icon: 'grid-outline', iconActive: 'grid', label: 'DASHBOARD', iconType: 'ionicons' },
  { name: 'DealerHome', icon: 'grid-outline', iconActive: 'grid', label: 'Home', iconType: 'ionicons' },
  { name: 'DealerStock', icon: 'car-outline', iconActive: 'car', label: 'Stock', iconType: 'ionicons' },
  { name: 'DealerCustomers', icon: 'people-outline', iconActive: 'people', label: 'Customers', iconType: 'ionicons' },
  { name: 'DealerBuyBid', icon: 'gavel', iconActive: 'gavel', label: 'Buy & Bid', iconType: 'material-community' },
  { name: 'DealerMore', icon: 'menu-outline', iconActive: 'menu', label: 'More', iconType: 'ionicons' },
];

// ─── Animated tab icon: spring-scales (1.0 → 1.2 → 1.0) on focus ─────────────
interface AnimatedTabIconProps {
  focused: boolean;
  iconName: string;
  iconType: 'ionicons' | 'material-community';
  color: string;
  size: number;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = React.memo(function AnimatedTabIcon({
  focused,
  iconName,
  iconType,
  color,
  size,
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotionPreference();

  useEffect(() => {
    if (focused && !reduceMotion) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 12, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
      );
    } else {
      scale.value = 1;
    }
  }, [focused, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {iconType === 'material-community' ? (
        <MaterialCommunityIcons
          name={iconName as any}
          size={size}
          color={color}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <Ionicons
          name={iconName as any}
          size={size}
          color={color}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </Animated.View>
  );
});

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const accountRole = useAuthStore((s) => s.accountRole);
  const { isOpen: isDrawerOpen, openDrawer, closeDrawer } = useDrawer();
  const dealerMode = role === 'dealer' && accountRole === 'dealer';
  const { loading: dealerAccessLoading, hasPermission } = useDealerAccess(dealerMode);
  const visibleRoutes = state.routes.filter((route: { name: string }) => {
    if (!dealerMode) return !route.name.startsWith('Dealer');
    if (!route.name.startsWith('Dealer')) return false;
    // Website mobile sidebar filters destinations by team permissions.
    // Never put unavailable Stock, CRM or bidding routes in the tab bar.
    if (route.name === 'DealerStock') return !dealerAccessLoading && hasPermission('VIEW_INVENTORY');
    if (route.name === 'DealerCustomers') return !dealerAccessLoading && hasPermission('MANAGE_CRM');
    if (route.name === 'DealerBuyBid') return !dealerAccessLoading && hasPermission('VIEW_TRADE');
    return true; // Home and More remain reachable.
  });

  // Stable press handlers keyed by route key — prevents closure recreation on every render
  const pressHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    state.routes.forEach((route: any, index: number) => {
      handlers[route.key] = () => {
        if (route.name === 'DealerMore') {
          // Match the website's active More state and close-on-second-tap.
          if (isDrawerOpen) closeDrawer();
          else openDrawer();
          return;
        }
        const isFocused = state.index === index;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };
    });
    return handlers;
  }, [state.routes, state.index, navigation, isDrawerOpen, openDrawer, closeDrawer]);

  return (
    // Match website DashboardSidebar's edge-to-edge five-item bar, including
    // its safe-area clearance. The earlier floating capsule read like a
    // different product, and covered the lowest rows on compact devices.
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: insets.bottom },
      ]}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.tabBarGlass]} />
      <View style={styles.tabBarInner}>
        {visibleRoutes.map((route: any) => {
          const config = TAB_CONFIG.find((c) => c.name === route.name)!;
          const isMore = route.name === 'DealerMore';
          const isFocused = isMore ? isDrawerOpen : state.routes[state.index]?.name === route.name;
          const onPress = pressHandlers[route.key];

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={config.label === 'DASHBOARD' ? 'Dashboard' : config.label}
              accessibilityState={isMore ? { selected: isDrawerOpen, expanded: isDrawerOpen } : { selected: isFocused }}
              accessibilityHint={isMore ? (isDrawerOpen ? 'Closes the dealer menu' : 'Opens the dealer menu') : isFocused ? undefined : `Switches to the ${config.label.toLowerCase()} tab`}
            >
              {/* Active dot above focused tabs */}
              {isFocused && (
                <View style={styles.activeDot} />
              )}
              <View style={styles.iconWrapper}>
                <AnimatedTabIcon
                  focused={isFocused}
                  iconName={isMore && isDrawerOpen ? 'close' : isFocused ? config.iconActive : config.icon}
                  iconType={config.iconType}
                  color={isFocused ? Colors.accent : Colors.tabInactive}
                  size={config.iconType === 'material-community' ? 22 : 20}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const TabNavigator: React.FC = () => {
  const role = useAuthStore((s) => s.role);
  const accountRole = useAuthStore((s) => s.accountRole);
  const dealerMode = role === 'dealer' && accountRole === 'dealer';
  return (
    <Tab.Navigator
      key={dealerMode ? 'dealer-workspace' : 'marketplace-workspace'}
      initialRouteName={dealerMode ? 'DealerHome' : 'Home'}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
      <Tab.Screen name="DealerHome" component={DealerProfileScreen} />
      <Tab.Screen name="DealerStock" component={DealerInventoryScreen} />
      <Tab.Screen name="DealerCustomers" component={DealerLeadsScreen} />
      <Tab.Screen name="DealerBuyBid" component={DealerBuyBidScreen} />
      <Tab.Screen name="DealerMore" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: '#243047',
  },
  tabBarGlass: {
    backgroundColor: '#243047',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 9,
    paddingBottom: 7,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 38,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    position: 'absolute',
    top: -4,
    alignSelf: 'center',
  },
  tabLabel: {
    ...TextPresets.tabLabel,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  tabLabelInactive: {
    color: Colors.tabInactive,
  },
});
