import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { apiClient } from '../../lib/apiClient';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────
type StatusTag = 'LIVE' | 'PENDING' | 'SOLD';
type FilterTab = 'All' | 'Live' | 'Pending' | 'Sold';

interface Listing {
  id: string;
  title: string;
  price: string;
  daysListed: number;
  views: number;
  leads: number;
  offers: number;
  status: StatusTag;
  images: string[];
  offersStatus: string;
  visibility: string;
}

// ─── API mapping helper ──────────────────────────────────────────────────────
const mapApiListing = (l: any): Listing => ({
  id: l.id,
  title: l.title || `${l.year ?? ''} ${l.make ?? ''} ${l.model ?? ''}`.trim() || 'Untitled',
  price: l.price ? `£${Number(l.price).toLocaleString('en-GB')}` : '–',
  daysListed: l.createdAt ? Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000) : 0,
  views: l.viewCount ?? 0,
  leads: 0,
  offers: 0,
  status: (l.status === 'ACTIVE' ? 'LIVE' : l.status === 'DRAFT' ? 'PENDING' : 'SOLD') as StatusTag,
  images: l.images || [],
  offersStatus: '',
  visibility: l.status ?? '',
});

// ─── Status badge colors ─────────────────────────────────────────────────────
const STATUS_STYLE: Record<StatusTag, { bg: string; color: string; label: string }> = {
  LIVE:    { bg: '#22C55E', color: '#FFFFFF', label: 'LIVE' },
  PENDING: { bg: '#F59E0B', color: '#FFFFFF', label: 'PRICING' },
  SOLD:    { bg: '#6B7280', color: '#FFFFFF', label: 'SOLD' },
};

