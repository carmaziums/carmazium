import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { Image } from 'expo-image';
import { DealerActiveBidPositions, DealerAuctionShortlist } from './DealerAuctionBuyingSections';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { LiveScreen } from './LiveScreen';

// Website reference: src/app/dashboard/dealer/auctions/page.tsx.
// /dashboard/dealer/auctions is the CANONICAL default Buy & Bid route:
// My Auctions, Live Auctions, Shortlisted, My Bids, Purchases.
// It is not simply a public live-auction browser.
type Section = 'mine' | 'live' | 'shortlisted' | 'bids';
type OwnedAuction = {
  id: string; listingId: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'CANCELLED' | string;
  startTime?: string | null;
  endTime?: string | null;
  reservePrice?: number | null;
  winnerId?: string | null;
  buyerRefusedAt?: string | null;
  sellerFundsConfirmedAt?: string | null;
  handoverRejectedAt?: string | null;
  handoverSubmittedAt?: string | null;
  sellerBonusReleased?: boolean;
  listing?: {
    title?: string | null; make?: string | null; model?: string | null;
    year?: number | null; vrm?: string | null; images?: string[];
  } | null;
};
type Nav = { navigate: (screen: string, params?: any) => void };
const STATUS_NAMES: Record<string, string> = {
  ACTIVE: 'Live', SCHEDULED: 'Scheduled', ENDED: 'Ended', CANCELLED: 'Cancelled',
};
const statusName = (status: string): string => STATUS_NAMES[status] || status;
const auctionTitle = (a: OwnedAuction): string =>
  a.listing?.title || [a.listing?.year, a.listing?.make, a.listing?.model]
    .filter(Boolean).join(' ') || 'Vehicle auction';
const formatDate = (raw?: string | null): string => {
  if (!raw) return 'Not provided';
  const date = new Date(raw);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not provided';
};

