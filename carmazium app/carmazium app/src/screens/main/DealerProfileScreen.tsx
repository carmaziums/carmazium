import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { GlobalToastContext } from '../../components/GlobalToastProvider';
import { HamburgerButton } from '../../components/HamburgerButton';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { apiClient } from '../../lib/apiClient';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Backend response shapes (see GET /dealers/stats & /dealers/analytics) ──

interface DealerStats {
  companyName: string | null;
  isVerified: boolean;
  activeListings: number;
  totalViews: number;
  soldListings: number;
  activeLeads: number;
  totalLeads: number;
  totalRevenue: number;
  staffCount: number;
}

interface TopVehicle {
  id: string;
  title: string;
  image: string | null;
  views: number;
  offerCount: number;
  price: number;
  status: string;
  daysListed: number;
}

interface DealerAnalyticsSnapshot {
  kpis: {
    totalUnitsSold: number; totalUnitsSoldTrend: number;
    avgDaysToSell: number; avgDaysToSellTrend: number;
    offerConversionRate: number; offerConversionRateTrend: number;
    totalRevenue: number; totalRevenueTrend: number;
  };
  leadFunnel: { NEW: number; CONTACTED: number; QUALIFIED: number; NEGOTIATING: number; WON: number; LOST: number };
  inventoryHealth: { DRAFT: number; ACTIVE: number; OFFER_ACCEPTED: number; SOLD: number; WITHDRAWN: number };
  topVehicles: TopVehicle[];
}

