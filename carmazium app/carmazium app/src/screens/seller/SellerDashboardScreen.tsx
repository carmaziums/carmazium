import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Animated,
  RefreshControl,
  Dimensions,
  Share,
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
import { PRICING } from '../../constants/pricing';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
// ─────────────────────────── interfaces ───────────────────────────

interface ListingStats {
  activeListings: number;
  totalViews: number;
  offersReceived: number;
  savedCount: number;
  // Already returned by GET /listings/stats (this screen already calls it) —
  // just never read into this interface before. Web's equivalent Sold/Revenue
  // cards read from a *different* endpoint (/dashboard/seller) whose backend
  // method (getSellerDashboard) doesn't actually return soldListings or
  // totalRevenue at all, so those two cards silently show 0 for every seller
  // on web today. /listings/stats computes them correctly, so mobile uses
  // that instead rather than copying the broken behavior.
  soldListings: number;
  totalRevenue: number;
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
  ACTIVE: { bg: 'rgba(16,185,129,0.22)', text: Colors.lightGreen_34d399, label: '• LIVE', border: 'rgba(16,185,129,0.40)' },
  DRAFT:  { bg: 'rgba(245,158,11,0.18)', text: Colors.warning, label: 'DRAFT', border: 'rgba(245,158,11,0.35)' },
  SOLD:   { bg: Colors.whiteAlpha08, text: Colors.textSecondary, label: 'SOLD',  border: Colors.whiteAlpha12 },
  PENDING:{ bg: 'rgba(59,130,246,0.18)', text: Colors.infoBlue, label: 'PENDING', border: 'rgba(59,130,246,0.35)' },
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
    tone: Colors.warning,
    toneBg: Colors.warningAlpha12,
    label: 'Boost listing',
    // Was hardcoded £9.99 — that's the HPI Check price, not Featured Boost
    // (£25/28 days, src/constants/pricing.ts / web's pricingConfig.ts).
    sub: `More views for £${PRICING.featuredBoost.price}`,
  },
  {
    key: 'share',
    icon: 'share-outline',
    tone: Colors.infoBlue,
    toneBg: Colors.infoBlueAlpha12,
    label: 'Share listing',
    sub: 'Copy link or social',
  },
  {
    key: 'insights',
    icon: 'bar-chart-outline',
    tone: Colors.paleBlue_818cf8,
    toneBg: 'rgba(129,140,248,0.12)',
    label: 'View insights',
    sub: 'Clicks, searches, reach',
  },
  {
    key: 'sold',
    icon: 'checkmark-circle-outline',
    tone: Colors.success,
    toneBg: Colors.successAlpha12,
    label: 'Mark as sold',
    sub: 'Close listing',
  },
];

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<ListingStats>({ activeListings: 0, totalViews: 0, offersReceived: 0, savedCount: 0, soldListings: 0, totalRevenue: 0 });
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

  // These used to be dead Alert.alert('Coming soon') stubs regardless of
  // which tile was tapped, including "sold" which claimed to ask for
  // confirmation and then did nothing on confirm. Boost and Mark Sold both
  // already have real, working implementations one screen over
  // (SellerListingsScreen.tsx's action sheet — in-app Stripe checkout for
  // Boost, a sale-price prompt for Mark Sold), and Insights already has a
  // real screen (SellerPerformanceScreen.tsx) — so route there instead of
  // re-implementing the same logic a second time in this file. Share is
  // genuinely simple to do inline with the native Share sheet.
  const handleQuickAction = async (key: string) => {
    if (key === 'share' && heroListing) {
      try {
        await Share.share({
          message: `Check out this ${getListingTitle(heroListing)} on CarMazium — ${formatPrice(heroListing.price)}`,
        });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    if (key === 'insights') {
      navigation?.navigate('SellerPerformance');
      return;
    }
    // 'boost' and 'sold' both need a specific listing picked from the
    // seller's inventory — send them to the screen that already does this.
    navigation?.navigate('SellerListings');
  };

  // ─────────────────── render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(59,130,246,0.05)', Colors.accentAlpha03, Colors.bgPrimary]}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton style={styles.bellBtn} icon={<Ionicons name="notifications-outline" size={18} color={Colors.white} />} onPress={() => navigation?.navigate('Notifications')} accessibilityLabel="Notifications" />
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
              <IconButton style={styles.heroEditBtn} icon={<Ionicons name="pencil-outline" size={15} color={Colors.white} />} onPress={() => navigation?.navigate('SellCarFlow')} accessibilityLabel="Edit" />

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
              <Ionicons name="pricetag-outline" size={15} color={Colors.warning} />
              <Text style={[styles.statValue, { color: Colors.warning }]}>
                {stats.offersReceived}
              </Text>
              <Text style={[styles.statLabel, { color: Colors.warning }]}>OFFERS</Text>
              <Text style={[styles.statDelta, { color: Colors.warning }]}>received</Text>
            </View>
          </View>
        )}

        {/* ── 2b. Sold / Revenue — matches web's Sold and Revenue stat cards ── */}
        {!loading && (
          <View style={[styles.statsRow, { marginTop: 12 }]}>
            <View style={[styles.statCard, styles.statCardSold]}>
              <Ionicons name="trending-up-outline" size={15} color={Colors.success} />
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {stats.soldListings}
              </Text>
              <Text style={[styles.statLabel, { color: Colors.success }]}>SOLD</Text>
              <Text style={[styles.statDelta, { color: Colors.success }]}>all time</Text>
            </View>
            <View style={[styles.statCard, styles.statCardRevenue]}>
              <Ionicons name="cash-outline" size={15} color={Colors.accentGreen} />
              <Text style={[styles.statValue, { color: Colors.accentGreen }]}>
                {formatPrice(stats.totalRevenue)}
              </Text>
              <Text style={[styles.statLabel, { color: Colors.accentGreen }]}>REVENUE</Text>
              <Text style={[styles.statDelta, { color: Colors.accentGreen }]}>all time</Text>
            </View>
          </View>
        )}

        {/* ── 3. Quick nav row ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 12,
              backgroundColor: Colors.whiteAlpha05,
              borderWidth: 1, borderColor: Colors.whiteAlpha08,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('SellerListings')}
          >
            <Ionicons name="list-outline" size={15} color={Colors.textSecondary} />
            <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.textSecondary }}>
              All Listings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 12,
              backgroundColor: Colors.whiteAlpha05,
              borderWidth: 1, borderColor: Colors.whiteAlpha08,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('SellerAuctions')}
          >
            <Ionicons name="hammer-outline" size={15} color={Colors.textSecondary} />
            <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.textSecondary }}>
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
          <Ionicons name="add" size={20} color={Colors.white} />
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
                    <View style={[styles.offerAvatar, { backgroundColor: isPending ? Colors.warningAlpha15 : Colors.whiteAlpha06 }]}>
                      <Text style={[styles.offerAvatarText, { color: isPending ? Colors.warning : Colors.textSecondary }]}>
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
                        <Text style={[styles.offerDiff, { color: offerVsAsking >= 0 ? Colors.success : Colors.accent }]}>
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
const CARD_BORDER = Colors.whiteAlpha08;

const styles = StyleSheet.create({
  // ── base ──
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
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
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size22,
    color: Colors.white,
    letterSpacing: -0.22,
    marginTop: 4,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha07,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
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
    backgroundColor: Colors.deepBlue_15192a,
    overflow: 'hidden',
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.deepBlue_15192a,
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
    fontSize: FontSize.size10,
    letterSpacing: 0.5,
  },
  heroEditBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.blackAlpha45,
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
    backgroundColor: Colors.blackAlpha55,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha12,
  },
  heroDaysPillText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
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
    fontSize: FontSize.md,
    color: Colors.white,
  },
  heroSpecs: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size11_5,
    color: Colors.textSecondary,
  },
  heroPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.lg,
    color: Colors.white,
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
    borderColor: Colors.whiteAlpha06,
  },
  statCardSaves: {
    backgroundColor: 'rgba(20,26,42,0.60)',
    borderColor: Colors.whiteAlpha06,
  },
  statCardOffers: {
    backgroundColor: Colors.warningAlpha08,
    borderColor: Colors.warningAlpha25,
  },
  statCardSold: {
    backgroundColor: Colors.successAlpha08,
    borderColor: Colors.successAlpha25,
  },
  statCardRevenue: {
    backgroundColor: Colors.accentGreenAlpha08,
    borderColor: Colors.accentGreenAlpha20,
  },
  statValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize['2xl'],
    color: Colors.white,
  },
  statLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statDelta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
  },

  // ── CTA button ──
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accent,
  },
  ctaButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
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
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionTitleMuted: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionSeeAll: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },

  // ── offers empty ──
  offersEmpty: {
    backgroundColor: 'rgba(20,26,42,0.55)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  offersEmptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  offersEmptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
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
    borderColor: Colors.whiteAlpha06,
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
    fontSize: FontSize.size12,
    color: Colors.white,
    marginTop: 8,
  },
  quickSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10_5,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ── listing cards ──
  listingCardSkeleton: {
    height: 76,
    borderRadius: 14,
    backgroundColor: Colors.whiteAlpha04,
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
    backgroundColor: Colors.whiteAlpha05,
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
    color: Colors.white,
  },
  listingPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  listingMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingMetaText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
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
    fontSize: FontSize.size9,
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
    color: Colors.white,
  },
  emptySubText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyCtaBtn: {
    marginTop: 8,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
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
    borderBottomColor: Colors.whiteAlpha05,
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
    fontSize: FontSize.size14,
  },
  offerInfo: {
    flex: 1,
    marginRight: 12,
  },
  offerBuyer: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 2,
  },
  offerListing: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  offerAmountCol: {
    alignItems: 'flex-end',
  },
  offerAmount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginBottom: 4,
  },
  offerDiff: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
  },
  pendingChip: {
    backgroundColor: Colors.warningAlpha15,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.warning,
    letterSpacing: 0.5,
  },
});