// ─── LISTING DETAIL SUBSCREEN ────────────────────────────────────────────────
const ListingDetail: React.FC<{
  listing: Listing;
  onBack: () => void;
}> = ({ listing, onBack }) => {
  const insets = useSafeAreaInsets();
  const [selectedImg, setSelectedImg] = useState(0);
  const [offersStatus, setOffersStatus] = useState(listing.offersStatus);
  const thumbW = (SCREEN_WIDTH - 48 - 12) / 3;

  const handleEdit = (field: string) => {
    if (field === 'offers') {
      Alert.alert('Offers Status', 'Update how you handle incoming offers:', [
        { text: 'Accepting', onPress: () => setOffersStatus('Accepting') },
        { text: 'Review needed', onPress: () => setOffersStatus('Review needed') },
        { text: 'Not accepting', onPress: () => setOffersStatus('Not accepting') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert(`Edit ${field}`, `Update the ${field} for this listing.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => {} },
      ]);
    }
  };

  const statusS = STATUS_STYLE[listing.status];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.05)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[styles.detailHeader, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.detailHeaderCenter}>
            <View style={styles.listingLivePill}>
              <View style={[styles.liveDot, { backgroundColor: statusS.bg }]} />
              <Text style={styles.listingLiveLabel}>LISTING · {listing.status}</Text>
            </View>
            <Text style={styles.detailTitle} numberOfLines={1}>{listing.title}</Text>
          </View>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert('Options', '', [
                { text: 'Edit listing', onPress: () => {} },
                { text: 'Duplicate listing', onPress: () => {} },
                { text: 'Archive', style: 'destructive', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Image thumbnails ─────────────────────────────────────────────── */}
        <View style={styles.thumbRow}>
          {listing.images.map((uri, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.thumbWrap,
                { width: thumbW },
                selectedImg === i && styles.thumbWrapActive,
              ]}
              onPress={() => setSelectedImg(i)}
              activeOpacity={0.85}
            >
              <Image source={{ uri }} style={[styles.thumbImg, { width: thumbW }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              {i === 0 && (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>HERO</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stat pills ───────────────────────────────────────────────────── */}
        <View style={styles.statPillRow}>
          <View style={styles.statPill}>
            <Ionicons name="eye-outline" size={18} color="#A0A0AB" />
            <Text style={styles.statPillVal}>{listing.views}</Text>
            <Text style={styles.statPillLabel}>VIEWS</Text>
          </View>
          <View style={[styles.statPill, styles.statPillMiddle]}>
            <Ionicons name="mail-outline" size={18} color="#A0A0AB" />
            <Text style={styles.statPillVal}>{listing.leads}</Text>
            <Text style={styles.statPillLabel}>LEADS</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="pricetag-outline" size={18} color="#DC1F26" />
            <Text style={[styles.statPillVal, { color: '#DC1F26' }]}>{listing.offers}</Text>
            <Text style={styles.statPillLabel}>OFFERS</Text>
          </View>
        </View>

        {/* ── Detail rows ─────────────────────────────────────────────────── */}
        <View style={styles.detailCard}>
          {/* List price */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>List price</Text>
            <TouchableOpacity
              style={styles.detailRowRight}
              onPress={() => handleEdit('price')}
              activeOpacity={0.7}
            >
              <Text style={styles.detailRowValue}>{listing.price}</Text>
              <Ionicons name="pencil-outline" size={14} color="#606070" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailDivider} />

          {/* Offers */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Offers</Text>
            <TouchableOpacity
              style={styles.detailRowRight}
              onPress={() => handleEdit('offers')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.detailRowValue,
                offersStatus === 'Accepting' && { color: '#DC1F26' },
                offersStatus === 'Not accepting' && { color: '#6B7280' },
              ]}>
                {offersStatus}
              </Text>
              <Ionicons name="pencil-outline" size={14} color="#606070" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailDivider} />

          {/* Visibility */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Visibility</Text>
            <TouchableOpacity
              style={styles.detailRowRight}
              onPress={() => handleEdit('visibility')}
              activeOpacity={0.7}
            >
              <Text style={styles.detailRowValue}>{listing.visibility}</Text>
              <Ionicons name="pencil-outline" size={14} color="#606070" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailDivider} />

          {/* Days listed */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Days listed</Text>
            <Text style={styles.detailRowValue}>{listing.daysListed} days</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom CTAs ─────────────────────────────────────────────────────── */}
      <View style={[styles.detailFooter, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.boostBtn}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert(
              'Boost Listing',
              'Boosting promotes your listing to the top of search results for 7 days.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Boost — £24.99', onPress: () => {} },
              ]
            )
          }
        >
          <MaterialCommunityIcons name="rocket-launch-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.boostBtnText}>BOOST</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.markSoldBtn, listing.status === 'SOLD' && styles.markSoldBtnDim]}
          activeOpacity={0.85}
          onPress={() =>
            listing.status !== 'SOLD'
              ? Alert.alert('Mark as Sold', `Confirm this vehicle has been sold?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm', style: 'destructive', onPress: () => {} },
                ])
              : undefined
          }
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.markSoldBtnText}>
            {listing.status === 'SOLD' ? 'SOLD' : 'MARK SOLD'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── MAIN INVENTORY SCREEN ───────────────────────────────────────────────────
export const DealerInventoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchListings = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/listings/my?page=1&limit=50');
      if (res.success) setListings((res.data || []).map(mapApiListing));
    } catch {
      setFetchError(true);
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchListings(); }, []);

  if (selectedListing) {
    return (
      <ListingDetail
        listing={selectedListing}
        onBack={() => setSelectedListing(null)}
      />
    );
  }

  const FILTERS: { label: FilterTab; count: number }[] = [
    { label: 'All',     count: listings.length },
    { label: 'Live',    count: listings.filter((l) => l.status === 'LIVE').length },
    { label: 'Pending', count: listings.filter((l) => l.status === 'PENDING').length },
    { label: 'Sold',    count: listings.filter((l) => l.status === 'SOLD').length },
  ];

  const filtered = activeFilter === 'All'
    ? listings
    : listings.filter((l) => l.status === activeFilter.toUpperCase() as StatusTag);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.listHeader, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.listHeaderCenter}>
          <Text style={styles.listHeaderSub}>DEALER · {listings.length} LISTINGS</Text>
          <Text style={styles.listHeaderTitle}>Inventory</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterBar}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[
              styles.filterTab,
              activeFilter === f.label && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(f.label)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === f.label && styles.filterTabTextActive,
            ]}>
              {f.label}
            </Text>
            <Text style={[
              styles.filterTabCount,
              activeFilter === f.label && styles.filterTabCountActive,
            ]}>
              {' '}{f.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Sort row ─────────────────────────────────────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>SORTED: NEWEST</Text>
        <TouchableOpacity
          style={styles.filterIcon}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert('Sort by', '', [
              { text: 'Newest first', onPress: () => {} },
              { text: 'Oldest first', onPress: () => {} },
              { text: 'Most views', onPress: () => {} },
              { text: 'Most offers', onPress: () => {} },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
        >
          <Ionicons name="funnel-outline" size={16} color="#606070" />
        </TouchableOpacity>
      </View>

      {/* ── Listing cards ─────────────────────────────────────────────────── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 16, marginTop: 20 }}>
          <ErrorBanner message="Could not load inventory. Check your connection." onRetry={() => fetchListings()} />
        </View>
      ) : loading && listings.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} w={SCREEN_WIDTH - 32} h={76} r={18} />
          ))}
        </View>
      ) : (
      <ScrollView
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchListings(true)} tintColor={Colors.accent} colors={[Colors.accent]} />}
      >
        {filtered.length === 0 ? (
          <View style={{ marginTop: 40 }}>
            <EmptyState
              icon="car-outline"
              title={activeFilter === 'All' ? 'No listings yet' : `No ${activeFilter.toLowerCase()} listings`}
              subtitle={activeFilter === 'All' ? 'Add your first vehicle to start selling.' : `Switch filters or add more listings.`}
            />
          </View>
        ) : null}
        {filtered.map((listing) => {
          const s = STATUS_STYLE[listing.status];
          return (
            <TouchableOpacity
              key={listing.id}
              style={styles.listingCard}
              onPress={() => setSelectedListing(listing)}
              activeOpacity={0.85}
            >
              {/* Thumbnail + status badge */}
              <View style={styles.listingThumbWrap}>
                <Image
                  source={{ uri: listing.images[0] }}
                  style={styles.listingThumb}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                  <Text style={styles.statusBadgeText}>{s.label}</Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
                <View style={styles.listingPriceRow}>
                  <Text style={styles.listingPrice}>{listing.price}</Text>
                  <Text style={styles.listingDays}> · {listing.daysListed}d listed</Text>
                </View>
                <View style={styles.listingStats}>
                  <Ionicons name="eye-outline" size={13} color="#606070" />
                  <Text style={styles.statNum}>{listing.views}</Text>
                  <Ionicons name="mail-outline" size={13} color="#606070" style={{ marginLeft: 10 }} />
                  <Text style={styles.statNum}>{listing.leads}</Text>
                  {listing.offers > 0 && (
                    <>
                      <Ionicons name="heart-outline" size={13} color="#DC1F26" style={{ marginLeft: 10 }} />
                      <Text style={styles.statOffers}>{listing.offers} offers</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Chevron */}
              <Ionicons name="chevron-forward" size={16} color="#2A2A32" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      )}

      {/* ── Add listing CTA ──────────────────────────────────────────────── */}
      <View style={[styles.addListingWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addListingBtn}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert('Add Listing', 'Upload vehicle details, photos and pricing to publish a new listing.')
          }
        >
          <LinearGradient
            colors={['#FF2D35', '#DC1F26']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name="add" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.addListingText}>ADD LISTING</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },

  // ── Back / icon button ──────────────────────────────────────────────────
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  listHeaderCenter: {
    alignItems: 'center',
  },
  listHeaderSub: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  listHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },

  // Filter tabs
  filterBar: {
    marginBottom: 0,
    maxHeight: 44,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  filterTabActive: {
    backgroundColor: '#DC1F26',
    borderColor: '#DC1F26',
  },
  filterTabText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#606070',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterTabCount: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#606070',
  },
  filterTabCountActive: {
    color: 'rgba(255,255,255,0.80)',
  },

  // Sort row
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 10,
  },
  sortLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#606070',
    letterSpacing: 1.2,
  },
  filterIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Listing cards
  listScroll: {
    flex: 1,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  listingThumbWrap: {
    width: 84,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  listingThumb: {
    width: 84,
    height: 64,
    borderRadius: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  listingPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  listingPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: '#FFFFFF',
  },
  listingDays: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
  },
  listingStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNum: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
    marginLeft: 4,
  },
  statOffers: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#DC1F26',
    marginLeft: 4,
  },

  // Add listing button
  addListingWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  addListingBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#DC1F26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  addListingText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  listingLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  listingLiveLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.6,
  },
  detailTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  // Image thumbnails
  thumbRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 20,
  },
  thumbWrap: {
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbWrapActive: {
    borderColor: '#DC1F26',
  },
  thumbImg: {
    height: 90,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  heroBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#DC1F26',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Stat pills
  statPillRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#111116',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statPillMiddle: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  statPillVal: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statPillLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.2,
  },

  // Detail rows
  detailCard: {
    marginHorizontal: 20,
    backgroundColor: '#111116',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  detailRowLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#A0A0AB',
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRowValue: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  detailDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Footer CTAs
  detailFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
    backgroundColor: 'rgba(10,10,12,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  boostBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  markSoldBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#DC1F26',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC1F26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  markSoldBtnDim: {
    backgroundColor: '#3A3A42',
    shadowOpacity: 0,
    elevation: 0,
  },
  markSoldBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