const formatGBP = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${Math.round(value).toLocaleString('en-GB')}`;
  return `£${Math.round(value)}`;
};

const trendColor = (value: number) => (value > 0 ? Colors.success : value < 0 ? Colors.error : Colors.lightBlue_9ca3af);
const trendStyle = (value: number) =>
  value > 0 ? { color: Colors.success } : value < 0 ? { color: Colors.error } : { color: Colors.lightBlue_9ca3af };
const trendLabel = (value: number) => (value === 0 ? '—' : `${value > 0 ? '+' : ''}${value}%`);

export const DealerProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { showToast } = useContext(GlobalToastContext);
  const { user, setRole } = useAuthStore();
  const [activeSubTab, setActiveSubTab] = useState<'today' | 'this_week'>('today');

  const [stats, setStats] = useState<DealerStats | null>(null);
  const [analytics, setAnalytics] = useState<DealerAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Web blocks the whole dealer dashboard with a non-dismissable modal until
  // a verified dealer sets a contact phone (DealerPhoneGate). Mobile uses a
  // softer, dismissible-but-recurring banner instead — a full-screen block
  // is a heavier interruption than anything else in this app and risks
  // firing at an awkward moment (e.g. a deep link into a specific screen).
  // Dismissal is local-state only (no persisted "seen" flag), so it comes
  // back next session until the dealer actually sets a phone (mobile-
  // production-readiness-plan.md F19). Without this, phone-less dealer
  // listings show no contact number to buyers (per F7's gating) with
  // nothing on mobile telling the dealer why.
  const [dealerPhone, setDealerPhone] = useState<string | null>(null);
  const [phoneCheckDone, setPhoneCheckDone] = useState(false);
  const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient<{ success: boolean; data: any }>('/users/me');
        if (res?.success) setDealerPhone(res.data?.dealerProfile?.phone ?? null);
      } catch { /* fail open — don't nag if we can't tell */ }
      finally { setPhoneCheckDone(true); }
    })();
  }, []);

  const showPhoneBanner = phoneCheckDone && !dealerPhone && !phoneBannerDismissed;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        apiClient<{ success: boolean; data: DealerStats }>('/dealers/stats'),
        apiClient<{ success: boolean; data: DealerAnalyticsSnapshot }>('/dealers/analytics?range=7d'),
      ]);
      if (statsRes?.success) setStats(statsRes.data);
      if (analyticsRes?.success) setAnalytics(analyticsRes.data);
    } catch {
      // Keep whatever we already loaded — a transient network error shouldn't blank the screen.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const dealerDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const handleViewBuyerProfile = () => {
    setRole('buyer');
  };

  // ─── Derived data ──────────────────────────────────────────────────────

  const inv = analytics?.inventoryHealth;
  const liveCount = inv?.ACTIVE ?? 0;
  const pendingCount = (inv?.DRAFT ?? 0) + (inv?.OFFER_ACCEPTED ?? 0);
  const soldCount = inv?.SOLD ?? 0;
  const totalInventory = liveCount + pendingCount + soldCount + (inv?.WITHDRAWN ?? 0);

  const topListings = analytics?.topVehicles?.slice(0, 3) ?? [];

  const funnelStages = [
    { label: 'New leads', value: analytics?.leadFunnel?.NEW ?? 0, color: Colors.infoBlue },
    { label: 'Contacted', value: analytics?.leadFunnel?.CONTACTED ?? 0, color: Colors.lightPurple },
    { label: 'Qualified', value: analytics?.leadFunnel?.QUALIFIED ?? 0, color: Colors.error },
    { label: 'Negotiating', value: analytics?.leadFunnel?.NEGOTIATING ?? 0, color: Colors.warning },
    { label: 'Won', value: analytics?.leadFunnel?.WON ?? 0, color: Colors.success },
  ];
  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.value));

  const activeLeads = stats?.activeLeads ?? 0;
  const staffCount = stats?.staffCount ?? 0;

  const renderTodayView = () => {
    return (
      <View style={styles.tabContent}>
        {/* INVENTORY SNAPSHOT */}
        <View style={styles.card}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.cardTitle}>INVENTORY SNAPSHOT</Text>
            <Text style={styles.cardRightText}>{totalInventory} total</Text>
          </View>

          {/* Segmented bar */}
          <View style={styles.segmentBar}>
            {totalInventory > 0 ? (
              <>
                <View style={[styles.segment, { flex: liveCount, backgroundColor: Colors.success }]} />
                <View style={[styles.segment, { flex: pendingCount, backgroundColor: Colors.warning }]} />
                <View style={[styles.segment, { flex: soldCount, backgroundColor: Colors.error }]} />
              </>
            ) : (
              <View style={[styles.segment, { flex: 1, backgroundColor: Colors.whiteAlpha06 }]} />
            )}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>{liveCount} Live</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
              <Text style={styles.legendText}>{pendingCount} Pending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.legendText}>{soldCount} Sold</Text>
            </View>
          </View>
        </View>

        {/* TOP LISTINGS • 7D */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>TOP LISTINGS • 7D</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DealerInventory')}>
              <Text style={styles.sectionActionText}>See all</Text>
            </TouchableOpacity>
          </View>

          {topListings.length > 0 ? (
            <View style={styles.listingsList}>
              {topListings.map((vehicle, index) => (
                <React.Fragment key={vehicle.id}>
                  <View style={styles.listingRow}>
                    <View style={index === 0 ? styles.rankBadgeRed : styles.rankBadgeGray}>
                      <Text style={styles.rankBadgeText}>{index + 1}</Text>
                    </View>
                    <Image
                      source={vehicle.image ? { uri: vehicle.image } : undefined}
                      style={styles.listingThumb}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                      alt={vehicle.title}
                    />
                    <View style={styles.listingInfo}>
                      <Text style={styles.listingTitle} numberOfLines={1}>{vehicle.title}</Text>
                      <View style={styles.listingMeta}>
                        <Ionicons name="eye-outline" size={13} color={Colors.textSecondary} />
                        <Text style={styles.metaText}>{vehicle.views}</Text>
                        <Ionicons name="pricetag-outline" size={13} color={Colors.textSecondary} style={{ marginLeft: 10 }} />
                        <Text style={styles.metaText}>{vehicle.offerCount}</Text>
                      </View>
                    </View>
                    <Text style={styles.listingPrice}>{formatGBP(vehicle.price)}</Text>
                  </View>
                  {index < topListings.length - 1 && <View style={styles.listDivider} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                {loading ? 'Loading your listings…' : 'No listings yet — add your first vehicle to see it ranked here.'}
              </Text>
            </View>
          )}
        </View>

        {/* NEEDS ATTENTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>NEEDS ATTENTION</Text>

          <View style={styles.attentionList}>
            {/* Leads */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerLeads')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: Colors.errorAlpha08, borderColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="chatbubble-ellipses" size={18} color={Colors.error} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>{activeLeads} active lead{activeLeads === 1 ? '' : 's'}</Text>
                <Text style={styles.attentionSub}>Tap to view your CRM pipeline</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Direct offers */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerOffers')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: Colors.warningAlpha08, borderColor: Colors.warningAlpha15 }]}>
                <Ionicons name="pricetag" size={18} color={Colors.warning} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Direct offers</Text>
                <Text style={styles.attentionSub}>Review and respond to buyer offers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* My Offers */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerMyOffers')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.15)' }]}>
                <Ionicons name="send-outline" size={18} color={Colors.infoBlueLight} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>My offers</Text>
                <Text style={styles.attentionSub}>Track offers your dealership has sent</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Purchases */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerPurchases')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: 'rgba(167, 139, 250, 0.08)', borderColor: 'rgba(167, 139, 250, 0.15)' }]}>
                <Ionicons name="receipt-outline" size={18} color={Colors.palePurple_a78bfa} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Purchases</Text>
                <Text style={styles.attentionSub}>Vehicles bought by your dealership</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Earnings */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerEarnings')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: Colors.successAlpha08, borderColor: Colors.successAlpha20 }]}>
                <Ionicons name="cash-outline" size={18} color={Colors.success} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Earnings</Text>
                <Text style={styles.attentionSub}>Revenue, sales registry and receipts</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Live auctions (watch) */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Tabs', { screen: 'Live' })}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: Colors.infoBlueAlpha08, borderColor: Colors.infoBlueAlpha15 }]}>
                <Ionicons name="time" size={18} color={Colors.infoBlue} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Live auctions</Text>
                <Text style={styles.attentionSub}>Track your dealership's auctions in real time</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Manage auctions (create/schedule/cancel — was previously
                watch-only for dealers; SellerAuctionsScreen's create flow
                already works generically, it just had no dealer entry point) */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SellerAuctions')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: Colors.accentAlpha08, borderColor: Colors.accentAlpha15 }]}>
                <Ionicons name="hammer-outline" size={18} color={Colors.accent} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Manage auctions</Text>
                <Text style={styles.attentionSub}>Schedule, edit or put a listing up for auction</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>

            {/* Team */}
            <TouchableOpacity
              style={styles.attentionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DealerTeam')}
            >
              <View style={[styles.attentionIconWrap, { backgroundColor: 'rgba(167, 139, 250, 0.08)', borderColor: 'rgba(167, 139, 250, 0.15)' }]}>
                <Ionicons name="people-outline" size={18} color={Colors.palePurple_a78bfa} />
              </View>
              <View style={styles.attentionTextCol}>
                <Text style={styles.attentionTitle}>Team</Text>
                <Text style={styles.attentionSub}>{staffCount} member{staffCount === 1 ? '' : 's'} on your team</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SWITCH BUTTON (buyer/seller) */}
        <TouchableOpacity style={styles.switchProfileBtn} onPress={handleViewBuyerProfile} activeOpacity={0.8}>
          <Text style={styles.switchProfileText}>VIEW MY PROFILE</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFunnelBar = (label: string, value: string, percentage: number, color: string) => {
    return (
      <View style={styles.funnelItem} key={label}>
        <View style={styles.funnelLabelRow}>
          <Text style={styles.funnelLabel}>{label}</Text>
          <Text style={styles.funnelVal}>{value}</Text>
        </View>
        <View style={styles.funnelTrack}>
          <View style={[styles.funnelFill, { width: `${Math.max(0, Math.min(1, percentage)) * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const renderThisWeekView = () => {
    const kpis = analytics?.kpis;
    return (
      <View style={styles.tabContent}>
        {/* REVENUE SALES CARD */}
        <View style={styles.salesCard}>
          <LinearGradient
            colors={[Colors.accentAlpha12, 'rgba(59, 130, 246, 0.02)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.salesLabel}>SALES VALUE • LAST 7 DAYS</Text>
          <Text style={styles.salesValue}>{formatGBP(kpis?.totalRevenue ?? 0)}</Text>
          <View style={styles.sparklineIllustration}>
            <View style={styles.sparklineDotActive} />
            <View style={styles.sparklineLine} />
          </View>
        </View>

        {/* METRICS GRID */}
        <View style={styles.metricsGrid}>
          {/* Live listings */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>LIVE LISTINGS</Text>
              <Ionicons name="cube-outline" size={14} color={Colors.accent} />
            </View>
            <View style={styles.metricValRow}>
              <Text style={styles.metricNumber}>{liveCount}</Text>
            </View>
          </View>

          {/* Units sold */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>UNITS SOLD</Text>
              <Ionicons name="checkmark-done-outline" size={14} color={Colors.accent} />
            </View>
            <View style={styles.metricValRow}>
              <Text style={styles.metricNumber}>{kpis?.totalUnitsSold ?? 0}</Text>
              <Text style={[styles.metricChangeGreen, trendStyle(kpis?.totalUnitsSoldTrend ?? 0)]}>
                {trendLabel(kpis?.totalUnitsSoldTrend ?? 0)}
              </Text>
            </View>
          </View>

          {/* Avg days to sell */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>AVG DAYS TO SELL</Text>
              <Ionicons name="time-outline" size={14} color={Colors.warning} />
            </View>
            <View style={styles.metricValRow}>
              <Text style={styles.metricNumber}>{kpis?.avgDaysToSell ?? 0}</Text>
              <Text style={[styles.metricChangeGreen, trendStyle(kpis?.avgDaysToSellTrend ?? 0)]}>
                {trendLabel(kpis?.avgDaysToSellTrend ?? 0)}
              </Text>
            </View>
          </View>

          {/* Conversion */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricTitle}>OFFER CONVERSION</Text>
              <Ionicons name="bar-chart-outline" size={14} color={Colors.success} />
            </View>
            <View style={styles.metricValRow}>
              <Text style={styles.metricNumber}>{kpis?.offerConversionRate ?? 0}%</Text>
              <Text style={[styles.metricChangeGreen, trendStyle(kpis?.offerConversionRateTrend ?? 0)]}>
                {trendLabel(kpis?.offerConversionRateTrend ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* LEAD FUNNEL */}
        <View style={styles.sectionContainer}>
          <View style={styles.funnelHeaderRow}>
            <Text style={styles.sectionTitle}>LEAD FUNNEL</Text>
            <Text style={styles.funnelRightText}>All time</Text>
          </View>

          <View style={styles.funnelCard}>
            {funnelStages.map((stage) =>
              renderFunnelBar(stage.label, String(stage.value), stage.value / funnelMax, stage.color)
            )}
          </View>
        </View>

        {/* ADD LISTING BUTTON */}
        <TouchableOpacity
          style={styles.addListingCTA}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SellCarFlow')}
        >
          <Ionicons name="add" size={20} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.addListingCTAText}>ADD LISTING</Text>
        </TouchableOpacity>

        {/* SWITCH BUTTON (buyer/seller) */}
        <TouchableOpacity style={[styles.switchProfileBtn, { marginTop: 12 }]} onPress={handleViewBuyerProfile} activeOpacity={0.8}>
          <Text style={styles.switchProfileText}>VIEW MY PROFILE</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const companyLabel = (stats?.companyName || 'YOUR DEALERSHIP').toUpperCase();
  const badgeCount = activeLeads > 9 ? '9+' : String(activeLeads);

  const renderHeader = () => {
    if (activeSubTab === 'today') {
      return (
        <View style={styles.headerToday}>
          <View style={styles.headerLeft}>
            <HamburgerButton />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.dealerProSub}>• DEALER PRO</Text>
            <Text style={styles.headerTodayTitle}>Today</Text>
          </View>
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={styles.bellBtnCircle}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications" size={20} color={Colors.white} />
              {activeLeads > 0 && (
                <View style={styles.bellBadgeRed}>
                  <Text style={styles.bellBadgeText}>{badgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <IconButton style={[styles.bellBtnCircle, { marginLeft: 8 }]} icon={<Ionicons name="settings-outline" size={20} color={Colors.white} />} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.headerWeek}>
          <View style={styles.headerWeekLeft}>
            <View style={styles.dealerTitleRow}>
              <Text style={styles.dealerSub}>DEALER • {companyLabel}</Text>
              {stats?.isVerified && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerWeekTitle}>This week</Text>
          </View>
          <View style={styles.headerRightRow}>
            <IconButton style={styles.bellBtnCircle} icon={<Ionicons name="notifications-outline" size={20} color={Colors.white} />} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Notifications" />
            <IconButton style={[styles.bellBtnCircle, { marginLeft: 8 }]} icon={<Ionicons name="settings-outline" size={20} color={Colors.white} />} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
          </View>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient glow matching the dashboard styling */}
      <LinearGradient
        colors={[Colors.accentAlpha04, Colors.infoBlueAlpha04, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Colors.accent} />
        }
      >
        {/* Render Dynamic Header */}
        {renderHeader()}

        {showPhoneBanner && (
          <TouchableOpacity
            style={styles.phoneBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings' as any)}
          >
            <Ionicons name="call-outline" size={18} color={Colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.phoneBannerTitle}>Add a contact phone</Text>
              <Text style={styles.phoneBannerSub}>Buyers can't see a number to call you until you set one in Settings.</Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setPhoneBannerDismissed(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={16} color={Colors.iconMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* TODAY / THIS WEEK SUB-TABS SELECTOR */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeSubTab === 'today' && styles.tabToggleBtnActive]}
            onPress={() => {
              setActiveSubTab('today');
              showToast('Today dashboard loaded', 'info');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabToggleText, activeSubTab === 'today' && styles.tabToggleTextActive]}>
              TODAY
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeSubTab === 'this_week' && styles.tabToggleBtnActive]}
            onPress={() => {
              setActiveSubTab('this_week');
              showToast('Weekly performance loaded', 'info');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabToggleText, activeSubTab === 'this_week' && styles.tabToggleTextActive]}>
              THIS WEEK
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !stats && !analytics ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading your dashboard…</Text>
          </View>
        ) : (
          activeSubTab === 'today' ? renderTodayView() : renderThisWeekView()
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    paddingBottom: 20,
  },

  // Headers
  headerToday: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    width: 38,
    alignItems: 'flex-start',
  },
  headerCenter: {
    alignItems: 'center',
  },
  dealerProSub: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.accent,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTodayTitle: {
    fontSize: FontSize['3xl'] - 2,
    fontFamily: FontFamily.extraBold,
    color: Colors.white,
    letterSpacing: -0.8,
  },
  bellBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadgeRed: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },
  bellBadgeText: {
    fontSize: FontSize.size8,
    fontFamily: FontFamily.bold,
    color: Colors.white,
    lineHeight: 11,
  },

  headerWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerWeekLeft: {
    flex: 1,
  },
  dealerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dealerSub: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
  },
  proBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: FontSize.size8,
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  headerWeekTitle: {
    fontSize: FontSize['3xl'] - 2,
    fontFamily: FontFamily.extraBold,
    color: Colors.white,
    letterSpacing: -0.8,
  },

  // Toggle sub-tabs
  phoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningAlpha05,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: 14,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  phoneBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  phoneBannerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.whiteAlpha02,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    padding: 3,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabToggleBtnActive: {
    backgroundColor: Colors.accent,
  },
  tabToggleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1,
  },
  tabToggleTextActive: {
    color: Colors.white,
  },

  tabContent: {
    gap: 20,
  },

  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
  },

  // Today View - Inventory Snapshot
  card: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    marginHorizontal: 24,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
  },
  cardRightText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
  },
  segmentBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  segment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },

  // Today View - Top Listings
  sectionContainer: {
    marginHorizontal: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
    marginLeft: 4,
    marginBottom: 10,
  },
  sectionActionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accent,
    marginRight: 4,
  },
  listingsList: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyCardText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    textAlign: 'center',
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rankBadgeRed: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeGray: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  listingThumb: {
    width: 48,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.whiteAlpha02,
    marginRight: 12,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base - 1,
    color: Colors.white,
    marginBottom: 3,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  listingPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base - 1,
    color: Colors.white,
  },
  listDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha04,
  },

  // Today View - Needs Attention
  attentionList: {
    gap: 10,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  attentionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  attentionTextCol: {
    flex: 1,
  },
  attentionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base - 1,
    color: Colors.white,
    marginBottom: 2,
  },
  attentionSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
  },

  // This Week View - Revenue Sales Card
  salesCard: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 24,
    marginHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
    height: 110,
    justifyContent: 'center',
  },
  salesLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  salesValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'] + 2,
    color: Colors.white,
    letterSpacing: -1,
  },
  sparklineIllustration: {
    position: 'absolute',
    bottom: 12,
    right: 24,
    width: 80,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  sparklineDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    position: 'absolute',
    right: 4,
    top: 12,
  },
  sparklineLine: {
    width: 60,
    height: 2,
    backgroundColor: Colors.accentAlpha30,
    transform: [{ rotate: '-15deg' }],
  },

  // This Week View - Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 24,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 58) / 2,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  metricNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg + 1,
    color: Colors.white,
  },
  metricChangeGreen: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.success,
  },
  metricChangeYellow: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.warning,
  },

  // This Week View - Lead Funnel
  funnelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  funnelRightText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accent,
    letterSpacing: 0.5,
    marginRight: 4,
  },
  funnelCard: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
  },
  funnelItem: {
    marginBottom: 14,
  },
  funnelLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  funnelLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm - 1,
    color: Colors.textSecondary,
  },
  funnelVal: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm - 1,
    color: Colors.white,
  },
  funnelTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.whiteAlpha04,
    overflow: 'hidden',
  },
  funnelFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Action CTA Buttons
  addListingCTA: {
    marginHorizontal: 24,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  addListingCTAText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
  switchProfileBtn: {
    marginHorizontal: 24,
    height: 48,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.whiteAlpha12,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  switchProfileText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accent,
    letterSpacing: 0.8,
  },
});
