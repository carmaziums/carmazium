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
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { RowDensity, Radius } from '../../constants/spacing';
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
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { fetchAllMyListings } from '../../lib/myListingsApi';
import { formatTransmission } from '../../lib/transmission';

const VIEW_MODE_STORAGE_KEY = 'czm_dealer_inventory_view_mode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────
type StatusTag = 'LIVE' | 'DRAFT' | 'REVIEW' | 'SALE_PENDING' | 'REJECTED' | 'SOLD' | 'OTHER';
type FilterTab = 'All' | 'Live' | 'Under Review' | 'Rejected' | 'Draft' | 'Sold' | 'Sale pending' | 'Other';

interface Listing {
  id: string;
  title: string;
  registration: string;
  make: string;
  mileage: number | null;
  transmission: string;
  rejectionReason: string | null;
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
  registration: String(l.vrm ?? l.registrationNumber ?? '').trim().toUpperCase(),
  make: String(l.make ?? '').trim(),
  mileage: l.mileage != null && Number.isFinite(Number(l.mileage)) ? Number(l.mileage) : null,
  transmission: formatTransmission(l.transmission),
  rejectionReason: l.rejectionReason ? String(l.rejectionReason) : null,
  price: l.price ? `£${Number(l.price).toLocaleString('en-GB')}` : '–',
  rawPrice: l.price ? Number(l.price) : 0,
  daysListed: l.createdAt ? Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000) : 0,
  views: l.viewCount ?? 0,
  // Were hardcoded 0 — GET /listings/my now includes a real _count on
  // offers/leads (backend previously only used the offers relation for
  // sort order without ever selecting it).
  leads: l._count?.leads ?? 0,
  offers: l._count?.offers ?? 0,
  // Never call an unapproved, rejected or provisional listing SOLD.
  status: (
    l.status === 'ACTIVE' ? 'LIVE'
      : l.status === 'DRAFT' ? 'DRAFT'
      : l.status === 'PENDING_REVIEW' ? 'REVIEW'
      : l.status === 'OFFER_ACCEPTED' ? 'SALE_PENDING'
      : l.status === 'REJECTED' ? 'REJECTED'
      : l.status === 'SOLD' ? 'SOLD'
      : 'OTHER'
  ) as StatusTag,
  linkedListingId: l.linkedListingId ?? null,
  linkedAuctionStatus: l.linkedListing?.auction?.status ?? null,
  images: l.images || [],
  offersStatus: (l._count?.offers ?? 0) > 0 ? `${l._count.offers} received` : 'No offers yet',
  visibility: l.status ?? '',
});

// ─── Status badge colors ─────────────────────────────────────────────────────
const STATUS_STYLE: Record<StatusTag, { bg: string; color: string; label: string }> = {
  LIVE:         { bg: Colors.success, color: Colors.white, label: 'Live' },
  DRAFT:        { bg: Colors.midBlue_6b7280, color: Colors.white, label: 'Draft' },
  REVIEW:       { bg: Colors.warning, color: Colors.white, label: 'Under Review' },
  SALE_PENDING: { bg: Colors.warning, color: Colors.white, label: 'SALE PENDING' },
  REJECTED:     { bg: Colors.error, color: Colors.white, label: 'Rejected' },
  SOLD:         { bg: Colors.infoBlue, color: Colors.white, label: 'Sold' },
  OTHER:        { bg: Colors.midBlue_6b7280, color: Colors.white, label: 'Not Live' },
};

