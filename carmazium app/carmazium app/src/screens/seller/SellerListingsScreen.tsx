import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheet } from '../../components/BottomSheet';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImportListingModal } from '../../components/ImportListingModal';
import { BulkImportModal } from '../../components/BulkImportModal';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';
import { alsoAuction } from '../../lib/listingsApi';
import { haptics } from '../../lib/haptics';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── types ────────────────────────────────

interface ApiListing {
  id: string;
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  status?: string;
  images?: string[];
  viewCount?: number;
  badgeTier?: string;
  description?: string;
  mileage?: number;
  linkedListingId?: string | null;
  linkedListing?: {
    id: string;
    type: string;
    auction?: { id: string; status: string; endTime: string } | null;
  } | null;
}

type TabKey = 'ALL' | 'ACTIVE' | 'DRAFT' | 'SOLD';

// ────────────────────────── constants ─────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; chipBg: string; chipText: string; chipBorder: string; leftBorder: string }> = {
  ACTIVE: {
    label: '• LIVE',
    chipBg: 'rgba(16,185,129,0.18)',
    chipText: Colors.lightGreen_34d399,
    chipBorder: 'rgba(16,185,129,0.35)',
    leftBorder: Colors.success,
  },
  DRAFT: {
    label: 'DRAFT',
    chipBg: 'rgba(245,158,11,0.18)',
    chipText: Colors.warning,
    chipBorder: 'rgba(245,158,11,0.35)',
    leftBorder: Colors.warning,
  },
  SOLD: {
    label: 'SOLD',
    chipBg: Colors.whiteAlpha07,
    chipText: Colors.textSecondary,
    chipBorder: Colors.whiteAlpha10,
    leftBorder: Colors.whiteAlpha15,
  },
  WITHDRAWN: {
    label: 'WITHDRAWN',
    chipBg: Colors.whiteAlpha05,
    chipText: Colors.textMuted,
    chipBorder: Colors.whiteAlpha06,
    leftBorder: Colors.whiteAlpha08,
  },
};

const FALLBACK_STATUS = STATUS_CONFIG.DRAFT;

const TABS: TabKey[] = ['ALL', 'ACTIVE', 'DRAFT', 'SOLD'];

// ─────────────────────────── helpers ──────────────────────────────

const getTitle = (l: ApiListing): string => {
  if (l.title) return l.title;
  return [l.year, l.make, l.model].filter(Boolean).join(' ') || 'Untitled';
};

const formatPrice = (price?: number): string =>
  price ? `£${price.toLocaleString('en-GB')}` : '–';

// ────────────────────── action sheet config ───────────────────────

interface ActionItem {
  key: string;
  icon: string;
  label: string;
  tone: string;
  toneBg: string;
  isDestructive?: boolean;
}

const getActionsForListing = (listing: ApiListing): ActionItem[] => {
  const s = (listing.status ?? 'DRAFT').toUpperCase();

  // Guard: can only create dual-channel auction if no linked auction is already SCHEDULED or ACTIVE
  const linkedAuctionStatus = listing.linkedListing?.auction?.status;
  const hasActiveLinkedAuction = linkedAuctionStatus === 'SCHEDULED' || linkedAuctionStatus === 'ACTIVE';

  if (s === 'ACTIVE') {
    const base: ActionItem[] = [
      { key: 'boost', icon: 'flash-outline', label: 'Boost listing', tone: Colors.warning, toneBg: Colors.warningAlpha14 },
      { key: 'edit', icon: 'pencil-outline', label: 'Edit listing', tone: Colors.infoBlue, toneBg: Colors.infoBlueAlpha14 },
    ];
    if (!hasActiveLinkedAuction) {
      base.push({ key: 'also_auction', icon: 'hammer-outline', label: 'Also Put in Auction', tone: Colors.lightOrange_f97316, toneBg: 'rgba(249,115,22,0.14)' });
    }
    base.push(
      { key: 'withdraw', icon: 'arrow-undo-outline', label: 'Withdraw', tone: Colors.textSecondary, toneBg: Colors.whiteAlpha07 },
      { key: 'mark_sold', icon: 'checkmark-circle-outline', label: 'Mark as Sold', tone: Colors.success, toneBg: Colors.successAlpha14 },
      { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: Colors.error, toneBg: Colors.errorAlpha14, isDestructive: true },
    );
    return base;
  }

  // Shim to preserve old call sites that pass only status
  return getActionsForStatus(listing.status);
};

