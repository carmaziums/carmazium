import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { getBottomTabItemHeight } from '../lib/nativeLayoutParity';
import { navigationRef } from '../lib/navigationRef';
import { getPersonalDashboardTabs, personalTabIsActive, type PersonalDashboardRole, type PersonalDashboardRoute } from '../lib/personalDashboardTabs';

/**
 * Mirrors website's seller/buyer-specific DashboardSidebar (4 shortcuts).
 * Uses existing native routes. No website navigation or account mutation.
 * The marketplace tabs remain available when using public marketplace pages.
 */
export const PersonalDashboardBottomNav: React.FC<{
  role: PersonalDashboardRole;
  activeRoute: string;
}> = ({ role, activeRoute }) => {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabs = getPersonalDashboardTabs(role);
  const open = (route: PersonalDashboardRoute) => {
    if (!navigationRef.isReady()) return;
    if (route === 'Profile') {
      navigationRef.navigate('Main', { screen: 'Tabs', params: { screen: 'Profile' } });
    } else {
      navigationRef.navigate('Main', { screen: route });
    }
  };

  return <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
    {tabs.map(tab => {
      const active = personalTabIsActive(tab.route, activeRoute);
      return <TouchableOpacity
        key={tab.route}
        onPress={() => open(tab.route)}
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={[styles.item, { minHeight: getBottomTabItemHeight(fontScale) }]}
      >
        <Ionicons name={tab.icon as any} size={21} color={active ? Colors.accent : Colors.textMuted} />
        <Text numberOfLines={2} style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
        {active && <View style={styles.dot} />}
      </TouchableOpacity>;
    })}
  </View>;
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: Colors.bgDropdown,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 4, paddingTop: 9, paddingBottom: 7,
  },
  item: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingHorizontal: 4,
  },
  label: {
    color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: FontSize.xs,
    textAlign: 'center', flexShrink: 1,
  },
  labelActive: { color: Colors.accent },
  dot: {
    height: 4, width: 4, borderRadius: 2,
    backgroundColor: Colors.accent, position: 'absolute', bottom: -2,
  },
});
