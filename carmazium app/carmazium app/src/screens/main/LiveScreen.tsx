import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
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

  // Per-auction alert toggles for upcoming auctions, keyed by auction id
  const [auctionAlerts, setAuctionAlerts] = useState<Record<string, boolean>>({});

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

  const handleToggleAlert = (auctionId: string, carModel: string) => {
    setAuctionAlerts((prev) => {
      const next = { ...prev, [auctionId]: !prev[auctionId] };
      if (next[auctionId]) {
        Alert.alert(
          'Alert Set',
          `We'll notify you 15 minutes before the bidding starts for the ${carModel}.`
        );
      }
      return next;
    });
  };

  const handleSetAllAlerts = () => {
    if (upcomingAuctions.length === 0) return;
    setAuctionAlerts((prev) => {
      const next = { ...prev };
      upcomingAuctions.forEach((auc) => { next[auc.id] = true; });
      return next;
    });
    Alert.alert(
      'Alerts Enabled',
      "We'll notify you for all upcoming auctions on today's schedule!"
    );
  };

  const activeList = liveAuctions;
  const upcomingList = upcomingAuctions;
  const topActiveAuction = activeList.length > 0
    ? [...activeList].sort((a, b) => b.currentBid - a.currentBid)[0]
    : null;

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

        {/* ─── Auction your car CTA ───────────────────────────────── */}
        <TouchableOpacity
          style={styles.auctionCtaBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SellCarFlow' as any)}
        >
          <View style={styles.auctionCtaLeft}>
            <MaterialCommunityIcons name="gavel" size={18} color="#F59E0B" />
            <View>
              <Text style={styles.auctionCtaTitle}>Auction your car</Text>
              <Text style={styles.auctionCtaSub}>List it now — bidding starts today</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#F59E0B" />
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
        ) : activeList.length === 0 ? (
          <EmptyState
            icon="flame-outline"
            title="No live auctions right now"
            subtitle="Check back soon — new lots go live throughout the day."
            ctaLabel="Browse listings"
            onCtaPress={() => navigation.navigate('Tabs' as any, { screen: 'Search' } as any)}
          />
        ) : null}

        {activeList.map((auction) => {
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
                  <Ionicons name="eye-outline" size={10} color="#A0A0AB" />
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
                <MaterialCommunityIcons name="gavel" size={16} color="#FFFFFF" style={styles.bidBtnIcon} />
                <Text style={styles.bidNowBtnText}>BID NOW</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" style={styles.bidBtnArrow} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ─── UPCOMING Section ─────────────────────────────────── */}
        <View style={styles.upcomingHeaderRow}>
          <Text style={styles.sectionTitle}>UPCOMING</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleSetAllAlerts}>
            <Text style={styles.setAlertLink}>Set alert</Text>
          </TouchableOpacity>
        </View>

        {upcomingList.length > 0 ? (
          upcomingList.map((auc, idx) => {
            const alertState = !!auctionAlerts[auc.id];
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
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.alertBellBtn,
                    alertState && styles.alertBellBtnActive,
                  ]}
                  onPress={() =>
                    handleToggleAlert(auc.id, `${auc.listing.make} ${auc.listing.model}`)
                  }
                >
                  <Ionicons
                    name={alertState ? 'checkmark' : 'notifications-outline'}
                    size={14}
                    color={alertState ? '#FFFFFF' : '#8A8A93'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        ) : !isLoading ? (
          <View style={styles.emptyUpcoming}>
            <Ionicons name="calendar-clear-outline" size={28} color="#5C5C6B" />
            <Text style={styles.emptyUpcomingText}>No upcoming auctions scheduled right now</Text>
          </View>
        ) : null}

        {/* ─── Market Insight ───────────────────────────────────── */}
        {topActiveAuction && (
          <View style={styles.marketAiBanner}>
            <View style={styles.marketAiIconWrap}>
              <Ionicons name="bulb-outline" size={16} color="#FF2D35" />
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
    backgroundColor: '#0A0A0C',
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
    fontSize: 10,
    color: '#8A8A93',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2A2A35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Auction CTA Banner ─────────────────────────────────────────
  auctionCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
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
    fontSize: 14,
    color: '#F59E0B',
  },
  auctionCtaSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#A0A0AB',
    marginTop: 2,
  },

  // ─── Alert Banner ───────────────────────────────────────────────
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161118',
    borderWidth: 1,
    borderColor: '#3B1E2B',
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
    backgroundColor: '#DC1F26',
  },
  alertText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#DC1F26',
    lineHeight: 16,
  },

  // ─── Section Titles ─────────────────────────────────────────────
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
    color: '#FFFFFF',
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
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  emptyUpcomingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#5C5C6B',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ─── Auction Card ───────────────────────────────────────────────
  auctionCard: {
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
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
    backgroundColor: '#DC1F26',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  viewerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  viewerCount: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#A0A0AB',
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
    fontSize: 10,
    color: '#C0C0C8',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  imageCarModel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Stats row (below image)
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E26',
  },
  statsLeft: {
    flex: 1,
  },
  statsRight: {
    alignItems: 'flex-end',
  },
  statsLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#8A8A93',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statsPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 24,
    color: '#FFFFFF',
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
    fontSize: 10,
    color: '#22C55E',
  },
  statsBidderCount: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#8A8A93',
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
    backgroundColor: '#1A1A22',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#2A2A36',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontFamily: FontFamily.mono,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  timerColon: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: '#FFFFFF',
    paddingBottom: 1,
  },

  // BID NOW button
  bidNowBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC1F26',
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
    fontSize: 14,
    color: '#FFFFFF',
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
  setAlertLink: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#DC1F26',
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
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
    fontSize: 13,
    color: '#FFFFFF',
  },
  upcomingLot: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#8A8A93',
  },
  upcomingSpecs: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#8A8A93',
    marginBottom: 4,
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  upcomingTime: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#F59E0B',
  },
  upcomingEst: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#5C5C6B',
  },
  alertBellBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  alertBellBtnActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  // ─── Market AI Banner ─────────────────────────────────────────
  marketAiBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#161118',
    borderWidth: 1,
    borderColor: '#3B1E2B',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  marketAiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(220,31,38,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketAiBody: {
    flex: 1,
  },
  marketAiTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#DC1F26',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  marketAiText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#A0A0AB',
    lineHeight: 17,
  },
});
