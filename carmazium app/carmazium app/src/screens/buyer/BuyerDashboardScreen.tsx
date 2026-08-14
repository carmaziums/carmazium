import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/apiClient';
import { getFeaturedListings } from '../../lib/listingsApi';
import { getUnreadCount } from '../../lib/notificationsApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Skeleton } from '../../components/ui/Skeleton';

import { IconButton } from '../../components/IconButton';
// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BuyerDashData {
  activeBids: number;
  activeOffers: number;
  watchlistCount: number;
  wonAuctions: number;
  totalSpent?: number;
  bids: Array<{
    id: string;
    amount: number;
    auctionStatus: string;
    listing: { title: string };
    listingId: string;
    createdAt: string;
  }>;
  offers: Array<{
    id: string;
    amount: number;
    status: string;
    counterAmount?: number | null;
    createdAt?: string;
    listing?: { title?: string; make?: string; model?: string };
  }>;
  history: any[];
}

interface BuyerDashResponse {
  success: boolean;
  data: BuyerDashData;
}

interface HotDeal {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  images?: string[];
  isFeatured?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPrice = (amount: number): string =>
  `£${amount.toLocaleString('en-GB')}`;

const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  icon: string;
  tone: string;
  value: number | string;
  sublabel: string;
  loading: boolean;
  fullWidth?: boolean;
}> = ({ label, icon, tone, value, sublabel, loading, fullWidth }) => (
  <View style={[styles.kpiCard, fullWidth && styles.kpiCardFull]}>
    <View style={[styles.kpiGlow, { backgroundColor: tone }]} />
    <View style={styles.kpiTopRow}>
      <Text style={styles.kpiEyebrow}>{label}</Text>
      <Ionicons name={icon as any} size={14} color={tone} />
    </View>
    {loading ? (
      <Skeleton w={80} h={28} r={6} />
    ) : (
      <Text style={styles.kpiValue}>{value}</Text>
    )}
    {loading ? (
      <Skeleton w={56} h={10} r={4} />
    ) : (
      <Text style={[styles.kpiDelta, { color: tone }]}>{sublabel}</Text>
    )}
  </View>
);

// ─── Activity Row ─────────────────────────────────────────────────────────────

