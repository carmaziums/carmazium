import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, FlatList, RefreshControl, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { getAuctionShortlist, type ShortlistedAuction } from '../../lib/auctionShortlistApi';
import { auctionToListingParam, getAuction } from '../../lib/auctionApi';
import { removeFromWatchlist } from '../../lib/watchlistApi';
import { useWatchlistStore } from '../../store/watchlistStore';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type ViewMode = 'live' | 'all';
const PAGE_SIZE = 12;
const AUTO_REFRESH_MS = 20_000;

function remainingUntil(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return 'Ended';
  const mins = Math.ceil(diff / 60_000);
  if (mins < 60) return mins + 'm left';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ' + (mins % 60) + 'm left';
  return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h left';
}

const money = (value: number | string) =>
  '£' + Number(value).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const statusLabel = (item: ShortlistedAuction, now: number) => {
  const auction = item.listing.auction;
  if (!auction) return 'Unavailable';
  const live = item.listing.status === 'ACTIVE' && auction.status === 'ACTIVE' && new Date(auction.endTime).getTime() > now;
  if (live) return 'LIVE';
  if (auction.status === 'SCHEDULED' && new Date(auction.startTime).getTime() > now) return 'UPCOMING';
  if (auction.status === 'CANCELLED') return 'CANCELLED';
  return 'ENDED / UNAVAILABLE';
};

