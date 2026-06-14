import React, { useEffect } from 'react';
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
import { FontFamily, FontSize } from '../constants/typography';

// Main screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { SearchScreen } from '../screens/main/SearchScreen';
import { LiveScreen } from '../screens/main/LiveScreen';
import { SavedScreen } from '../screens/main/SavedScreen';
import { DealerProfileScreen } from '../screens/main/DealerProfileScreen';
import { UnifiedDashboardScreen } from '../screens/account/UnifiedDashboardScreen';
import { useAuthStore } from '../store/authStore';

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
  { name: 'Profile', icon: 'person-outline', iconActive: 'person', label: 'PROFILE', iconType: 'ionicons' },
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

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({
  focused,
  iconName,
  iconType,
  color,
  size,
  onPress,
}) => {
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
};

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom }]}>
      {/* Glass-effect background overlay */}
      <View style={[StyleSheet.absoluteFillObject, styles.tabBarGlass]} />
      <View style={styles.tabBarInner}>
        {state.routes.map((route: any, index: number) => {
          const config = TAB_CONFIG.find((c) => c.name === route.name)!;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

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
  const role = useAuthStore((s) => s.role);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen
        name="Profile"
        component={
          role === 'dealer'
            ? DealerProfileScreen
            : UnifiedDashboardScreen
        }
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBarBg,
    overflow: 'hidden',
  },
  tabBarGlass: {
    backgroundColor: 'rgba(10, 10, 12, 0.88)',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 8,
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
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  tabLabelInactive: {
    color: Colors.tabInactive,
  },
});
