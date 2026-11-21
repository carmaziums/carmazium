import React, { useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { getBottomTabItemHeight } from '../lib/nativeLayoutParity';
import { navigationRef } from '../lib/navigationRef';
import { openAdminWeb } from '../screens/admin/adminShared';

export const ADMIN_NATIVE_BOTTOM_ROUTES = ['AdminDashboard', 'AdminListingsReview', 'AdminTransactions'] as const;
type AdminDestination = { name: string; label: string; icon: string; route?: string; webPath?: string };
const tabs: AdminDestination[] = [
  { name: 'AdminDashboard', label: 'Overview', icon: 'grid-outline', route: 'AdminDashboard' },
  { name: 'AdminListingsReview', label: 'Listings', icon: 'car-outline', route: 'AdminListingsReview' },
  { name: 'AdminTransactions', label: 'Transactions', icon: 'receipt-outline', route: 'AdminTransactions' },
  { name: 'AdminMessages', label: 'Messages', icon: 'chatbubble-outline', webPath: '/dashboard/admin/messages' },
  { name: 'More', label: 'More', icon: 'menu-outline' },
];
const overflow: AdminDestination[] = [
  { name: 'AdminAuctions', label: 'Auctions', icon: 'hammer-outline', route: 'AdminAuctions' },
  { name: 'AdminHandovers', label: 'Handovers', icon: 'hand-left-outline', route: 'AdminHandovers' },
  { name: 'AdminAccounts', label: 'Accounts', icon: 'people-outline', route: 'AdminAccounts' },
  { name: 'AdminDealerKyc', label: 'Dealer KYC', icon: 'shield-outline', route: 'AdminDealerKyc' },
  { name: 'AdminAppInsights', label: 'Online, App & Reports', icon: 'pulse-outline', route: 'AdminAppInsights' },
  { name: 'AdminCancellations', label: 'Sale Cancellations', icon: 'close-outline', webPath: '/dashboard/admin/cancellations' },
  { name: 'AdminHpi', label: 'Vehicle History Reports', icon: 'document-outline', webPath: '/dashboard/admin/hpi' },
  { name: 'AdminWarranty', label: 'Warranty Orders', icon: 'shield-outline', webPath: '/dashboard/admin/warranty-orders' },
  { name: 'AdminFreeListingGrants', label: 'Free Listing Grants', icon: 'gift-outline', webPath: '/dashboard/admin/free-listings' },
  { name: 'AdminDealers', label: 'All Dealers', icon: 'business-outline', webPath: '/dashboard/admin/dealers' },
  { name: 'AdminServices', label: 'Trade Services', icon: 'briefcase-outline', webPath: '/dashboard/admin/services' },
  { name: 'AdminAnalytics', label: 'Analytics', icon: 'analytics-outline', webPath: '/dashboard/admin/analytics' },
  { name: 'AdminBlog', label: 'Blog', icon: 'newspaper-outline', webPath: '/dashboard/admin/blog' },
];

/** Website's fixed Admin-specific mobile nav. Existing screens keep their own
 * authorization gate; unsupported modules are visibly marked Website. */
export const AdminBottomNav: React.FC<{ routeName: string }> = ({ routeName }) => {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [moreOpen, setMoreOpen] = useState(false);

  const open = (item: AdminDestination) => {
    setMoreOpen(false);
    if (item.route && navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: item.route });
    } else if (item.webPath) {
      void openAdminWeb(item.webPath);
    }
  };
  return <>
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {tabs.map(tab => {
        const active = tab.name === routeName || (tab.name === 'More' && moreOpen);
        return <TouchableOpacity key={tab.name} onPress={() => tab.name === 'More' ? setMoreOpen(true) : open(tab)}
          accessibilityRole="tab" accessibilityLabel={tab.label}
          accessibilityState={{ selected: active }}
          style={[styles.tab, { minHeight: getBottomTabItemHeight(fontScale) }]}>
          <Ionicons name={tab.icon as any} size={22} color={active ? Colors.accent : Colors.textMuted} />
          <Text style={[styles.tabText, active && styles.activeText]} numberOfLines={2}>{tab.label}</Text>
          {active && <View style={styles.indicator} />}
        </TouchableOpacity>;
      })}
    </View>
    <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
      <View style={styles.modal}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.topRow}>
            <Text style={styles.heading}>Admin tools</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close admin menu"
              onPress={() => setMoreOpen(false)} style={styles.close}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll}>
            {overflow.map(item => <TouchableOpacity key={item.name} onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={item.webPath ? `${item.label}, opens the website` : item.label}
              style={styles.menuRow}>
              <Ionicons name={item.icon as any} size={21} color={Colors.accent} />
              <Text style={styles.menuText}>{item.label}</Text>
              {item.webPath && <Text style={styles.website}>Website</Text>}
              <Ionicons name={item.webPath ? 'open-outline' : 'chevron-forward'} size={17} color={Colors.textMuted} />
            </TouchableOpacity>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: Colors.bgDropdown, borderTopWidth: 1, borderColor: Colors.border, paddingTop: 7, paddingHorizontal: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: FontFamily.medium, textAlign: 'center' },
  activeText: { color: Colors.accent },
  indicator: { backgroundColor: Colors.accent, width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: -2 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.blackAlpha75 },
  sheet: { maxHeight: '84%', backgroundColor: Colors.bgCard, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: FontSize.xl, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  close: { padding: 8 },
  scroll: { flexGrow: 0 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: 1, borderColor: Colors.border, minHeight: 56 },
  menuText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontFamily: FontFamily.medium },
  website: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: FontFamily.bold },
});