// We intentionally link to the existing auction manager for ALL seller
// actions, especially seller funds confirmation and handover proof: copying
// those state transitions into this overview would be unsafe.
export const DealerBuyBidScreen: React.FC<{ navigation?: Nav }> = ({ navigation }) => {
  const { loading: accessLoading, hasPermission } = useDealerAccess(true);
  const canManageInventory = !accessLoading && hasPermission('MANAGE_INVENTORY');
  const canViewPurchases = !accessLoading && hasPermission('VIEW_PURCHASES');
  const canPlaceBid = !accessLoading && hasPermission('PLACE_BID');
  const [section, setSection] = useState<Section>('mine');
  const [auctions, setAuctions] = useState<OwnedAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOwned = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const records = await fetchAllMyAuctions<OwnedAuction>('list');
      setAuctions(records);
    } catch (err: any) {
      // Previous results may be stale, and an empty API error is not "0 auctions."
      setError(err?.message || 'Could not load your auctions. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchOwned();
  }, [fetchOwned]));

  const openManager = () => {
    if (canManageInventory) navigation?.navigate('SellerAuctions');
  };
  const openCreate = () => {
    if (canManageInventory) navigation?.navigate('SellerAuctions', { openCreate: true });
  };
  const openWon = () => {
    if (canViewPurchases) navigation?.navigate('SellerAuctions', { initialTab: 'WON' });
  };

  const auctionLinks: {
    id: string; label: string; icon: string;
    active?: boolean; allowed: boolean; onPress: () => void;
  }[] = [
    { id: 'mine', label: 'My Auctions', icon: 'hammer-outline',
      active: section === 'mine', allowed: true, onPress: () => setSection('mine') },
    { id: 'live', label: 'Live Auctions', icon: 'flame-outline',
      active: section === 'live', allowed: true, onPress: () => setSection('live') },
    { id: 'shortlisted', label: 'Shortlisted', icon: 'star-outline',
      active: section === 'shortlisted', allowed: true, onPress: () => setSection('shortlisted') },
    { id: 'bids', label: 'My Bids', icon: 'receipt-outline',
      active: section === 'bids', allowed: true, onPress: () => setSection('bids') },
    { id: 'purchases', label: 'Purchases', icon: 'trophy-outline',
      allowed: canViewPurchases, onPress: openWon },
  ];

  const active = auctions.filter(a => a.status === 'ACTIVE').length;
  const scheduled = auctions.filter(a => a.status === 'SCHEDULED').length;
  const ended = auctions.filter(a => a.status === 'ENDED').length;
  const needsHandover = auctions.filter(a => (
    a.status === 'ENDED' && !!a.winnerId && !a.buyerRefusedAt
    && !a.sellerBonusReleased && (
      !a.sellerFundsConfirmedAt || !a.handoverSubmittedAt || !!a.handoverRejectedAt
    )
  )).length;

  const renderCard = ({ item }: { item: OwnedAuction }) => (
    <TouchableOpacity style={styles.auctionCard}
      onPress={openManager} disabled={!canManageInventory}
      accessibilityRole={canManageInventory ? 'button' : undefined}
      accessibilityLabel={`${auctionTitle(item)}, ${statusName(item.status)}. ${canManageInventory ? 'Manage auction' : 'Read-only'}`}>
      <View style={styles.rowTitle}>
        <View style={styles.auctionThumb}>
          {item.listing?.images?.[0] ? (
            <Image source={{ uri: item.listing.images[0] }} style={styles.auctionImage}
              contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : <Ionicons name="car-outline" size={24} color={Colors.accent} />}
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.vehicleTitle} numberOfLines={2}>{auctionTitle(item)}</Text>
          <Text style={styles.auctionIdText}>{item.listing?.vrm || 'PRIVATE'}</Text>
        </View>
        <View style={[styles.statusPill,
          item.status === 'ACTIVE' && styles.statusPillLive]}>
          <Text style={[styles.statusText, item.status === 'ACTIVE' && styles.statusTextLive]}>
            {statusName(item.status)}
          </Text>
        </View>
      </View>
      <View style={styles.auctionMeta}>
        <Text style={styles.metaText}>
          {item.status === 'SCHEDULED' ? 'Starts' : 'Ends'} {formatDate(item.status === 'SCHEDULED' ? item.startTime : item.endTime)}
        </Text>
        {item.status === 'ENDED' && !!item.winnerId && (
          <Text style={styles.metaText}>
            {item.sellerBonusReleased ? 'Handover complete' : 'Check next handover step'}
          </Text>
        )}
      </View>
      {canManageInventory && (
        <View style={styles.cardFooter}>
          <Text style={styles.cardAction}>View auction management and results</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <WebsiteTopBar />
      <View style={styles.heading}>
        <Text style={styles.pageTitle}>Auctions & Buying</Text>
        <Text style={styles.subtitle}>Live auctions, bids and purchases</Text>
        {canManageInventory && (
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Create Auction"
            onPress={openCreate} style={styles.createButton}>
            <Ionicons name="add-circle-outline" size={19} color={Colors.white} />
            <Text style={styles.createText}>Create Auction</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.navScroller} contentContainerStyle={styles.navContent}
        accessibilityLabel="Auction and buying navigation">
        {auctionLinks.filter(link => link.allowed).map(link => (
          <TouchableOpacity key={link.id} onPress={link.onPress}
            accessibilityRole="button" accessibilityLabel={link.label}
            accessibilityState={link.active === undefined ? undefined : { selected: link.active }}
            style={[styles.navButton, link.active && styles.navSelected]}>
            <Ionicons name={link.icon as any} size={17}
              color={link.active ? Colors.white : Colors.textMuted} />
            <Text style={[styles.navText, link.active && styles.navTextActive]}>
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {section === 'live' ? (
        <View style={styles.liveContainer}>
          {!accessLoading && !canPlaceBid && (
            <Text style={styles.permissionNotice}>
              You can browse auctions. Placing bids requires dealer bidding permission.
            </Text>
          )}
          <LiveScreen embeddedDealerHub />
        </View>
      ) : section === 'shortlisted' ? (
        <DealerAuctionShortlist navigation={navigation} />
      ) : section === 'bids' ? (
        <DealerActiveBidPositions navigation={navigation} />
      ) : (
        <>
          {canManageInventory && needsHandover > 0 && !error && !loading && (
            <TouchableOpacity style={styles.warning} onPress={openManager}
              accessibilityRole="button"
              accessibilityLabel={`${needsHandover} auctions may need next handover steps`}>
              <Ionicons name="alert-circle-outline" size={19} color={Colors.warning} />
              <Text style={styles.warningText}>
                {needsHandover} auction{needsHandover === 1 ? '' : 's'} may need a next step.
                Open My Auctions to review funds confirmation, inspection and handover.
              </Text>
            </TouchableOpacity>
          )}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => { void fetchOwned(true); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading && !error && (
            <View style={styles.metrics}>
              {[
                { label: 'My Auctions', count: auctions.length },
                { label: 'Live', count: active },
                { label: 'Scheduled', count: scheduled },
                { label: 'Ended', count: ended },
              ].map(value => (
                <View key={value.label} style={styles.metric}>
                  <Text style={styles.metricCount}>{value.count}</Text>
                  <Text style={styles.metricLabel}>{value.label}</Text>
                </View>
              ))}
            </View>
          )}
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={error && auctions.length === 0 ? [] : auctions}
            keyExtractor={a => a.id}
            renderItem={renderCard}
            refreshControl={<RefreshControl
              refreshing={refreshing} onRefresh={() => { void fetchOwned(true); }}
              tintColor={Colors.accent} />}
            ListHeaderComponent={
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>My Auctions</Text>
                {canManageInventory && (
                  <TouchableOpacity accessibilityRole="button" onPress={openManager}>
                    <Text style={styles.manageLink}>Manage Auctions</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListEmptyComponent={
              loading ? <View style={styles.emptyState}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.emptyText}>Loading your auctions…</Text>
              </View>
              : error ? null : <View style={styles.emptyState}>
                <Ionicons name="hammer-outline" size={26} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No auctions yet</Text>
                <Text style={styles.emptyHint}>
                  Your own auctions will appear here. Use Live Auctions to find vehicles to bid on.
                </Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  liveContainer: { flex: 1 },
  permissionNotice: { color: Colors.textMuted, paddingHorizontal: 20, paddingBottom: 5,
    fontFamily: FontFamily.medium, fontSize: 12 },
  heading: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 9, gap: 5 },
  pageTitle: { fontFamily: FontFamily.extraBold, fontSize: 25,
    color: Colors.textPrimary, letterSpacing: -0.5, textTransform: 'uppercase' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.textMuted },
  createButton: { flexDirection: 'row', gap: 7, alignItems: 'center',
    backgroundColor: Colors.accent, borderRadius: 12,
    minHeight: 44, paddingHorizontal: 15, alignSelf: 'flex-start', marginTop: 10 },
  createText: { color: Colors.white, fontFamily: FontFamily.bold, fontSize: 13 },
  navScroller: { flexGrow: 0, marginBottom: 9, maxHeight: 58 },
  navContent: { gap: 4, padding: 5, marginHorizontal: 20, alignItems: 'center',
    borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 13, borderRadius: 11 },
  navSelected: { backgroundColor: Colors.accent },
  navText: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: 12 },
  navTextActive: { color: Colors.white },
  warning: { flexDirection: 'row', marginHorizontal: 20, padding: 13, gap: 9,
    borderColor: Colors.warning, borderWidth: 1, borderRadius: 13, marginBottom: 9,
    backgroundColor: Colors.bgCard },
  warningText: { flex: 1, color: Colors.warning,
    fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 18 },
  errorBox: { marginHorizontal: 20, padding: 13, marginBottom: 9,
    borderWidth: 1, borderColor: Colors.warning, borderRadius: 13,
    backgroundColor: Colors.bgCard, gap: 7 },
  errorText: { color: Colors.warning, fontSize: 12, fontFamily: FontFamily.medium },
  retryText: { color: Colors.accent, fontSize: 12, fontFamily: FontFamily.bold },
  metrics: { flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 20, marginBottom: 10, gap: 8 },
  metric: { flexGrow: 1, width: '46%', padding: 12, minHeight: 75,
    borderRadius: 12, backgroundColor: Colors.bgCard,
    borderColor: Colors.borderSubtle, borderWidth: 1, alignItems: 'center' },
  metricCount: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 21 },
  metricLabel: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: 11 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 110 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16,
    fontFamily: FontFamily.extraBold },
  manageLink: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 12 },
  auctionCard: { borderRadius: 15, padding: 15, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgCard },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  auctionThumb: { width: 65, height: 60, backgroundColor: Colors.bgElevated,
    borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  auctionImage: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, gap: 3 },
  vehicleTitle: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 14 },
  auctionIdText: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 11 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.bgElevated },
  statusPillLive: { borderColor: Colors.success },
  statusText: { fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: 10 },
  statusTextLive: { color: Colors.success },
  auctionMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaText: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 11 },
  cardFooter: { marginTop: 10, paddingTop: 10, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  cardAction: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 11 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  emptyText: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 13 },
  emptyHint: { color: Colors.textMuted, fontFamily: FontFamily.regular,
    fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
