import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatPrice, AuctionListing } from '../../data/listings';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { getActiveAuctions, getScheduledAuctions, AuctionDetail } from '../../lib/auctionApi';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Individual digit flip box component
const DigitBox: React.FC<{ value: string }> = ({ value }) => (
  <View style={styles.digitBox}>
    <Text style={styles.digitText}>{value}</Text>
  </View>
);

// Timer display as flip-digit boxes
const FlipTimer: React.FC<{ seconds: number }> = ({ seconds }) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hStr = pad(h);
  const mStr = pad(m);
  const sStr = pad(s);

  return (
    <View style={styles.timerContainer}>
      <View style={styles.digitGroup}>
        <DigitBox value={hStr[0]} />
        <DigitBox value={hStr[1]} />
      </View>
      <Text style={styles.timerColon}>:</Text>
      <View style={styles.digitGroup}>
        <DigitBox value={mStr[0]} />
        <DigitBox value={mStr[1]} />
      </View>
      <Text style={styles.timerColon}>:</Text>
      <View style={styles.digitGroup}>
        <DigitBox value={sStr[0]} />
        <DigitBox value={sStr[1]} />
      </View>
    </View>
  );
};

export const LiveScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  // Live states for dynamic API data
  const [liveAuctions, setLiveAuctions] = useState<AuctionListing[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionDetail[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Global ticker reference time
  const [now, setNow] = useState(Date.now());

  // Make/model search — web's /auctions page has this, mobile didn't
  // (mobile-production-readiness-plan.md F15). Filters client-side like
  // web does; no dedicated backend search param for auctions exists.
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const activeData = await getActiveAuctions();
      const scheduledData = await getScheduledAuctions(1, 20);

      // Map dynamic active auctions to UI component-friendly shapes
      const mappedActive = activeData.map((a) => {
        const latestBid = a.listing.bids && a.listing.bids.length > 0 ? Number(a.listing.bids[0].amount) : Number(a.startingBid);
        const totalBidsCount = a.listing._count?.bids ?? a.listing.bids?.length ?? 0;
        const seller = a.listing.seller;
        const sellerName = seller ? `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim() : '';

        return {
          id: a.listing.id,
          auctionId: a.id,
          make: a.listing.make,
          model: a.listing.model,
          variant: a.listing.variant || '',
          year: a.listing.year,
          price: Number(a.listing.price),
          mileage: a.listing.mileage,
          fuelType: a.listing.fuelType as any,
          transmission: a.listing.transmission as any,
          category: (a.listing.category as any) || 'Sports',
          condition: (a.listing.condition as any) || 'Used',
          colour: a.listing.colour || '',
          bhp: a.listing.bhp || 0,
          zeroToSixty: a.listing.zeroToSixty || 0,
          topSpeed: a.listing.topSpeed || 0,
          location: a.listing.location || '',
          dealer: seller?.dealerProfile?.companyName || sellerName || 'Private Seller',
          rating: seller?.sellerProfile?.reliabilityScore || 0,
          images: a.listing.images && a.listing.images.length > 0 ? a.listing.images : ['https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=900&q=80'],
          isFeatured: true,
          isNew: false,
          description: a.listing.description || '',
          features: Array.isArray(a.listing.features) ? a.listing.features : [],
          currentBid: latestBid,
          startingBid: Number(a.startingBid),
          totalBids: totalBidsCount,
          endsAt: new Date(a.endTime),
          isLive: a.status === 'ACTIVE',
          viewers: a.listing.viewCount || 0,
          reserve: Number(a.reservePrice),
          reserveMet: latestBid >= Number(a.reservePrice),
        } as AuctionListing;
      });

      setLiveAuctions(mappedActive);
      setUpcomingAuctions(scheduledData.data);
    } catch (error) {
      // No mock fallback exists — on failure the lists simply stay empty and
      // the screen renders its real empty state. (This log previously claimed
      // a "fall back to mocks" that doesn't happen — fixed to avoid misleading
      // future debugging. Also corrected the log level: this is a genuine
      // error path, not informational, so it should survive prod log-stripping.)
      console.error('Error loading backend auctions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingSeconds = (endsAt: Date | string) => {
    const endMs = new Date(endsAt).getTime();
    return Math.max(0, Math.floor((endMs - now) / 1000));
  };

  const activeList = liveAuctions;
  const upcomingList = upcomingAuctions;
  const topActiveAuction = activeList.length > 0
    ? [...activeList].sort((a, b) => b.currentBid - a.currentBid)[0]
    : null;

  const q = searchQuery.trim().toLowerCase();
  const matchesQuery = (make: string, model: string) =>
    !q || `${make} ${model}`.toLowerCase().includes(q);
  const filteredActive = q ? activeList.filter(a => matchesQuery(a.make, a.model)) : activeList;
  const filteredUpcoming = q ? upcomingList.filter(u => matchesQuery(u.listing.make, u.listing.model)) : upcomingList;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* ─── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerMeta}>{activeList.length} LIVE NOW · UPCOMING</Text>
            <Text style={styles.headerTitle}>Live Auctions</Text>
          </View>
          <HamburgerButton />
        </View>

        {/* ─── Search ──────────────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search make or model…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Auction your car CTA ───────────────────────────────── */}
        <TouchableOpacity
          style={styles.auctionCtaBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SellCarFlow' as any)}
        >
          <View style={styles.auctionCtaLeft}>
            <MaterialCommunityIcons name="gavel" size={18} color={Colors.warning} />
            <View>
              <Text style={styles.auctionCtaTitle}>Auction your car</Text>
              <Text style={styles.auctionCtaSub}>List it now — bidding starts today</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={16} color={Colors.warning} />
        </TouchableOpacity>

        {/* ─── Live Alert Banner ──────────────────────────────────── */}
        <View style={styles.alertBanner}>
          <View style={styles.alertDot} />
          <Text style={styles.alertText}>
            Bidding is live — place your bid before the gavel drops.
          </Text>
        </View>

        {/* ─── LIVE NOW Section ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>LIVE NOW</Text>

        {isLoading ? (
          <View style={{ gap: 16, marginBottom: 8 }}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.auctionCard, { overflow: 'hidden' }]}>
                {/* Image block skeleton */}
                <Skeleton w={SCREEN_WIDTH - 48} h={196} r={0} />
                {/* Stats row skeleton */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 12 }}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton w={80} h={10} r={5} />
                    <Skeleton w={120} h={24} r={6} />
                    <Skeleton w={100} h={10} r={5} />
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <Skeleton w={60} h={10} r={5} />
                    <Skeleton w={100} h={26} r={6} />
                    <Skeleton w={70} h={10} r={5} />
                  </View>
                </View>
                {/* Button skeleton */}
                <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
                  <Skeleton w={SCREEN_WIDTH - 80} h={50} r={13} />
                </View>
              </View>
            ))}
          </View>
        ) : filteredActive.length === 0 ? (
          <EmptyState
            icon="flame-outline"
            title={q ? 'No live auctions match your search' : 'No live auctions right now'}
            subtitle={q ? 'Try a different make or model.' : 'Check back soon — new lots go live throughout the day.'}
            ctaLabel={q ? undefined : 'Browse listings'}
            onCtaPress={q ? undefined : () => navigation.navigate('Tabs' as any, { screen: 'Search' } as any)}
          />
        ) : null}

        {filteredActive.map((auction) => {
          const secsLeft = getRemainingSeconds(auction.endsAt);
          const reserveDiff = auction.currentBid - auction.reserve;
          const reserveText = reserveDiff >= 0
            ? `${formatPrice(reserveDiff)} above reserve`
            : `${formatPrice(Math.abs(reserveDiff))} below reserve`;

          return (
            <View key={auction.id} style={styles.auctionCard}>
              {/* Image Block */}
              <View style={styles.imageBlock}>
                <Image
                  source={{ uri: auction.images[0] }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={styles.imageGradient} />

                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <View style={styles.viewerBadge}>
                  <Ionicons name="eye-outline" size={10} color={Colors.textSecondary} />
                  <Text style={styles.viewerCount}>{auction.viewers}</Text>
                </View>

                <View style={styles.imageNameContainer}>
                  <Text style={styles.imageCarMake}>
                    {auction.make.toUpperCase()}
                  </Text>
                  <Text style={styles.imageCarModel}>
                    {auction.model} {auction.variant}
                  </Text>
                </View>
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statsLeft}>
                  <Text style={styles.statsLabel}>CURRENT BID</Text>
                  <Text style={styles.statsPrice}>{formatPrice(auction.currentBid)}</Text>
                  <View style={styles.statsSubRow}>
                    <Text style={styles.statsAboveReserve}>{reserveText}</Text>
                  </View>
                </View>
                <View style={styles.statsRight}>
                  <Text style={styles.statsLabel}>ENDS IN</Text>
                  <FlipTimer seconds={secsLeft} />
                  <Text style={styles.statsBidderCount}>
                    {auction.totalBids} bidders
                  </Text>
                </View>
              </View>

              {/* BID NOW Button */}
              <TouchableOpacity
                style={styles.bidNowBtn}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('LiveAuctionDetailed', { listing: auction })
                }
              >
                <MaterialCommunityIcons name="gavel" size={16} color={Colors.white} style={styles.bidBtnIcon} />
                <Text style={styles.bidNowBtnText}>BID NOW</Text>
                <Ionicons name="arrow-forward" size={15} color={Colors.white} style={styles.bidBtnArrow} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ─── UPCOMING Section ─────────────────────────────────── */}
        <View style={styles.upcomingHeaderRow}>
          <Text style={styles.sectionTitle}>UPCOMING</Text>
        </View>

        {filteredUpcoming.length > 0 ? (
          filteredUpcoming.map((auc, idx) => {
            const estPriceRange = `Est. £${Math.round(Number(auc.startingBid) / 1000)}k – £${Math.round(Number(auc.reservePrice) / 1000)}k`;
            const startTimeDate = new Date(auc.startTime);
            const timeText = `Starts ${startTimeDate.toLocaleDateString('en-GB')} ${startTimeDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

            // Convert backend AuctionDetail shape to UI CarListing shape for compatibility
            const upcomingSeller = auc.listing.seller;
            const upcomingSellerName = upcomingSeller ? `${upcomingSeller.firstName ?? ''} ${upcomingSeller.lastName ?? ''}`.trim() : '';
            const mappedListing = {
              id: auc.listing.id,
              auctionId: auc.id,
              make: auc.listing.make,
              model: auc.listing.model,
              variant: auc.listing.variant || '',
              year: auc.listing.year,
              price: Number(auc.listing.price),
              mileage: auc.listing.mileage,
              fuelType: auc.listing.fuelType as any,
              transmission: auc.listing.transmission as any,
              category: (auc.listing.category as any) || 'Sports',
              condition: (auc.listing.condition as any) || 'Used',
              colour: auc.listing.colour || '',
              bhp: auc.listing.bhp || 0,
              zeroToSixty: auc.listing.zeroToSixty || 0,
              topSpeed: auc.listing.topSpeed || 0,
              location: auc.listing.location || '',
              dealer: upcomingSeller?.dealerProfile?.companyName || upcomingSellerName || 'Private Seller',
              rating: upcomingSeller?.sellerProfile?.reliabilityScore || 0,
              images: auc.listing.images && auc.listing.images.length > 0 ? auc.listing.images : ['https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&q=80'],
              isFeatured: true,
              isNew: false,
              description: auc.listing.description || '',
              features: Array.isArray(auc.listing.features) ? auc.listing.features : [],
              currentBid: Number(auc.startingBid),
              startingBid: Number(auc.startingBid),
              totalBids: 0,
              endsAt: new Date(auc.endTime),
              isLive: false,
              viewers: 0,
              reserve: Number(auc.reservePrice),
              reserveMet: false,
            } as any;

            return (
              <TouchableOpacity
                key={auc.id}
                style={styles.upcomingItem}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('LiveAuctionDetailed', { listing: mappedListing })}
              >
                <Image
                  source={{
                    uri: auc.listing.images[0] || 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&q=80',
                  }}
                  style={styles.upcomingImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={styles.upcomingInfo}>
                  <View style={styles.upcomingTitleRow}>
                    <Text style={styles.upcomingCarName} numberOfLines={1}>
                      {auc.listing.make} {auc.listing.model}
                    </Text>
                    <Text style={styles.upcomingLot}>LOT {String(idx + 6).padStart(2, '0')}</Text>
                  </View>
                  <Text style={styles.upcomingSpecs} numberOfLines={1}>
                    {auc.listing.year} · {auc.listing.colour || 'Verified Spec'}
                  </Text>
                  <View style={styles.upcomingFooter}>
                    <Text style={styles.upcomingTime}>{timeText}</Text>
                    <Text style={styles.upcomingEst}>{estPriceRange}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : !isLoading ? (
          <View style={styles.emptyUpcoming}>
            <Ionicons name="calendar-clear-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyUpcomingText}>
              {q ? 'No upcoming auctions match your search' : 'No upcoming auctions scheduled right now'}
            </Text>
          </View>
        ) : null}

        {/* ─── Market Insight ───────────────────────────────────── */}
        {topActiveAuction && (
          <View style={styles.marketAiBanner}>
            <View style={styles.marketAiIconWrap}>
              <Ionicons name="bulb-outline" size={16} color={Colors.accentGlow} />
            </View>
            <View style={styles.marketAiBody}>
              <Text style={styles.marketAiTitle}>MARKET INSIGHT</Text>
              <Text style={styles.marketAiText}>
                {topActiveAuction.make} {topActiveAuction.model} is currently leading at{' '}
                {formatPrice(topActiveAuction.currentBid)}
                {topActiveAuction.reserveMet ? ' — reserve met, strong bidding momentum.' : ' — reserve not yet met.'}
                {' '}{topActiveAuction.totalBids} bid{topActiveAuction.totalBids === 1 ? '' : 's'} so far.
              </Text>
            </View>
          </View>
        )}

        {/* Bottom spacing so last element clears the tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  // ─── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerMeta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textFaint,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size26,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.deepBlue_1c1c22,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2a2a35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Search ────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
  },

  // ─── Auction CTA Banner ─────────────────────────────────────────
  auctionCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    gap: 10,
  },
  auctionCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  auctionCtaTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.warning,
  },
  auctionCtaSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ─── Alert Banner ───────────────────────────────────────────────
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.deepPurple,
    borderWidth: 1,
    borderColor: Colors.darkPink_3b1e2b,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 28,
    gap: 10,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  alertText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.accent,
    lineHeight: 16,
  },

  // ─── Section Titles ─────────────────────────────────────────────
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 1.4,
    marginBottom: 16,
    marginTop: 4,
  },

  // ─── Empty states ───────────────────────────────────────────────
  emptyUpcoming: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    marginBottom: 24,
  },
  emptyUpcomingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ─── Auction Card ───────────────────────────────────────────────
  auctionCard: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },

  // Image block
  imageBlock: {
    width: '100%',
    height: 196,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    // Subtle top-to-bottom dark scrim so text reads over image
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  // Badges
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.white,
  },
  liveBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  viewerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.blackAlpha55,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  viewerCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
  },

  // Car name overlay on image
  imageNameContainer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  imageCarMake: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.paleGrey_c0c0c8,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  imageCarModel: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    letterSpacing: -0.3,
  },

  // Stats row (below image)
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.deepBlue_1e1e26,
  },
  statsLeft: {
    flex: 1,
  },
  statsRight: {
    alignItems: 'flex-end',
  },
  statsLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textFaint,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statsPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize['2xl'],
    color: Colors.white,
    marginBottom: 3,
    letterSpacing: -0.5,
  },
  statsSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsAboveReserve: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.success,
  },
  statsBidderCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textFaint,
    marginTop: 3,
  },

  // Flip-digit timer
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 3,
  },
  digitGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  digitBox: {
    width: 22,
    height: 26,
    backgroundColor: Colors.deepBlue_1a1a22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2a2a36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0,
  },
  timerColon: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.white,
    paddingBottom: 1,
  },

  // BID NOW button
  bidNowBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    marginHorizontal: 16,
    marginVertical: 14,
    height: 50,
    borderRadius: 13,
    gap: 6,
  },
  bidBtnIcon: {
    marginRight: 2,
  },
  bidNowBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 0.6,
  },
  bidBtnArrow: {
    marginLeft: 2,
  },

  // ─── Upcoming Section ──────────────────────────────────────────
  upcomingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  upcomingImage: {
    width: 58,
    height: 58,
    borderRadius: 11,
    marginRight: 14,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  upcomingCarName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  upcomingLot: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textFaint,
  },
  upcomingSpecs: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    marginBottom: 4,
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  upcomingTime: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  upcomingEst: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  // ─── Market AI Banner ─────────────────────────────────────────
  marketAiBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.deepPurple,
    borderWidth: 1,
    borderColor: Colors.darkPink_3b1e2b,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  marketAiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accentAlpha12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketAiBody: {
    flex: 1,
  },
  marketAiTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  marketAiText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
