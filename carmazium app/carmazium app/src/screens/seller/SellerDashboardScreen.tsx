import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Skeleton } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { CarListing } from '../../data/listings';

// ─────────────────────────── interfaces ───────────────────────────

interface ListingStats {
  activeListings: number;
  totalViews: number;
  offersReceived: number;
  savedCount: number;
}

interface StatsResponse {
  success: boolean;
  data: ListingStats;
}

interface ApiListing {
  id: string;
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  status?: string;
  viewCount?: number;
  images?: string[];
  createdAt?: string;
}

interface MyListingsResponse {
  success: boolean;
  data: ApiListing[];
}

interface IncomingOffer {
  id: string;
  amount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
  listing?: { title?: string; price?: number };
  buyer?: { firstName?: string; lastName?: string };
  createdAt?: string;
}

interface SellerDashResponse {
  success: boolean;
  data: {
    activeListings?: number;
    offerCount?: number;
    savedCount?: number;
    offers?: IncomingOffer[];
  };
}

// ──────────────────────── static config ───────────────────────────

const LISTING_STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; border: string }> = {
  ACTIVE: { bg: 'rgba(16,185,129,0.22)', text: '#34d399', label: '• LIVE', border: 'rgba(16,185,129,0.40)' },
  DRAFT:  { bg: 'rgba(245,158,11,0.18)', text: '#F59E0B', label: 'DRAFT', border: 'rgba(245,158,11,0.35)' },
  SOLD:   { bg: 'rgba(255,255,255,0.08)', text: '#A0A0AB', label: 'SOLD',  border: 'rgba(255,255,255,0.12)' },
  PENDING:{ bg: 'rgba(59,130,246,0.18)', text: '#3B82F6', label: 'PENDING', border: 'rgba(59,130,246,0.35)' },
};

// ────────────────────────── helpers ───────────────────────────────

const formatPrice = (price?: number): string => {
  if (!price) return '–';
  return `£${price.toLocaleString('en-GB')}`;
};

const getListingTitle = (item: ApiListing): string => {
  if (item.title) return item.title;
  return `${item.year ?? ''} ${item.make ?? ''} ${item.model ?? ''}`.trim() || 'Untitled';
};

const getDaysListed = (createdAt?: string): string => {
  if (!createdAt) return '–';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return `${days}d listed`;
};

const mapApiListingToCarListing = (item: ApiListing): CarListing => ({
  id: item.id,
  make: item.make || '',
  model: item.model || '',
  variant: '',
  year: item.year || 0,
  price: item.price || 0,
  mileage: 0,
  fuelType: 'Petrol',
  transmission: 'Automatic',
  category: 'Sports',
  condition: 'Used',
  colour: '',
  bhp: 0,
  zeroToSixty: 0,
  topSpeed: 0,
  location: '',
  dealer: '',
  rating: 0,
  images: item.images || [],
  isFeatured: false,
  isNew: false,
});

// ─────────────────── quick actions config ─────────────────────────

