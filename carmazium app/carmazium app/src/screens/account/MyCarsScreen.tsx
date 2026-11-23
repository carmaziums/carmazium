import React, { useCallback, useRef, useState } from 'react';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { ImportListingModal } from '../../components/ImportListingModal';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { fetchAllMyListings } from '../../lib/myListingsApi';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { Colors } from '../../constants/colors';
import { Elevation, Radius } from '../../constants/spacing';
import { FontFamily, FontSize } from '../../constants/typography';
import { Layout } from '../../constants/layout';

type Vehicle = {
  id: string; title?: string; make?: string; model?: string; year?: number;
  price?: number; mileage?: number; viewCount?: number; createdAt?: string;
  status?: string; images?: string[]; type?: string; listingId?: string;
  listing?: { id: string; title?: string; images?: string[]; year?: number; make?: string; model?: string };
};
type Channel = 'Listings' | 'Auctions';
type Filter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'SCHEDULED' | 'PENDING_REVIEW' | 'OFFER_ACCEPTED' | 'SOLD' | 'WITHDRAWN' | 'REJECTED' | 'ENDED' | 'CANCELLED';
const FILTERS: Filter[] = ['ALL', 'ACTIVE', 'DRAFT', 'SCHEDULED', 'PENDING_REVIEW', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED', 'ENDED', 'CANCELLED'];

/** A single entry point for every owned retail and auction car. */
export const MyCarsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [channel, setChannel] = useState<Channel>('Listings');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [listings, setListings] = useState<Vehicle[]>([]);
  const [auctions, setAuctions] = useState<Vehicle[]>([]);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const request = useRef(0);
  const listRef = useRef<FlatList<Vehicle>>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = ++request.current;
    setBusy(true);
    setError(null);
    const [listingResult, auctionResult] = await Promise.allSettled([
      fetchAllMyListings<Vehicle>(),
      fetchAllMyAuctions<Vehicle>('list'),
    ]);
    if (id !== request.current) return;
    if (listingResult.status === 'fulfilled') setListings(listingResult.value);
    else setError('Your listings could not be loaded.');
    if (auctionResult.status === 'fulfilled') setAuctions(auctionResult.value);
    else setError(previous => previous ? previous + ' Auctions could not be loaded.' : 'Auctions could not be loaded.');
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  const data = (channel === 'Listings' ? listings : auctions).filter(item =>
    filter === 'ALL' || item.status === filter);
  const totalPages = Math.max(1, Math.ceil(data.length / 10));
  const currentPage = Math.min(page, totalPages);
  const paginated = data.slice((currentPage - 1) * 10, currentPage * 10);
  // Heading, channel switch and status filters scroll with the cars (list
  // header) so a larger system font size can't leave the list no height.
  const header = (
    <View style={styles.headerBleed}>
      <View style={styles.heading}>
        <Text style={styles.title}>My cars</Text>
        <Text style={styles.muted}>Every vehicle you are selling, through retail or auction.</Text>
      </View>
      <View style={styles.channelRow}>
        {(['Listings', 'Auctions'] as const).map(value => (
          <TouchableOpacity key={value} accessibilityRole="button"
            accessibilityState={{ selected: channel === value }}
            onPress={() => { setChannel(value); setFilter('ALL'); setPage(1); }}
            style={[styles.channel, channel === value && styles.selected]}>
            <Text style={[styles.channelText, channel === value && styles.selectedText]}>{value === 'Listings' ? 'Retail and other listings' : 'Auctions'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{paddingHorizontal:20,gap:12,marginVertical:20}}>
        <Text style={[styles.name,{textTransform:'uppercase'}]}>{channel === 'Listings' ? 'Retail and other listings' : 'Auctions'}</Text>
        <Text style={styles.muted}>{channel === 'Listings' ? 'Cars you are selling, waiting for review, in draft or sold.' : 'Manage your auction listings and completed sales.'}</Text>
        <View style={{ gap: 12 }}>
          {channel === 'Listings' && <Button label="Import Listing" variant="outline" style={{ width: '100%' }} onPress={() => setImporting(true)} />}
          <Button label="New Listing" style={{ width: '100%' }} onPress={() => navigation.navigate('SellLanding')} />
        </View>
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:20,marginBottom:20}}>
        {FILTERS.filter(status => channel === 'Listings'
          ? !['SCHEDULED', 'ENDED', 'CANCELLED'].includes(status)
          : !['DRAFT', 'PENDING_REVIEW', 'OFFER_ACCEPTED', 'SOLD', 'WITHDRAWN', 'REJECTED'].includes(status)).map(status => (
          <Button key={status} size="sm" label={status === 'ALL' ? 'All' : status.replace(/_/g, ' ').toLowerCase()} variant={filter === status ? 'primary' : 'outline'} onPress={() => {setFilter(status);setPage(1);}} />
        ))}
      </View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
  return (
    <View style={styles.screen}>
      <WebsiteTopBar />
      {importing && <ImportListingModal onClose={() => setImporting(false)} onImported={() => {setImporting(false);void load();}} />}
        <FlatList ref={listRef} style={styles.list} data={busy ? [] : paginated} keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          ListFooterComponent={!busy && totalPages > 1 ? <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:20}}><Button label="Prev" variant="outline" disabled={currentPage===1} onPress={() => {setPage(currentPage-1);listRef.current?.scrollToOffset({offset:0,animated:false});}} /><Text style={styles.muted}>Page {currentPage} of {totalPages}</Text><Button label="Next" variant="outline" disabled={currentPage===totalPages} onPress={() => {setPage(currentPage+1);listRef.current?.scrollToOffset({offset:0,animated:false});}} /></View> : null}
          ListEmptyComponent={busy
            ? <View style={styles.loading}><ActivityIndicator color={Colors.accent}/></View>
            : error ? <Button label="Retry" onPress={() => void load()} /> : <View style={styles.emptyListings}>
              <Text style={styles.emptyListingsText}>
                {channel === 'Listings'
                  ? filter === 'ALL' ? 'No listings found. Start selling today!' : 'No listings matching this status.'
                  : 'No auctions matching this status.'}
              </Text>
            </View>}
          renderItem={({ item }) => {
            const vehicle = item.listing || item;
            const name = vehicle.title || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
            const canMarkSold = channel === 'Listings' && ['ACTIVE', 'OFFER_ACCEPTED'].includes(item.status || '');
            return (
              <View style={styles.card}>
                <View style={styles.vehicleSummary}>
                  {vehicle.images?.[0]
                    ? <Image source={{ uri: vehicle.images[0] }} style={styles.image} contentFit="cover" />
                    : <View style={styles.thumb}><Ionicons name="car-outline" size={22} color={Colors.textMuted}/></View>}
                  <View style={styles.details}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {vehicle.year || 'Year not recorded'}{item.mileage != null ? ` • ${Number(item.mileage).toLocaleString('en-GB')} miles` : ''}
                    </Text>
                    <Text style={[styles.manage, item.status === 'ACTIVE' && styles.liveStatus]}>
                      {item.status === 'ACTIVE' ? 'LIVE' : item.status?.replace(/_/g, ' ') || 'Not provided'}
                    </Text>
                  </View>
                </View>
                {channel === 'Listings' && <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>{item.price == null ? 'Price not recorded' : Number(item.price).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}</Text>
                    <Text style={styles.viewsText}>{item.viewCount ?? 0} views</Text>
                  </View>
                  {item.createdAt && <Text style={styles.listedDate}>Listed on {new Date(item.createdAt).toLocaleDateString('en-GB')}</Text>}
                </>}
                <View style={styles.primaryActions}>
                  {channel === 'Listings' ? <>
                    {canMarkSold ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.soldButton]}
                        accessibilityRole="button" accessibilityLabel="Mark Sold"
                        onPress={() => navigation.navigate('SellerListings', { focusListingId: item.id, focusAction: 'mark_sold' })}>
                        <Ionicons name="checkmark-circle-outline" size={17} color={Colors.onAccent} />
                        <Text style={styles.soldButtonText}>Mark Sold</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.neutralButton]}
                        accessibilityRole="button" accessibilityLabel={item.status === 'DRAFT' ? 'Manage draft listing' : 'Manage listing status'}
                        onPress={() => navigation.navigate('SellerListings', { focusListingId: item.id })}>
                        <Text style={styles.neutralButtonText}>{item.status === 'DRAFT' ? 'Manage draft' : item.status === 'REJECTED' ? 'Review rejection' : 'Manage status'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]} accessibilityRole="button" accessibilityLabel="Edit listing"
                      onPress={() => navigation.navigate('SellCarFlow', { listingId: item.id })}>
                      <Ionicons name="create-outline" size={17} color={Colors.textPrimary} />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </> : <TouchableOpacity style={[styles.actionButton, styles.editButton]}
                    accessibilityRole="button" accessibilityLabel="Manage auction"
                    onPress={() => navigation.navigate('SellerAuctions', { focusListingId: item.listingId || item.listing?.id })}>
                    <Text style={styles.editButtonText}>Manage auction</Text>
                  </TouchableOpacity>}
                </View>
                {channel === 'Listings' && (
                  <TouchableOpacity style={styles.moreOptions} accessibilityRole="button"
                    accessibilityLabel="More listing options"
                    onPress={() => navigation.navigate('SellerListings', { focusListingId: item.id })}>
                    <Text style={styles.moreOptionsText}>More options</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  heading: { paddingHorizontal: 8, paddingTop: 24, paddingBottom: 20, gap: 8 },
  title: { fontSize: FontSize['2xl'] + 1, color: Colors.textPrimary, fontFamily: FontFamily.extraBold },
  muted: { fontSize: FontSize.base - 1, lineHeight: 22, color: Colors.textMuted, fontFamily: FontFamily.medium },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  channel: { minHeight: 44, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, backgroundColor: Colors.bgCard, borderColor: Colors.borderHi },
  selected: { backgroundColor: Colors.accent, borderColor: Colors.accent, borderBottomColor: Colors.accentDark, ...Elevation.neon },
  selectedText: { color: Colors.onAccent },
  channelText: { color: Colors.textSecondary, fontFamily: FontFamily.bold },
  filters: { flexGrow: 0, marginVertical: 12, maxHeight: 52 },
  filterContent: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  filter: { minHeight: 38, borderWidth: 1, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 11, backgroundColor: Colors.bgCard, borderColor: Colors.borderHi, borderBottomWidth: 2 },
  filterSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent, borderBottomColor: Colors.accentDark },
  filterText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontFamily: FontFamily.bold },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 110, gap: 2 },
  card: { gap: 7, backgroundColor: Colors.bgCard, padding: 16,
    borderWidth: 1, borderRadius: 14, borderColor: Colors.borderSubtle },
  vehicleSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  image: { width: 80, height: 64, borderRadius: 12 },
  thumb: { width: 80, height: 64, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', backgroundColor: Colors.bgElevated },
  details: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: FontSize.base },
  manage: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: 11,
    alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSurface, overflow: 'hidden' },
  liveStatus: { color: Colors.success, borderColor: Colors.successAlpha20, backgroundColor: Colors.successAlpha08 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  priceText: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: FontSize.lg },
  viewsText: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  listedDate: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  primaryActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  soldButton: { backgroundColor: Colors.success, borderColor: Colors.success },
  soldButtonText: { color: Colors.onAccent, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  neutralButton: { backgroundColor: Colors.bgElevated, borderColor: Colors.borderSubtle },
  neutralButtonText: { color: Colors.textSecondary, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  editButton: { backgroundColor: Colors.bgCard, borderColor: Colors.border },
  editButtonText: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  moreOptions: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6 },
  moreOptionsText: { color: Colors.textMuted, fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  error: { paddingHorizontal: 20, color: Colors.warning, fontSize: FontSize.sm - 1 },
  loading: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyListings: { minHeight: 255, padding: 30, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  emptyListingsText: { color: Colors.textSecondary, fontSize: FontSize.base, fontStyle: 'italic', textAlign: 'center' },
  // Header rows carry their own 20pt gutters inside the padded list.
  headerBleed: { marginHorizontal: -8 },
});
