import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  Dimensions,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { RowDensity } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { haptics } from '../../lib/haptics';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { ImportListingModal } from '../../components/ImportListingModal';
import { BulkImportModal } from '../../components/BulkImportModal';
import { BottomSheet } from '../../components/BottomSheet';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';
import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VIEW_MODE_STORAGE_KEY = 'czm_dealer_inventory_view_mode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────
type StatusTag = 'LIVE' | 'PENDING' | 'SOLD';
type FilterTab = 'All' | 'Live' | 'Pending' | 'Sold';

interface Listing {
  id: string;
  title: string;
  price: string;
  rawPrice: number;
  daysListed: number;
  views: number;
  leads: number;
  offers: number;
  status: StatusTag;
  images: string[];
  offersStatus: string;
  visibility: string;
  linkedListingId?: string | null;
  linkedAuctionStatus?: string | null;
}

// ─── API mapping helper ──────────────────────────────────────────────────────
const mapApiListing = (l: any): Listing => ({
  id: l.id,
  title: l.title || `${l.year ?? ''} ${l.make ?? ''} ${l.model ?? ''}`.trim() || 'Untitled',
  price: l.price ? `£${Number(l.price).toLocaleString('en-GB')}` : '–',
  rawPrice: l.price ? Number(l.price) : 0,
  daysListed: l.createdAt ? Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000) : 0,
  views: l.viewCount ?? 0,
  // Were hardcoded 0 — GET /listings/my now includes a real _count on
  // offers/leads (backend previously only used the offers relation for
  // sort order without ever selecting it).
  leads: l._count?.leads ?? 0,
  offers: l._count?.offers ?? 0,
  status: (l.status === 'ACTIVE' ? 'LIVE' : l.status === 'DRAFT' ? 'PENDING' : 'SOLD') as StatusTag,
  linkedListingId: l.linkedListingId ?? null,
  linkedAuctionStatus: l.linkedListing?.auction?.status ?? null,
  images: l.images || [],
  offersStatus: '',
  visibility: l.status ?? '',
});

// ─── Status badge colors ─────────────────────────────────────────────────────
const STATUS_STYLE: Record<StatusTag, { bg: string; color: string; label: string }> = {
  LIVE:    { bg: Colors.success, color: Colors.white, label: 'LIVE' },
  PENDING: { bg: Colors.warning, color: Colors.white, label: 'PRICING' },
  SOLD:    { bg: Colors.midBlue_6b7280, color: Colors.white, label: 'SOLD' },
};

