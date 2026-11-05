import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Card } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Colors } from '../../constants/colors';
import { FontFamily, TextPresets, Type } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { getAdminStats, type AdminStats } from '../../lib/adminApi';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { AdminHeader, adminStyles, formatPrice, openAdminWeb } from './adminShared';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type MenuItem = {
  label: string;
  icon: string;
  /** Native destination. */
  screen?: 'AdminListingsReview' | 'AdminHandovers' | 'AdminAccounts' | 'AdminDealerKyc' | 'SellCarFlow' | 'AdminAppInsights';
  /** Website admin path, opened in the in-app browser. */
  webPath?: string;
};

// Same sections, labels and order as the website admin sidebar
// (src/components/dashboard/DashboardSidebar.tsx `admin`). Overview is this
// screen, so it is not repeated as a row.
const MENU: { section: string; items: MenuItem[] }[] = [
  {
    section: 'Workspace',
    items: [
      { label: 'Messages', icon: 'chatbubbles-outline', webPath: '/dashboard/admin/messages' },
    ],
  },
  {
    section: 'Marketplace',
    items: [
      { label: 'Create Listing', icon: 'add-circle-outline', screen: 'SellCarFlow' },
      { label: 'Listings', icon: 'car-outline', screen: 'AdminListingsReview' },
      { label: 'Auctions', icon: 'gavel-outline', webPath: '/dashboard/admin/auctions' },
      { label: 'Handovers', icon: 'handshake', screen: 'AdminHandovers' },
      { label: 'Sale Cancellations', icon: 'shield-checkmark', webPath: '/dashboard/admin/cancellations' },
    ],
  },
  {
    section: 'Payments & reports',
    items: [
      { label: 'Transactions', icon: 'receipt-outline', webPath: '/dashboard/admin/transactions' },
      { label: 'Vehicle History Reports', icon: 'shield-checkmark', webPath: '/dashboard/admin/hpi' },
      { label: 'Free Listing Grants', icon: 'gift-outline', webPath: '/dashboard/admin/free-listings' },
    ],
  },
  {
    section: 'Accounts & partners',
    items: [
      { label: 'Accounts', icon: 'people-outline', screen: 'AdminAccounts' },
      { label: 'All Dealers', icon: 'business-outline', webPath: '/dashboard/admin/dealers' },
      { label: 'Dealer KYC', icon: 'shield-outline', screen: 'AdminDealerKyc' },
      { label: 'Trade Services', icon: 'briefcase-outline', webPath: '/dashboard/admin/services' },
    ],
  },
  {
    section: 'Content & insights',
    items: [
      { label: 'Online now, app & problem reports', icon: 'pulse-outline', screen: 'AdminAppInsights' },
      { label: 'Analytics', icon: 'trending-up', webPath: '/dashboard/admin/analytics' },
      { label: 'AI Reports', icon: 'sparkles', webPath: '/dashboard/admin/ai-reports' },
      { label: 'Marketing Popup', icon: 'megaphone-outline', webPath: '/dashboard/admin/marketing-popup' },
      { label: 'Blog', icon: 'newspaper-outline', webPath: '/dashboard/admin/blog' },
    ],
  },
];

// The website overview's default KPI cards (DEFAULT_ADMIN_CARD_IDS in
// src/app/dashboard/admin/page.tsx), with the same labels and values.
const STAT_CARDS: { label: string; description: string; value: (s: AdminStats | null) => string }[] = [
  { label: 'Users', description: 'All platform accounts', value: (s) => (s?.totalUsers ?? 0).toLocaleString() },
  { label: 'Listings', description: 'All marketplace listings', value: (s) => (s?.totalListings ?? 0).toLocaleString() },
  { label: 'Sold', description: 'Completed vehicle sales', value: (s) => (s?.soldListings ?? 0).toLocaleString() },
  { label: 'Auctions', description: 'All auction records', value: (s) => (s?.totalAuctions ?? 0).toLocaleString() },
  { label: 'Bids', description: 'All auction bid activity', value: (s) => (s?.totalBids ?? 0).toLocaleString() },
  { label: 'Revenue', description: 'Retained platform revenue', value: (s) => formatPrice(s?.totalRevenue ?? 0) },
];

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const bottomPad = useTabBarClearance();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      setStats(await getAdminStats());
    } catch (err: any) {
      setError(err?.message || 'Failed to load system statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const openItem = (item: MenuItem) => {
    if (item.screen) {
      navigation.navigate(item.screen as never);
      return;
    }
    if (item.webPath) void openAdminWeb(item.webPath);
  };

  return (
    <View style={adminStyles.screen}>
      <AdminHeader
        title="Admin Control Panel"
        subtitle="CarMazium platform overview"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? <ErrorBanner message={error} onRetry={() => void load(false)} /> : null}

        <Text style={adminStyles.sectionLabel}>Overview</Text>
        <View style={styles.statGrid}>
          {STAT_CARDS.map((card) => (
            <Card key={card.label} style={styles.statCard} padded>
              <Text style={adminStyles.fieldLabel}>{card.label}</Text>
              {loading && !stats ? (
                <View style={styles.statSkeleton}><Skeleton w={80} h={22} r={Radius.chip} /></View>
              ) : (
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {card.value(stats)}
                </Text>
              )}
              <Text style={adminStyles.meta} numberOfLines={1}>{card.description}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.note} padded>
          <View style={adminStyles.row}>
            <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
            <Text style={[adminStyles.body, styles.noteText]}>
              Sections marked “Website” open the CarMazium website admin console. Sign in there with your admin account.
            </Text>
          </View>
        </Card>

        {MENU.map((group) => (
          <View key={group.section} style={styles.group}>
            <Text style={adminStyles.sectionLabel}>{group.section}</Text>
            <Card padded={false}>
              {group.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuRow, index > 0 && styles.menuRowBorder]}
                  onPress={() => openItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.webPath ? `${item.label}, opens the website` : item.label}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon} size={18} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.webPath ? <Text style={styles.webTag}>Website</Text> : null}
                  <Ionicons
                    name={item.webPath ? 'open-outline' : 'chevron-forward'}
                    size={14}
                    color={Colors.iconMuted}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  statSkeleton: { marginVertical: 6 },
  statValue: { ...TextPresets.monoFigure, fontSize: Type.h4, color: Colors.textPrimary, marginVertical: 6 },
  note: {},
  noteText: { flex: 1 },
  group: { gap: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.chip,
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: Type.body, color: Colors.textPrimary },
  webTag: {
    fontFamily: FontFamily.extraBold,
    fontSize: Type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
});