// Kept for DRAFT/SOLD paths (unchanged)
const getActionsForStatus = (status?: string): ActionItem[] => {
  const s = (status ?? 'DRAFT').toUpperCase();
  if (s === 'ACTIVE') {
    return [
      { key: 'boost', icon: 'flash-outline', label: 'Boost listing', tone: Colors.warning, toneBg: Colors.warningAlpha14 },
      { key: 'edit', icon: 'pencil-outline', label: 'Edit listing', tone: Colors.infoBlue, toneBg: Colors.infoBlueAlpha14 },
      { key: 'withdraw', icon: 'arrow-undo-outline', label: 'Withdraw', tone: Colors.textSecondary, toneBg: Colors.whiteAlpha07 },
      { key: 'mark_sold', icon: 'checkmark-circle-outline', label: 'Mark as Sold', tone: Colors.success, toneBg: Colors.successAlpha14 },
      { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: Colors.error, toneBg: Colors.errorAlpha14, isDestructive: true },
    ];
  }
  if (s === 'DRAFT') {
    return [
      { key: 'edit', icon: 'pencil-outline', label: 'Edit listing', tone: Colors.infoBlue, toneBg: Colors.infoBlueAlpha14 },
      { key: 'publish', icon: 'rocket-outline', label: 'Publish', tone: Colors.success, toneBg: Colors.successAlpha14 },
      { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: Colors.error, toneBg: Colors.errorAlpha14, isDestructive: true },
    ];
  }
  // SOLD / WITHDRAWN
  return [
    { key: 'relist', icon: 'refresh-outline', label: 'Relist', tone: Colors.success, toneBg: Colors.successAlpha14 },
    { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: Colors.error, toneBg: Colors.errorAlpha14, isDestructive: true },
  ];
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerListingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  // Dual-channel: "Also Put in Auction"
  const [alsoAuctionListing, setAlsoAuctionListing] = useState<ApiListing | null>(null);
  const [auctionStartDate, setAuctionStartDate] = useState<Date>(new Date(Date.now() + 5 * 60 * 1000));
  const [showAuctionDatePicker, setShowAuctionDatePicker] = useState(false);
  const [auctionPickerMode, setAuctionPickerMode] = useState<'date' | 'time'>('date');
  const [auctionReserve, setAuctionReserve] = useState('');
  const [auctionStartingBid, setAuctionStartingBid] = useState('');
  const [auctionIncrement, setAuctionIncrement] = useState('100');
  const [auctionBin, setAuctionBin] = useState('');
  const [auctionSubmitting, setAuctionSubmitting] = useState(false);
  const [auctionError, setAuctionError] = useState<string | null>(null);
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [actionMenuListing, setActionMenuListing] = useState<ApiListing | null>(null);
  const [sellPriceModal, setSellPriceModal] = useState<ApiListing | null>(null);
  const [soldPriceInput, setSoldPriceInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [boostCheckoutUrl, setBoostCheckoutUrl] = useState<string | null>(null);
  const [boostToast, setBoostToast] = useState<string | null>(null);

  // ─── data fetch ───────────────────────────────────────────────

  const fetchListings = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = activeTab !== 'ALL' ? `&status=${activeTab}` : '';
      const res = await apiClient<{ success: boolean; data: ApiListing[]; pagination: any }>(
        `/listings/my?page=1&limit=50${params}`
      );
      if (res.success) setListings(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ─── tab counts ───────────────────────────────────────────────

  const counts: Record<TabKey, number> = {
    ALL: listings.length,
    ACTIVE: listings.filter(l => l.status === 'ACTIVE').length,
    DRAFT: listings.filter(l => l.status === 'DRAFT').length,
    SOLD: listings.filter(l => l.status === 'SOLD').length,
  };

  // ─── action handlers ──────────────────────────────────────────

  const handleAction = async (key: string, listing: ApiListing) => {
    setActionMenuListing(null);

    if (key === 'edit') {
      navigation?.navigate('SellCarFlow', { listingId: listing.id });
      return;
    }

    if (key === 'mark_sold') {
      setSoldPriceInput(listing.price ? listing.price.toLocaleString('en-GB') : '');
      setSellPriceModal(listing);
      return;
    }

    if (key === 'delete') {
      Alert.alert(
        'Delete Listing',
        'Are you sure you want to delete this listing? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                await apiClient(`/listings/${listing.id}`, { method: 'DELETE' });
                setListings(prev => prev.filter(l => l.id !== listing.id));
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Could not delete listing.');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    if (key === 'withdraw') {
      setActionLoading(true);
      try {
        await apiClient(`/listings/${listing.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'WITHDRAWN' }),
        });
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, status: 'WITHDRAWN' } : l)
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not withdraw listing.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (key === 'relist') {
      // Matches web's handleRelist (dashboard/user/page.tsx) — a SOLD/WITHDRAWN
      // listing going back on sale is the same PATCH /status as publish.
      setActionLoading(true);
      try {
        await apiClient(`/listings/${listing.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE' }),
        });
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, status: 'ACTIVE' } : l)
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not relist. Please try again.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (key === 'publish') {
      setActionLoading(true);
      try {
        await apiClient(`/listings/${listing.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE' }),
        });
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, status: 'ACTIVE' } : l)
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not publish listing.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (key === 'also_auction') {
      setAuctionStartDate(new Date(Date.now() + 5 * 60 * 1000));
      setShowAuctionDatePicker(false);
      setAuctionPickerMode('date');
      setAuctionReserve('');
      setAuctionStartingBid('');
      setAuctionIncrement('100');
      setAuctionBin('');
      setAuctionError(null);
      setAlsoAuctionListing(listing);
      return;
    }

    if (key === 'boost') {
      setActionLoading(true);
      try {
        const res = await apiClient<{ success: boolean; data: { checkoutUrl: string } }>(
          `/featured-boost/${listing.id}`,
          { method: 'POST' }
        );
        const checkoutUrl = res?.data?.checkoutUrl;
        if (checkoutUrl) {
          // In-app WebView checkout — mirrors MyListingDashboardScreen so
          // the seller doesn't get bounced to the system browser.
          setBoostCheckoutUrl(checkoutUrl);
        } else {
          Alert.alert('Error', 'No checkout URL returned.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not initiate boost.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleBoostSuccess = useCallback(async () => {
    setBoostCheckoutUrl(null);
    haptics.success();
    setBoostToast('Boosted for 7 days');
    setTimeout(() => setBoostToast(null), 3000);
    // Refresh the listings so the isFeatured pill reflects the new state
    // once the Stripe webhook has fired.
    try {
      const refreshed = await apiClient<{ success: boolean; data: ApiListing[] }>(
        '/listings/my?page=1&limit=50',
      );
      if (refreshed?.success) setListings(refreshed.data || []);
    } catch { /* non-fatal */ }
  }, []);

  function onAuctionDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') { setShowAuctionDatePicker(false); return; }
    if (selected) setAuctionStartDate(selected);
    if (Platform.OS === 'android') {
      if (auctionPickerMode === 'date') {
        setAuctionPickerMode('time');
        setShowAuctionDatePicker(true);
      } else {
        setShowAuctionDatePicker(false);
      }
    }
  }

  const handleAlsoAuctionSubmit = async () => {
    if (!alsoAuctionListing) return;
    if (auctionStartDate.getTime() < Date.now() + 60_000) {
      setAuctionError('Start time must be at least 1 minute in the future.');
      return;
    }
    const reserve = parseFloat(auctionReserve.replace(/[^0-9.]/g, ''));
    const starting = parseFloat(auctionStartingBid.replace(/[^0-9.]/g, ''));
    const increment = parseFloat(auctionIncrement.replace(/[^0-9.]/g, '')) || 100;
    const bin = auctionBin.trim() ? parseFloat(auctionBin.replace(/[^0-9.]/g, '')) : undefined;

    if (isNaN(reserve) || reserve <= 0) { setAuctionError('Enter a valid reserve price.'); return; }
    if (isNaN(starting) || starting <= 0) { setAuctionError('Enter a valid starting bid.'); return; }
    if (starting > reserve) { setAuctionError('Starting bid must be ≤ reserve price.'); return; }

    setAuctionSubmitting(true);
    setAuctionError(null);
    try {
      await alsoAuction(alsoAuctionListing.id, {
        startTime: auctionStartDate.toISOString(),
        reservePrice: reserve,
        startingBid: starting,
        minIncrement: increment,
        ...(bin != null && !isNaN(bin) && bin > 0 && { buyItNowPrice: bin }),
      });
      haptics.success();
      setAlsoAuctionListing(null);
      fetchListings(true);
      Alert.alert('Auction Created!', 'Both listings are now live. Bidders can find the auction in the Live tab.');
    } catch (err: any) {
      setAuctionError(err?.message ?? 'Could not create auction. Please try again.');
    } finally {
      setAuctionSubmitting(false);
    }
  };

  const handleConfirmSold = async () => {
    if (!sellPriceModal) return;
    const raw = soldPriceInput.replace(/[^0-9.]/g, '');
    const soldPrice = parseFloat(raw);
    if (!soldPrice || isNaN(soldPrice)) {
      Alert.alert('Invalid price', 'Please enter a valid sold price.');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient(`/listings/${sellPriceModal.id}/sold`, {
        method: 'PATCH',
        body: JSON.stringify({ soldPrice }),
      });
      setListings(prev =>
        prev.map(l => l.id === sellPriceModal.id ? { ...l, status: 'SOLD' } : l)
      );
      setSellPriceModal(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark as sold.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── filtered list ────────────────────────────────────────────

  const displayed = activeTab === 'ALL'
    ? listings
    : listings.filter(l => (l.status ?? '').toUpperCase() === activeTab);

  // ─── render helpers ───────────────────────────────────────────

  const renderSkeletonRows = () => (
    <View style={styles.skeletonList}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={`sk-${i}`} style={styles.skeletonRow}>
          <Skeleton w={64} h={56} r={10} />
          <View style={styles.skeletonInfo}>
            <Skeleton w={140} h={14} r={6} />
            <Skeleton w={80} h={16} r={6} />
            <Skeleton w={60} h={12} r={5} />
          </View>
          <View style={styles.skeletonRight}>
            <Skeleton w={48} h={20} r={10} />
            <Skeleton w={28} h={28} r={8} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      icon="pricetags-outline"
      title="No listings yet"
      subtitle="List your first vehicle to start selling."
      ctaLabel="Sell a car"
      onCtaPress={() => navigation?.navigate('SellCarFlow')}
    />
  );

  const renderCard = useCallback(({ item }: { item: ApiListing }) => {
    const statusKey = (item.status ?? 'DRAFT').toUpperCase();
    const cfg = STATUS_CONFIG[statusKey] ?? FALLBACK_STATUS;
    const thumb = item.images?.[0];

    return (
      <View style={[styles.card, { borderLeftColor: cfg.leftBorder }]}>
        {/* Thumbnail */}
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="car-outline" size={24} color={Colors.textMuted} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{getTitle(item)}</Text>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
          <Text style={styles.cardViews}>Views: {item.viewCount ?? 0}</Text>
        </View>

        {/* Right */}
        <View style={styles.cardRight}>
          <View style={[styles.statusChip, { backgroundColor: cfg.chipBg, borderColor: cfg.chipBorder }]}>
            <Text style={[styles.statusChipText, { color: cfg.chipText }]}>{cfg.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.7}
            onPress={() => setActionMenuListing(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.dotWrap}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, []);

  // ─── action sheet ─────────────────────────────────────────────

  const renderActionSheet = () => {
    if (!actionMenuListing) return null;
    const actions = getActionsForListing(actionMenuListing);
    return (
      <BottomSheet
        visible
        onClose={() => setActionMenuListing(null)}
        title={getTitle(actionMenuListing)}
        maxHeightPercent={60}
      >
        {actions.map(action => (
          <TouchableOpacity
            key={action.key}
            style={styles.sheetRow}
            activeOpacity={0.75}
            onPress={() => handleAction(action.key, actionMenuListing)}
          >
            <View style={[styles.sheetIconWrap, { backgroundColor: action.toneBg }]}>
              <Ionicons name={action.icon} size={18} color={action.tone} />
            </View>
            <Text style={[styles.sheetRowLabel, action.isDestructive && { color: Colors.error }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.sheetRow, { borderBottomWidth: 0 }]}
          activeOpacity={0.75}
          onPress={() => setActionMenuListing(null)}
        >
          <Text style={[styles.sheetRowLabel, { color: Colors.error }]}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
    );
  };

  // ─── mark as sold modal ───────────────────────────────────────

  const renderSoldModal = () => {
    if (!sellPriceModal) return null;
    return (
      <BottomSheet
        visible
        onClose={() => setSellPriceModal(null)}
        title="Mark as Sold"
        avoidKeyboard
        maxHeightPercent={60}
      >
        <Text style={styles.soldSubtitle}>Enter the final sale price for this vehicle.</Text>

        <View style={styles.soldInputWrap}>
          <Text style={styles.soldCurrencySymbol}>£</Text>
          <TextInput
            style={styles.soldInput}
            value={soldPriceInput}
            onChangeText={setSoldPriceInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.accent}
          />
        </View>

        <TouchableOpacity
          style={[styles.soldConfirmBtn, actionLoading && { opacity: 0.6 }]}
          activeOpacity={0.8}
          onPress={handleConfirmSold}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.soldConfirmBtnText}>Confirm Sale</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.soldCancelBtn}
          activeOpacity={0.75}
          onPress={() => setSellPriceModal(null)}
        >
          <Text style={styles.soldCancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
    );
  };

  // ─── main render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.headerBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>My Listings</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton style={styles.headerBtn} icon={<Ionicons name="cloud-upload-outline" size={18} color={Colors.warning} />} onPress={() => setShowBulkImportModal(true)} accessibilityLabel="Bulk import" />
          <IconButton style={styles.headerBtn} icon={<Ionicons name="link-outline" size={18} color={Colors.infoBlueLight} />} onPress={() => setShowImportModal(true)} accessibilityLabel="Import from URL" />
          <IconButton style={styles.headerBtn} icon={<Ionicons name="add" size={20} color={Colors.white} />} onPress={() => navigation?.navigate('SellCarFlow')} accessibilityLabel="Add listing" />
        </View>
      </View>

      {/* ── Status tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsRow}
      >
        {TABS.map(tab => {
          const isActive = tab === activeTab;
          const count = counts[tab];
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              activeOpacity={0.75}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {loading ? (
        renderSkeletonRows()
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            displayed.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchListings(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Modals ── */}
      {renderActionSheet()}
      {renderSoldModal()}

      {/* Global action loading overlay */}
      {actionLoading && !sellPriceModal && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}

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
          <Ionicons name="flash" size={14} color={Colors.warning} />
          <Text style={styles.boostToastText}>{boostToast}</Text>
        </View>
      )}

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onComplete={() => { setShowBulkImportModal(false); fetchListings(); }}
      />

      {/* Import Listing Modal */}
      {showImportModal && (
        <ImportListingModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); fetchListings(); }}
        />
      )}

      {/* ── Also Put in Auction Modal ── */}
      <BottomSheet
        visible={alsoAuctionListing !== null}
        onClose={() => setAlsoAuctionListing(null)}
        title="Also Put in Auction"
        avoidKeyboard
      >
        <View>
              {alsoAuctionListing && (
                <Text style={styles.dualModalSub} numberOfLines={1}>
                  {getTitle(alsoAuctionListing)} · stays on sale simultaneously
                </Text>
              )}

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
                {/* Start time */}
                <Text style={styles.dualFieldLabel}>START TIME</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => { setAuctionPickerMode('date'); setShowAuctionDatePicker(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={14} color={Colors.infoBlueLight} />
                  <Text style={styles.datePickerBtnText}>
                    {auctionStartDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                </TouchableOpacity>
                {(Platform.OS === 'ios' || showAuctionDatePicker) && (
                  <DateTimePicker
                    value={auctionStartDate}
                    mode={Platform.OS === 'ios' ? 'datetime' : auctionPickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onAuctionDateChange}
                    minimumDate={new Date(Date.now() + 60_000)}
                    themeVariant="dark"
                    style={Platform.OS === 'ios' ? { marginVertical: 4 } : undefined}
                  />
                )}

                {/* Reserve */}
                <Text style={[styles.dualFieldLabel, { marginTop: 14 }]}>RESERVE PRICE (£) *</Text>
                <View style={styles.dualPriceRow}>
                  <Text style={styles.dualCurrency}>£</Text>
                  <TextInput style={styles.dualInput} value={auctionReserve} onChangeText={v => { setAuctionReserve(v); setAuctionError(null); }} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.textMuted} />
                </View>

                {/* Starting bid */}
                <Text style={[styles.dualFieldLabel, { marginTop: 14 }]}>STARTING BID (£) *</Text>
                <View style={styles.dualPriceRow}>
                  <Text style={styles.dualCurrency}>£</Text>
                  <TextInput style={styles.dualInput} value={auctionStartingBid} onChangeText={v => { setAuctionStartingBid(v); setAuctionError(null); }} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.textMuted} />
                </View>

                {/* Min increment */}
                <Text style={[styles.dualFieldLabel, { marginTop: 14 }]}>MIN INCREMENT (£)</Text>
                <View style={styles.dualPriceRow}>
                  <Text style={styles.dualCurrency}>£</Text>
                  <TextInput style={styles.dualInput} value={auctionIncrement} onChangeText={v => { setAuctionIncrement(v); setAuctionError(null); }} keyboardType="number-pad" placeholder="100" placeholderTextColor={Colors.textMuted} />
                </View>

                {/* BIN optional */}
                <Text style={[styles.dualFieldLabel, { marginTop: 14 }]}>BUY IT NOW PRICE (£, optional)</Text>
                <View style={styles.dualPriceRow}>
                  <Text style={styles.dualCurrency}>£</Text>
                  <TextInput style={styles.dualInput} value={auctionBin} onChangeText={v => { setAuctionBin(v); setAuctionError(null); }} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={Colors.textMuted} />
                </View>

                {auctionError && (
                  <View style={styles.dualErrorBox}>
                    <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
                    <Text style={styles.dualErrorText}>{auctionError}</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(249,115,22,0.06)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.18)', borderRadius: 10, padding: 10, marginTop: 14 }}>
                  <Ionicons name="time-outline" size={13} color={Colors.lightOrange_fb923c} />
                  <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.lightOrange_fb923c, flex: 1, lineHeight: 16 }}>Auction runs for 24 hours. Anti-snipe: bids in the final 3 minutes extend the auction by 3 minutes.</Text>
                </View>

                <TouchableOpacity
                  style={[styles.dualSubmitBtn, auctionSubmitting && { opacity: 0.6 }]}
                  onPress={handleAlsoAuctionSubmit}
                  disabled={auctionSubmitting}
                  activeOpacity={0.85}
                >
                  {auctionSubmitting ? <ActivityIndicator color={Colors.white} size="small" /> : (
                    <Text style={styles.dualSubmitText}>Create Auction</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
        </View>
      </BottomSheet>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha07,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  // ── tabs ──
  tabsRow: {
    marginBottom: 16,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  tabBadgeTextActive: {
    color: Colors.white,
  },

  // ── list ──
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  listContentEmpty: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderLeftWidth: 3,
    borderLeftColor: Colors.whiteAlpha10,
    padding: 12,
    gap: 12,
  },
  skeletonInfo: {
    flex: 1,
    gap: 6,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: 6,
  },

  // ── card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderLeftWidth: 3,
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.whiteAlpha04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  cardPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.white,
    marginTop: 3,
  },
  cardViews: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },


  // ── action sheet ──
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha04,
  },
  sheetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  // ── sold modal ──
  soldSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  soldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
  },
  soldCurrencySymbol: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size22,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  soldInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size22,
    color: Colors.white,
  },
  soldConfirmBtn: {
    marginHorizontal: 20,
    height: 52,
    borderRadius: 13,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  soldConfirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  soldCancelBtn: {
    marginHorizontal: 20,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldCancelBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.error,
  },

  // ── global action loading overlay ──
  actionLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── boost success toast ──
  boostToast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,17,22,0.95)',
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  boostToastText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // ── Dual-channel modal (Also Put in Auction) ──
  dualModalSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, marginTop: 2 },
  dualFieldLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  dualPriceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, paddingHorizontal: 12 },
  dualCurrency: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.textMuted, marginRight: 4 },
  dualInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textPrimary, paddingVertical: 11 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.infoBlueAlpha30, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  datePickerBtnText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.infoBlueLight },
  dualErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: Colors.errorAlpha08, borderWidth: 1, borderColor: Colors.errorAlpha20, borderRadius: 10, padding: 10, marginTop: 10 },
  dualErrorText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.error, flex: 1, lineHeight: 17 },
  dualSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: Colors.lightOrange_f97316, marginTop: 16 },
  dualSubmitText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, letterSpacing: 0.3 },
});
