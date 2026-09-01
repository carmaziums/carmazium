import React, { useCallback, useEffect, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, TextPresets } from '../constants/typography';
import { Elevation, Radius } from '../constants/spacing';

// Main screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { SearchScreen } from '../screens/main/SearchScreen';
import { LiveScreen } from '../screens/main/LiveScreen';
import { SavedScreen } from '../screens/main/SavedScreen';
import { DealerProfileScreen } from '../screens/main/DealerProfileScreen';
import { UnifiedDashboardScreen } from '../screens/account/UnifiedDashboardScreen';
import { BuyerDashboardScreen } from '../screens/buyer/BuyerDashboardScreen';
import { useAuthStore } from '../store/authStore';

// Stable wrapper so the Profile tab's component prop never changes reference,
// preventing React Navigation from unmounting + remounting the tab when role loads.
const ProfileTabScreen: React.FC<any> = React.memo((props) => {
  const role = useAuthStore((s) => s.role);
  // Buyers get the buyer-specific dashboard (DASH-004 / OQ-29). It was fully
  // built and completely unreachable — zero navigate() call sites and absent
  // from the drawer's 33 stackScreen targets — while carrying the richer tile
  // set (Active Offers, Watching, Live Bids, Auctions Won, Total Spent) and the
  // 7d/30d period toggle that the live screen lacks (DASH-005).
  //
  // Sellers keep UnifiedDashboard, which is where the inventory/revenue tiles
  // live. A buyer-role user who also lists still reaches every seller screen
  // from the drawer — only the tiles differ, not the access.
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
  { name: 'Search', icon: 'search-outline', iconActive: 'search', label: 'SEARCH', iconType: 'ionicons' },
  { name: 'Live', icon: 'gavel', iconActive: 'gavel', label: 'LIVE', iconType: 'material-community' },
  { name: 'Saved', icon: 'heart-outline', iconActive: 'heart', label: 'SAVED', iconType: 'ionicons' },
  { name: 'Profile', icon: 'grid-outline', iconActive: 'grid', label: 'DASHBOARD', iconType: 'ionicons' },
];

// ─── Animated tab icon: spring-scales (1.0 → 1.2 → 1.0) on focus ─────────────
interface AnimatedTabIconProps {
  focused: boolean;
  iconName: string;
  iconType: 'ionicons' | 'material-community';
  color: string;
  size: number;
  onPress?: () => void;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = React.memo(function AnimatedTabIcon({
  focused,
  iconName,
  iconType,
  color,
  size,
  onPress,
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 12, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
      );
    }
  }, [focused]);

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
          onPress={onPress}
        />
      ) : (
        <Ionicons
          name={iconName as any}
          size={size}
          color={color}
          onPress={onPress}
        />
      )}
    </Animated.View>
  );
});

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();

  // Stable press handlers keyed by route key — prevents closure recreation on every render
  const pressHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    state.routes.forEach((route: any, index: number) => {
      handlers[route.key] = () => {
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
  }, [state.routes, state.index, navigation]);

  return (
    // The bar floats above the content rather than sitting edge-to-edge on a
    // hairline border — that inset, rounded, shadowed slab is the design
    // system's tab bar and one of the few pieces of chrome visible on every
    // screen. `insets.bottom` becomes a margin rather than internal padding so
    // the bar clears the home indicator without growing a dead grey strip
    // underneath it; on devices with no inset it falls back to a fixed 10px so
    // it never sits flush against the screen edge.
    <View
      style={[
        styles.tabBarOuter,
        { bottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.tabBarGlass]} />
      <View style={styles.tabBarInner}>
        {state.routes.map((route: any, index: number) => {
          const config = TAB_CONFIG.find((c) => c.name === route.name)!;
          const isFocused = state.index === index;
          const onPress = pressHandlers[route.key];

          return (
            <View key={route.key} style={styles.tabItem}>
              {/* Active dot above focused tabs */}
              {isFocused && (
                <View style={styles.activeDot} />
              )}
              <View style={styles.iconWrapper}>
                <AnimatedTabIcon
                  focused={isFocused}
                  iconName={isFocused ? config.iconActive : config.icon}
                  iconType={config.iconType}
                  color={isFocused ? Colors.accent : Colors.tabInactive}
                  size={config.iconType === 'material-community' ? 22 : 20}
                  onPress={onPress}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                onPress={onPress}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {config.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
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
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBarBg,
    // Deliberately NOT `overflow: 'hidden'` — on iOS that clips the shadow, so
    // the float elevation below would never render. The glass layer carries its
    // own radius instead of relying on the parent to clip it.
    ...Elevation.float,
  },
  tabBarGlass: {
    borderRadius: Radius.sheet,
    // Sits under the items to deepen the translucent ground. A real backdrop
    // blur needs expo-blur, which isn't installed (adding it forces a native
    // prebuild) — on a dark ground this reads close.
    backgroundColor: Colors.tabBarBg,
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 6,
    gap: 4,
  },
  iconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    // The glow on the active dot is the tab bar's signature detail.
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
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
