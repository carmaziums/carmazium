import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, RefreshControl,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CarListing, formatPrice } from '../../data/listings';
import { getFeaturedListings, searchListings } from '../../lib/listingsApi';
import { getActiveAuctions, getScheduledAuctions, AuctionDetail, auctionToListingParam } from '../../lib/auctionApi';
import { naturalLanguageSearch, AiSearchResult } from '../../lib/aiApi';
import { useAuthStore } from '../../store/authStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { Logo } from '../../components/Logo';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Skeleton } from '../../components/ui/Skeleton';
import { Colors } from '../../constants/colors';
import { getBodyTypeIcon } from '../../constants/bodyTypes';
import {FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const { width: SW } = Dimensions.get('window');

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
            <Text style={[s.overlayVal, { color: Colors.warning }]}>{timeLeft}</Text>
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
          <Ionicons name="hammer-outline" size={11} color={Colors.textSecondary} />
          <Text style={s.cardMeta}>{bids} bid{bids !== 1 ? 's' : ''}</Text>
          <Text style={s.cardMeta}> · </Text>
          <Text style={[s.cardMeta, { color: Colors.warning }]}>View auction</Text>
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
          <Ionicons name="calendar-outline" size={9} color={Colors.white} />
          <Text style={s.livePillText}>UPCOMING</Text>
        </View>
        <View style={s.bidOverlay}>
          <View style={{ flex: 1 }}>
            <Text style={s.overlayLabel}>STARTING BID</Text>
            <Text style={s.overlayVal}>{formatPrice(startingBid)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.overlayLabel}>STARTS IN</Text>
            <Text style={[s.overlayVal, { color: Colors.infoBlueLight }]}>{startsIn}</Text>
          </View>
        </View>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardSpecs}>
          {l?.year}{l?.mileage ? ` · ${Number(l.mileage).toLocaleString('en-GB')} mi` : ''}
        </Text>
        <Text style={s.cardTitle} numberOfLines={1}>{l?.make ?? ''} {l?.model ?? ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={11} color={Colors.textSecondary} />
          <Text style={s.cardMeta}>Reserve: {formatPrice(Number(auction.reservePrice ?? 0))}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Listing Card (retail) ────────────────────────────────────────────────────

// Memoized + stable-id callbacks so a parent re-render (watchlist toggle, countdown
// tick from a sibling card, etc.) doesn't re-render every card in the row (mobile-audit.md P4).
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const ListingCard = React.memo<{ listing: CarListing; onPress: (id: string) => void; onToggle: (id: string) => void; saved: boolean }>(({
  listing, onPress, onToggle, saved
}) => (
  <AnimatedTouchable entering={FadeIn.duration(220)} style={s.listingCard} onPress={() => onPress(listing.id)} activeOpacity={0.9}>
    <View style={s.cardImgWrap}>
      {listing.images?.[0]
        ? <Image source={{ uri: listing.images[0] }} style={s.cardImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        : <View style={s.cardImgEmpty} />
      }
      {listing.isFeatured && (
        <View style={s.featuredBadge}><Text style={s.featuredBadgeText}>FEATURED</Text></View>
      )}
      <TouchableOpacity
        style={s.heartBtn}
        onPress={() => onToggle(listing.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'}
        accessibilityRole="button"
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={15} color={saved ? Colors.accent : Colors.white} />
      </TouchableOpacity>
    </View>
    <View style={s.cardBody}>
      <Text style={s.cardSpecs}>
        {listing.year} · {String(listing.fuelType || '').replace(/_/g, ' ').toUpperCase()} · {Number(listing.mileage || 0).toLocaleString('en-GB')} MI
      </Text>
      <Text style={s.cardTitle} numberOfLines={1}>{listing.make} {listing.model}</Text>
      <Text style={s.cardPrice}>{formatPrice(listing.price)}</Text>
    </View>
  </AnimatedTouchable>
));

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
    <Ionicons name={icon as any} size={24} color={Colors.borderMuted} />
    <Text style={s.emptyStateText}>{text}</Text>
  </View>
);

// ─── Body type chips ──────────────────────────────────────────────────────────

// Icons sourced from the shared body-type set (src/constants/bodyTypes.ts) so
// Home/Search/Sell all show identical icons per body type (mobile-ui-ux-audit.md §C6).
const BODY_TYPES = [
  { label: 'SUV', icon: getBodyTypeIcon('SUV'), color: Colors.infoBlue, bodyType: 'SUV' },
  { label: 'Sedan', icon: getBodyTypeIcon('SEDAN'), color: Colors.accentGreen, bodyType: 'SEDAN' },
  { label: 'Hatchback', icon: getBodyTypeIcon('HATCHBACK'), color: Colors.lightPurple, bodyType: 'HATCHBACK' },
  { label: 'Estate', icon: getBodyTypeIcon('ESTATE'), color: Colors.warning, bodyType: 'ESTATE' },
  { label: 'Coupé', icon: getBodyTypeIcon('COUPE'), color: Colors.accent, bodyType: 'COUPE' },
  { label: 'Convertible', icon: getBodyTypeIcon('CONVERTIBLE'), color: Colors.lightPink, bodyType: 'CONVERTIBLE' },
  { label: 'Van', icon: getBodyTypeIcon('VAN'), color: Colors.lightBlue_6366f1, bodyType: 'VAN' },
  { label: 'Pickup Truck', icon: getBodyTypeIcon('PICKUP_TRUCK'), color: Colors.midTeal_14b8a6, bodyType: 'PICKUP_TRUCK' },
];

// ─── Home Screen ──────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const { isSaved, toggle } = useWatchlistStore();

  const [liveAuctions, setLiveAuctions] = useState<AuctionDetail[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionDetail[]>([]);
  const [featuredListings, setFeaturedListings] = useState<CarListing[]>([]);
  const [latestListings, setLatestListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Inline AI search — was just a TouchableOpacity that navigated straight
  // to Search with no query state at all; web's home page (HomeClient.tsx)
  // shows the AI's answer inline before the user commits to leaving the
  // page. Reuses the same naturalLanguageSearch API SearchScreen's AI modal
  // already calls.
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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

  const handleAiSearch = async () => {
    const query = aiQuery.trim();
    if (!query || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await naturalLanguageSearch(query);
      setAiResult(result);
    } catch (err: any) {
      setAiError(err?.message ?? 'AI search failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const viewAiResults = () => {
    if (!aiResult) return;
    navigation.navigate('Search' as any, { aiFilters: aiResult.filterCard?.params, aiExplanation: aiResult.text, _t: Date.now() });
    setAiResult(null);
    setAiQuery('');
  };

  const goToAuction = (auction: AuctionDetail) =>
    navigation.navigate('LiveAuctionDetailed', { listing: auctionToListingParam(auction) });

  // Stable-identity callbacks for ListingCard (see its React.memo comment) — looked up
  // by id from a ref kept in sync with whatever's currently loaded, so neither callback's
  // identity changes across renders regardless of which listings are on screen.
  const listingsByIdRef = useRef<Map<string, CarListing>>(new Map());
  useEffect(() => {
    for (const l of [...latestListings, ...featuredListings]) listingsByIdRef.current.set(l.id, l);
  }, [latestListings, featuredListings]);

  const handleCardPress = useCallback((id: string) => {
    const l = listingsByIdRef.current.get(id);
    if (l) navigation.navigate('VehicleDetail', { listing: l });
  }, [navigation]);

  const handleCardToggle = useCallback((id: string) => {
    const l = listingsByIdRef.current.get(id);
    if (l) toggle(l);
  }, [toggle]);

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
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7} accessibilityLabel="Notifications" accessibilityRole="button" hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}>
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
              <View style={[s.statChip, { borderColor: Colors.infoBlueAlpha30, backgroundColor: Colors.infoBlueAlpha06 }]}>
                <Ionicons name="calendar-outline" size={10} color={Colors.infoBlueLight} />
                <Text style={[s.statChipText, { color: Colors.infoBlueLight }]}>{upcomingAuctions.length} Upcoming</Text>
              </View>
            )}
            {latestListings.length > 0 && (
              <View style={[s.statChip, { borderColor: Colors.accentGreenAlpha30, backgroundColor: Colors.accentGreenAlpha06 }]}>
                <Ionicons name="pricetag-outline" size={10} color={Colors.accentGreen} />
                <Text style={[s.statChipText, { color: Colors.accentGreen }]}>{latestListings.length}+ Listings</Text>
              </View>
            )}
          </View>
        )}

        {/* Search bar — was a TouchableOpacity with no query state at all
            (tapping anywhere just navigated to Search); now a real input
            that runs AI search inline, matching web's HomeClient.tsx. */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
          <TextInput
            style={s.searchInput}
            value={aiQuery}
            onChangeText={(t) => { setAiQuery(t); if (aiResult) setAiResult(null); if (aiError) setAiError(null); }}
            placeholder="Search make, model, budget..."
            placeholderTextColor={Colors.iconMuted}
            returnKeyType="search"
            onSubmitEditing={handleAiSearch}
          />
          <TouchableOpacity style={s.aiChip} onPress={handleAiSearch} disabled={aiLoading} activeOpacity={0.8}>
            {aiLoading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <>
                  <Ionicons name="sparkles" size={10} color={Colors.white} />
                  <Text style={s.aiChipText}>AI</Text>
                </>}
          </TouchableOpacity>
        </View>

        {aiError && (
          <View style={s.aiResultCard}>
            <Text style={s.aiResultError}>{aiError}</Text>
          </View>
        )}

        {aiResult && (
          <View style={s.aiResultCard}>
            <View style={s.aiResultHeader}>
              <Ionicons name="sparkles" size={13} color={Colors.warning} />
              <Text style={s.aiResultLabel}>MAZIUM AI</Text>
            </View>
            <Text style={s.aiResultText}>{aiResult.text}</Text>
            {Object.keys(aiResult.filterCard?.params ?? {}).length > 0 && (
              <TouchableOpacity style={s.aiResultBtn} onPress={viewAiResults} activeOpacity={0.85}>
                <Text style={s.aiResultBtnText}>VIEW MATCHING CARS</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickChipsRow}
        >
          {[
            { label: 'Live Auctions', icon: 'hammer-outline', color: Colors.accent, screen: 'Live', params: undefined },
            { label: 'Under £15k', icon: 'pricetag-outline', color: Colors.accentGreen, screen: 'Search', params: { maxPrice: 15000, _t: 0 } },
            { label: 'Electric', icon: 'flash-outline', color: Colors.warning, screen: 'Search', params: { fuelType: 'Electric', _t: 0 } },
            { label: 'SUV', icon: 'car-sharp', color: Colors.infoBlue, screen: 'Search', params: { bodyType: 'SUV', _t: 0 } },
            { label: 'New Today', icon: 'time-outline', color: Colors.lightPurple, screen: 'Search', params: { sortBy: 'newest', _t: 0 } },
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
                  onPress={handleCardPress}
                  onToggle={handleCardToggle}
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
                    onPress={handleCardPress}
                    onToggle={handleCardToggle}
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
                      : <View style={[s.recentImg, { backgroundColor: Colors.bgTertiary }]} />
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

        {/* Live Auctions CTA — a direct, prominent entry point matching the
            "Sell your car" card's visual weight, not just the small quick-chip
            + "See all" link this used to be the only way in via (see
            mobile-production-readiness-plan.md F9). Only shown when there's
            something live to jump into; the quick chip below still covers the
            zero-live-auctions case. */}
        {liveAuctions.length > 0 && (
          <TouchableOpacity
            style={s.auctionCta}
            onPress={() => navigation.navigate('Tabs', { screen: 'Live' })}
            activeOpacity={0.85}
          >
            <View style={s.auctionCtaIconWrap}>
              <Ionicons name="hammer" size={20} color={Colors.accent} />
              <View style={s.auctionLiveDot} />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.auctionCtaTitle}>
                {liveAuctions.length} live auction{liveAuctions.length !== 1 ? 's' : ''} right now
              </Text>
              <Text style={s.auctionCtaHint}>Bid live before time runs out</Text>
            </View>
            <View style={s.auctionCtaBtn}>
              <Text style={s.auctionCtaBtnText}>VIEW</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Sell your car CTA */}
        <TouchableOpacity
          style={s.sellCta}
          onPress={() => navigation.navigate('SellCarFlow' as any)}
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

        {/* Apply as a Dealer CTA — web's home page (HomeClient.tsx) has a
            full "Are You a Car Dealer?" section linking to dealer signup;
            mobile had no equivalent entry point anywhere on the home screen. */}
        {role !== 'dealer' && (
          <TouchableOpacity
            style={s.dealerCta}
            onPress={() => navigation.navigate('DealerOnboarding' as any)}
            activeOpacity={0.85}
          >
            <View style={s.dealerCtaIconWrap}>
              <Ionicons name="business-outline" size={20} color={Colors.infoBlueLight} />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.dealerCtaTitle}>Are you a car dealer?</Text>
              <Text style={s.dealerCtaHint}>Apply for a dealer account to list your full stock</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.iconMuted} accessibilityElementsHidden importantForAccessibility="no" />
          </TouchableOpacity>
        )}

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
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.whiteAlpha10, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.bgPrimary },

  // Greeting
  greeting: { paddingHorizontal: 24, marginBottom: 22 },
  greetingLine: { fontFamily: FontFamily.extraBold, fontSize: FontSize['3xl'], color: Colors.white, lineHeight: 34 },
  greetingAccent: { fontFamily: FontFamily.extraBold, fontSize: FontSize['3xl'], color: Colors.accent, lineHeight: 34 },

  // Stats bar
  statsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: Colors.accentAlpha30, backgroundColor: Colors.accentAlpha06 },
  statChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 12, paddingHorizontal: 16, height: 52, borderRadius: 14, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderSubtle, gap: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size14, color: Colors.white },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, minWidth: 40, justifyContent: 'center' },
  aiChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white },

  // Inline AI search result
  aiResultCard: {
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.warningAlpha08,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    gap: 10,
  },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiResultLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.warning, letterSpacing: 1 },
  aiResultText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  aiResultError: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.error },
  aiResultBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 42, borderRadius: 10, backgroundColor: Colors.accent,
  },
  aiResultBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, letterSpacing: 0.5 },

  // Quick chips
  quickChipsRow: { paddingHorizontal: 24, paddingBottom: 4, gap: 8, marginBottom: 36 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  // Section
  section: { marginBottom: 36 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 18 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1.5 },
  sectionBadge: { backgroundColor: Colors.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  sectionBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white, letterSpacing: 0.5 },
  seeAll: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.accent },

  // Horizontal scroll
  hScroll: { paddingHorizontal: 24, gap: 16, flexDirection: 'row', alignItems: 'center' },

  // Cards shared
  auctionCard: { width: 282, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 16, overflow: 'hidden' },
  listingCard: { width: 240, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 16, overflow: 'hidden' },
  cardImgWrap: { position: 'relative', height: 150, backgroundColor: Colors.bgTertiary },
  cardImg: { width: '100%', height: '100%' },
  cardImgEmpty: { width: '100%', height: '100%', backgroundColor: Colors.bgTertiary },
  cardBody: { padding: 16 },
  cardSpecs: { fontFamily: FontFamily.medium, fontSize: FontSize.size10, color: Colors.textFaint, letterSpacing: 0.5, marginBottom: 4 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginBottom: 10 },
  cardPrice: { fontFamily: FontFamily.bold, fontSize: FontSize.size17, color: Colors.white },
  cardMeta: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Auction overlays
  livePill: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  livePillText: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.white, letterSpacing: 1 },
  bidOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(10,10,12,0.78)', borderTopWidth: 1, borderTopColor: Colors.whiteAlpha07, paddingVertical: 9, paddingHorizontal: 14 },
  overlayLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.size8, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 2 },
  overlayVal: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white },

  // Listing badges
  featuredBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: Colors.warning, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  featuredBadgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.black, letterSpacing: 0.5 },
  heartBtn: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: Colors.whiteAlpha12, alignItems: 'center', justifyContent: 'center' },

  // Body type
  bodyTypeCard: { width: 80, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.whiteAlpha07, borderRadius: 14, alignItems: 'center', paddingVertical: 14, gap: 8 },
  bodyTypeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bodyTypeLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.white },

  // Recent grid
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 24, rowGap: 16 },
  recentCard: { width: (SW - 56 - 12) / 2, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.whiteAlpha07, borderRadius: 16, overflow: 'hidden' },
  recentImgWrap: { height: 116 },
  recentImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  recentBody: { padding: 16 },
  recentSpecs: { fontFamily: FontFamily.medium, fontSize: FontSize.size9, color: Colors.textFaint, marginBottom: 4 },
  recentTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 6 },
  recentPrice: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white },

  // Empty state
  emptyState: { width: 240, height: 100, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.whiteAlpha02, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha05 },
  emptyStateText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.midBlue_505060 },

  // Live Auctions CTA
  auctionCta: { marginHorizontal: 24, marginBottom: 12, backgroundColor: Colors.bgSecondary, borderRadius: 18, borderWidth: 1, borderColor: Colors.accentAlpha25, padding: 18, flexDirection: 'row', alignItems: 'center' },
  auctionCtaIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.accentAlpha12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  auctionLiveDot: { position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 4.5, backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.bgSecondary },
  auctionCtaTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 2 },
  auctionCtaHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },
  auctionCtaBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  auctionCtaBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, letterSpacing: 0.8 },

  // Sell CTA
  sellCta: { marginHorizontal: 24, marginBottom: 8, backgroundColor: Colors.bgSecondary, borderRadius: 18, borderWidth: 1, borderColor: Colors.accentAlpha25, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sellCtaTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white, marginBottom: 4 },
  sellCtaHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.iconMuted },
  sellCtaBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sellCtaBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, letterSpacing: 0.8 },

  dealerCta: { marginHorizontal: 24, marginBottom: 8, backgroundColor: Colors.bgSecondary, borderRadius: 18, borderWidth: 1, borderColor: Colors.infoBlueAlpha20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dealerCtaIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.infoBlueAlpha12, alignItems: 'center', justifyContent: 'center' },
  dealerCtaTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.white, marginBottom: 2 },
  dealerCtaHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted },
});
