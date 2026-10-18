import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@/components/BrandIcon';
import { Image } from 'expo-image';
import { DealerActiveBidPositions, DealerAuctionShortlist } from './DealerAuctionBuyingSections';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { mergeAppearanceStyles } from '../../theme/appearancePalette';
import { FontFamily } from '../../constants/typography';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { getScrollableStageHeight } from '../../lib/nativeLayoutParity';
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
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(styles, lightDealerBuyBidStyles) : styles;
  const { fontScale } = useWindowDimensions();
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
    <TouchableOpacity style={ts.auctionCard}
      onPress={openManager} disabled={!canManageInventory}
      accessibilityRole={canManageInventory ? 'button' : undefined}
      accessibilityLabel={`${auctionTitle(item)}, ${statusName(item.status)}. ${canManageInventory ? 'Manage auction' : 'Read-only'}`}>
      <View style={ts.rowTitle}>
        <View style={ts.auctionThumb}>
          {item.listing?.images?.[0] ? (
            <Image source={{ uri: item.listing.images[0] }} style={ts.auctionImage}
              contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : <Ionicons name="car-outline" size={24} color={Colors.accent} />}
        </View>
        <View style={ts.rowCopy}>
          <Text style={ts.vehicleTitle} numberOfLines={2}>{auctionTitle(item)}</Text>
          <Text style={ts.auctionIdText}>{item.listing?.vrm || 'PRIVATE'}</Text>
        </View>
        <View style={[ts.statusPill,
          item.status === 'ACTIVE' && ts.statusPillLive]}>
          <Text style={[ts.statusText, item.status === 'ACTIVE' && ts.statusTextLive]}>
            {statusName(item.status)}
          </Text>
        </View>
      </View>
      <View style={ts.auctionMeta}>
        <Text style={ts.metaText}>
          {item.status === 'SCHEDULED' ? 'Starts' : 'Ends'} {formatDate(item.status === 'SCHEDULED' ? item.startTime : item.endTime)}
        </Text>
        {item.status === 'ENDED' && !!item.winnerId && (
          <Text style={ts.metaText}>
            {item.sellerBonusReleased ? 'Handover complete' : 'Check next handover step'}
          </Text>
        )}
      </View>
      {canManageInventory && (
        <View style={ts.cardFooter}>
          <Text style={ts.cardAction}>View auction management and results</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );

  // Render the website-matched dealer hub inside the selected section's
  // scroll surface; no fixed half-screen header above the actual vehicles.
  const hubHeader = (
    <>
      <WebsiteTopBar />
      <View style={ts.heading}>
        <Text style={ts.pageTitle}>Auctions & Buying</Text>
        <Text style={ts.subtitle}>Live auctions, bids and purchases</Text>
        {canManageInventory && (
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Create Auction"
            onPress={openCreate} style={ts.createButton}>
            <Ionicons name="add-circle-outline" size={19} color={Colors.white} />
            <Text style={ts.createText}>Create Auction</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[ts.navScroller, { maxHeight: getScrollableStageHeight(fontScale) + 4 }]} contentContainerStyle={ts.navContent}
        accessibilityLabel="Auction and buying navigation">
        {auctionLinks.filter(link => link.allowed).map(link => (
          <TouchableOpacity key={link.id} onPress={link.onPress}
            accessibilityRole="button" accessibilityLabel={link.label}
            accessibilityState={link.active === undefined ? undefined : { selected: link.active }}
            style={[ts.navButton, { minHeight: Math.max(44, getScrollableStageHeight(fontScale) - 10) }, link.active && ts.navSelected]}>
            <Ionicons name={link.icon as any} size={17}
              color={link.active ? Colors.white : Colors.textMuted} />
            <Text style={[ts.navText, link.active && ts.navTextActive]}>
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
  const myAuctionHeader = (
    <>
      {hubHeader}
          {canManageInventory && needsHandover > 0 && !error && !loading && (
            <TouchableOpacity style={ts.warning} onPress={openManager}
              accessibilityRole="button"
              accessibilityLabel={`${needsHandover} auctions may need next handover steps`}>
              <Ionicons name="alert-circle-outline" size={19} color={Colors.warning} />
              <Text style={ts.warningText}>
                {needsHandover} auction{needsHandover === 1 ? '' : 's'} may need a next step.
                Open My Auctions to review funds confirmation, inspection and handover.
              </Text>
            </TouchableOpacity>
          )}
          {error && (
            <View style={ts.errorBox}>
              <Text style={ts.errorText}>{error}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => { void fetchOwned(true); }}>
                <Text style={ts.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading && !error && (
            <View style={ts.metrics}>
              {[
                { label: 'My Auctions', count: auctions.length },
                { label: 'Live', count: active },
                { label: 'Scheduled', count: scheduled },
                { label: 'Ended', count: ended },
              ].map(value => (
                <View key={value.label} style={ts.metric}>
                  <Text style={ts.metricCount}>{value.count}</Text>
                  <Text style={ts.metricLabel}>{value.label}</Text>
                </View>
              ))}
            </View>
          )}
            <View style={[ts.sectionHeading, { marginHorizontal: 20 }]}>
              <Text style={ts.sectionTitle}>My Auctions</Text>
              {canManageInventory && (
                <TouchableOpacity accessibilityRole="button" onPress={openManager}>
                  <Text style={ts.manageLink}>Manage Auctions</Text>
                </TouchableOpacity>
              )}
            </View>
    </>
  );

  return (
    <View style={ts.screen}>
      {section === 'live' ? (
        <LiveScreen embeddedDealerHub embeddedHeader={
          <>
            {hubHeader}
            {!accessLoading && !canPlaceBid && (
              <Text style={ts.permissionNotice}>
                You can browse auctions. Placing bids requires dealer bidding permission.
              </Text>
            )}
          </>
        } />
      ) : section === 'shortlisted' ? (
        <DealerAuctionShortlist navigation={navigation} header={hubHeader} />
      ) : section === 'bids' ? (
        <DealerActiveBidPositions navigation={navigation} header={hubHeader} />
      ) : (
        <>
          <FlatList
            style={ts.list}
            contentContainerStyle={ts.listContent}
            data={error && auctions.length === 0 ? [] : auctions}
            keyExtractor={a => a.id}
            renderItem={renderCard}
            refreshControl={<RefreshControl
              refreshing={refreshing} onRefresh={() => { void fetchOwned(true); }}
              tintColor={Colors.accent} />}
            ListHeaderComponent={myAuctionHeader}
            ListHeaderComponentStyle={{ marginHorizontal: -20 }}
            ListEmptyComponent={
              loading ? <View style={ts.emptyState}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={ts.emptyText}>Loading your auctions…</Text>
              </View>
              : error ? null : <View style={ts.emptyState}>
                <Ionicons name="hammer-outline" size={26} color={Colors.textMuted} />
                <Text style={ts.emptyText}>No auctions yet</Text>
                <Text style={ts.emptyHint}>
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

const lightDealerBuyBidStyles = StyleSheet.create({
  screen: {backgroundColor: '#EEF5FB'},
  liveContainer: {backgroundColor: '#EEF5FB'},
  permissionNotice: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  pageTitle: {color: '#0F172A'},
  subtitle: {color: '#64748B'},
  navButton: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  navText: {color: '#334155'},
  warning: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  warningText: {color: '#334155'},
  errorBox: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  metrics: {backgroundColor: '#EEF5FB'},
  metric: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  metricCount: {color: '#0F172A'},
  metricLabel: {color: '#64748B'},
  sectionTitle: {color: '#0F172A'},
  auctionCard: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  vehicleTitle: {color: '#0F172A'},
  auctionIdText: {color: '#64748B'},
  statusPill: {backgroundColor: '#F7FBFF', borderColor: '#D5E1EC'},
  statusText: {color: '#334155'},
  metaText: {color: '#64748B'},
  cardFooter: {borderTopColor: '#D5E1EC'},
  emptyState: {backgroundColor: '#FFFFFF', borderColor: '#D5E1EC'},
  emptyText: {color: '#0F172A'},
  emptyHint: {color: '#64748B'},
});

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