/** Uses the same dealer-only API and saved watchlist as the website. */
export const DealerAuctionShortlistScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const hydrateWatchlist = useWatchlistStore((s) => s.hydrateFromApi);
  const [view, setView] = useState<ViewMode>('live');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ShortlistedAuction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const requestId = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const request = ++requestId.current;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await getAuctionShortlist(page, PAGE_SIZE, view);
      if (request !== requestId.current) return;
      setItems(response.data);
      setTotal(response.pagination.total);
      const nextTotalPages = Math.max(1, response.pagination.totalPages);
      setTotalPages(nextTotalPages);
      // Match the website: deleting the final item on page N must return to
      // the last non-empty page instead of showing a false empty shortlist.
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }
    } catch (err: any) {
      if (request === requestId.current) {
        setError(err?.message || 'Could not load shortlisted auctions.');
      }
    } finally {
      if (request === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, view]);

  useFocusEffect(useCallback(() => {
    void load();
    // Website refreshes authoritative price/status every 20s. Do the same
    // while this screen is focused and the app is foregrounded. Never poll
    // an unfocused screen or wake a backgrounded phone unnecessarily.
    const refreshTimer = setInterval(() => {
      if (AppState.currentState === 'active') void load(true);
    }, AUTO_REFRESH_MS);
    const clockTimer = setInterval(() => {
      if (AppState.currentState === 'active') setNow(Date.now());
    }, 15_000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      requestId.current += 1;
    };
  }, [load]));

  const changeView = (next: ViewMode) => {
    if (next === view) return;
    setPage(1);
    setView(next);
    setItems([]);
  };

  const openAuction = async (auctionId: string) => {
    if (opening) return;
    setOpening(auctionId);
    try {
      // Fetch current state before opening the bidding room; stale shortlist
      // data must never be treated as an active auction or an eligible bid.
      const auction = await getAuction(auctionId);
      navigation.navigate('LiveAuctionDetailed', { listing: auctionToListingParam(auction) });
    } catch (err: any) {
      Alert.alert('Auction unavailable', err?.message || 'Please refresh and try again.');
    } finally {
      setOpening(null);
    }
  };

  const remove = (item: ShortlistedAuction) => {
    Alert.alert('Remove shortlisted auction?', 'You can save this car again from live auctions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          if (removing) return;
          setRemoving(item.listingId);
          void (async () => {
            try {
              await removeFromWatchlist(item.listingId);
              await load(true);
              // Update hearts and the general Saved Cars tab, too.
              await hydrateWatchlist();
            } catch (err: any) {
              Alert.alert('Could not remove auction', err?.message || 'Please retry.');
            } finally {
              setRemoving(null);
            }
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ShortlistedAuction }) => {
    const a = item.listing.auction;
    const isLive = item.listing.status === 'ACTIVE' && a?.status === 'ACTIVE' && new Date(a.endTime).getTime() > now;
    const upcoming = a?.status === 'SCHEDULED' && new Date(a.startTime).getTime() > now;
    const highest = item.listing.bids[0]?.amount;
    const bidAmount = highest != null ? highest : a?.startingBid ?? 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          accessibilityRole="button"
          accessibilityLabel={'View auction for ' + item.listing.title}
          onPress={() => a && void openAuction(a.id)}
          disabled={!a || !!opening}
        >
          <View style={styles.imageWrap}>
            {item.listing.images?.[0] ? (
              <Image source={{ uri: item.listing.images[0] }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={styles.imagePlaceholder}><Ionicons name="car-outline" size={32} color={Colors.textMuted} /></View>
            )}
          </View>
          <View style={styles.details}>
            <Text style={styles.title} numberOfLines={2}>{item.listing.title}</Text>
            <Text style={styles.meta}>
              {[item.listing.year, item.listing.mileage == null ? null : item.listing.mileage.toLocaleString('en-GB') + ' miles']
                .filter(Boolean).join(' · ')}
            </Text>
            <Text style={[styles.status, isLive && styles.liveStatus]}>{statusLabel(item, now)}</Text>
            <Text style={styles.price}>{money(bidAmount)}</Text>
            <Text style={styles.meta}>
              {item.listing._count?.bids || 0} bids · {highest != null ? 'Current bid' : 'Starting bid'}
            </Text>
            {!!a && <Text style={styles.meta}>
              {isLive ? 'Ends in ' + remainingUntil(a.endTime, now)
                : upcoming ? 'Starts in ' + remainingUntil(a.startTime, now)
                  : statusLabel(item, now)}
            </Text>}
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={'Remove ' + item.listing.title + ' from shortlist'}
            disabled={removing === item.listingId}
            onPress={() => remove(item)}
          >
            {removing === item.listingId ? <ActivityIndicator color={Colors.textSecondary} size="small" /> :
              <Ionicons name="trash-outline" color={Colors.textSecondary} size={17} />}
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bidButton, (!a || !isLive) && styles.inactiveButton]}
            accessibilityRole="button"
            disabled={!a || !!opening}
            onPress={() => a && void openAuction(a.id)}
          >
            {opening === a?.id && <ActivityIndicator size="small" color={Colors.textPrimary} />}
            <Text style={styles.bidText}>{isLive ? 'Open auction to bid' : 'View auction'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="arrow-back" color={Colors.textPrimary} size={22} />
        </TouchableOpacity>
        <Text style={styles.heading}>Shortlisted auctions</Text>
        <TouchableOpacity onPress={() => void load(true)} accessibilityRole="button" accessibilityLabel="Refresh shortlisted auctions" style={styles.back}>
          <Ionicons name="refresh" color={Colors.textPrimary} size={21} />
        </TouchableOpacity>
      </View>
      <View style={styles.toolbar}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: view === 'live' }}
          style={[styles.pill, view === 'live' && styles.pillSelected]} onPress={() => changeView('live')}>
          <Text style={[styles.pillText, view === 'live' && styles.pillTextSelected]}>Live to bid</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: view === 'all' }}
          style={[styles.pill, view === 'all' && styles.pillSelected]} onPress={() => changeView('all')}>
          <Text style={[styles.pillText, view === 'all' && styles.pillTextSelected]}>All saved</Text>
        </TouchableOpacity>
        <Text style={styles.count}>{total} saved</Text>
      </View>
      {!!error && (
        <TouchableOpacity accessibilityRole="button" onPress={() => void load()} style={styles.errorWrap}>
          <Text style={styles.error}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {loading && items.length === 0 ? (
        <View style={styles.empty}><ActivityIndicator size="large" color={Colors.accent} /><Text style={styles.meta}>Loading shortlist…</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, items.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={Colors.accent} onRefresh={() => void load(true)} />}
          ListEmptyComponent={!error ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={38} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{view === 'live' ? 'No live shortlisted auctions' : 'No shortlisted auctions'}</Text>
              <Text style={styles.meta}>Save any live auction with the heart icon. Ended auctions remain under All saved.</Text>
              <TouchableOpacity style={styles.bidButton} onPress={() => navigation.navigate('Tabs', { screen: 'Live' })}>
                <Text style={styles.bidText}>Browse live auctions</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          ListFooterComponent={totalPages > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity disabled={page <= 1} style={styles.pill} onPress={() => setPage(page - 1)}>
                <Text style={styles.pillText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.meta}>Page {page} / {totalPages}</Text>
              <TouchableOpacity disabled={page >= totalPages} style={styles.pill} onPress={() => setPage(page + 1)}>
                <Text style={styles.pillText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  heading: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  pill: { paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: Colors.textMuted, borderRadius: 10 },
  pillSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText: { color: Colors.textSecondary, fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  pillTextSelected: { color: Colors.textPrimary },
  count: { color: Colors.textMuted, fontSize: FontSize.xs, marginLeft: 'auto' },
  list: { padding: 16, gap: 12, paddingBottom: 36 },
  emptyList: { flexGrow: 1 },
  card: { backgroundColor: Colors.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha08, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', padding: 12, gap: 13 },
  imageWrap: { width: 105, minHeight: 118, borderRadius: 10, overflow: 'hidden' },
  image: { width: 105, height: 118 },
  imagePlaceholder: { width: 105, height: 118, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgTertiary },
  details: { flex: 1, gap: 4 },
  title: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  meta: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.xs },
  status: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  liveStatus: { color: Colors.success },
  price: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha08 },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  removeText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  bidButton: { backgroundColor: Colors.accent, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  inactiveButton: { backgroundColor: Colors.bgTertiary },
  bidText: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 26, flex: 1 },
  emptyTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.md, textAlign: 'center' },
  errorWrap: { marginHorizontal: 16, padding: 12, backgroundColor: Colors.bgSecondary, borderRadius: 10 },
  error: { color: Colors.error, fontSize: FontSize.sm },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
});
