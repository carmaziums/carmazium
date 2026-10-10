import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// Canonical sources: src/app/dashboard/dealer/auctions/shortlisted/page.tsx
// and src/app/dashboard/dealer/bids/page.tsx. Both endpoints return
// authenticated dealer/business scoped records; never merge retail saves.
type Nav = { navigate: (name: string, params?: any) => void } | undefined;
type SavedAuction = {
  id: string; listingId: string;
  listing?: {
    id: string; title: string; images?: string[]; status: string;
    make?: string | null; model?: string | null; year?: number | null;
    _count?: { bids?: number };
    auction?: {
      id: string; status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
      startTime: string; endTime: string;
      startingBid: string | number;
    } | null;
  } | null;
};
type AuctionPosition = {
  listingId: string; auctionId: string | null; myBidId: string;
  myHighestBid: number; currentHighestBid: number;
  isLeading: boolean; bidCount: number; endTime: string;
  canCancelCurrentBid: boolean; cancelDeadline: string;
  listing: {
    id: string; title: string; images?: string[];
    make?: string | null; year?: number | null; model?: string | null;
  };
};

const money = (v: number | string) =>
  '£' + Number(v || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const timeLeft = (raw: string, now: number): string => {
  const ms = new Date(raw).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'Ending';
  const mins = Math.ceil(ms / 60000);
  return mins < 60 ? `${mins}m left`
    : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m left`
    : `${Math.floor(mins / 1440)}d ${Math.floor(mins % 1440 / 60)}h left`;
};

function Thumbnail({ uri }: { uri?: string }) {
  return <View style={styles.thumb}>
    {uri ? <Image source={{ uri }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
      : <Ionicons name="car-outline" size={25} color={Colors.textMuted} />}
  </View>;
}

function ErrorText({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.error}>
    <Text style={styles.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} accessibilityRole="button">
      <Text style={styles.retry}>Retry</Text>
    </TouchableOpacity>
  </View>;
}

export function DealerAuctionShortlist({ navigation }: { navigation?: Nav }) {
  const [view, setView] = useState<'live' | 'all'>('live');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SavedAuction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fetchSaved = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient<{
        success: boolean; data: SavedAuction[];
        pagination: { total: number; totalPages: number };
      }>(`/watchlist/auctions?page=${page}&limit=12&view=${view}`);
      if (!res?.success || !Array.isArray(res.data)) {
        throw new Error('Shortlist data unavailable');
      }
      setItems(res.data);
      setTotal(res.pagination?.total ?? res.data.length);
      setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1));
    } catch (err: any) {
      setError(err?.message || 'Unable to load shortlisted auctions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, view]);
  useFocusEffect(useCallback(() => { void fetchSaved(); }, [fetchSaved]));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const setFilter = (next: 'live' | 'all') => {
    if (view === next) return;
    setItems([]);
    setPage(1);
    setView(next);
  };
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Shortlisted Auctions</Text>
      <Text style={styles.subtitle}>
        Save live vehicles and return to bid when you are ready.
      </Text>
      <View style={styles.switchRow}>
        {(['live','all'] as const).map(next => (
          <TouchableOpacity key={next}
            style={[styles.segment, view === next && styles.segmentOn]}
            accessibilityRole="button" accessibilityState={{ selected: view === next }}
            onPress={() => setFilter(next)}>
            <Text style={[styles.segmentText, view === next && styles.segmentTextOn]}>
              {next === 'live' ? 'Live Only' : 'All Saved'}
            </Text>
          </TouchableOpacity>
        ))}
        {!error && !loading && (
          <Text style={styles.total}>{total} saved</Text>
        )}
      </View>
      {error && <ErrorText message={error} onRetry={() => void fetchSaved(true)} />}
      <FlatList
        data={error && !items.length ? [] : items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => void fetchSaved(true)} tintColor={Colors.accent}/>}
        renderItem={({ item }) => {
          const a = item.listing?.auction;
          const live = a?.status === 'ACTIVE' && item.listing?.status === 'ACTIVE'
            && new Date(a.endTime).getTime() > now;
          const state = live ? 'LIVE' : a?.status === 'SCHEDULED' ? 'UPCOMING' : a?.status || 'ENDED';
          return (
            <TouchableOpacity style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Open auction for ${item.listing?.title || 'Vehicle'}`}
              onPress={() => a?.id && navigation?.navigate('AuctionDeepLink', { auctionId: a.id })}
              disabled={!a?.id}>
              <Thumbnail uri={item.listing?.images?.[0]}/>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.listing?.title || 'Vehicle auction'}</Text>
                <Text style={[styles.status, live && { color: Colors.success }]}>{state}</Text>
                {a && <Text style={styles.meta}>Opening bid {money(a.startingBid)}</Text>}
                {a && <Text style={styles.meta}>
                  {live ? 'Ends' : a.status === 'SCHEDULED' ? 'Starts' : 'Ended'} · {timeLeft(live ? a.endTime : a.startTime, now)}
                </Text>}
                <Text style={styles.go}>{live ? 'Open Auction to Bid' : 'View Auction'}  ›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 38 }} color={Colors.accent}/> :
          !error ? <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No {view === 'live' ? 'live ' : ''}shortlisted auctions</Text>
            <Text style={styles.subtitle}>Save auctions from Live Auctions to find them here.</Text>
          </View> : null
        }
        ListFooterComponent={!error && !loading && totalPages > 1 ? (
          <View style={styles.pageRow}>
            <TouchableOpacity onPress={() => setPage(x=>Math.max(1,x-1))}
              disabled={page===1} accessibilityRole="button">
              <Text style={styles.pageLink}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.meta}>{page} / {totalPages}</Text>
            <TouchableOpacity onPress={()=>setPage(x=>Math.min(totalPages,x+1))}
              disabled={page>=totalPages} accessibilityRole="button">
              <Text style={styles.pageLink}>Next</Text>
            </TouchableOpacity>
          </View>) : null
        }
      />
    </View>
  );
}