// ─── LISTING DETAIL SUBSCREEN ────────────────────────────────────────────────
const ListingDetail: React.FC<{
  listing: Listing;
  onBack: () => void;
  navigation?: any;
  onSold: () => void;
  canManageInventory: boolean;
}> = ({ listing, onBack, navigation, onSold, canManageInventory }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useDealerInventoryPalette();
  const insets = useSafeAreaInsets();
  const [selectedImg, setSelectedImg] = useState(0);
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

  // Edit the actual listing in the existing, permission-checked wizard.
  // Remove the inline detail view before navigating, so returning from the
  // editor refreshes the inventory instead of showing stale figures.
  const handleEditListing = () => {
    if (!canManageInventory) return;
    onBack();
    navigation?.navigate('SellCarFlow', { listingId: listing.id });
  };

  const statusS = STATUS_STYLE[listing.status];

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <LinearGradient
        colors={[Colors.accentAlpha05, 'rgba(0,0,0,0)', palette.bgBody]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[themed.detailHeader, { paddingTop: insets.top + 14 }]}>
          <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={onBack} accessibilityLabel="Go back" />
          <View style={themed.detailHeaderCenter}>
            <View style={themed.listingLivePill}>
              <View style={[themed.liveDot, { backgroundColor: statusS.bg }]} />
              <Text style={themed.listingLiveLabel}>LISTING · {listing.status}</Text>
            </View>
            <Text style={themed.detailTitle} numberOfLines={1}>{listing.title}</Text>
          </View>
          <IconButton style={themed.backBtn} icon={<Ionicons name="ellipsis-horizontal" size={20} color={Colors.white} />} onPress={() =>
              Alert.alert('Options', '', [
                ...(canManageInventory ? [{ text: 'Edit listing', onPress: handleEditListing }] : []),
                { text: 'Cancel', style: 'cancel' },
              ])
            } accessibilityLabel="More options" />
        </View>

        {/* ── Image thumbnails ─────────────────────────────────────────────── */}
        <View style={themed.thumbRow}>
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
              <Image source={{ uri }} style={[themed.thumbImg, { width: thumbW }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              {i === 0 && (
                <View style={themed.heroBadge}>
                  <Text style={themed.heroBadgeText}>HERO</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stat pills ───────────────────────────────────────────────────── */}
        <View style={themed.statPillRow}>
          <View style={themed.statPill}>
            <Ionicons name="eye-outline" size={18} color={Colors.textSecondary} />
            <Text style={themed.statPillVal}>{listing.views}</Text>
            <Text style={themed.statPillLabel}>VIEWS</Text>
          </View>
          <View style={[themed.statPill, styles.statPillMiddle]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
            <Text style={themed.statPillVal}>{listing.leads}</Text>
            <Text style={themed.statPillLabel}>LEADS</Text>
          </View>
          <View style={themed.statPill}>
            <Ionicons name="pricetag-outline" size={18} color={Colors.accent} />
            <Text style={[themed.statPillVal, { color: Colors.accent }]}>{listing.offers}</Text>
            <Text style={themed.statPillLabel}>OFFERS</Text>
          </View>
        </View>

        {/* ── Detail rows ─────────────────────────────────────────────────── */}
        <View style={themed.detailCard}>
          {/* List price */}
          <View style={themed.detailRow}>
            <Text style={themed.detailRowLabel}>List price</Text>
            <TouchableOpacity
              style={themed.detailRowRight}
              onPress={handleEditListing}
              activeOpacity={0.7}
              disabled={!canManageInventory}
            >
              <Text style={themed.detailRowValue}>{listing.price}</Text>
              {canManageInventory && <Ionicons name="pencil-outline" size={14} color={Colors.iconMuted} style={{ marginLeft: 8 }} />}
            </TouchableOpacity>
          </View>
          <View style={themed.detailDivider} />

          {/* Offers */}
          <View style={themed.detailRow}>
            <Text style={themed.detailRowLabel}>Offers</Text>
            <View style={themed.detailRowRight}>
              <Text style={themed.detailRowValue}>{listing.offersStatus}</Text>
            </View>
          </View>
          <View style={themed.detailDivider} />

          {/* Visibility */}
          <View style={themed.detailRow}>
            <Text style={themed.detailRowLabel}>Listing status</Text>
            <View style={themed.detailRowRight}>
              <Text style={themed.detailRowValue}>{listing.visibility}</Text>
            </View>
          </View>
          <View style={themed.detailDivider} />

          {/* Days listed */}
          <View style={themed.detailRow}>
            <Text style={themed.detailRowLabel}>Days listed</Text>
            <Text style={themed.detailRowValue}>{listing.daysListed} days</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom CTAs ─────────────────────────────────────────────────────── */}
      <View style={[themed.detailFooterWrap, { paddingBottom: insets.bottom + 16 }]}>
        {/* Put on Auction — only ACTIVE listings can be converted; the
            destination screen (SellerAuctionsScreen) re-validates eligibility
            itself, so this is a convenience shortcut, not the only gate. */}
        {canManageInventory && listing.status === 'LIVE' && (
          <TouchableOpacity
            style={themed.putOnAuctionBtn}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('SellerAuctions', { preselectListingId: listing.id })}
          >
            <MaterialCommunityIcons name="gavel" size={16} color={Colors.white} style={{ marginRight: 6 }} />
            <Text style={themed.putOnAuctionBtnText}>PUT ON AUCTION</Text>
          </TouchableOpacity>
        )}
        {canManageInventory && (
        <View style={themed.detailFooter}>
        <TouchableOpacity
          style={[themed.boostBtn, boosting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleBoost}
          disabled={boosting}
        >
          {boosting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="rocket-launch-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={themed.boostBtnText}>BOOST</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[themed.markSoldBtn, listing.status !== 'LIVE' && styles.markSoldBtnDim]}
          activeOpacity={0.85}
          onPress={listing.status === 'LIVE' ? openMarkSold : undefined}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={themed.markSoldBtnText}>
            {listing.status === 'LIVE' ? 'MARK SOLD' : STATUS_STYLE[listing.status].label}
          </Text>
        </TouchableOpacity>
        </View>
        )}
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
        <View style={themed.boostToast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
          <Text style={themed.boostToastText}>{boostToast}</Text>
        </View>
      )}

      {/* Mark Sold — sale price confirmation */}
      <BottomSheet
        visible={markSoldVisible}
        onClose={() => setMarkSoldVisible(false)}
        title="Mark as Sold"
        avoidKeyboard
      >
        <View style={themed.markSoldModalBody}>
          <Text style={themed.markSoldModalHint}>Confirm the price this vehicle sold for.</Text>
          <Text style={themed.soldPriceLabel}>SALE PRICE</Text>
          <View style={themed.soldPriceInputWrap}>
            <Text style={themed.soldPriceCurrency}>£</Text>
            <TextInput
              style={themed.soldPriceInput}
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
            style={[themed.markSoldConfirmBtn, markSoldSubmitting && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleConfirmMarkSold}
            disabled={markSoldSubmitting}
          >
            {markSoldSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={themed.markSoldConfirmBtnText}>Confirm Sold</Text>
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
  canManageInventory: boolean;
}> = React.memo(({ listing, onPress, onPutOnAuction, onOpenLinkedAuction, canManageInventory }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useDealerInventoryPalette();
  const s = STATUS_STYLE[listing.status];
  const hasLinkedAuction = !!listing.linkedListingId;
  const linkedAuctionLive = listing.linkedAuctionStatus === 'ACTIVE';
  const canPutOnAuction = canManageInventory && listing.status === 'LIVE' && !hasLinkedAuction;
  return (
    <TouchableOpacity
      style={themed.websiteStockCard}
      onPress={() => onPress(listing.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${listing.title}, ${listing.registration || 'private registration'}, ${listing.transmission}, ${s.label}`}
      activeOpacity={0.85}
    >
      {/* Website inventory mobile showcase: real photo, title and vehicle facts. */}
      <View style={themed.stockShowcase}>
        <View style={themed.stockImageWrap}>
          {listing.images[0] ? (
            <Image source={{ uri: listing.images[0] }} style={themed.stockImage}
              contentFit="cover" transition={200} cachePolicy="memory-disk"
              accessibilityLabel={listing.title} />
          ) : (
            <Ionicons name="car-outline" size={23} color={Colors.textMuted} />
          )}
        </View>
        <View style={themed.stockIdentity}>
          <Text style={themed.stockTitle} numberOfLines={2}>{listing.title}</Text>
          <View style={themed.stockFacts}>
            <Text style={themed.stockRegistration}>{listing.registration || 'PRIVATE'}</Text>
            {!!listing.make && <Text style={themed.stockMake}>{listing.make.toUpperCase()}</Text>}
            {listing.mileage !== null && (
              <Text style={themed.stockFact}>{listing.mileage.toLocaleString('en-GB')} mi</Text>
            )}
            <Text style={themed.stockFact}>Transmission: {listing.transmission}</Text>
          </View>
        </View>
      </View>

      {/* Match website's mobile 2-column price/status/engagement/leads grid. */}
      <View style={themed.stockMetrics}>
        <View style={themed.stockMetricTile}>
          <Text style={themed.stockMetricLabel}>MARKET PRICE</Text>
          <Text style={themed.stockPrice}>{listing.price}</Text>
        </View>
        <View style={themed.stockMetricTile}>
          <Text style={themed.stockMetricLabel}>STATUS</Text>
          <View style={[themed.stockOutlinedStatus, { borderColor: s.bg }]}>
            <Text style={[themed.stockStatusText, { color: s.bg }]}>{s.label}</Text>
          </View>
          {!!listing.rejectionReason && listing.status === 'REJECTED' && (
            <Text style={themed.stockRejection} numberOfLines={3}>{listing.rejectionReason}</Text>
          )}
        </View>
        <View style={themed.stockMetricTile}>
          <Text style={themed.stockMetricLabel}>ENGAGEMENT</Text>
          <Text style={themed.stockMetricValue}>{listing.views.toLocaleString('en-GB')}</Text>
        </View>
        <View style={themed.stockMetricTile}>
          <Text style={themed.stockMetricLabel}>HOT LEADS</Text>
          <Text style={[themed.stockMetricValue, { color: Colors.accent }]}>
            {listing.leads.toLocaleString('en-GB')}
          </Text>
        </View>
      </View>

      {/* Existing linked-auction and dealer-only actions stay on the card. */}
      {hasLinkedAuction ? (
        <TouchableOpacity style={[themed.rowCrossListChip, linkedAuctionLive && styles.rowCrossListChipLive]}
          onPress={() => listing.linkedListingId && onOpenLinkedAuction?.(listing.linkedListingId)}
          accessibilityRole="button" accessibilityLabel="Open linked auction" activeOpacity={0.8}>
          <Ionicons name="hammer-outline" size={13} color={Colors.accent} />
          <Text style={themed.rowCrossListChipText}>
            {linkedAuctionLive ? 'Linked auction — Live' : 'Linked auction' +
              (listing.linkedAuctionStatus ? ` · ${listing.linkedAuctionStatus}` : '')}
          </Text>
        </TouchableOpacity>
      ) : canPutOnAuction && onPutOnAuction ? (
        <TouchableOpacity style={themed.rowPutOnAuction}
          onPress={() => onPutOnAuction(listing.id)}
          accessibilityRole="button" accessibilityLabel="Also list on auction" activeOpacity={0.8}>
          <Ionicons name="hammer-outline" size={13} color={Colors.accent} />
          <Text style={themed.rowPutOnAuctionText}>Also list on auction</Text>
        </TouchableOpacity>
      ) : null}
      <View style={themed.stockOpenRow}>
        <Text style={themed.stockOpenText}>View details and actions</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );});

// ─── Inventory grid card — compact thumbnail-forward alternative to the row
// view, for dealers scanning many listings at once (mobile-ui-ux-audit.md §C9). ──
const InventoryGridCard: React.FC<{ listing: Listing; onPress: (id: string) => void }> = React.memo(({ listing, onPress }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useDealerInventoryPalette();
  const s = STATUS_STYLE[listing.status];
  return (
    <TouchableOpacity style={themed.gridCard} onPress={() => onPress(listing.id)}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${listing.price}, ${listing.transmission}, ${s.label}`}
      activeOpacity={0.85}>
      <View style={themed.gridThumbWrap}>
        {listing.images[0] ? (
          <Image source={{ uri: listing.images[0] }} style={themed.gridThumb}
            contentFit="cover" transition={200} cachePolicy="memory-disk"
            accessibilityLabel={listing.title} />
        ) : <Ionicons name="car-outline" size={26} color={Colors.textMuted} />}
        <View style={[themed.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={themed.statusBadgeText}>{s.label}</Text>
        </View>
      </View>
      <Text style={themed.gridTitle} numberOfLines={2}>{listing.title}</Text>
      <Text style={themed.stockGridFact} numberOfLines={1}>{listing.registration || 'PRIVATE'}</Text>
      <Text style={themed.stockGridFact} numberOfLines={1}>{listing.transmission}</Text>
      {listing.mileage !== null && (
        <Text style={themed.stockGridFact}>{listing.mileage.toLocaleString('en-GB')} mi</Text>
      )}
      <Text style={themed.gridPrice}>{listing.price}</Text>
      <View style={themed.listingStats}>
        <Ionicons name="eye-outline" size={12} color={Colors.iconMuted} />
        <Text style={themed.statNum}>{listing.views}</Text>
        <Ionicons name="people-outline" size={12} color={Colors.iconMuted} style={{ marginLeft: 8 }} />
        <Text style={themed.statNum}>{listing.leads}</Text>
      </View>
    </TouchableOpacity>
  );});

// ─── MAIN INVENTORY SCREEN ───────────────────────────────────────────────────
export const DealerInventoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useDealerInventoryPalette();
  const insets = useSafeAreaInsets();
  const { hasPermission } = useDealerAccess(true);
  const canManageInventory = hasPermission('MANAGE_INVENTORY');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [showExtraStatuses, setShowExtraStatuses] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'price-high' | 'price-low'>('newest');

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
      // Include SOLD and every page so counts, search and filter tabs match
      // the dealership's full stock, not just the first 50 unsold cars.
      const ownedListings = await fetchAllMyListings<any>();
      setListings(ownedListings.map(mapApiListing));
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
        onPutOnAuction={canManageInventory ? handlePutOnAuction : undefined}
        onOpenLinkedAuction={canManageInventory ? handleOpenLinkedAuction : undefined}
        canManageInventory={canManageInventory}
      />
    ),
    [handleRowPress, handlePutOnAuction, handleOpenLinkedAuction, canManageInventory],
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
        canManageInventory={canManageInventory}
        onSold={() => {
          setSelectedListing(null);
          fetchListings();
        }}
      />
    );
  }

  // Website's six statuses first; retain other workflow states in More.
  const FILTERS: { label: FilterTab; value: StatusTag | null; count: number }[] = [
    { label: 'All', value: null, count: listings.length },
    { label: 'Live', value: 'LIVE', count: listings.filter(l => l.status === 'LIVE').length },
    { label: 'Under Review', value: 'REVIEW', count: listings.filter(l => l.status === 'REVIEW').length },
    { label: 'Rejected', value: 'REJECTED', count: listings.filter(l => l.status === 'REJECTED').length },
    { label: 'Draft', value: 'DRAFT', count: listings.filter(l => l.status === 'DRAFT').length },
    { label: 'Sold', value: 'SOLD', count: listings.filter(l => l.status === 'SOLD').length },
    { label: 'Sale pending', value: 'SALE_PENDING', count: listings.filter(l => l.status === 'SALE_PENDING').length },
    { label: 'Other', value: 'OTHER', count: listings.filter(l => l.status === 'OTHER').length },
  ];
  const chosenStatus = FILTERS.find(f => f.label === activeFilter)?.value;
  const q = inventoryQuery.trim().toLowerCase();
  const filtered = listings
    .filter(l => !chosenStatus || l.status === chosenStatus)
    .filter(l => !q || [l.title, l.registration, l.make, l.transmission, l.price, l.visibility].some(field => field.toLowerCase().includes(q)))
    .sort((a, b) => sortOrder === 'price-low'
      ? a.rawPrice - b.rawPrice
      : sortOrder === 'price-high' ? b.rawPrice - a.rawPrice
        : 0);

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', palette.bgBody]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />

      <WebsiteTopBar />
      {/* The same global web header stays visible while the stock-specific
          view picker and inventory count remain below it. */}
      <View style={[themed.listHeader, { paddingTop: 12 }]}>
        <View style={themed.listHeaderCenter}>
          <Text style={themed.listHeaderTitle}>Inventory</Text>
          <Text style={themed.listHeaderSub}>Manage live, draft and sold stock</Text>
        </View>
        <IconButton
          style={themed.backBtn}
          icon={<Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={20} color={Colors.white} />}
          onPress={toggleViewMode}
          accessibilityLabel={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        />
      </View>
      {/* Website places Add Vehicle and imports above filters, not as a
          floating footer that can overlap the dealer bottom navigation. */}
      {canManageInventory && (
        <View style={themed.stockHeaderActions}>
          <TouchableOpacity style={themed.stockAddAction} onPress={() => navigation?.navigate('SellCarFlow')}
            accessibilityRole="button" accessibilityLabel="Add Vehicle">
            <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
            <Text style={themed.stockAddActionText}>Add Vehicle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={themed.stockSecondaryAction} onPress={() => setShowImportModal(true)}
            accessibilityRole="button" accessibilityLabel="Import Listing">
            <Ionicons name="link-outline" size={16} color={Colors.textSecondary} />
            <Text style={themed.stockSecondaryActionText}>Import Listing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={themed.stockSecondaryAction} onPress={() => setShowBulkImportModal(true)}
            accessibilityRole="button" accessibilityLabel="Bulk Import">
            <Ionicons name="cloud-upload-outline" size={16} color={Colors.textSecondary} />
            <Text style={themed.stockSecondaryActionText}>Bulk Import</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search inventory without paging through unrelated vehicles. */}
      <View style={themed.inventorySearchWrap}>
        <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
        <TextInput
          value={inventoryQuery}
          onChangeText={setInventoryQuery}
          placeholder="Search by make, model, VRM..."
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search dealer inventory"
          style={themed.inventorySearchInput}
        />
        {!!inventoryQuery && (
          <TouchableOpacity onPress={() => setInventoryQuery('')} accessibilityRole="button" accessibilityLabel="Clear inventory search">
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={themed.filterScroll}
        style={themed.filterBar}
      >
        {FILTERS.filter((f, index) => index < 6 || showExtraStatuses || activeFilter === f.label).map((f) => (
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
        <TouchableOpacity style={themed.filterTab}
          onPress={() => {
            if (showExtraStatuses && (activeFilter === 'Sale pending' || activeFilter === 'Other')) setActiveFilter('All');
            setShowExtraStatuses(previous => !previous);
          }}
          accessibilityRole="button"
          accessibilityLabel={showExtraStatuses ? 'Hide additional statuses' : 'Show additional statuses'}
          accessibilityState={{ expanded: showExtraStatuses }}
        >
          <Text style={themed.filterTabText}>{showExtraStatuses ? 'Fewer' : 'More'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sort row ─────────────────────────────────────────────────────── */}
      <View style={themed.sortRow}>
        <Text style={themed.sortLabel}>{filtered.length} {filtered.length === 1 ? 'vehicle' : 'vehicles'} shown</Text>
        <TouchableOpacity
          style={themed.sortAction}
          accessibilityRole="button"
          accessibilityLabel="Change inventory sorting"
          onPress={() => setSortOrder(prev => prev === 'newest' ? 'price-high' : prev === 'price-high' ? 'price-low' : 'newest')}
        >
          <Ionicons name="swap-vertical-outline" size={17} color={Colors.accent} />
          <Text style={themed.sortActionText}>{sortOrder === 'newest' ? 'Newest' : sortOrder === 'price-high' ? 'Price: high to low' : 'Price: low to high'}</Text>
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
      <FlatList
        key={viewMode}
        style={themed.listScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContent : styles.stockListContent}
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
              title="No vehicles found"
              subtitle={inventoryQuery || activeFilter !== 'All'
                ? 'Try adjusting your search or filters.'
                : 'Add your first vehicle to start building your dealership inventory.'}
            />
          </View>
        }
      />
      )}

      {/* Bulk CSV Import Modal */}
      {canManageInventory && (
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onComplete={() => setShowBulkImportModal(false)}
      />
      )}

      {/* Import Listing Modal */}
      {canManageInventory && showImportModal && (
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

  // Website mobile PageHeader keeps the main listing CTA and imports in the
  // page header rather than a bottom fixed overlay.
  stockHeaderActions: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, marginBottom: 16, gap: 8,
  },
  stockAddAction: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.accent, borderRadius: 12,
    minHeight: 46, paddingHorizontal: 16,
  },
  stockAddActionText: {
    fontFamily: FontFamily.bold, fontSize: 12, color: Colors.white,
  },
  stockSecondaryAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard, borderRadius: 12,
    minHeight: 46, paddingHorizontal: 11,
  },
  stockSecondaryActionText: {
    fontFamily: FontFamily.bold, color: Colors.textSecondary, fontSize: 11,
  },
  stockListContent: {
    paddingTop: 4, paddingBottom: 92,
  },
  websiteStockCard: {
    marginHorizontal: 20, padding: 16, marginBottom: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1,
    borderColor: Colors.borderSubtle, borderRadius: 18,
  },
  stockShowcase: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stockImageWrap: {
    width: 80, height: 64, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgElevated, alignItems: 'center',
    justifyContent: 'center',
  },
  stockImage: { width: '100%', height: '100%' },
  stockIdentity: { flex: 1, minWidth: 0 },
  stockTitle: {
    fontFamily: FontFamily.extraBold, fontSize: 15, lineHeight: 21,
    color: Colors.textPrimary,
  },
  stockFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  stockRegistration: {
    color: Colors.textSecondary, backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: 4, overflow: 'hidden', paddingHorizontal: 5,
    paddingVertical: 2, fontSize: 11, fontFamily: FontFamily.bold,
  },
  stockMake: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 11 },
  stockFact: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 11 },
  stockMetrics: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16,
  },
  stockMetricTile: {
    width: '48%', flexGrow: 1, minWidth: 0, minHeight: 79,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgElevated, borderRadius: 12, padding: 12,
  },
  stockMetricLabel: {
    fontFamily: FontFamily.bold, color: Colors.textMuted,
    fontSize: 10, letterSpacing: 0.6,
  },
  stockPrice: {
    fontFamily: FontFamily.extraBold, fontSize: 20,
    color: Colors.textPrimary, marginTop: 6,
  },
  stockMetricValue: {
    fontFamily: FontFamily.extraBold, fontSize: 18,
    color: Colors.textPrimary, marginTop: 6,
  },
  stockOutlinedStatus: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4, marginTop: 6,
  },
  stockStatusText: { fontFamily: FontFamily.bold, fontSize: 11 },
  stockRejection: { fontFamily: FontFamily.medium, fontSize: 10,
    color: Colors.error, marginTop: 5 },
  stockOpenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: 13, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  stockOpenText: { color: Colors.textSecondary, fontFamily: FontFamily.bold, fontSize: 12 },
  stockGridFact: { color: Colors.textMuted, fontFamily: FontFamily.medium,
    fontSize: 11, marginBottom: 3 },
  // ── LIST VIEW ────────────────────────────────────────────────────────────
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  listHeaderCenter: {
    flex: 1,
    alignItems: 'flex-start',
  },
  listHeaderSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  listHeaderTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size26,
    color: Colors.white,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
  },

  inventorySearchWrap: { marginHorizontal: 20, marginBottom: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderHi, backgroundColor: Colors.bgSecondary },
  inventorySearchInput: { flex: 1, paddingVertical: 12, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },
  sortAction: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, minHeight: 40 },
  sortActionText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },
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
    borderRadius: Radius.card,
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
    paddingVertical: 12,
    minHeight: 94,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  listingThumbWrap: {
    width: 92,
    height: 68,
    borderRadius: RowDensity.compact.borderRadius,
    overflow: 'hidden',
    marginRight: RowDensity.compact.gap,
    position: 'relative',
    backgroundColor: Colors.whiteAlpha04,
  },
  listingThumb: {
    width: 92,
    height: 68,
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
    fontSize: FontSize.sm,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: 3,
  },
  inventoryReg: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 3 },
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
    paddingHorizontal: 20,
    paddingBottom: 92,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderColor: Colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 9,
    marginBottom: RowDensity.compact.gap * 2,
  },
  gridThumbWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.inline,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.inline,
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
    borderRadius: Radius.inline,
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