const QUICK_ACTIONS = [
  {
    key: 'boost',
    icon: 'flash-outline',
    tone: '#F59E0B',
    toneBg: 'rgba(245,158,11,0.12)',
    label: 'Boost listing',
    sub: 'More views for £9.99',
  },
  {
    key: 'share',
    icon: 'share-outline',
    tone: '#3B82F6',
    toneBg: 'rgba(59,130,246,0.12)',
    label: 'Share listing',
    sub: 'Copy link or social',
  },
  {
    key: 'insights',
    icon: 'bar-chart-outline',
    tone: '#818CF8',
    toneBg: 'rgba(129,140,248,0.12)',
    label: 'View insights',
    sub: 'Clicks, searches, reach',
  },
  {
    key: 'sold',
    icon: 'checkmark-circle-outline',
    tone: '#22C55E',
    toneBg: 'rgba(34,197,94,0.12)',
    label: 'Mark as sold',
    sub: 'Close listing',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<ListingStats>({ activeListings: 0, totalViews: 0, offersReceived: 0, savedCount: 0 });
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [recentOffers, setRecentOffers] = useState<IncomingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, listingsRes, dashRes] = await Promise.allSettled([
        apiClient<StatsResponse>('/listings/stats'),
        apiClient<MyListingsResponse>('/listings/my?page=1&limit=5'),
        apiClient<SellerDashResponse>('/dashboard/seller'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.data);
      }
      if (listingsRes.status === 'fulfilled' && listingsRes.value?.success) {
        setListings(Array.isArray(listingsRes.value.data) ? listingsRes.value.data : []);
      }
      if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
        const dashData = dashRes.value.data;
        const offers = dashData?.offers;
        setRecentOffers(Array.isArray(offers) ? offers.slice(0, 3) : []);
        // Merge offer count + saves from dashboard into stats
        setStats(prev => ({
          ...prev,
          offersReceived: dashData?.offerCount ?? prev.offersReceived,
          savedCount: dashData?.savedCount ?? 0,
        }));
      }
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroListing = listings[0] ?? null;
  const heroStatusKey = (heroListing?.status ?? 'DRAFT').toUpperCase();
  const heroStatusCfg = LISTING_STATUS_CONFIG[heroStatusKey] ?? LISTING_STATUS_CONFIG.DRAFT;

  const handleQuickAction = (key: string) => {
    if (key === 'sold') {
      Alert.alert(
        'Mark as sold',
        'Are you sure you want to close this listing?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark as Sold', style: 'destructive', onPress: () => {} },
        ],
      );
    } else {
      Alert.alert('Coming soon', 'This feature is coming in a future update.');
    }
  };

  // ─────────────────── render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(59,130,246,0.05)', 'rgba(220,31,38,0.03)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* safe-area top spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEyebrow}>MY LISTING</Text>
          <Text style={styles.headerTitle}>Selling</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75} onPress={() => navigation?.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >

        {/* ── 1. Hero listing card ── */}
        {heroListing ? (
          <View style={styles.heroCard}>
            {/* Image area */}
            <View style={styles.heroImageArea}>
              {heroListing.images?.[0] ? (
                <Image
                  source={{ uri: heroListing.images[0] }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroImagePlaceholder} />
              )}

              {/* LIVE / DRAFT badge */}
              <View style={[styles.heroBadge, { backgroundColor: heroStatusCfg.bg, borderColor: heroStatusCfg.border }]}>
                <Text style={[styles.heroBadgeText, { color: heroStatusCfg.text }]}>
                  {heroStatusCfg.label}
                </Text>
              </View>

              {/* Edit pill */}
              <TouchableOpacity
                style={styles.heroEditBtn}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate('SellCarFlow')}
              >
                <Ionicons name="pencil-outline" size={15} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Days listed pill */}
              <View style={styles.heroDaysPill}>
                <Text style={styles.heroDaysPillText}>{getDaysListed(heroListing.createdAt)}</Text>
              </View>
            </View>

            {/* Card body */}
            <View style={styles.heroBody}>
              <View style={styles.heroBodyLeft}>
                <Text style={styles.heroTitle} numberOfLines={1}>{getListingTitle(heroListing)}</Text>
                <Text style={styles.heroSpecs} numberOfLines={1}>
                  {[heroListing.year, heroListing.make, heroListing.model].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={styles.heroPrice}>{formatPrice(heroListing.price)}</Text>
            </View>
          </View>
        ) : null}

        {/* ── 2. Stats row ── */}
        {loading ? (
          <View style={styles.statsRow}>
            <Skeleton w={(SCREEN_WIDTH - 48 - 24) / 3} h={90} r={16} />
            <Skeleton w={(SCREEN_WIDTH - 48 - 24) / 3} h={90} r={16} />
            <Skeleton w={(SCREEN_WIDTH - 48 - 24) / 3} h={90} r={16} />
          </View>
        ) : (
          <View style={styles.statsRow}>
            {/* Views */}
            <View style={[styles.statCard, styles.statCardViews]}>
              <Ionicons name="eye-outline" size={15} color={Colors.textMuted} />
              <Text style={styles.statValue}>
                {stats.totalViews.toLocaleString('en-GB')}
              </Text>
              <Text style={styles.statLabel}>VIEWS</Text>
              <Text style={[styles.statDelta, { color: Colors.textMuted }]}>total</Text>
            </View>

            {/* Saves */}
            <View style={[styles.statCard, styles.statCardSaves]}>
              <Ionicons name="heart-outline" size={15} color={Colors.accent} />
              <Text style={styles.statValue}>
                {stats.savedCount.toLocaleString('en-GB')}
              </Text>
              <Text style={styles.statLabel}>SAVES</Text>
              <Text style={[styles.statDelta, { color: Colors.textMuted }]}>watching</Text>
            </View>

            {/* Offers */}
            <View style={[styles.statCard, styles.statCardOffers]}>
              <Ionicons name="pricetag-outline" size={15} color="#F59E0B" />
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {stats.offersReceived}
              </Text>
              <Text style={[styles.statLabel, { color: '#F59E0B' }]}>OFFERS</Text>
              <Text style={[styles.statDelta, { color: '#F59E0B' }]}>received</Text>
            </View>
          </View>
        )}

        {/* ── 3. Quick nav row ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('SellerListings')}
          >
            <Ionicons name="list-outline" size={15} color="#A0A0AB" />
            <Text style={{ fontFamily: FontFamily.bold, fontSize: 12, color: '#A0A0AB' }}>
              All Listings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('SellerAuctions')}
          >
            <Ionicons name="hammer-outline" size={15} color="#A0A0AB" />
            <Text style={{ fontFamily: FontFamily.bold, fontSize: 12, color: '#A0A0AB' }}>
              My Auctions
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Create listing CTA ── */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate('SellCarFlow')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.ctaButtonText}>CREATE NEW LISTING</Text>
        </TouchableOpacity>

        {/* ── 4. Latest offers ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Latest offers</Text>
            <TouchableOpacity activeOpacity={0.75} onPress={() => navigation?.navigate('SellerOffers')}>
              <Text style={styles.sectionSeeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentOffers.length === 0 ? (
            <View style={styles.offersEmpty}>
              <Ionicons name="mail-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.offersEmptyTitle}>No offers yet</Text>
              <Text style={styles.offersEmptySub}>Buyers can make offers on your listings</Text>
            </View>
          ) : (
            <View style={styles.offersCard}>
              {recentOffers.map((offer, idx) => {
                const buyerName = [offer.buyer?.firstName, offer.buyer?.lastName].filter(Boolean).join(' ') || 'Buyer';
                const listingTitle = offer.listing?.title || 'Your listing';
                const offerVsAsking = offer.listing?.price
                  ? offer.amount - offer.listing.price
                  : null;
                const isPending = offer.status === 'PENDING';
                const isLast = idx === recentOffers.length - 1;
                return (
                  <TouchableOpacity
                    key={offer.id}
                    style={[styles.offerRow, !isLast && styles.offerRowBorder]}
                    activeOpacity={0.75}
                    onPress={() => navigation?.navigate('SellerOffers')}
                  >
                    <View style={[styles.offerAvatar, { backgroundColor: isPending ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)' }]}>
                      <Text style={[styles.offerAvatarText, { color: isPending ? '#F59E0B' : '#A0A0AB' }]}>
                        {buyerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.offerInfo}>
                      <Text style={styles.offerBuyer} numberOfLines={1}>{buyerName}</Text>
                      <Text style={styles.offerListing} numberOfLines={1}>{listingTitle}</Text>
                    </View>
                    <View style={styles.offerAmountCol}>
                      <Text style={styles.offerAmount}>£{offer.amount.toLocaleString('en-GB')}</Text>
                      {offerVsAsking != null && (
                        <Text style={[styles.offerDiff, { color: offerVsAsking >= 0 ? '#22C55E' : Colors.accent }]}>
                          {offerVsAsking >= 0 ? '+' : ''}£{Math.abs(offerVsAsking).toLocaleString('en-GB')}
                        </Text>
                      )}
                      {isPending && (
                        <View style={styles.pendingChip}>
                          <Text style={styles.pendingChipText}>PENDING</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 5. Quick actions 2×2 grid ── */}
        <View style={styles.section}>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.quickTile}
                activeOpacity={0.75}
                onPress={() => handleQuickAction(action.key)}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: action.toneBg }]}>
                  <Ionicons name={action.icon as any} size={16} color={action.tone} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
                <Text style={styles.quickSub}>{action.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── 6. My Listings ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleMuted}>MY LISTINGS</Text>
          </View>

          {loading ? (
            <>
              <View style={styles.listingCardSkeleton} />
              <View style={styles.listingCardSkeleton} />
              <View style={styles.listingCardSkeleton} />
            </>
          ) : listings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySubText}>
                List your first vehicle and reach thousands of serious buyers
              </Text>
              <TouchableOpacity
                style={styles.emptyCtaBtn}
                activeOpacity={0.85}
                onPress={() => navigation?.navigate('SellCarFlow')}
              >
                <Text style={styles.emptyCtaBtnText}>Create your first listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            listings.map((item) => {
              const statusKey = (item.status || 'DRAFT').toUpperCase();
              const statusCfg = LISTING_STATUS_CONFIG[statusKey] ?? LISTING_STATUS_CONFIG.DRAFT;
              const thumb = item.images?.[0];
              const carListing = mapApiListingToCarListing(item);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.listingCard}
                  activeOpacity={0.8}
                  onPress={() => navigation?.navigate('VehicleDetail', { listing: carListing })}
                >
                  <View style={styles.listingThumbContainer}>
                    {thumb ? (
                      <Image
                        source={{ uri: thumb }}
                        style={styles.listingThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.listingThumbPlaceholder}>
                        <Ionicons name="car-outline" size={24} color={Colors.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.listingInfo}>
                    <Text style={styles.listingTitle} numberOfLines={1}>
                      {getListingTitle(item)}
                    </Text>
                    <Text style={styles.listingPrice}>{formatPrice(item.price)}</Text>
                    {item.viewCount != null && (
                      <View style={styles.listingMetaItem}>
                        <Ionicons name="eye-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.listingMetaText}>{item.viewCount} views</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.statusChip, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                    <Text style={[styles.statusChipText, { color: statusCfg.text }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const CARD_BG = 'rgba(20,26,42,0.65)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';

const styles = StyleSheet.create({
  // ── base ──
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 20,
    paddingBottom: 20,
  },

  // ── header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    gap: 2,
  },
  headerEyebrow: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: '#5C5C6B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.22,
    marginTop: 4,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── hero card ──
  heroCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroImageArea: {
    height: 150,
    backgroundColor: '#15192a',
    overflow: 'hidden',
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#15192a',
  },
  heroBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  heroEditBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDaysPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroDaysPillText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: '#A0A0AB',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  heroBodyLeft: {
    flex: 1,
    marginRight: 12,
    gap: 3,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  heroSpecs: {
    fontFamily: FontFamily.medium,
    fontSize: 11.5,
    color: '#A0A0AB',
  },
  heroPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 18,
    color: '#FFFFFF',
  },

  // ── stats row ──
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  statCardViews: {
    backgroundColor: 'rgba(20,26,42,0.60)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statCardSaves: {
    backgroundColor: 'rgba(20,26,42,0.60)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statCardOffers: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
  statValue: {
    fontFamily: FontFamily.mono,
    fontSize: 24,
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#A0A0AB',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statDelta: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },

  // ── CTA button ──
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#DC1F26',
  },
  ctaButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },

  // ── section wrapper ──
  section: {
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionTitleMuted: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#A0A0AB',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionSeeAll: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#DC1F26',
  },

  // ── offers empty ──
  offersEmpty: {
    backgroundColor: 'rgba(20,26,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  offersEmptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  offersEmptySub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#5C5C6B',
    textAlign: 'center',
  },

  // ── quick actions grid ──
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickTile: {
    width: '47.5%',
    backgroundColor: 'rgba(20,26,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 8,
  },
  quickSub: {
    fontFamily: FontFamily.regular,
    fontSize: 10.5,
    color: '#5C5C6B',
    marginTop: 2,
  },

  // ── listing cards ──
  listingCardSkeleton: {
    height: 76,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    gap: 14,
  },
  listingThumbContainer: {
    width: 64,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  listingThumb: {
    width: '100%',
    height: '100%',
  },
  listingThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    flex: 1,
    gap: 3,
  },
  listingTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  listingPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  listingMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingMetaText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#5C5C6B',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // ── empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
  },
  emptySubText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#5C5C6B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyCtaBtn: {
    marginTop: 8,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  // ── recent offers card ──
  offersCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  offerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  offerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offerAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  offerInfo: {
    flex: 1,
    marginRight: 12,
  },
  offerBuyer: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  offerListing: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#A0A0AB',
  },
  offerAmountCol: {
    alignItems: 'flex-end',
  },
  offerAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  offerDiff: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  pendingChip: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
});