// ─── LISTING DETAIL SUBSCREEN ────────────────────────────────────────────────
const ListingDetail: React.FC<{
  listing: Listing;
  onBack: () => void;
  navigation?: any;
  onSold: () => void;
}> = ({ listing, onBack, navigation, onSold }) => {
  const insets = useSafeAreaInsets();
  const [selectedImg, setSelectedImg] = useState(0);
  const [offersStatus, setOffersStatus] = useState(listing.offersStatus);
  const thumbW = (SCREEN_WIDTH - 48 - 12) / 3;

  // Boost — same in-app Stripe checkout pattern already used by
  // SellerListingsScreen.tsx (POST /featured-boost/:id -> checkoutUrl).
  const [boosting, setBoosting] = useState(false);
  const [boostCheckoutUrl, setBoostCheckoutUrl] = useState<string | null>(null);
  const [boostToast, setBoostToast] = useState<string | null>(null);

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const res = await apiClient<{ success: boolean; data: { checkoutUrl: string } }>(
        `/featured-boost/${listing.id}`,
        { method: 'POST' },
      );
      const checkoutUrl = res?.data?.checkoutUrl;
      if (checkoutUrl) {
        setBoostCheckoutUrl(checkoutUrl);
      } else {
        Alert.alert('Error', 'No checkout URL returned.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not initiate boost.');
    } finally {
      setBoosting(false);
    }
  };

  const handleBoostSuccess = useCallback(() => {
    setBoostCheckoutUrl(null);
    haptics.success();
    setBoostToast('Boosted for 7 days');
    setTimeout(() => setBoostToast(null), 3000);
  }, []);

  // Mark Sold — same PATCH /listings/:id/sold pattern as SellerListingsScreen.tsx.
  const [markSoldVisible, setMarkSoldVisible] = useState(false);
  const [soldPriceInput, setSoldPriceInput] = useState('');
  const [markSoldSubmitting, setMarkSoldSubmitting] = useState(false);
  const [markSoldError, setMarkSoldError] = useState<string | null>(null);

  const openMarkSold = () => {
    setSoldPriceInput(listing.rawPrice ? listing.rawPrice.toLocaleString('en-GB') : '');
    setMarkSoldError(null);
    setMarkSoldVisible(true);
  };

  const handleConfirmMarkSold = async () => {
    const soldPrice = parseFloat(soldPriceInput.replace(/[^0-9.]/g, ''));
    if (isNaN(soldPrice) || soldPrice <= 0) {
      setMarkSoldError('Enter a valid sale price.');
      return;
    }
    setMarkSoldSubmitting(true);
    setMarkSoldError(null);
    try {
      await apiClient(`/listings/${listing.id}/sold`, {
        method: 'PATCH',
        body: JSON.stringify({ soldPrice }),
      });
      haptics.success();
      setMarkSoldVisible(false);
      onSold();
    } catch (err: any) {
      setMarkSoldError(err?.message ?? 'Could not mark as sold. Please try again.');
    } finally {
      setMarkSoldSubmitting(false);
    }
  };

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
        colors={[Colors.accentAlpha05, 'rgba(0,0,0,0)', Colors.bgPrimary]}
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
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={onBack} accessibilityLabel="Go back" />
          <View style={styles.detailHeaderCenter}>
            <View style={styles.listingLivePill}>
              <View style={[styles.liveDot, { backgroundColor: statusS.bg }]} />
              <Text style={styles.listingLiveLabel}>LISTING · {listing.status}</Text>
            </View>
            <Text style={styles.detailTitle} numberOfLines={1}>{listing.title}</Text>
          </View>
          <IconButton style={styles.backBtn} icon={<Ionicons name="ellipsis-horizontal" size={20} color={Colors.white} />} onPress={() =>
              Alert.alert('Options', '', [
                { text: 'Edit listing', onPress: () => {} },
                { text: 'Duplicate listing', onPress: () => {} },
                { text: 'Archive', style: 'destructive', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' },
              ])
            } accessibilityLabel="More options" />
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
            <Ionicons name="eye-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.statPillVal}>{listing.views}</Text>
            <Text style={styles.statPillLabel}>VIEWS</Text>
          </View>
          <View style={[styles.statPill, styles.statPillMiddle]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.statPillVal}>{listing.leads}</Text>
            <Text style={styles.statPillLabel}>LEADS</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="pricetag-outline" size={18} color={Colors.accent} />
            <Text style={[styles.statPillVal, { color: Colors.accent }]}>{listing.offers}</Text>
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
              <Ionicons name="pencil-outline" size={14} color={Colors.iconMuted} style={{ marginLeft: 8 }} />
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
                offersStatus === 'Accepting' && { color: Colors.accent },
                offersStatus === 'Not accepting' && { color: Colors.midBlue_6b7280 },
              ]}>
                {offersStatus}
              </Text>
              <Ionicons name="pencil-outline" size={14} color={Colors.iconMuted} style={{ marginLeft: 8 }} />
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
              <Ionicons name="pencil-outline" size={14} color={Colors.iconMuted} style={{ marginLeft: 8 }} />
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
      <View style={[styles.detailFooterWrap, { paddingBottom: insets.bottom + 16 }]}>
        {/* Put on Auction — only ACTIVE listings can be converted; the
            destination screen (SellerAuctionsScreen) re-validates eligibility
            itself, so this is a convenience shortcut, not the only gate. */}
        {listing.status === 'LIVE' && (
          <TouchableOpacity
            style={styles.putOnAuctionBtn}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SellerAuctions', { preselectListingId: listing.id })}
          >
            <MaterialCommunityIcons name="gavel" size={16} color={Colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.putOnAuctionBtnText}>PUT ON AUCTION</Text>
          </TouchableOpacity>
        )}
        <View style={styles.detailFooter}>
        <TouchableOpacity
          style={[styles.boostBtn, boosting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleBoost}
          disabled={boosting}
        >
          {boosting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="rocket-launch-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.boostBtnText}>BOOST</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.markSoldBtn, listing.status === 'SOLD' && styles.markSoldBtnDim]}
          activeOpacity={0.85}
          onPress={listing.status !== 'SOLD' ? openMarkSold : undefined}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.markSoldBtnText}>
            {listing.status === 'SOLD' ? 'SOLD' : 'MARK SOLD'}
          </Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Featured boost checkout — hosted Stripe checkout in-app */}
      <StripeCheckoutModal
        url={boostCheckoutUrl}
        title="Featured Boost Checkout"
        onSuccess={handleBoostSuccess}
        onCancel={() => setBoostCheckoutUrl(null)}
        onClose={() => setBoostCheckoutUrl(null)}
      />
      {boostToast && (
        <View style={styles.boostToast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
          <Text style={styles.boostToastText}>{boostToast}</Text>
        </View>
      )}

      {/* Mark Sold — sale price confirmation */}
      <BottomSheet
        visible={markSoldVisible}
        onClose={() => setMarkSoldVisible(false)}
        title="Mark as Sold"
        avoidKeyboard
      >
        <View style={styles.markSoldModalBody}>
          <Text style={styles.markSoldModalHint}>Confirm the price this vehicle sold for.</Text>
          <Text style={styles.soldPriceLabel}>SALE PRICE</Text>
          <View style={styles.soldPriceInputWrap}>
            <Text style={styles.soldPriceCurrency}>£</Text>
            <TextInput
              style={styles.soldPriceInput}
              value={soldPriceInput}
              onChangeText={v => { setSoldPriceInput(v); setMarkSoldError(null); }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.iconMuted}
              autoFocus
            />
          </View>
          {markSoldError && <ErrorBanner message={markSoldError} />}
          <TouchableOpacity
            style={[styles.markSoldConfirmBtn, markSoldSubmitting && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleConfirmMarkSold}
            disabled={markSoldSubmitting}
          >
            {markSoldSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.markSoldConfirmBtnText}>Confirm Sold</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
};

// ─── Inventory row — hoisted + memoized so FlatList only re-renders the row
// whose own props changed (mobile-audit.md P3/P4). ──
const InventoryRow: React.FC<{
  listing: Listing;
  onPress: (id: string) => void;
  onPutOnAuction?: (id: string) => void;
  onOpenLinkedAuction?: (linkedId: string) => void;
}> = React.memo(({ listing, onPress, onPutOnAuction, onOpenLinkedAuction }) => {
  const s = STATUS_STYLE[listing.status];
  const hasLinkedAuction = !!listing.linkedListingId;
  const linkedAuctionLive = listing.linkedAuctionStatus === 'ACTIVE';
  const canPutOnAuction = listing.status === 'LIVE' && !hasLinkedAuction;
  return (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => onPress(listing.id)}
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
          <Ionicons name="eye-outline" size={13} color={Colors.iconMuted} />
          <Text style={styles.statNum}>{listing.views}</Text>
          <Ionicons name="mail-outline" size={13} color={Colors.iconMuted} style={{ marginLeft: 10 }} />
          <Text style={styles.statNum}>{listing.leads}</Text>
          {listing.offers > 0 && (
            <>
              <Ionicons name="heart-outline" size={13} color={Colors.accent} style={{ marginLeft: 10 }} />
              <Text style={styles.statOffers}>{listing.offers} offers</Text>
            </>
          )}
        </View>
        {hasLinkedAuction ? (
          <TouchableOpacity
            style={[styles.rowCrossListChip, linkedAuctionLive && styles.rowCrossListChipLive]}
            onPress={() => listing.linkedListingId && onOpenLinkedAuction?.(listing.linkedListingId)}
            activeOpacity={0.7}
          >
            <Ionicons name="gavel" size={10} color={linkedAuctionLive ? Colors.accentGreen : Colors.textMuted} />
            <Text style={[styles.rowCrossListChipText, linkedAuctionLive && { color: Colors.accentGreen }]}>
              {linkedAuctionLive ? 'Linked auction — LIVE' : `Linked auction${listing.linkedAuctionStatus ? ` · ${listing.linkedAuctionStatus}` : ''}`}
            </Text>
          </TouchableOpacity>
        ) : canPutOnAuction && onPutOnAuction ? (
          <TouchableOpacity
            style={styles.rowPutOnAuction}
            onPress={() => onPutOnAuction(listing.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="gavel" size={10} color={Colors.accent} />
            <Text style={styles.rowPutOnAuctionText}>Also list on auction</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={Colors.borderSubtle} accessibilityElementsHidden importantForAccessibility="no" />
    </TouchableOpacity>
  );
});

// ─── Inventory grid card — compact thumbnail-forward alternative to the row
// view, for dealers scanning many listings at once (mobile-ui-ux-audit.md §C9). ──
const InventoryGridCard: React.FC<{ listing: Listing; onPress: (id: string) => void }> = React.memo(({ listing, onPress }) => {
  const s = STATUS_STYLE[listing.status];
  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => onPress(listing.id)}
      activeOpacity={0.85}
    >
      <View style={styles.gridThumbWrap}>
        <Image
          source={{ uri: listing.images[0] }}
          style={styles.gridThumb}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={styles.statusBadgeText}>{s.label}</Text>
        </View>
      </View>
      <Text style={styles.gridTitle} numberOfLines={1}>{listing.title}</Text>
      <Text style={styles.gridPrice}>{listing.price}</Text>
      <View style={styles.listingStats}>
        <Ionicons name="eye-outline" size={12} color={Colors.iconMuted} />
        <Text style={styles.statNum}>{listing.views}</Text>
        <Ionicons name="mail-outline" size={12} color={Colors.iconMuted} style={{ marginLeft: 8 }} />
        <Text style={styles.statNum}>{listing.leads}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── MAIN INVENTORY SCREEN ───────────────────────────────────────────────────
export const DealerInventoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Persist the dealer's list/grid preference across sessions (SE8-style
  // affordance, mobile-ui-ux-audit.md §C9).
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY).then((saved) => {
      if (saved === 'grid' || saved === 'list') setViewMode(saved);
    });
  }, []);
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'grid' : 'list';
      AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  // Bulk import
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

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

  // Refetch on every focus (initial mount + return-from-child, e.g. after
  // editing a listing in SellCarFlow). Silent on returns so the whole screen
  // doesn't blank out with a skeleton every time.
  const isFirstInventoryFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (isFirstInventoryFocus.current) {
      fetchListings();
      isFirstInventoryFocus.current = false;
    } else {
      fetchListings(true); // background refresh via refreshing spinner path
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // Stable id-keyed handler so InventoryRow's React.memo isn't busted by a fresh
  // closure every render (mobile-audit.md P4) — identity only changes when
  // `listings` itself changes (fetch/refresh), not on filter-tab switches.
  // Hooks must stay unconditional, so this is declared before the early
  // return below (Rules of Hooks).
  const handleRowPress = useCallback((id: string) => {
    const l = listings.find((x) => x.id === id);
    if (l) setSelectedListing(l);
  }, [listings]);
  const handlePutOnAuction = useCallback((listingId: string) => {
    navigation?.navigate('SellerAuctions', { preselectListingId: listingId });
  }, [navigation]);
  const handleOpenLinkedAuction = useCallback((linkedId: string) => {
    navigation?.navigate('SellerAuctions', { preselectListingId: linkedId });
  }, [navigation]);
  const renderInventoryRow = useCallback(
    ({ item }: { item: Listing }) => (
      <InventoryRow
        listing={item}
        onPress={handleRowPress}
        onPutOnAuction={handlePutOnAuction}
        onOpenLinkedAuction={handleOpenLinkedAuction}
      />
    ),
    [handleRowPress, handlePutOnAuction, handleOpenLinkedAuction],
  );
  const renderInventoryGrid = useCallback(
    ({ item }: { item: Listing }) => <InventoryGridCard listing={item} onPress={handleRowPress} />,
    [handleRowPress],
  );

  if (selectedListing) {
    return (
      <ListingDetail
        listing={selectedListing}
        onBack={() => setSelectedListing(null)}
        navigation={navigation}
        onSold={() => {
          setSelectedListing(null);
          fetchListings();
        }}
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
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.listHeader, { paddingTop: insets.top + 14 }]}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <View style={styles.listHeaderCenter}>
          <Text style={styles.listHeaderSub}>DEALER · {listings.length} LISTINGS</Text>
          <Text style={styles.listHeaderTitle}>Inventory</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton
            style={styles.backBtn}
            icon={<Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={20} color={Colors.white} />}
            onPress={toggleViewMode}
            accessibilityLabel={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
          />
          <HamburgerButton />
        </View>
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
      {/* Sort picker used to be an alert with every option a no-op — removed
          rather than faking it (mobile-ui-ux-audit.md §C13). Label alone is
          still accurate: the list really is fetched newest-first. */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>SORTED: NEWEST</Text>
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
      <FlatList
        key={viewMode}
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContent : { paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchListings(true)} tintColor={Colors.accent} colors={[Colors.accent]} />}
        data={filtered}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        keyExtractor={(item) => item.id}
        renderItem={viewMode === 'grid' ? renderInventoryGrid : renderInventoryRow}
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <EmptyState
              icon="car-outline"
              title={activeFilter === 'All' ? 'No listings yet' : `No ${activeFilter.toLowerCase()} listings`}
              subtitle={activeFilter === 'All' ? 'Add your first vehicle to start selling.' : `Switch filters or add more listings.`}
            />
          </View>
        }
      />
      )}

      {/* ── Add listing CTA ──────────────────────────────────────────────── */}
      <View style={[styles.addListingWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.addListingBtn, { flex: 1, marginRight: 8 }]}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate('SellCarFlow')}
        >
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accent]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name="add" size={22} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.addListingText}>ADD LISTING</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkImportBtn}
          activeOpacity={0.85}
          onPress={() => setShowImportModal(true)}
        >
          <Ionicons name="link-outline" size={20} color={Colors.infoBlueLight} />
          <Text style={[styles.bulkImportText, { color: Colors.infoBlueLight }]}>IMPORT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkImportBtn}
          activeOpacity={0.85}
          onPress={() => setShowBulkImportModal(true)}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.warning} />
          <Text style={styles.bulkImportText}>CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onComplete={() => setShowBulkImportModal(false)}
      />

      {/* Import Listing Modal */}
      {showImportModal && (
        <ImportListingModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); /* fetchListings called by onClose */ }}
        />
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── Back / icon button ──────────────────────────────────────────────────
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
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
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  listHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size26,
    color: Colors.white,
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
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha07,
  },
  filterTabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterTabText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.iconMuted,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  filterTabCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.iconMuted,
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
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
  },
  // Listing cards
  listScroll: {
    flex: 1,
  },
  // Dealer inventory is a power-user surface (30+ listings), so it uses the
  // compact row density preset instead of buyer-card spacing (mobile-ui-ux-audit.md §C9).
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: RowDensity.compact.padding,
    minHeight: RowDensity.compact.rowHeight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha04,
  },
  listingThumbWrap: {
    width: 56,
    height: 40,
    borderRadius: RowDensity.compact.borderRadius,
    overflow: 'hidden',
    marginRight: RowDensity.compact.gap,
    position: 'relative',
    backgroundColor: Colors.whiteAlpha04,
  },
  listingThumb: {
    width: 56,
    height: 40,
    borderRadius: RowDensity.compact.borderRadius,
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
    fontSize: FontSize.size8,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.rowLabel,
    color: Colors.white,
    marginBottom: 2,
  },
  listingPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  listingPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.rowLabel,
    color: Colors.white,
  },
  listingDays: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.rowMeta,
    color: Colors.iconMuted,
  },
  listingStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNum: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    marginLeft: 4,
  },
  statOffers: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accent,
    marginLeft: 4,
  },
  rowCrossListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.whiteAlpha04,
  },
  rowCrossListChipLive: {
    borderColor: Colors.accentGreen + '55',
    backgroundColor: Colors.accentGreen + '15',
  },
  rowCrossListChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.3,
    color: Colors.textMuted,
  },
  rowPutOnAuction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
    backgroundColor: Colors.accentAlpha10,
  },
  rowPutOnAuctionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.3,
    color: Colors.accent,
  },
  // Grid view — compact thumbnail-forward alternative to the row view
  // (mobile-ui-ux-audit.md §C9).
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    marginBottom: RowDensity.compact.gap * 2,
  },
  gridThumbWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RowDensity.compact.borderRadius,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.whiteAlpha04,
    marginBottom: 6,
  },
  gridThumb: {
    width: '100%',
    height: '100%',
  },
  gridTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.rowLabel,
    color: Colors.white,
    marginBottom: 2,
  },
  gridPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.rowLabel,
    color: Colors.white,
    marginBottom: 4,
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
    borderTopColor: Colors.whiteAlpha05,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulkImportBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.warningAlpha12,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bulkImportText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.warning,
    letterSpacing: 0.8,
  },

  // ── Bulk import modal ──────────────────────────────────────────────────
  bulkBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bulkSheet: {
    backgroundColor: Colors.bgSecondaryAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha07,
    padding: 24,
    paddingBottom: 36,
  },
  bulkHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.whiteAlpha15,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bulkTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginBottom: 8,
  },
  bulkSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.lightBlue_a0a0b0,
    lineHeight: 18,
    marginBottom: 16,
  },
  bulkInput: {
    backgroundColor: Colors.deepBlue_1a1a22,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.white,
    minHeight: 120,
    marginBottom: 14,
  },
  bulkSupportedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  bulkSupportedLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1,
  },
  bulkPlatformChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha25,
  },
  bulkPlatformText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.warning,
  },
  bulkCountHint: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.success,
    marginBottom: 12,
  },
  bulkSubmitBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkSubmitText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1.2,
  },
  bulkSuccess: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bulkSuccessIcon: {
    marginBottom: 16,
  },
  bulkSuccessTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size22,
    color: Colors.white,
    marginBottom: 8,
  },
  bulkSuccessSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.lightBlue_a0a0b0,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  bulkDoneBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  bulkDoneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1.2,
  },
  addListingBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  addListingText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
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
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.6,
  },
  detailTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.lg,
    color: Colors.white,
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
    borderColor: Colors.accent,
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
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.white,
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
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
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
    fontSize: FontSize.size22,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  statPillLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.2,
  },

  // Detail rows
  detailCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
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
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRowValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha05,
  },

  // Footer CTAs
  detailFooterWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    backgroundColor: 'rgba(10,10,12,0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha05,
  },
  detailFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  putOnAuctionBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  putOnAuctionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  boostBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.deepBlue_1c1c22,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },
  markSoldBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  markSoldBtnDim: {
    backgroundColor: Colors.darkGrey,
    shadowOpacity: 0,
    elevation: 0,
  },
  markSoldBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 1,
  },

  // ── Boost success toast ──
  boostToast: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  boostToastText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },

  // ── Mark Sold modal ──
  markSoldModalBody: {
    gap: 10,
  },
  markSoldModalHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  soldPriceLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1,
  },
  soldPriceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  soldPriceCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginRight: 4,
  },
  soldPriceInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  markSoldConfirmBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  markSoldConfirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
