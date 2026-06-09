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
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BuyerDashData {
  activeBids: number;
  activeOffers: number;
  watchlistCount: number;
  wonAuctions: number;
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
}> = ({ label, icon, tone, value, sublabel, loading }) => (
  <View style={styles.kpiCard}>
    <View style={[styles.kpiGlow, { backgroundColor: tone }]} />
    <View style={styles.kpiTopRow}>
      <Text style={styles.kpiEyebrow}>{label}</Text>
      <Ionicons name={icon as any} size={14} color={tone} />
    </View>
    {loading ? (
      <View style={styles.skeletonValue} />
    ) : (
      <Text style={styles.kpiValue}>{value}</Text>
    )}
    {loading ? (
      <View style={styles.skeletonDelta} />
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

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, featuredRes, unreadRes] = await Promise.allSettled([
        apiClient<BuyerDashResponse>('/dashboard/buyer'),
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
  }, []);

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
        colors={['rgba(220,31,38,0.07)', 'rgba(10,10,12,0)', '#0A0A0C']}
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
          >
            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
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
          <Text style={styles.greetingHeadline}>Hello, {firstName}</Text>
          <Text style={styles.greetingSubtitle}>Your buying activity at a glance</Text>
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
            tone="#F59E0B"
            value={loading ? '–' : watchlistCount}
            sublabel={watchlistCount > 0 ? `${watchlistCount} saved` : 'none saved'}
            loading={loading}
          />
          <KpiCard
            label="LIVE BIDS"
            icon="hammer-outline"
            tone="#22C55E"
            value={loading ? '–' : activeBids}
            sublabel={activeBids > 0 ? 'in active auctions' : 'no active bids'}
            loading={loading}
          />
          <KpiCard
            label="AUCTIONS WON"
            icon="trophy"
            tone="#3B82F6"
            value={loading ? '–' : wonAuctions}
            sublabel={wonAuctions > 0 ? `${wonAuctions} won` : 'none yet'}
            loading={loading}
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
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation?.navigate('Alerts')}>
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
                    tone="#22C55E"
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
                  tone="#22C55E"
                  title="Auction Bids"
                  subtitle="Browse live auctions to start bidding"
                  time=""
                  onPress={() => navigation?.navigate('Live')}
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
              <View style={[styles.quickIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <Ionicons name="hammer-outline" size={18} color="#22C55E" />
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
              <View style={[styles.quickIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Ionicons name="document-text-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.quickLabel}>My Offers</Text>
              {activeOffers > 0 && (
                <View style={[styles.quickBadge, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.quickBadgeText}>{activeOffers}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickTile}
              activeOpacity={0.8}
              onPress={() => navigation?.navigate('Saved' as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: 'rgba(220,31,38,0.12)' }]}>
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
              <View style={[styles.quickIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="receipt-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.quickLabel}>History</Text>
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
              <Ionicons name="checkmark-circle-sharp" size={11} color="#22C55E" />
              <Text style={styles.verifiedBadgeText}>VERIFIED BUYER</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.profileGear}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_BG = 'rgba(20,26,42,0.70)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#DC1F26', borderWidth: 1.5, borderColor: '#0A0A0C' },

  // Greeting
  greetingSection: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 },
  greetingHeadline: { fontFamily: FontFamily.extraBold, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 2 },
  greetingSubtitle: { fontFamily: FontFamily.regular, fontSize: 14, color: '#5C5C6B' },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 24, marginBottom: 28 },
  kpiCard: { width: '47.5%', backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, padding: 18, overflow: 'hidden', position: 'relative' },
  kpiGlow: { position: 'absolute', top: -10, right: -10, width: 70, height: 70, borderRadius: 35, opacity: 0.18 },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  kpiEyebrow: { fontFamily: FontFamily.bold, fontSize: 9, color: '#5C5C6B', letterSpacing: 1, textTransform: 'uppercase', flex: 1, marginRight: 4 },
  kpiValue: { fontFamily: FontFamily.mono, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.56, marginBottom: 4 },
  kpiDelta: { fontFamily: FontFamily.bold, fontSize: 10 },
  skeletonValue: { width: 48, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 4 },
  skeletonDelta: { width: 56, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)' },

  // Hot Deal
  hotDealSection: { marginBottom: 28, paddingHorizontal: 24 },
  hotDealCard: { backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,0,55,0.25)', flexDirection: 'row', padding: 18, gap: 14, alignItems: 'center' },
  hotDealImage: { width: 96, height: 76, borderRadius: 12 },
  hotDealImagePlaceholder: { backgroundColor: 'rgba(255,255,255,0.06)' },
  hotDealInfo: { flex: 1 },
  hotDealTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF', marginBottom: 8 },
  hotDealPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hotDealPrice: { fontFamily: FontFamily.mono, fontSize: 16, color: '#FFFFFF', letterSpacing: -0.32 },
  hotDealCta: { backgroundColor: '#DC1F26', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  hotDealCtaText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.3 },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionEyebrow: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFFFFF', letterSpacing: 1, textTransform: 'uppercase' },

  // Activity
  activitySection: { paddingHorizontal: 24, marginBottom: 28 },
  activitySectionTitle: { fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 1, textTransform: 'uppercase' },
  seeAllText: { fontFamily: FontFamily.medium, fontSize: 11, color: '#DC1F26' },
  activityCard: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 17, gap: 14 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  activityIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityText: { flex: 1 },
  activityTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF', marginBottom: 1 },
  activitySubtitle: { fontFamily: FontFamily.regular, fontSize: 11, color: '#5C5C6B' },
  activityTime: { fontFamily: FontFamily.regular, fontSize: 10, color: '#5C5C6B', flexShrink: 0 },
  skeletonRow: { height: 52, marginHorizontal: 16, marginVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },

  // Quick actions
  quickActionsSection: { paddingHorizontal: 24, marginBottom: 28, gap: 14 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickTile: { flex: 1, backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, padding: 18, alignItems: 'center', gap: 8, position: 'relative' },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.3, textAlign: 'center' },
  quickBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quickBadgeText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFFFFF' },

  // Profile Card
  profileCard: { marginHorizontal: 24, marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, padding: 20, gap: 16 },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileAvatarText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#FFFFFF', marginBottom: 2 },
  profileEmail: { fontFamily: FontFamily.regular, fontSize: 12, color: '#A0A0AB', marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.20)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  verifiedBadgeText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#22C55E', letterSpacing: 0.5 },
  profileGear: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