const ActivityRow: React.FC<{
  icon: string;
  tone: string;
  title: string;
  subtitle: string;
  time: string;
  onPress?: () => void;
  isLast?: boolean;
}> = ({ icon, tone, title, subtitle, time, onPress, isLast }) => (
  <TouchableOpacity
    style={[styles.activityRow, !isLast && styles.activityRowBorder]}
    activeOpacity={0.7}
    onPress={onPress}
  >
    <View style={[styles.activityIcon, { backgroundColor: `${tone}1F`, borderColor: `${tone}45` }]}>
      <Ionicons name={icon as any} size={16} color={tone} />
    </View>
    <View style={styles.activityText}>
      <Text style={styles.activityTitle}>{title}</Text>
      {subtitle !== '–' && subtitle !== '' && (
        <Text style={styles.activitySubtitle} numberOfLines={1}>{subtitle}</Text>
      )}
    </View>
    <Text style={styles.activityTime}>{time}</Text>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export const BuyerDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [dash, setDash] = useState<BuyerDashData | null>(null);
  const [hotDeal, setHotDeal] = useState<HotDeal | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';
  const displayName = user
    ? `${user.firstName || ''}${user.lastName ? ' ' + user.lastName : ''}`.trim() || user.email
    : 'User';
  const displayEmail = user?.email || '';
  const initials = (displayName as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // 7d/30d period toggle — matches web's dashboard/buyer/page.tsx, which
  // re-queries /dashboard/buyer?period=... and scopes all four stat cards
  // (including Total Spent, added below) to that window.
  const [period, setPeriod] = useState<'7d' | '30d'>('30d');

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, featuredRes, unreadRes] = await Promise.allSettled([
        apiClient<BuyerDashResponse>(`/dashboard/buyer?period=${period}`),
        getFeaturedListings(),
        getUnreadCount(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
        setDash(dashRes.value.data);
      }
      if (featuredRes.status === 'fulfilled' && featuredRes.value?.length > 0) {
        const f = featuredRes.value[0] as any;
        setHotDeal(f);
      }
      if (unreadRes.status === 'fulfilled') {
        setUnreadCount(unreadRes.value);
      }
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Derived data
  const activeBids = dash?.activeBids ?? 0;
  const activeOffers = dash?.activeOffers ?? 0;
  const watchlistCount = dash?.watchlistCount ?? 0;
  const wonAuctions = dash?.wonAuctions ?? 0;
  const totalSpent = dash?.totalSpent ?? 0;

  // Recent activity rows (up to 4): show countered offers first, then active bids
  const recentOffers = (dash?.offers ?? []).slice(0, 2);
  const recentBids = (dash?.bids ?? []).filter(b => b.auctionStatus === 'ACTIVE').slice(0, 2);
  const hasActivity = recentOffers.length > 0 || recentBids.length > 0;

  // Hot deal
  const hotDealTitle = hotDeal
    ? `${hotDeal.make} ${hotDeal.model} ${hotDeal.year}`
    : null;
  const hotDealPrice = hotDeal ? formatPrice(hotDeal.price) : null;
  const hotDealImage = (hotDeal as any)?.images?.[0] ?? null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Logo size="sm" />
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('Notifications')}
           accessibilityLabel="Notifications" accessibilityRole="button" hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}>
            <Ionicons name="notifications-outline" size={18} color={Colors.white} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
          <HamburgerButton />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* ── 1. Greeting ── */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingHeadline}>Hello, {firstName}</Text>
              <Text style={styles.greetingSubtitle}>Your buying activity at a glance</Text>
            </View>
            <View style={styles.periodPillRow}>
              {(['7d', '30d'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodPill, period === p && styles.periodPillActive]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodPillText, period === p && styles.periodPillTextActive]}>
                    {p === '7d' ? '7D' : '30D'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── 2. KPI 2×2 Grid ── */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="ACTIVE OFFERS"
            icon="document-text-outline"
            tone={Colors.accent}
            value={loading ? '–' : activeOffers}
            sublabel={activeOffers > 0 ? `${activeOffers} pending` : 'none pending'}
            loading={loading}
          />
          <KpiCard
            label="WATCHING"
            icon="heart"
            tone={Colors.warning}
            value={loading ? '–' : watchlistCount}
            sublabel={watchlistCount > 0 ? `${watchlistCount} saved` : 'none saved'}
            loading={loading}
          />
          <KpiCard
            label="LIVE BIDS"
            icon="hammer-outline"
            tone={Colors.success}
            value={loading ? '–' : activeBids}
            sublabel={activeBids > 0 ? 'in active auctions' : 'no active bids'}
            loading={loading}
          />
          <KpiCard
            label="AUCTIONS WON"
            icon="trophy"
            tone={Colors.infoBlue}
            value={loading ? '–' : wonAuctions}
            sublabel={wonAuctions > 0 ? `${wonAuctions} won` : 'none yet'}
            loading={loading}
          />
          <KpiCard
            label="TOTAL SPENT"
            icon="cash-outline"
            tone={Colors.success}
            value={loading ? '–' : formatPrice(totalSpent)}
            sublabel={period === '7d' ? 'last 7 days' : 'last 30 days'}
            loading={loading}
            fullWidth
          />
        </View>

        {/* ── 3. Hot Deal ── (only when available) */}
        {hotDeal && (
          <View style={styles.hotDealSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionEyebrow}>FEATURED LISTING</Text>
            </View>
            <View style={styles.hotDealCard}>
              {hotDealImage ? (
                <Image source={{ uri: hotDealImage }} style={styles.hotDealImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.hotDealImage, styles.hotDealImagePlaceholder]} />
              )}
              <View style={styles.hotDealInfo}>
                <Text style={styles.hotDealTitle} numberOfLines={2}>{hotDealTitle}</Text>
                <View style={styles.hotDealPriceRow}>
                  <Text style={styles.hotDealPrice}>{hotDealPrice}</Text>
                  <TouchableOpacity
                    style={styles.hotDealCta}
                    activeOpacity={0.8}
                    onPress={() => navigation?.navigate('VehicleDetail', { id: hotDeal.id })}
                  >
                    <Text style={styles.hotDealCtaText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── 4. Recent Activity ── */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.activitySectionTitle}>RECENT ACTIVITY</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation?.navigate('Notifications')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {!loading && hasActivity ? (
              <>
                {recentOffers.map((offer, idx) => {
                  const isCountered = offer.status === 'COUNTERED';
                  const title = isCountered ? 'Counter-offer received' : 'Offer sent';
                  const subtitle = offer.listing?.make
                    ? `${offer.listing.make} ${offer.listing.model || ''}`.trim()
                    : (offer.listing?.title || '–');
                  const isLast = idx === recentOffers.length - 1 && recentBids.length === 0;
                  return (
                    <ActivityRow
                      key={offer.id}
                      icon={isCountered ? 'pricetag-outline' : 'document-text-outline'}
                      tone={isCountered ? Colors.accent : Colors.warning}
                      title={title}
                      subtitle={subtitle}
                      time={timeAgo(offer.createdAt)}
                      onPress={() => navigation?.navigate('BuyerOffers')}
                      isLast={isLast}
                    />
                  );
                })}
                {recentBids.map((bid, idx) => (
                  <ActivityRow
                    key={bid.id}
                    icon="hammer-outline"
                    tone={Colors.success}
                    title="Active bid"
                    subtitle={bid.listing?.title || '–'}
                    time={timeAgo(bid.createdAt)}
                    onPress={() => navigation?.navigate('BuyerBids')}
                    isLast={idx === recentBids.length - 1}
                  />
                ))}
              </>
            ) : !loading ? (
              <>
                <ActivityRow
                  icon="hammer-outline"
                  tone={Colors.success}
                  title="Auction Bids"
                  subtitle="Browse live auctions to start bidding"
                  time=""
                  onPress={() => navigation?.navigate('Tabs', { screen: 'Live' })}
                />
                <ActivityRow
                  icon="pricetag-outline"
                  tone={Colors.warning}
                  title="Make an Offer"
                  subtitle="Browse listings and make your first offer"
                  time=""
                  onPress={() => navigation?.navigate('Search')}
                  isLast
                />
              </>
            ) : (
              <>
                <View style={styles.skeletonRow} />
                <View style={styles.skeletonRow} />
                <View style={[styles.skeletonRow, { marginBottom: 0 }]} />
              </>
            )}
          </View>
        </View>

        {/* ── 5. Quick actions ── */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.activitySectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('BuyerBids')}
            >
              <View style={[styles.quickIcon, { backgroundColor: Colors.successAlpha12 }]}>
                <Ionicons name="hammer-outline" size={18} color={Colors.success} />
              </View>
              <Text style={styles.quickLabel}>My Bids</Text>
              {activeBids > 0 && (
                <View style={styles.quickBadge}>
                  <Text style={styles.quickBadgeText}>{activeBids}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('BuyerOffers')}
            >
              <View style={[styles.quickIcon, { backgroundColor: Colors.warningAlpha12 }]}>
                <Ionicons name="document-text-outline" size={18} color={Colors.warning} />
              </View>
              <Text style={styles.quickLabel}>My Offers</Text>
              {activeOffers > 0 && (
                <View style={[styles.quickBadge, { backgroundColor: Colors.warning }]}>
                  <Text style={styles.quickBadgeText}>{activeOffers}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('Tabs', { screen: 'Saved' })}
            >
              <View style={[styles.quickIcon, { backgroundColor: Colors.accentAlpha12 }]}>
                <Ionicons name="heart" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.quickLabel}>Watchlist</Text>
              {watchlistCount > 0 && (
                <View style={[styles.quickBadge, { backgroundColor: Colors.accent }]}>
                  <Text style={styles.quickBadgeText}>{watchlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('BuyerPurchaseHistory')}
            >
              <View style={[styles.quickIcon, { backgroundColor: Colors.infoBlueAlpha12 }]}>
                <Ionicons name="receipt-outline" size={18} color={Colors.infoBlue} />
              </View>
              <Text style={styles.quickLabel}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('BuyerDeliveryRequests')}
            >
              <View style={[styles.quickIcon, { backgroundColor: Colors.accentGreenAlpha12 }]}>
                <Ionicons name="car-outline" size={18} color={Colors.accentGreen} />
              </View>
              <Text style={styles.quickLabel}>Delivery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 6. Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle-sharp" size={11} color={Colors.success} />
              <Text style={styles.verifiedBadgeText}>VERIFIED BUYER</Text>
            </View>
          </View>
          <IconButton style={styles.profileGear} icon={<Ionicons name="settings-outline" size={18} color={Colors.textSecondary} />} onPress={() => navigation?.navigate('Settings')} accessibilityLabel="Settings" />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_BG = 'rgba(20,26,42,0.70)';
const CARD_BORDER = Colors.whiteAlpha06;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: { width: 38, height: 38, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.bgPrimary },

  // Greeting
  greetingSection: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 },
  greetingTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greetingHeadline: { fontFamily: FontFamily.extraBold, fontSize: FontSize['3xl'], color: Colors.white, letterSpacing: -0.5, marginBottom: 2 },
  greetingSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.textMuted },
  periodPillRow: { flexDirection: 'row', gap: 6, backgroundColor: Colors.whiteAlpha04, borderRadius: 10, padding: 3 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodPillActive: { backgroundColor: Colors.accent },
  periodPillText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.iconMuted, letterSpacing: 0.4 },
  periodPillTextActive: { color: Colors.white },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 24, marginBottom: 28 },
  kpiCard: { width: '47.5%', backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: CARD_BORDER, padding: 18, overflow: 'hidden', position: 'relative' },
  kpiCardFull: { width: '100%' },
  kpiGlow: { position: 'absolute', top: -10, right: -10, width: 70, height: 70, borderRadius: 35, opacity: 0.18 },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  kpiEyebrow: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', flex: 1, marginRight: 4 },
  kpiValue: { fontFamily: FontFamily.mono, fontSize: FontSize['3xl'], color: Colors.white, letterSpacing: -0.56, marginBottom: 4 },
  kpiDelta: { fontFamily: FontFamily.bold, fontSize: FontSize.size10 },
  skeletonValue: { width: 48, height: 28, borderRadius: 6, backgroundColor: Colors.whiteAlpha06, marginBottom: 4 },
  skeletonDelta: { width: 56, height: 10, borderRadius: 4, backgroundColor: Colors.whiteAlpha04 },

  // Hot Deal
  hotDealSection: { marginBottom: 28, paddingHorizontal: 24 },
  hotDealCard: { backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1.5, borderColor: 'rgba(255,0,55,0.25)', flexDirection: 'row', padding: 18, gap: 14, alignItems: 'center' },
  hotDealImage: { width: 96, height: 76, borderRadius: 12 },
  hotDealImagePlaceholder: { backgroundColor: Colors.whiteAlpha06 },
  hotDealInfo: { flex: 1 },
  hotDealTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 8 },
  hotDealPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hotDealPrice: { fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.white, letterSpacing: -0.32 },
  hotDealCta: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  hotDealCtaText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 0.3 },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionEyebrow: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white, letterSpacing: 1, textTransform: 'uppercase' },

  // Activity
  activitySection: { paddingHorizontal: 24, marginBottom: 28 },
  activitySectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1, textTransform: 'uppercase' },
  seeAllText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.accent },
  activityCard: { backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 17, gap: 14 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha06 },
  activityIcon: { width: 36, height: 36, borderRadius: Radius.inline, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityText: { flex: 1 },
  activityTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 1 },
  activitySubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  activityTime: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, flexShrink: 0 },
  skeletonRow: { height: 52, marginHorizontal: 16, marginVertical: 7, borderRadius: 8, backgroundColor: Colors.whiteAlpha04 },

  // Quick actions
  quickActionsSection: { paddingHorizontal: 24, marginBottom: 28, gap: 14 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickTile: { flex: 1, backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: CARD_BORDER, padding: 18, alignItems: 'center', gap: 8, position: 'relative' },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white, letterSpacing: 0.3, textAlign: 'center' },
  quickBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quickBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white },

  // Profile Card
  profileCard: { marginHorizontal: 24, marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: Radius.card, borderWidth: 1, borderColor: CARD_BORDER, padding: 20, gap: 16 },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, marginBottom: 2 },
  profileEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textSecondary, marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.successAlpha08, borderWidth: 1, borderColor: Colors.successAlpha20, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  verifiedBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.success, letterSpacing: 0.5 },
  profileGear: { width: 38, height: 38, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