export function DealerActiveBidPositions({ navigation }: { navigation?: Nav }) {
  const [positions, setPositions] = useState<AuctionPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fetchBids = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient<{ success: boolean; data: AuctionPosition[] }>('/bids/my/active');
      if (!res?.success || !Array.isArray(res.data)) throw new Error('Could not load live auction bids.');
      setPositions(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load your current auction bids.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void fetchBids(); }, [fetchBids]));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Same 20s read-only poll as website's My Auction Bids page.
  useEffect(() => {
    const id = setInterval(() => { void fetchBids(true); }, 20000);
    return () => clearInterval(id);
  }, [fetchBids]);
  const leading = positions.filter(x=>x.isLeading).length;
  return <View style={styles.root}>
    <Text style={styles.title}>My Auction Bids</Text>
    <Text style={styles.subtitle}>One live position per vehicle you're currently bidding on</Text>
    {error && <ErrorText message={error} onRetry={() => void fetchBids(true)} />}
    {!loading && (!error || positions.length > 0) && <View style={styles.metrics}>
      {[{label:'Live Auction Positions',count:positions.length},
        {label:'Currently Leading',count:leading},
        {label:'Outbid / Action Needed',count:positions.length-leading}].map(x=>(
        <View key={x.label} style={styles.metric}>
          <Text style={styles.metricNumber}>{x.count}</Text>
          <Text style={styles.metricLabel}>{x.label}</Text>
        </View>
      ))}
    </View>}
    <FlatList
      style={styles.list}
      data={error && !positions.length ? [] : positions}
      keyExtractor={x => x.listingId}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchBids(true)}
        tintColor={Colors.accent}/>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.bidHeader}>
            <Thumbnail uri={item.listing?.images?.[0]}/>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.listing?.title || 'Vehicle auction'}</Text>
              <Text style={[styles.status,
                { color: item.isLeading ? Colors.success : Colors.warning }]}>
                {item.isLeading ? 'CURRENTLY LEADING' : 'OUTBID / ACTION NEEDED'}
              </Text>
              <Text style={styles.meta}>{timeLeft(item.endTime, now)}</Text>
            </View>
          </View>
          <View style={styles.bidMetrics}>
            <Text style={styles.meta}>Your highest bid: {money(item.myHighestBid)}</Text>
            <Text style={styles.meta}>Current highest: {money(item.currentHighestBid)}</Text>
            <Text style={styles.meta}>{item.bidCount} bid{item.bidCount===1?'':'s'}</Text>
          </View>
          <TouchableOpacity style={styles.mainAction}
            accessibilityRole="button"
            disabled={!item.auctionId}
            onPress={() => item.auctionId &&
              navigation?.navigate('AuctionDeepLink', { auctionId: item.auctionId })}>
            <Text style={styles.mainActionText}>{item.isLeading ? 'View Live Auction' : 'Bid Again'}</Text>
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={
        loading ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 38 }}/> :
          !error ? <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No Current Auction Bids</Text>
            <Text style={styles.subtitle}>Your live auction positions will appear here after you place a bid.</Text>
          </View> : null
      }
      ListFooterComponent={
        <TouchableOpacity style={styles.historyLink} accessibilityRole="button"
          onPress={() => navigation?.navigate('BuyerBids')}>
          <Text style={styles.pageLink}>View all bid history and cancellation options ›</Text>
        </TouchableOpacity>
      }
    />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary, paddingTop: 8 },
  title: { fontFamily: FontFamily.extraBold, fontSize: 19, color: Colors.textPrimary,
    paddingHorizontal: 20, textTransform:'uppercase' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.textMuted,
    lineHeight: 18, paddingHorizontal: 20, marginTop: 4, marginBottom: 11 },
  switchRow: { flexDirection:'row', gap: 7, marginHorizontal:20, marginBottom: 9, alignItems:'center' },
  segment: { minHeight: 42, justifyContent:'center', paddingHorizontal: 13,
    backgroundColor:Colors.bgCard, borderColor:Colors.borderSubtle, borderWidth:1, borderRadius:11 },
  segmentOn:{ backgroundColor: Colors.accent, borderColor:Colors.accent },
  segmentText: {fontFamily: FontFamily.bold,fontSize:12,color:Colors.textMuted},
  segmentTextOn:{color:Colors.white},
  total:{fontFamily:FontFamily.bold,color:Colors.textMuted,fontSize:11, marginLeft:6},
  error: {marginHorizontal:20,marginVertical:7,padding:12,backgroundColor:Colors.bgCard,
    borderWidth:1,borderColor:Colors.warning,borderRadius:12,gap:6},
  errorText:{color:Colors.warning,fontFamily:FontFamily.medium,fontSize:12},
  retry:{color:Colors.accent,fontFamily:FontFamily.bold,fontSize:12},
  list:{flex:1},
  listContent:{paddingBottom:100,paddingHorizontal:20},
  thumb:{width:90,height:88,backgroundColor:Colors.bgElevated,
    alignItems:'center',justifyContent:'center',borderRadius:11,overflow:'hidden'},
  image:{width:'100%',height:'100%'},
  card:{padding:12,borderRadius:14,backgroundColor:Colors.bgCard,
    borderWidth:1,borderColor:Colors.borderSubtle,marginBottom:11,
    flexDirection:'row',gap:12},
  cardCopy:{flex:1,gap:4},
  cardTitle:{color:Colors.textPrimary,fontFamily:FontFamily.bold,fontSize:14},
  meta:{fontFamily:FontFamily.medium,color:Colors.textMuted,fontSize:11},
  status:{fontFamily:FontFamily.bold,fontSize:11,color:Colors.textMuted},
  go:{fontFamily:FontFamily.bold,fontSize:12,color:Colors.accent,marginTop:5},
  empty:{alignItems:'center',gap:8,paddingVertical:42},
  emptyTitle:{fontFamily:FontFamily.bold,fontSize:15,color:Colors.textPrimary},
  pageRow:{flexDirection:'row',justifyContent:'space-between',
    paddingVertical:18,paddingHorizontal:5},
  pageLink:{fontFamily:FontFamily.bold,fontSize:12,color:Colors.accent},
  metrics:{flexDirection:'row',flexWrap:'wrap',gap:8,marginHorizontal:20,marginBottom:10},
  metric:{width:'47%',flexGrow:1,backgroundColor:Colors.bgCard,
    borderWidth:1,borderColor:Colors.borderSubtle,borderRadius:12,
    alignItems:'center',padding:11},
  metricNumber:{fontFamily:FontFamily.extraBold,color:Colors.textPrimary,fontSize:19},
  metricLabel:{fontFamily:FontFamily.bold,color:Colors.textMuted,fontSize:10,textAlign:'center'},
  bidHeader:{flexDirection:'row',gap:11},
  bidMetrics:{gap:6,paddingVertical:8},
  mainAction:{minHeight:44,backgroundColor:Colors.accent,borderRadius:11,
    alignItems:'center',justifyContent:'center',marginTop:6},
  mainActionText:{fontFamily:FontFamily.bold,color:Colors.white,fontSize:12},
  historyLink:{paddingTop:15,paddingBottom:15,alignItems:'center'},
});
