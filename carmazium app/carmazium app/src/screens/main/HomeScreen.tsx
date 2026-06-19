import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Animated, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CarListing, formatPrice } from '../../data/listings';
import { getFeaturedListings, searchListings } from '../../lib/listingsApi';
import { getActiveAuctions, getScheduledAuctions, AuctionDetail } from '../../lib/auctionApi';
import { useAuthStore } from '../../store/authStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const { width: SW } = Dimensions.get('window');

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton: React.FC<{ w: number; h: number; r?: number }> = ({ w, h, r = 14 }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [opacity]);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: '#1E1E28', opacity }} />;
};

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(targetIso: string) {
  const [str, setStr] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setStr(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return str;
}

// ─── Helper to map auction → listing nav params ───────────────────────────────

function auctionToListingParam(a: AuctionDetail): CarListing & { auctionId: string } {
  const l = a.listing as any;
  return {
    id: l?.id ?? a.id,
    auctionId: a.id,
    make: l?.make ?? '',
    model: l?.model ?? '',
    variant: l?.variant ?? '',
    year: l?.year ?? new Date().getFullYear(),
    price: Number(l?.price ?? 0),
    mileage: l?.mileage ?? 0,
    fuelType: l?.fuelType ?? 'Petrol',
    transmission: l?.transmission === 'MANUAL' ? 'Manual' : 'Automatic',
    category: 'Saloon',
    condition: 'Used',
    colour: l?.colour ?? l?.color ?? '',
    bhp: l?.bhp ?? 0,
    zeroToSixty: l?.zeroToSixty ?? l?.zeroTo60Mph ?? 0,
    topSpeed: l?.topSpeed ?? l?.topSpeedMph ?? 0,
    location: l?.location ?? '',
    dealer: l?.seller?.dealerProfile?.companyName
      || `${l?.seller?.firstName || ''} ${l?.seller?.lastName || ''}`.trim()
      || 'Private Seller',
    rating: 4.5,
    images: l?.images ?? [],
    isFeatured: false,
    isNew: false,
    description: l?.description ?? '',
    features: Array.isArray(l?.features) ? l.features : [],
  } as any;
}

// ─── Live Auction Card ────────────────────────────────────────────────────────

const LiveAuctionCard: React.FC<{ auction: AuctionDetail; onPress: () => void }> = ({ auction, onPress }) => {
  const timeLeft = useCountdown(auction.endTime);
  const l = auction.listing as any;
  const image = l?.images?.[0] ?? '';
  const currentBid = Number(auction.winningBidAmount ?? auction.startingBid ?? 0);
  const bids = l?._count?.bids ?? l?.bids?.length ?? 0;

  return (
    <TouchableOpacity style={s.auctionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={s.cardImgWrap}>
        {image ? <Image source={{ uri: image }} style={s.cardImg} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : <View style={s.cardImgEmpty} />}
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>LIVE</Text>
        </View>
        <View style={s.bidOverlay}>
          <View style={{ flex: 1 }}>
            <Text style={s.overlayLabel}>CURRENT BID</Text>
            <Text style={s.overlayVal}>{formatPrice(currentBid)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.overlayLabel}>ENDS IN</Text>
            <Text style={[s.overlayVal, { color: '#F59E0B' }]}>{timeLeft}</Text>
          </View>
        </View>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardSpecs}>
          {l?.year}{l?.transmission ? ` · ${l.transmission === 'MANUAL' ? 'Manual' : 'Auto'}` : ''}
          {l?.mileage ? ` · ${Number(l.mileage).toLocaleString('en-GB')} mi` : ''}
        </Text>
        <Text style={s.cardTitle} numberOfLines={1}>{l?.make ?? ''} {l?.model ?? ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="hammer-outline" size={11} color="#A0A0AB" />
          <Text style={s.cardMeta}>{bids} bid{bids !== 1 ? 's' : ''}</Text>
          <Text style={s.cardMeta}> · </Text>
          <Text style={[s.cardMeta, { color: '#F59E0B' }]}>View auction</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Upcoming Auction Card ────────────────────────────────────────────────────

const UpcomingAuctionCard: React.FC<{ auction: AuctionDetail; onPress: () => void }> = ({ auction, onPress }) => {
  const startsIn = useCountdown(auction.startTime);
  const l = auction.listing as any;
  const image = l?.images?.[0] ?? '';
  const startingBid = Number(auction.startingBid ?? 0);

  return (
    <TouchableOpacity style={s.auctionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={s.cardImgWrap}>
        {image ? <Image source={{ uri: image }} style={s.cardImg} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : <View style={s.cardImgEmpty} />}
        <View style={[s.livePill, { backgroundColor: 'rgba(59,130,246,0.9)' }]}>
          <Ionicons name="calendar-outline" size={9} color="#FFF" />
          <Text style={s.livePillText}>UPCOMING</Text>
        </View>
        <View style={s.bidOverlay}>
          <View style={{ flex: 1 }}>
            <Text style={s.overlayLabel}>STARTING BID</Text>
            <Text style={s.overlayVal}>{formatPrice(startingBid)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.overlayLabel}>STARTS IN</Text>
            <Text style={[s.overlayVal, { color: '#60A5FA' }]}>{startsIn}</Text>
          </View>
        </View>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardSpecs}>
          {l?.year}{l?.mileage ? ` · ${Number(l.mileage).toLocaleString('en-GB')} mi` : ''}
        </Text>
        <Text style={s.cardTitle} numberOfLines={1}>{l?.make ?? ''} {l?.model ?? ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={11} color="#A0A0AB" />
          <Text style={s.cardMeta}>Reserve: {formatPrice(Number(auction.reservePrice ?? 0))}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Listing Card (retail) ────────────────────────────────────────────────────

const ListingCard: React.FC<{ listing: CarListing; onPress: () => void; onToggle: () => void; saved: boolean }> = ({
  listing, onPress, onToggle, saved
}) => (
  <TouchableOpacity style={s.listingCard} onPress={onPress} activeOpacity={0.9}>
    <View style={s.cardImgWrap}>
      {listing.images?.[0]
        ? <Image source={{ uri: listing.images[0] }} style={s.cardImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        : <View style={s.cardImgEmpty} />
      }
      {listing.isFeatured && (
        <View style={s.featuredBadge}><Text style={s.featuredBadgeText}>FEATURED</Text></View>
      )}
      <TouchableOpacity style={s.heartBtn} onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={15} color={saved ? Colors.accent : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
    <View style={s.cardBody}>
      <Text style={s.cardSpecs}>
        {listing.year} · {String(listing.fuelType || '').replace(/_/g, ' ').toUpperCase()} · {Number(listing.mileage || 0).toLocaleString('en-GB')} MI
      </Text>
      <Text style={s.cardTitle} numberOfLines={1}>{listing.make} {listing.model}</Text>
      <Text style={s.cardPrice}>{formatPrice(listing.price)}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; onSeeAll?: () => void; children: React.ReactNode; badge?: string }> = ({
  title, onSeeAll, children, badge
}) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {badge ? <View style={s.sectionBadge}><Text style={s.sectionBadgeText}>{badge}</Text></View> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={s.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
    {children}
  </View>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={s.emptyState}>
    <Ionicons name={icon as any} size={24} color="#404050" />
    <Text style={s.emptyStateText}>{text}</Text>
  </View>
);

// ─── Body type chips ──────────────────────────────────────────────────────────

const BODY_TYPES = [
  { label: 'SUV', icon: 'car-outline', color: '#3B82F6', bodyType: 'SUV' },
  { label: 'Saloon', icon: 'car-outline', color: '#10B981', bodyType: 'SALOON' },
  { label: 'Hatchback', icon: 'car-outline', color: '#A855F7', bodyType: 'HATCHBACK' },
  { label: 'Estate', icon: 'car-outline', color: '#F59E0B', bodyType: 'ESTATE' },
  { label: 'Coupé', icon: 'car-sports', color: Colors.accent, bodyType: 'COUPE' },
  { label: 'Convertible', icon: 'car-sports', color: '#EC4899', bodyType: 'CONVERTIBLE' },
  { label: 'Van', icon: 'car-outline', color: '#6366F1', bodyType: 'VAN' },
  { label: 'Pickup', icon: 'car-outline', color: '#14B8A6', bodyType: 'PICKUP' },
];

// ─── Home Screen ──────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const { isSaved, toggle } = useWatchlistStore();

  const [liveAuctions, setLiveAuctions] = useState<AuctionDetail[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionDetail[]>([]);
  const [featuredListings, setFeaturedListings] = useState<CarListing[]>([]);
  const [latestListings, setLatestListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [live, scheduled, featured, latest] = await Promise.allSettled([
        getActiveAuctions(),
        getScheduledAuctions(1, 6),
        getFeaturedListings(),
        searchListings({ page: 1, limit: 10, sortBy: 'newest' }),
      ]);
      if (live.status === 'fulfilled') setLiveAuctions(live.value);
      if (scheduled.status === 'fulfilled') setUpcomingAuctions(scheduled.value.data ?? []);
      if (featured.status === 'fulfilled') setFeaturedListings(featured.value);
      if (latest.status === 'fulfilled') setLatestListings(latest.value.listings ?? []);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const goToListing = (listing: CarListing) => navigation.navigate('VehicleDetail', { listing });

  const goToAuction = (auction: AuctionDetail) =>
    navigation.navigate('LiveAuctionDetailed', { listing: auctionToListingParam(auction) });

  const userName = user?.firstName || 'there';
  const recentGrid = latestListings.slice(4, 10);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={s.topGlow} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 12 }]}
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
        {/* Header */}
        <View style={s.header}>
          <Logo size="sm" />
          <View style={s.headerRight}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <HamburgerButton />
          </View>
        </View>

        {/* Greeting */}
        <View style={s.greeting}>
          <Text style={s.greetingLine}>Find your next</Text>
          <Text style={s.greetingAccent}>car, {userName}.</Text>
        </View>

        {/* Stats bar */}
        {!isLoading && (liveAuctions.length > 0 || latestListings.length > 0) && (
          <View style={s.statsBar}>
            {liveAuctions.length > 0 && (
              <View style={s.statChip}>
                <View style={s.liveDot} />
                <Text style={s.statChipText}>{liveAuctions.length} Live now</Text>
              </View>
            )}
            {upcomingAuctions.length > 0 && (
              <View style={[s.statChip, { borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.06)' }]}>
                <Ionicons name="calendar-outline" size={10} color="#60A5FA" />
                <Text style={[s.statChipText, { color: '#60A5FA' }]}>{upcomingAuctions.length} Upcoming</Text>
              </View>
            )}
            {latestListings.length > 0 && (
              <View style={[s.statChip, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.06)' }]}>
                <Ionicons name="pricetag-outline" size={10} color="#10B981" />
                <Text style={[s.statChipText, { color: '#10B981' }]}>{latestListings.length}+ Listings</Text>
              </View>
            )}
          </View>
        )}

        {/* Search bar */}
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => navigation.navigate('Search' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={18} color="#606070" />
          <Text style={s.searchHint}>Search make, model, budget...</Text>
          <View style={s.aiChip}>
            <Ionicons name="sparkles" size={10} color="#FFF" />
            <Text style={s.aiChipText}>AI</Text>
          </View>
        </TouchableOpacity>

        {/* Quick category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickChipsRow}
        >
          {[
            { label: 'Live Auctions', icon: 'hammer-outline', color: Colors.accent, screen: 'Live', params: undefined },
            { label: 'Under £15k', icon: 'pricetag-outline', color: '#10B981', screen: 'Search', params: { maxPrice: 15000, _t: 0 } },
            { label: 'Electric', icon: 'flash-outline', color: '#F59E0B', screen: 'Search', params: { fuelType: 'Electric', _t: 0 } },
            { label: 'SUV', icon: 'car-sharp', color: '#3B82F6', screen: 'Search', params: { bodyType: 'SUV', _t: 0 } },
            { label: 'New Today', icon: 'time-outline', color: '#A855F7', screen: 'Search', params: { sortBy: 'newest', _t: 0 } },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={[s.quickChip, { borderColor: `${chip.color}40`, backgroundColor: `${chip.color}0D` }]}
              onPress={() => {
                const params = chip.params ? { ...chip.params, _t: Date.now() } : undefined;
                navigation.navigate(chip.screen as any, params as any);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={chip.icon as any} size={13} color={chip.color} />
              <Text style={[s.quickChipText, { color: chip.color }]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── LIVE AUCTIONS ── */}
        <Section
          title="LIVE AUCTIONS"
          badge={liveAuctions.length > 0 ? `${liveAuctions.length} LIVE` : undefined}
          onSeeAll={() => navigation.navigate('Tabs', { screen: 'Live' })}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {isLoading ? (
              <><Skeleton w={280} h={230} /><Skeleton w={280} h={230} /></>
            ) : liveAuctions.length > 0 ? (
              liveAuctions.map(a => (
                <LiveAuctionCard key={a.id} auction={a} onPress={() => goToAuction(a)} />
              ))
            ) : (
              <EmptyState icon="hammer-outline" text="No live auctions right now" />
            )}
          </ScrollView>
        </Section>

        {/* ── UPCOMING AUCTIONS ── */}
        {(isLoading || upcomingAuctions.length > 0) && (
          <Section
            title="UPCOMING AUCTIONS"
            onSeeAll={() => navigation.navigate('Tabs', { screen: 'Live' })}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {isLoading ? (
                <><Skeleton w={280} h={230} /><Skeleton w={280} h={230} /></>
              ) : upcomingAuctions.length > 0 ? (
                upcomingAuctions.map(a => (
                  <UpcomingAuctionCard key={a.id} auction={a} onPress={() => goToAuction(a)} />
                ))
              ) : null}
            </ScrollView>
          </Section>
        )}

        {/* ── LATEST RETAIL LISTINGS ── */}
        <Section
          title="LATEST LISTINGS"
          onSeeAll={() => navigation.navigate('Search' as any)}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {isLoading ? (
              <><Skeleton w={240} h={220} /><Skeleton w={240} h={220} /><Skeleton w={240} h={220} /></>
            ) : latestListings.slice(0, 8).length > 0 ? (
              latestListings.slice(0, 8).map(l => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  onPress={() => goToListing(l)}
                  onToggle={() => toggle(l)}
                  saved={isSaved(l.id)}
                />
              ))
            ) : (
              <EmptyState icon="car-sharp" text="No listings found" />
            )}
          </ScrollView>
        </Section>

        {/* ── FEATURED THIS WEEK ── */}
        {(isLoading || featuredListings.length > 0) && (
          <Section
            title="FEATURED THIS WEEK"
            onSeeAll={() => navigation.navigate('Search' as any)}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {isLoading ? (
                <><Skeleton w={260} h={220} /><Skeleton w={260} h={220} /></>
              ) : featuredListings.length > 0 ? (
                featuredListings.map(l => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onPress={() => goToListing(l)}
                    onToggle={() => toggle(l)}
                    saved={isSaved(l.id)}
                  />
                ))
              ) : null}
            </ScrollView>
          </Section>
        )}

        {/* ── BROWSE BY BODY TYPE ── */}
        <Section title="BROWSE BY TYPE">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {BODY_TYPES.map(bt => (
              <TouchableOpacity
                key={bt.bodyType}
                style={s.bodyTypeCard}
                onPress={() => navigation.navigate('Search' as any, { bodyType: bt.bodyType, _t: Date.now() })}
                activeOpacity={0.8}
              >
                <View style={[s.bodyTypeIconWrap, { backgroundColor: `${bt.color}18` }]}>
                  <Ionicons name={bt.icon as any} size={22} color={bt.color} />
                </View>
                <Text style={s.bodyTypeLabel}>{bt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>

        {/* ── RECENTLY ADDED (2-col grid) ── */}
        {(isLoading || recentGrid.length > 0) && (
          <Section
            title="RECENTLY ADDED"
            badge={!isLoading && recentGrid.length > 0 ? `${recentGrid.length} new` : undefined}
            onSeeAll={() => navigation.navigate('Search' as any)}
          >
            <View style={s.recentGrid}>
              {isLoading ? (
                <>
                  <Skeleton w={(SW - 48 - 12) / 2} h={170} />
                  <Skeleton w={(SW - 48 - 12) / 2} h={170} />
                  <Skeleton w={(SW - 48 - 12) / 2} h={170} />
                  <Skeleton w={(SW - 48 - 12) / 2} h={170} />
                </>
              ) : recentGrid.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={s.recentCard}
                  onPress={() => goToListing(l)}
                  activeOpacity={0.85}
                >
                  <View style={s.recentImgWrap}>
                    {l.images?.[0]
                      ? <Image source={{ uri: l.images[0] }} style={s.recentImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      : <View style={[s.recentImg, { backgroundColor: '#18181E' }]} />
                    }
                  </View>
                  <View style={s.recentBody}>
                    <Text style={s.recentSpecs}>{l.year} · {Number(l.mileage || 0).toLocaleString('en-GB')} mi</Text>
                    <Text style={s.recentTitle} numberOfLines={1}>{l.make} {l.model}</Text>
                    <Text style={s.recentPrice}>{formatPrice(l.price)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}

        {/* Sell your car CTA */}
        <TouchableOpacity
          style={s.sellCta}
          onPress={() => navigation.navigate('SellCars' as any)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.sellCtaTitle}>Sell your car</Text>
            <Text style={s.sellCtaHint}>List in minutes · Get offers from buyers</Text>
          </View>
          <View style={s.sellCtaBtn}>
            <Text style={s.sellCtaBtnText}>START</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topGlow: {
    position: 'absolute', top: -80, left: '5%', right: '5%', height: 260,
    borderRadius: 130, backgroundColor: Colors.accent, opacity: 0.04,
  },
  scroll: { paddingBottom: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#111115', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.bgPrimary },

  // Greeting
  greeting: { paddingHorizontal: 24, marginBottom: 22 },
  greetingLine: { fontFamily: FontFamily.extraBold, fontSize: 28, color: '#FFFFFF', lineHeight: 34 },
  greetingAccent: { fontFamily: FontFamily.extraBold, fontSize: 28, color: Colors.accent, lineHeight: 34 },

  // Stats bar
  statsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(220,31,38,0.3)', backgroundColor: 'rgba(220,31,38,0.06)' },
  statChipText: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.accent },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 20, paddingHorizontal: 16, height: 52, borderRadius: 14, backgroundColor: '#111115', borderWidth: 1, borderColor: '#2A2A32', gap: 10 },
  searchHint: { flex: 1, fontFamily: FontFamily.regular, fontSize: 14, color: '#505060' },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  aiChipText: { fontFamily: FontFamily.bold, fontSize: 10, color: '#FFF' },

  // Quick chips
  quickChipsRow: { paddingHorizontal: 24, paddingBottom: 4, gap: 8, marginBottom: 36 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickChipText: { fontFamily: FontFamily.bold, fontSize: 11 },

  // Section
  section: { marginBottom: 36 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 18 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 1.5 },
  sectionBadge: { backgroundColor: Colors.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  sectionBadgeText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF', letterSpacing: 0.5 },
  seeAll: { fontFamily: FontFamily.bold, fontSize: 12, color: Colors.accent },

  // Horizontal scroll
  hScroll: { paddingHorizontal: 24, gap: 16, flexDirection: 'row', alignItems: 'center' },

  // Cards shared
  auctionCard: { width: 282, backgroundColor: '#111115', borderWidth: 1, borderColor: '#2A2A32', borderRadius: 16, overflow: 'hidden' },
  listingCard: { width: 240, backgroundColor: '#111115', borderWidth: 1, borderColor: '#2A2A32', borderRadius: 16, overflow: 'hidden' },
  cardImgWrap: { position: 'relative', height: 150, backgroundColor: '#18181E' },
  cardImg: { width: '100%', height: '100%' },
  cardImgEmpty: { width: '100%', height: '100%', backgroundColor: '#18181E' },
  cardBody: { padding: 16 },
  cardSpecs: { fontFamily: FontFamily.medium, fontSize: 10, color: '#8A8A93', letterSpacing: 0.5, marginBottom: 4 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF', marginBottom: 10 },
  cardPrice: { fontFamily: FontFamily.bold, fontSize: 17, color: '#FFFFFF' },
  cardMeta: { fontFamily: FontFamily.medium, fontSize: 11, color: '#A0A0AB' },

  // Auction overlays
  livePill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  livePillText: { fontFamily: FontFamily.bold, fontSize: 9, color: '#FFF', letterSpacing: 1 },
  bidOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(10,10,12,0.78)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingVertical: 9, paddingHorizontal: 14 },
  overlayLabel: { fontFamily: FontFamily.medium, fontSize: 8, color: '#A0A0AB', letterSpacing: 1, marginBottom: 2 },
  overlayVal: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF' },

  // Listing badges
  featuredBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#F59E0B', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  featuredBadgeText: { fontFamily: FontFamily.bold, fontSize: 8, color: '#000', letterSpacing: 0.5 },
  heartBtn: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // Body type
  bodyTypeCard: { width: 80, backgroundColor: '#111115', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 14, alignItems: 'center', paddingVertical: 14, gap: 8 },
  bodyTypeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bodyTypeLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#FFFFFF' },

  // Recent grid
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 24, rowGap: 16 },
  recentCard: { width: (SW - 56 - 12) / 2, backgroundColor: '#111115', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' },
  recentImgWrap: { height: 116 },
  recentImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  recentBody: { padding: 16 },
  recentSpecs: { fontFamily: FontFamily.medium, fontSize: 9, color: '#8A8A93', marginBottom: 4 },
  recentTitle: { fontFamily: FontFamily.bold, fontSize: 13, color: '#FFFFFF', marginBottom: 6 },
  recentPrice: { fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF' },

  // Empty state
  emptyState: { width: 240, height: 100, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyStateText: { fontFamily: FontFamily.medium, fontSize: 12, color: '#505060' },

  // Sell CTA
  sellCta: { marginHorizontal: 24, marginBottom: 8, backgroundColor: '#111115', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(220,31,38,0.25)', padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sellCtaTitle: { fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF', marginBottom: 4 },
  sellCtaHint: { fontFamily: FontFamily.regular, fontSize: 12, color: '#606070' },
  sellCtaBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sellCtaBtnText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFF', letterSpacing: 0.8 },
});