function useDealerInventoryPalette() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    websiteStockCard: [styles.websiteStockCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    stockTitle: [styles.stockTitle, { color: palette.textPrimary }],
    stockRegistration: [styles.stockRegistration, { color: palette.textMuted }],
    stockFact: [styles.stockFact, { color: palette.textSecondary }],
    stockMetricTile: [styles.stockMetricTile, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    stockMetricLabel: [styles.stockMetricLabel, { color: palette.textMuted }],
    stockPrice: [styles.stockPrice, { color: palette.textPrimary }],
    stockMetricValue: [styles.stockMetricValue, { color: palette.textPrimary }],
    stockOpenRow: [styles.stockOpenRow, { borderTopColor: palette.borderDefault }],
    stockOpenText: [styles.stockOpenText, { color: palette.textSecondary }],
    stockGridFact: [styles.stockGridFact, { color: palette.textMuted }],
    listHeaderTitle: [styles.listHeaderTitle, { color: palette.textPrimary }],
    listHeaderSub: [styles.listHeaderSub, { color: palette.textSecondary }],
    inventorySearchWrap: [styles.inventorySearchWrap, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    inventorySearchInput: [styles.inventorySearchInput, { color: palette.textPrimary }],
    sortAction: [styles.sortAction, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    sortActionText: [styles.sortActionText, { color: palette.textSecondary }],
    filterTab: [styles.filterTab, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    filterTabText: [styles.filterTabText, { color: palette.textSecondary }],
    sortLabel: [styles.sortLabel, { color: palette.textMuted }],
    listingCard: [styles.listingCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    listingTitle: [styles.listingTitle, { color: palette.textPrimary }],
    inventoryReg: [styles.inventoryReg, { color: palette.textMuted }],
    listingPrice: [styles.listingPrice, { color: palette.textPrimary }],
    listingDays: [styles.listingDays, { color: palette.textMuted }],
    statNum: [styles.statNum, { color: palette.textSecondary }],
    gridCard: [styles.gridCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    gridTitle: [styles.gridTitle, { color: palette.textPrimary }],
    gridPrice: [styles.gridPrice, { color: palette.textPrimary }],
    bulkSheet: [styles.bulkSheet, { backgroundColor: palette.bgDropdown, borderColor: palette.borderDefault }],
    bulkTitle: [styles.bulkTitle, { color: palette.textPrimary }],
    bulkSub: [styles.bulkSub, { color: palette.textSecondary }],
    bulkInput: [styles.bulkInput, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault, color: palette.textPrimary }],
    bulkSupportedLabel: [styles.bulkSupportedLabel, { color: palette.textMuted }],
    bulkPlatformChip: [styles.bulkPlatformChip, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    bulkPlatformText: [styles.bulkPlatformText, { color: palette.textSecondary }],
    bulkCountHint: [styles.bulkCountHint, { color: palette.textMuted }],
    detailTitle: [styles.detailTitle, { color: palette.textPrimary }],
    detailCard: [styles.detailCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    detailRow: [styles.detailRow, { borderBottomColor: palette.borderDefault }],
    detailRowLabel: [styles.detailRowLabel, { color: palette.textMuted }],
    detailRowValue: [styles.detailRowValue, { color: palette.textPrimary }],
    detailFooter: [styles.detailFooter, { backgroundColor: palette.bgBody, borderTopColor: palette.borderDefault }],
    soldPriceInputWrap: [styles.soldPriceInputWrap, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    soldPriceInput: [styles.soldPriceInput, { color: palette.textPrimary }],
  }), [palette]);
}
