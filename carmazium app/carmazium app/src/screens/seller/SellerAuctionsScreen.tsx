import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import * as ImagePicker from 'expo-image-picker';
import { useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { useAuthStore } from '../../store/authStore';
import { haptics } from '../../lib/haptics';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import {FontFamily, FontSize } from '../../constants/typography';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { alsoListRetail } from '../../lib/listingsApi';
import { createPaymentSheet } from '../../lib/paymentsApi';
import { submitHandoverProof } from '../../lib/auctionApi';
import { useStripe } from '@stripe/stripe-react-native';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
// ─────────────────────────── Types ───────────────────────────

type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
type TabFilter = 'ALL' | 'LIVE' | 'SCHEDULED' | 'ENDED';

interface AuctionItem {
  id: string;           // auction id
  listingId: string;
  status: AuctionStatus;
  startTime: string;
  endTime: string;
  reservePrice: number;
  startingBid: number;
  minIncrement: number;
  winnerId?: string | null;
  winningBidAmount?: number | null;
  handoverProofUrl?: string | null;
  handoverSubmittedAt?: string | null;
  sellerBonusReleased?: boolean;
  stripePayoutError?: string | null;
  // Already returned by GET /auctions/my/list (confirmed in auctions.service.ts's
  // findMyAuctions) — just not read by this screen before.
  winner?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  customTags?: string[] | null;
  sellerSelfRating?: number | null;
  listing: {
    id: string;
    title?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    price?: number | null;
    images?: string[];
    viewCount?: number;
    sellerId?: string | null;
    _count?: { bids?: number };
    bids?: { amount: number }[];
  };
}

interface EligibleListing {
  id: string;
  title?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  price?: number | null;
  images?: string[];
  type?: string;
  status?: string;
}

// ─────────────────────────── Status Config ───────────────────────────

const STATUS_CFG: Record<AuctionStatus, { borderColor: string; chipBg: string; chipText: string; label: string }> = {
  SCHEDULED: { borderColor: Colors.infoBlue, chipBg: Colors.infoBlueAlpha15,  chipText: Colors.infoBlueLight, label: 'SCHEDULED' },
  ACTIVE:    { borderColor: Colors.success, chipBg: Colors.successAlpha15,   chipText: Colors.success, label: 'LIVE' },
  ENDED:     { borderColor: Colors.whiteAlpha15, chipBg: Colors.whiteAlpha06, chipText: Colors.textSecondary, label: 'ENDED' },
  CANCELLED: { borderColor: Colors.whiteAlpha08, chipBg: Colors.whiteAlpha04, chipText: Colors.textMuted, label: 'CANCELLED' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerAuctionsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const userId = useAuthStore((state) => state.user?.id) ?? 'anon';
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  // Dealers reach this screen from a specific listing's "Put on Auction"
  // action (DealerInventoryScreen) rather than the "CREATE AUCTION" button
  // below — when a listing id is passed in, jump straight to step 2 once
  // it's confirmed still eligible, instead of making them re-pick it.
  const preselectListingId: string | undefined = route.params?.preselectListingId;
  const [preselectHandled, setPreselectHandled] = useState(false);

  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [navigating, setNavigating] = useState<string | null>(null);

  // Handover proof upload state — keyed by auctionId
  const [handoverUploading, setHandoverUploading] = useState<Record<string, boolean>>({});
  const [handoverUploaded, setHandoverUploaded] = useState<Record<string, boolean>>({});
  const [handoverError, setHandoverError] = useState<Record<string, string | null>>({});

  // Inline edit form state for SCHEDULED auctions
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReserve, setEditReserve] = useState('');
  const [editStartingBid, setEditStartingBid] = useState('');
  const [editMinIncrement, setEditMinIncrement] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Also List for Sale modal
  const [alsoRetailAuction, setAlsoRetailAuction] = useState<AuctionItem | null>(null);
  const [retailPrice, setRetailPrice] = useState('');
  const [retailTier, setRetailTier] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('BASIC');
  const [retailSubmitting, setRetailSubmitting] = useState(false);
  const [retailError, setRetailError] = useState<string | null>(null);

  // Close Bids (early-close an ACTIVE auction)
  const [closingId, setClosingId] = useState<string | null>(null);

  // Digest modal — seller-authored custom tags + self-rating on their own
  // auction (PATCH /auctions/:id/digest, live on the backend). Editable any
  // time before the auction ends, so reachable from both the ACTIVE and
  // SCHEDULED "Manage Auction" action sheets.
  const [digestAuction, setDigestAuction] = useState<AuctionItem | null>(null);
  const [digestTags, setDigestTags] = useState<string[]>([]);
  const [digestTagInput, setDigestTagInput] = useState('');
  const [digestRating, setDigestRating] = useState<number | null>(null);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  // Auction Results modal (ENDED auctions)
  const [resultsAuction, setResultsAuction] = useState<AuctionItem | null>(null);
  const [connectingChat, setConnectingChat] = useState(false);

  // Create auction modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [eligibleListings, setEligibleListings] = useState<EligibleListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<EligibleListing | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() + 5 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [newReservePrice, setNewReservePrice] = useState('');
  const [newStartingBid, setNewStartingBid] = useState('');
  const [newMinIncrement, setNewMinIncrement] = useState('100');
  const [newBuyItNowPrice, setNewBuyItNowPrice] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Fetch auctions from the auction endpoint (gives us auction-level statuses) ──
  const fetchAuctions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!refreshing) setLoading(true);
    try {
      const res = await apiClient<{ success: boolean; data: { data?: AuctionItem[]; } | AuctionItem[] }>(
        '/auctions/my/list?page=1&limit=50'
      );
      // Endpoint may return { data: AuctionItem[] } or { data: { data: AuctionItem[] } } (paginated)
      let items: AuctionItem[] = [];
      if (res.success) {
        const inner = (res as any).data;
        if (Array.isArray(inner)) {
          items = inner;
        } else if (Array.isArray(inner?.data)) {
          items = inner.data;
        }
      }
      setAuctions(items);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  // ── Tab counts ──
  const counts: Record<TabFilter, number> = {
    ALL:       auctions.length,
    LIVE:      auctions.filter(a => a.status === 'ACTIVE').length,
    SCHEDULED: auctions.filter(a => a.status === 'SCHEDULED').length,
    ENDED:     auctions.filter(a => a.status === 'ENDED' || a.status === 'CANCELLED').length,
  };

  const displayed = (() => {
    switch (activeTab) {
      case 'LIVE':      return auctions.filter(a => a.status === 'ACTIVE');
      case 'SCHEDULED': return auctions.filter(a => a.status === 'SCHEDULED');
      case 'ENDED':     return auctions.filter(a => a.status === 'ENDED' || a.status === 'CANCELLED');
      default:          return auctions;
    }
  })();

  // ── Tap handler — navigate to live room or vehicle detail ──
  const handleTap = async (item: AuctionItem) => {
    if (editingId === item.id) return; // ignore tap when edit form is open
    setNavigating(item.id);
    try {
      const listing = await getListingById(item.listing.id);
      if (!listing) { Alert.alert('Not available', 'Could not load listing.'); return; }
      if (item.status === 'ACTIVE') {
        navigation?.navigate('LiveAuctionDetailed', { listing });
      } else {
        navigation?.navigate('VehicleDetail', { listing });
      }
    } catch {
      Alert.alert('Error', 'Could not load listing details.');
    } finally {
      setNavigating(null);
    }
  };

  // ── Handover proof upload ──
  async function handleHandoverUpload(auctionId: string) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: false,
      quality: 1.0,
    });
    if (result.canceled) return;
    setHandoverUploading(prev => ({ ...prev, [auctionId]: true }));
    setHandoverError(prev => ({ ...prev, [auctionId]: null }));
    try {
      const jpegUri = await convertAndCompress(result.assets[0].uri);
      const proofUrl = await uploadToStorage(
        jpegUri, 'handover', `${userId}/${auctionId}-${Date.now()}.jpg`, 'image/jpeg',
      );
      await submitHandoverProof(auctionId, proofUrl);
      haptics.success();
      setHandoverUploaded(prev => ({ ...prev, [auctionId]: true }));
    } catch (err: any) {
      setHandoverError(prev => ({ ...prev, [auctionId]: err.message ?? 'Upload failed' }));
    } finally {
      setHandoverUploading(prev => ({ ...prev, [auctionId]: false }));
    }
  }

  // ── Close Bids — ends an ACTIVE auction immediately, matching web's
  // handleClose (POST /auctions/:id/close). A winner is still determined if
  // the reserve was met by the time of closing. ──
  async function handleCloseBids(item: AuctionItem) {
    setClosingId(item.id);
    try {
      await apiClient(`/auctions/${item.id}/close`, { method: 'POST' });
      haptics.success();
      await fetchAuctions(true);
      Alert.alert('Auction Closed', 'Bidding has ended — a winner was determined if the reserve was met.');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to close auction.');
    } finally {
      setClosingId(null);
    }
  }

  async function handleConnectWithWinner(item: AuctionItem) {
    const winnerId = item.winnerId ?? item.winner?.id;
    if (!winnerId) return;
    setConnectingChat(true);
    try {
      const res = await apiClient<{ success: boolean; data: { id: string } }>(
        '/chat/rooms',
        { method: 'POST', body: JSON.stringify({ participantId: winnerId, listingId: item.listing.id }) },
      );
      if (res?.success && res.data?.id) {
        setResultsAuction(null);
        navigation?.navigate('ChatScreen', { threadId: res.data.id });
      }
    } catch (err: any) {
      Alert.alert('Could not open chat', err?.message ?? 'Please try again.');
    } finally {
      setConnectingChat(false);
    }
  }

  // ── Auction overflow menu (SCHEDULED + ACTIVE) ──
  function openDigestModal(item: AuctionItem) {
    setDigestTags(item.customTags ?? []);
    setDigestTagInput('');
    setDigestRating(item.sellerSelfRating ?? null);
    setDigestError(null);
    setDigestAuction(item);
  }

  function handleAuctionMenu(item: AuctionItem) {
    if (item.status === 'ACTIVE') {
      Alert.alert(
        'Auction Options',
        item.listing.title ?? 'Live Auction',
        [
          {
            text: 'Also List for Sale',
            onPress: () => {
              setRetailPrice('');
              setRetailTier('BASIC');
              setRetailError(null);
              setAlsoRetailAuction(item);
            },
          },
          {
            text: 'Set Digest',
            onPress: () => openDigestModal(item),
          },
          {
            text: 'Close Bids',
            style: 'destructive',
            onPress: () => Alert.alert(
              'Close Bids',
              'Close this auction now? Bidding will end immediately and a winner will be determined if the reserve has been met. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Close Bids', style: 'destructive', onPress: () => handleCloseBids(item) },
              ],
            ),
          },
          { text: 'Dismiss', style: 'cancel' },
        ],
      );
      return;
    }
    // SCHEDULED
    Alert.alert(
      'Manage Auction',
      item.listing.title ?? 'Scheduled Auction',
      [
        {
          text: 'Edit Auction',
          onPress: () => openEditForm(item),
        },
        {
          text: 'Set Digest',
          onPress: () => openDigestModal(item),
        },
        {
          text: 'Cancel Auction',
          style: 'destructive',
          onPress: () => confirmCancelAuction(item),
        },
        { text: 'Dismiss', style: 'cancel' },
      ],
    );
  }

  // ── Digest handler ──
  async function handleDigestSubmit() {
    if (!digestAuction) return;
    setDigestSaving(true);
    setDigestError(null);
    try {
      const res = await apiClient<{ success: boolean; data: { customTags: string[]; sellerSelfRating: number | null } }>(
        `/auctions/${digestAuction.id}/digest`,
        { method: 'PATCH', body: JSON.stringify({ customTags: digestTags, sellerSelfRating: digestRating }) },
      );
      haptics.success();
      setAuctions(prev =>
        prev.map(a =>
          a.id === digestAuction.id
            ? { ...a, customTags: res?.data?.customTags ?? digestTags, sellerSelfRating: res?.data?.sellerSelfRating ?? digestRating }
            : a,
        ),
      );
      setDigestAuction(null);
    } catch (err: any) {
      setDigestError(err?.message ?? 'Could not save digest. Please try again.');
    } finally {
      setDigestSaving(false);
    }
  }

  function addDigestTag() {
    const tag = digestTagInput.trim();
    if (!tag || digestTags.length >= 10 || digestTags.includes(tag)) { setDigestTagInput(''); return; }
    setDigestTags(prev => [...prev, tag]);
    setDigestTagInput('');
  }

  // ── Also List for Sale handler ──
  async function handleAlsoRetailSubmit() {
    if (!alsoRetailAuction) return;
    const price = parseFloat(retailPrice.replace(/[^0-9.]/g, ''));
    if (isNaN(price) || price <= 0) { setRetailError('Enter a valid asking price.'); return; }

    setRetailSubmitting(true);
    setRetailError(null);
    try {
      const res = await alsoListRetail(alsoRetailAuction.listingId, price, retailTier);

      // Trigger Stripe payment for the listing fee
      try {
        const sheet = await createPaymentSheet({
          listingId: res.linkedListingId,
          amount: retailTier === 'BASIC' ? 1 : retailTier === 'STANDARD' ? 10 : 25,
          type: 'LISTING_FEE',
          currency: 'gbp',
          badgeTier: retailTier,
        });
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Carmazium',
          customerId: sheet.customerId,
          customerEphemeralKeySecret: sheet.ephemeralKey,
          paymentIntentClientSecret: sheet.clientSecret,
          allowsDelayedPaymentMethods: false,
          appearance: {
            colors: {
              primary: Colors.accent,
              background: Colors.bgSecondaryAlt,
              componentBackground: Colors.deepBlue_18181f,
              componentBorder: Colors.whiteAlpha08,
              primaryText: Colors.white,
              secondaryText: Colors.textSecondary,
              componentText: Colors.white,
              placeholderText: Colors.iconMuted,
              icon: Colors.textSecondary,
              error: Colors.accent,
            },
          },
        });
        if (initError) throw new Error(initError.message);
        const { error: presentError } = await presentPaymentSheet();
        if (presentError && presentError.code !== 'Canceled') throw new Error(presentError.message);
      } catch (payErr: any) {
        // Payment failed / cancelled — listing still created as draft, non-fatal
        Alert.alert('Note', `Classified listing created as draft (payment not completed): ${payErr?.message ?? ''}`);
      }

      haptics.success();
      setAlsoRetailAuction(null);
      Alert.alert('Classified Listing Created!', 'The vehicle can now be found and bought without bidding, while the auction continues.');
    } catch (err: any) {
      setRetailError(err?.message ?? 'Could not create listing. Please try again.');
    } finally {
      setRetailSubmitting(false);
    }
  }

  function openEditForm(item: AuctionItem) {
    setEditingId(item.id);
    setEditReserve(String(item.reservePrice));
    setEditStartingBid(String(item.startingBid));
    setEditMinIncrement(String(item.minIncrement));
    setEditError(null);
  }

  function closeEditForm() {
    setEditingId(null);
    setEditReserve('');
    setEditStartingBid('');
    setEditMinIncrement('');
    setEditError(null);
  }

  function confirmCancelAuction(item: AuctionItem) {
    Alert.alert(
      'Cancel Auction',
      'Cancel this auction? Bidders will be notified.',
      [
        { text: 'Keep Auction', style: 'cancel' },
        {
          text: 'Cancel Auction',
          style: 'destructive',
          onPress: () => cancelAuction(item),
        },
      ],
    );
  }

  async function cancelAuction(item: AuctionItem) {
    try {
      await apiClient(`/auctions/${item.id}/cancel`, { method: 'PATCH' });
      haptics.medium();
      // Remove from local list immediately
      setAuctions(prev => prev.filter(a => a.id !== item.id));
    } catch (err: any) {
      Alert.alert('Failed', err?.message ?? 'Could not cancel auction. Please try again.');
    }
  }

  async function saveAuctionEdit(item: AuctionItem) {
    const reserve = parseFloat(editReserve.replace(/[^0-9.]/g, ''));
    const starting = parseFloat(editStartingBid.replace(/[^0-9.]/g, ''));
    const increment = parseFloat(editMinIncrement.replace(/[^0-9.]/g, ''));

    if (isNaN(reserve) || reserve <= 0) {
      setEditError('Enter a valid reserve price.');
      return;
    }
    if (isNaN(starting) || starting <= 0) {
      setEditError('Enter a valid starting bid.');
      return;
    }
    if (isNaN(increment) || increment <= 0) {
      setEditError('Enter a valid minimum increment.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await apiClient(`/auctions/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reservePrice: reserve, startingBid: starting, minIncrement: increment }),
      });
      haptics.success();
      // Update local state
      setAuctions(prev =>
        prev.map(a =>
          a.id === item.id
            ? { ...a, reservePrice: reserve, startingBid: starting, minIncrement: increment }
            : a,
        ),
      );
      closeEditForm();
    } catch (err: any) {
      setEditError(err?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Create auction modal ──

  function resetCreateModal() {
    setCreateStep(1);
    setSelectedListing(null);
    setEligibleListings([]);
    setStartDate(new Date(Date.now() + 5 * 60 * 1000));
    setShowDatePicker(false);
    setPickerMode('date');
    setNewReservePrice('');
    setNewStartingBid('');
    setNewMinIncrement('100');
    setNewBuyItNowPrice('');
    setCreateError(null);
  }

  async function openCreateModal(presetListingId?: string) {
    resetCreateModal();
    setCreateModalVisible(true);
    setListingsLoading(true);
    try {
      const res = await apiClient<{ success: boolean; data: EligibleListing[]; pagination: any }>(
        '/listings/my?page=1&limit=100'
      );
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : [];
        // Only ACTIVE CLASSIFIED listings can be put in an auction
        const eligible = items.filter(l => l.type === 'CLASSIFIED' && l.status === 'ACTIVE');
        setEligibleListings(eligible);
        if (presetListingId) {
          const match = eligible.find(l => l.id === presetListingId);
          // If the listing is no longer eligible (already sold, converted,
          // etc.) fall back to the normal picker rather than failing silently.
          if (match) selectListing(match);
        }
      }
    } catch { /* show empty state */ }
    finally { setListingsLoading(false); }
  }

  // Auto-open the create flow once when arriving with a preselected listing.
  useEffect(() => {
    if (preselectListingId && !preselectHandled) {
      setPreselectHandled(true);
      openCreateModal(preselectListingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectListingId, preselectHandled]);

  function selectListing(listing: EligibleListing) {
    setSelectedListing(listing);
    setStartDate(new Date(Date.now() + 5 * 60 * 1000));
    setShowDatePicker(false);
    setPickerMode('date');
    setCreateError(null);
    setCreateStep(2);
  }

  const renderListingPickCard = useCallback(({ item }: { item: EligibleListing }) => {
    const thumb = item.images?.[0];
    const title = item.title || [item.year, item.make, item.model].filter(Boolean).join(' ') || 'Untitled';
    const price = item.price ? `£${Number(item.price).toLocaleString('en-GB')}` : '–';
    return (
      <TouchableOpacity
        style={styles.listingPickCard}
        onPress={() => selectListing(item)}
        activeOpacity={0.8}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.listingPickThumb} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.listingPickThumb, styles.listingPickThumbPlaceholder]}>
            <MaterialCommunityIcons name="car-outline" size={20} color={Colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.listingPickTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.listingPickPrice}>{price}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      </TouchableOpacity>
    );
  }, []);

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selected) {
      setStartDate(selected);
    }
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        // Android: after date selected, immediately show time picker
        setPickerMode('time');
        setShowDatePicker(true);
      } else {
        setShowDatePicker(false);
      }
    }
  }

  async function handleCreateSubmit() {
    if (!selectedListing) return;

    // Validate start time
    if (startDate.getTime() < Date.now() + 60_000) {
      setCreateError('Start time must be at least 1 minute in the future.');
      return;
    }

    const reserve = parseFloat(newReservePrice.replace(/[^0-9.]/g, ''));
    const starting = parseFloat(newStartingBid.replace(/[^0-9.]/g, ''));
    const increment = parseFloat(newMinIncrement.replace(/[^0-9.]/g, '')) || 100;
    const bin = newBuyItNowPrice.trim() ? parseFloat(newBuyItNowPrice.replace(/[^0-9.]/g, '')) : undefined;

    if (isNaN(reserve) || reserve <= 0) { setCreateError('Enter a valid reserve price.'); return; }
    if (isNaN(starting) || starting <= 0) { setCreateError('Enter a valid starting bid.'); return; }
    if (starting > reserve) { setCreateError('Starting bid must be ≤ reserve price.'); return; }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await apiClient('/auctions', {
        method: 'POST',
        body: JSON.stringify({
          listingId: selectedListing.id,
          startTime: startDate.toISOString(),
          reservePrice: reserve,
          startingBid: starting,
          minIncrement: increment,
          ...(bin != null && !isNaN(bin) && bin > 0 && { buyItNowPrice: bin }),
        }),
      });
      haptics.success();
      setCreateModalVisible(false);
      resetCreateModal();
      await fetchAuctions(true);
      Alert.alert('Auction Scheduled!', 'Your auction has been created and will start at the scheduled time.');
    } catch (err: any) {
      setCreateError(err?.message ?? 'Could not create auction. Please try again.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  // ── Render card ──
  // Wrapped in useCallback (though this row still closes over a lot of local
  // edit/upload state, so its identity churns whenever that state changes —
  // this is the "at minimum stable when unrelated state is untouched" case,
  // mobile-audit.md P3/P4).
  const renderCard = useCallback(({ item }: { item: AuctionItem }) => {
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;
    const thumb = item.listing.images?.[0];
    const listingTitle = item.listing.title
      || [item.listing.year, item.listing.make, item.listing.model].filter(Boolean).join(' ')
      || 'Untitled';
    const price = item.listing.price ? `£${Number(item.listing.price).toLocaleString('en-GB')}` : '–';
    const isLoadingNav = navigating === item.id;
    const isEditOpen = editingId === item.id;
    const isScheduled = item.status === 'SCHEDULED';
    const isEnded = item.status === 'ENDED' && item.winnerId;

    return (
      <View style={[styles.card, { borderLeftColor: cfg.borderColor }]}>
        {/* Main row — tappable to navigate */}
        <TouchableOpacity
          style={styles.cardRow}
          onPress={() => handleTap(item)}
          activeOpacity={0.8}
          disabled={!!navigating || isEditOpen}
        >
          <View style={styles.thumb}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <MaterialCommunityIcons name="gavel" size={22} color={Colors.textMuted} />
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{listingTitle}</Text>
            <Text style={styles.cardPrice}>{price}</Text>
            <Text style={styles.cardMeta}>
              {isScheduled ? `Starts ${fmtDate(item.startTime)}` : `Ends ${fmtDate(item.endTime)}`}
            </Text>
          </View>

          <View style={styles.cardRight}>
            <View style={[styles.statusChip, { backgroundColor: cfg.chipBg }]}>
              <Text style={[styles.statusChipText, { color: cfg.chipText }]}>{cfg.label}</Text>
            </View>
            {isLoadingNav ? (
              <ActivityIndicator size="small" color={Colors.textMuted} style={{ width: 28, height: 28 }} />
            ) : (isScheduled || item.status === 'ACTIVE') ? (
              // Three-dots menu for SCHEDULED (edit/cancel) and ACTIVE (also-list-retail/close-bids)
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => handleAuctionMenu(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : item.status === 'ENDED' ? (
              // Results — winner/no-winner summary, matches web's Results button
              <TouchableOpacity
                style={styles.resultsBtn}
                onPress={() => setResultsAuction(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="bar-chart-outline" size={13} color={Colors.accent} style={{ marginRight: 4 }} />
                <Text style={styles.resultsBtnText}>Results</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            )}
          </View>
        </TouchableOpacity>

        {/* Reserve / bid info row for SCHEDULED */}
        {isScheduled && (
          <View style={styles.auctionInfoRow}>
            <View style={styles.auctionInfoCell}>
              <Text style={styles.auctionInfoLabel}>RESERVE</Text>
              <Text style={styles.auctionInfoValue}>£{Number(item.reservePrice).toLocaleString('en-GB')}</Text>
            </View>
            <View style={styles.auctionInfoCell}>
              <Text style={styles.auctionInfoLabel}>STARTING BID</Text>
              <Text style={styles.auctionInfoValue}>£{Number(item.startingBid).toLocaleString('en-GB')}</Text>
            </View>
            <View style={styles.auctionInfoCell}>
              <Text style={styles.auctionInfoLabel}>INCREMENT</Text>
              <Text style={styles.auctionInfoValue}>£{Number(item.minIncrement).toLocaleString('en-GB')}</Text>
            </View>
          </View>
        )}

        {/* Inline edit form — expands when editingId matches */}
        {isEditOpen && (
          <View style={styles.editExpand}>
            <Text style={styles.editExpandTitle}>Edit Auction Details</Text>

            {/* Reserve price */}
            <Text style={styles.editLabel}>RESERVE PRICE</Text>
            <View style={styles.editInputRow}>
              <Text style={styles.editCurrency}>£</Text>
              <TextInput
                style={styles.editInput}
                value={editReserve}
                onChangeText={v => { setEditReserve(v); setEditError(null); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Starting bid */}
            <Text style={styles.editLabel}>STARTING BID</Text>
            <View style={styles.editInputRow}>
              <Text style={styles.editCurrency}>£</Text>
              <TextInput
                style={styles.editInput}
                value={editStartingBid}
                onChangeText={v => { setEditStartingBid(v); setEditError(null); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Minimum increment */}
            <Text style={styles.editLabel}>MIN. INCREMENT</Text>
            <View style={styles.editInputRow}>
              <Text style={styles.editCurrency}>£</Text>
              <TextInput
                style={styles.editInput}
                value={editMinIncrement}
                onChangeText={v => { setEditMinIncrement(v); setEditError(null); }}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {editError && <Text style={styles.editError}>{editError}</Text>}

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]}
                onPress={() => saveAuctionEdit(item)}
                disabled={editSaving}
                activeOpacity={0.8}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.editSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={closeEditForm}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={editSaving}
              >
                <Text style={styles.editDiscard}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Handover proof upload for ENDED auctions with a winner */}
        {isEnded ? (
          <View style={styles.handoverSection}>
            {item.stripePayoutError ? (
              <View style={styles.payoutFailPill}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.paleRed_fca5a5} />
                <Text style={styles.payoutFailText}>
                  Payout failed — {item.stripePayoutError}
                </Text>
              </View>
            ) : item.sellerBonusReleased ? (
              <View style={styles.payoutOkPill}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.lightGreen_4ade80} />
                <Text style={styles.handoverDone}>£100 payout released</Text>
              </View>
            ) : handoverUploaded[item.id] || item.handoverProofUrl ? (
              <View style={styles.payoutOkPill}>
                <Ionicons name="hourglass-outline" size={13} color={Colors.lightGreen_4ade80} />
                <Text style={styles.handoverDone}>Awaiting admin approval</Text>
              </View>
            ) : handoverError[item.id] ? (
              <ErrorBanner
                message={handoverError[item.id]!}
                onRetry={() => handleHandoverUpload(item.id)}
              />
            ) : (
              <TouchableOpacity
                style={styles.handoverButton}
                onPress={() => handleHandoverUpload(item.id)}
                disabled={handoverUploading[item.id]}
              >
                {handoverUploading[item.id] ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.handoverButtonText}>Upload Handover Proof</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  }, [
    navigating,
    editingId,
    handleTap,
    handleAuctionMenu,
    editReserve,
    editStartingBid,
    editMinIncrement,
    editError,
    editSaving,
    saveAuctionEdit,
    closeEditForm,
    handoverUploaded,
    handoverError,
    handoverUploading,
    handleHandoverUpload,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha04, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>My Auctions</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="add" size={22} color={Colors.white} />} onPress={() => navigation?.navigate('SellCarFlow')} accessibilityLabel="Add listing" />
          <HamburgerButton />
        </View>
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {(['ALL', 'LIVE', 'SCHEDULED', 'ENDED'] as TabFilter[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}{counts[tab] > 0 ? ` (${counts[tab]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
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
                <Skeleton w={72} h={20} r={10} />
                <Skeleton w={22} h={22} r={6} />
              </View>
            </View>
          ))}
        </View>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon="hammer-outline"
          title="No auctions yet"
          subtitle="Your live and scheduled auctions will appear here."
        />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAuctions(true)}
              tintColor={Colors.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListFooterComponent={
            <View>
              <TouchableOpacity
                style={styles.createAuctionBtn}
                onPress={() => openCreateModal()}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="gavel" size={18} color={Colors.white} />
                <Text style={styles.createAuctionText}>CREATE AUCTION</Text>
              </TouchableOpacity>
              <View style={{ height: 110 }} />
            </View>
          }
        />
      )}
      {/* ── Also List for Sale Modal ── */}
      <BottomSheet
        visible={alsoRetailAuction !== null}
        onClose={() => setAlsoRetailAuction(null)}
        title="Also List for Sale"
        avoidKeyboard
      >
        {alsoRetailAuction && (
          <Text style={styles.retailModalSub} numberOfLines={1}>
            {alsoRetailAuction.listing.title || [alsoRetailAuction.listing.year, alsoRetailAuction.listing.make, alsoRetailAuction.listing.model].filter(Boolean).join(' ')} · auction continues simultaneously
          </Text>
        )}

        {/* Price */}
        <Text style={[styles.retailFieldLabel, { marginTop: 18 }]}>ASKING PRICE (£) *</Text>
        <View style={styles.retailPriceRow}>
          <Text style={styles.retailCurrency}>£</Text>
          <TextInput
            style={styles.retailInput}
            value={retailPrice}
            onChangeText={v => { setRetailPrice(v); setRetailError(null); }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
        </View>

        {/* Plan selection */}
        <Text style={[styles.retailFieldLabel, { marginTop: 18 }]}>LISTING PLAN</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {([
            { tier: 'BASIC' as const, label: 'Basic', price: 1, accent: Colors.white },
            { tier: 'STANDARD' as const, label: 'Standard', price: 10, accent: Colors.infoBlue },
            { tier: 'PREMIUM' as const, label: 'Premium', price: 25, accent: Colors.warning },
          ]).map(plan => (
            <TouchableOpacity
              key={plan.tier}
              style={[styles.retailPlanCard, retailTier === plan.tier && { borderColor: plan.accent, backgroundColor: `${plan.accent}10` }]}
              onPress={() => setRetailTier(plan.tier)}
              activeOpacity={0.8}
            >
              <View style={[styles.retailPlanRadio, retailTier === plan.tier && { backgroundColor: plan.accent, borderColor: plan.accent }]}>
                {retailTier === plan.tier && <Ionicons name="checkmark" size={11} color={Colors.white} />}
              </View>
              <Text style={[styles.retailPlanLabel, { color: plan.accent }]}>{plan.label}</Text>
              <Text style={[styles.retailPlanPrice, { color: plan.accent }]}>£{plan.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {retailError && (
          <View style={styles.retailErrorBox}>
            <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
            <Text style={styles.retailErrorText}>{retailError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.retailSubmitBtn, retailSubmitting && { opacity: 0.6 }]}
          onPress={handleAlsoRetailSubmit}
          disabled={retailSubmitting}
          activeOpacity={0.85}
        >
          {retailSubmitting ? <ActivityIndicator color={Colors.white} size="small" /> : (
            <Text style={styles.retailSubmitText}>Create Listing</Text>
          )}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Digest Modal — custom tags + self-rating on your own auction
          listing, shown to buyers on the live auction screen (PATCH
          /auctions/:id/digest). ── */}
      <BottomSheet
        visible={digestAuction !== null}
        onClose={() => setDigestAuction(null)}
        title="Auction Digest"
        avoidKeyboard
      >
        {digestAuction && (
          <Text style={styles.retailModalSub} numberOfLines={1}>
            {digestAuction.listing.title || [digestAuction.listing.year, digestAuction.listing.make, digestAuction.listing.model].filter(Boolean).join(' ')}
          </Text>
        )}

        <Text style={[styles.retailFieldLabel, { marginTop: 18 }]}>CUSTOM TAGS ({digestTags.length}/10)</Text>
        <Text style={styles.fieldHintSmall}>Batch labels buyers see on your listing, e.g. "Track Day Ready", "One Owner".</Text>
        <View style={styles.digestTagRow}>
          <TextInput
            style={[styles.retailInput, { flex: 1 }]}
            value={digestTagInput}
            onChangeText={setDigestTagInput}
            onSubmitEditing={addDigestTag}
            placeholder="Add a tag..."
            placeholderTextColor={Colors.textMuted}
            maxLength={30}
            editable={digestTags.length < 10}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.digestAddTagBtn, digestTags.length >= 10 && { opacity: 0.4 }]}
            onPress={addDigestTag}
            disabled={digestTags.length >= 10}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        {digestTags.length > 0 && (
          <View style={styles.digestTagChipRow}>
            {digestTags.map(tag => (
              <View key={tag} style={styles.digestTagChip}>
                <Text style={styles.digestTagChipText} numberOfLines={1}>{tag}</Text>
                <TouchableOpacity onPress={() => setDigestTags(prev => prev.filter(t => t !== tag))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={12} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.retailFieldLabel, { marginTop: 18 }]}>SELF RATING</Text>
        <View style={styles.digestStarRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setDigestRating(prev => prev === n ? null : n)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons
                name={digestRating != null && n <= digestRating ? 'star' : 'star-outline'}
                size={28}
                color={digestRating != null && n <= digestRating ? Colors.warning : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {digestError && (
          <View style={styles.retailErrorBox}>
            <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
            <Text style={styles.retailErrorText}>{digestError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.retailSubmitBtn, { marginTop: 18 }, digestSaving && { opacity: 0.6 }]}
          onPress={handleDigestSubmit}
          disabled={digestSaving}
          activeOpacity={0.85}
        >
          {digestSaving ? <ActivityIndicator color={Colors.white} size="small" /> : (
            <Text style={styles.retailSubmitText}>Save Digest</Text>
          )}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Auction Results Modal — matches web's Results modal (winner banner,
          winning-bid/total-bids/reserve stats, timeline, and either "Connect
          with Winner" or "Re-auction" depending on outcome). ── */}
      <BottomSheet
        visible={resultsAuction != null}
        onClose={() => setResultsAuction(null)}
        title="Auction Results"
        maxHeightPercent={70}
      >
        {resultsAuction && (
          <View style={{ gap: 16 }}>
            <Text style={styles.resultsListingTitle} numberOfLines={1}>
              {resultsAuction.listing.title ?? 'Vehicle'}
            </Text>

            {/* Status banner */}
            {resultsAuction.winnerId ? (
              <View style={styles.resultsBanner}>
                <Ionicons name="trophy" size={20} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultsBannerTitle}>Auction Sold</Text>
                  <Text style={styles.resultsBannerSub}>
                    Winner: {[resultsAuction.winner?.firstName, resultsAuction.winner?.lastName].filter(Boolean).join(' ') || 'Anonymous Bidder'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.resultsBanner, { backgroundColor: Colors.whiteAlpha04, borderColor: Colors.whiteAlpha10 }]}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultsBannerTitle, { color: Colors.textSecondary }]}>No Winner</Text>
                  <Text style={styles.resultsBannerSub}>Reserve price not met or no bids placed</Text>
                </View>
              </View>
            )}

            {/* Stats grid */}
            <View style={styles.resultsStatsGrid}>
              <View style={styles.resultsStatCell}>
                <Text style={styles.resultsStatLabel}>WINNING BID</Text>
                <Text style={styles.resultsStatValue}>
                  {resultsAuction.winningBidAmount ? `£${Number(resultsAuction.winningBidAmount).toLocaleString('en-GB')}` : '—'}
                </Text>
              </View>
              <View style={styles.resultsStatCell}>
                <Text style={styles.resultsStatLabel}>TOTAL BIDS</Text>
                <Text style={styles.resultsStatValue}>
                  {resultsAuction.listing._count?.bids ?? resultsAuction.listing.bids?.length ?? 0}
                </Text>
              </View>
              <View style={styles.resultsStatCell}>
                <Text style={styles.resultsStatLabel}>RESERVE</Text>
                <Text style={styles.resultsStatValue}>
                  £{Number(resultsAuction.reservePrice).toLocaleString('en-GB')}
                </Text>
              </View>
            </View>

            {/* Timeline */}
            <View style={styles.resultsTimeline}>
              <View style={styles.resultsTimelineRow}>
                <Text style={styles.resultsTimelineLabel}>Started</Text>
                <Text style={styles.resultsTimelineValue}>{fmtDate(resultsAuction.startTime)}</Text>
              </View>
              <View style={styles.resultsTimelineRow}>
                <Text style={styles.resultsTimelineLabel}>Ended</Text>
                <Text style={styles.resultsTimelineValue}>{fmtDate(resultsAuction.endTime)}</Text>
              </View>
              <View style={styles.resultsTimelineRow}>
                <Text style={styles.resultsTimelineLabel}>Starting Bid</Text>
                <Text style={styles.resultsTimelineValue}>£{Number(resultsAuction.startingBid).toLocaleString('en-GB')}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.resultsViewBtn}
                activeOpacity={0.8}
                onPress={() => { setResultsAuction(null); handleTap(resultsAuction); }}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.resultsViewBtnText}>View Auction</Text>
              </TouchableOpacity>
              {resultsAuction.winnerId ? (
                <TouchableOpacity
                  style={[styles.resultsPrimaryBtn, connectingChat && { opacity: 0.6 }]}
                  activeOpacity={0.8}
                  onPress={() => handleConnectWithWinner(resultsAuction)}
                  disabled={connectingChat}
                >
                  {connectingChat ? <ActivityIndicator size="small" color={Colors.white} /> : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                      <Text style={styles.resultsPrimaryBtnText}>Connect with Winner</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.resultsPrimaryBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    const relistId = resultsAuction.listing.id;
                    setResultsAuction(null);
                    openCreateModal(relistId);
                  }}
                >
                  <MaterialCommunityIcons name="gavel" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.resultsPrimaryBtnText}>Re-auction</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </BottomSheet>

      {/* ── Create Auction Modal (BottomSheet — shell provided by shared component,
          no `title` prop since this modal needs its own two-icon header with a
          conditional back-chevron + step indicator, not the sheet's simple
          single-row title) ── */}
      <BottomSheet
        visible={createModalVisible}
        onClose={() => { setCreateModalVisible(false); resetCreateModal(); }}
        avoidKeyboard
        maxHeightPercent={95}
      >
        <View style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            {createStep === 2 ? (
              <IconButton style={styles.modalBackBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => { setCreateStep(1); setCreateError(null); }} accessibilityLabel="Go back" />
            ) : (
              <View style={styles.modalBackBtn} />
            )}
            <Text style={styles.modalTitle}>
              {createStep === 1 ? 'Select a Listing' : 'Auction Settings'}
            </Text>
            <IconButton style={styles.modalCloseBtn} icon={<Ionicons name="close" size={20} color={Colors.white} />} onPress={() => { setCreateModalVisible(false); resetCreateModal(); }} accessibilityLabel="Close" />
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, createStep >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, createStep >= 2 && styles.stepDotActive]} />
          </View>

          {/* ── Step 1: Pick a listing ── */}
          {createStep === 1 && (
            <View style={{ flex: 1 }}>
              <Text style={styles.modalSubheading}>
                Choose an active classified listing to put up for auction.
              </Text>
              {listingsLoading ? (
                <View style={styles.modalCenter}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                </View>
              ) : eligibleListings.length === 0 ? (
                <View style={styles.modalCenter}>
                  <Ionicons name="car-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.modalEmptyTitle}>No eligible listings</Text>
                  <Text style={styles.modalEmptyText}>
                    Only active classified listings can be converted to auctions.
                    Publish a listing first, then return here to schedule an auction.
                  </Text>
                </View>
              ) : (
                <FlatList
                  style={{ flex: 1 }}
                  data={eligibleListings}
                  keyExtractor={l => l.id}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 10 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={renderListingPickCard}
                />
              )}
            </View>
          )}

          {/* ── Step 2: Auction settings ── */}
          {createStep === 2 && selectedListing && (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 }}
            >
              {/* Selected listing summary */}
              <View style={styles.selectedListingChip}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.selectedListingText} numberOfLines={1}>
                  {selectedListing.title || [selectedListing.year, selectedListing.make, selectedListing.model].filter(Boolean).join(' ')}
                </Text>
              </View>

              {/* START TIME */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>START TIME</Text>
                <Text style={styles.formHint}>Minimum: 5 minutes from now · Auction runs for exactly 24 hours</Text>

                {/* Tappable date/time display — opens picker on Android; iOS shows inline */}
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.infoBlueLight} />
                  <Text style={styles.datePickerBtnText}>
                    {startDate.toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                </TouchableOpacity>

                {/* iOS: always show picker inline; Android: show as dialog when showDatePicker */}
                {(Platform.OS === 'ios' || showDatePicker) && (
                  <DateTimePicker
                    value={startDate}
                    mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date(Date.now() + 60_000)}
                    themeVariant="dark"
                    style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
                  />
                )}
              </View>

              {/* RESERVE PRICE */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>RESERVE PRICE (£) *</Text>
                <Text style={styles.formHint}>Minimum amount required for the sale to complete</Text>
                <View style={styles.formInputRow}>
                  <Text style={styles.formCurrency}>£</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newReservePrice}
                    onChangeText={v => { setNewReservePrice(v); setCreateError(null); }}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* STARTING BID */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>STARTING BID (£) *</Text>
                <Text style={styles.formHint}>First bid must be at least this amount · Must be ≤ reserve</Text>
                <View style={styles.formInputRow}>
                  <Text style={styles.formCurrency}>£</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newStartingBid}
                    onChangeText={v => { setNewStartingBid(v); setCreateError(null); }}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* MIN INCREMENT */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>MIN BID INCREMENT (£)</Text>
                <Text style={styles.formHint}>Each subsequent bid must raise the price by at least this</Text>
                <View style={styles.formInputRow}>
                  <Text style={styles.formCurrency}>£</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newMinIncrement}
                    onChangeText={v => { setNewMinIncrement(v); setCreateError(null); }}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* BUY IT NOW (optional) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>BUY IT NOW PRICE (£)</Text>
                <Text style={styles.formHint}>
                  Buyers can purchase immediately at this price before the reserve is met. Leave blank to disable.
                </Text>
                <View style={styles.formInputRow}>
                  <Text style={styles.formCurrency}>£</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBuyItNowPrice}
                    onChangeText={v => { setNewBuyItNowPrice(v); setCreateError(null); }}
                    keyboardType="number-pad"
                    placeholder="Optional"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Duration note */}
              <View style={styles.durationNote}>
                <Ionicons name="time-outline" size={13} color={Colors.infoBlueLight} />
                <Text style={styles.durationNoteText}>
                  Auctions always run for exactly 24 hours. Anti-snipe: any bid in the final 3 minutes extends the auction by 3 minutes.
                </Text>
              </View>

              {/* Error */}
              {createError && (
                <View style={styles.createErrorBox}>
                  <Ionicons name="alert-circle-outline" size={13} color={Colors.error} />
                  <Text style={styles.createErrorText}>{createError}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.createSubmitBtn, createSubmitting && { opacity: 0.6 }]}
                onPress={handleCreateSubmit}
                disabled={createSubmitting}
                activeOpacity={0.85}
              >
                {createSubmitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="gavel" size={16} color={Colors.white} />
                    <Text style={styles.createSubmitBtnText}>Schedule Auction</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.white,
  },
  list: {
    paddingHorizontal: 20,
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
    borderLeftWidth: 3,
    borderColor: Colors.whiteAlpha06,
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

  // ── Card ──
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: Colors.whiteAlpha06,
    padding: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
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
  resultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  resultsBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.accent,
    letterSpacing: 0.3,
  },

  // ── Auction info row (SCHEDULED) ──
  auctionInfoRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha06,
    gap: 0,
  },
  auctionInfoCell: {
    flex: 1,
    alignItems: 'center',
  },
  auctionInfoLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  auctionInfoValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.infoBlueLight,
  },

  // ── Inline edit form (SCHEDULED) ──
  editExpand: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha08,
    gap: 6,
  },
  editExpandTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    marginBottom: 4,
  },
  editLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  editInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  editCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textMuted,
    marginRight: 4,
  },
  editInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  editError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  editSaveBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  editDiscard: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ── Auction Results Modal ──
  resultsListingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  resultsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  resultsBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  resultsBannerSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  resultsStatsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    paddingVertical: 12,
  },
  resultsStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  resultsStatLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  resultsStatValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  resultsTimeline: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 12,
    gap: 8,
  },
  resultsTimelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsTimelineLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  resultsTimelineValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  resultsViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  resultsViewBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  resultsPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  resultsPrimaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },

  // ── Handover section ──
  handoverSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha06,
  },
  handoverButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  handoverButtonText: {
    color: Colors.white,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
  },
  handoverDone: {
    color: Colors.lightGreen_4ade80,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  payoutOkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.24)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  payoutFailPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.errorAlpha10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  payoutFailText: {
    color: Colors.paleRed_fca5a5,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    flex: 1,
    lineHeight: 17,
  },

  // ── Create auction button ──
  createAuctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    marginTop: 20,
  },
  createAuctionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // ── Also List for Sale modal ──
  retailModalSub: { fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, marginTop: 2 },
  retailFieldLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  retailPriceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, paddingHorizontal: 12 },
  retailCurrency: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textMuted, marginRight: 4 },
  retailInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: 12 },
  retailPlanCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.whiteAlpha08, borderRadius: 12, padding: 12 },
  retailPlanRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.whiteAlpha20, alignItems: 'center', justifyContent: 'center' },
  retailPlanLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size14, flex: 1 },
  retailPlanPrice: { fontFamily: FontFamily.mono, fontSize: FontSize.base, flexShrink: 0 },
  retailErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: Colors.errorAlpha08, borderWidth: 1, borderColor: Colors.errorAlpha20, borderRadius: 10, padding: 10, marginTop: 12 },
  retailErrorText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.error, flex: 1, lineHeight: 17 },
  retailSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, backgroundColor: Colors.infoBlue, marginTop: 16, marginBottom: 4 },
  retailSubmitText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white, letterSpacing: 0.3 },

  // ── Digest modal ──
  fieldHintSmall: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 8, lineHeight: 15 },
  digestTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  digestAddTagBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.infoBlue, alignItems: 'center', justifyContent: 'center' },
  digestTagChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  digestTagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 180 },
  digestTagChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.textPrimary },
  digestStarRow: { flexDirection: 'row', alignItems: 'center' },

  // ── Create Auction Modal (shell now provided by shared <BottomSheet>) ──
  modalContainer: {
    flex: 1,
    // No backgroundColor here — BottomSheet's own sheet background
    // (Colors.bgSecondary) already shows through.
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha06,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size17,
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 60,
    paddingVertical: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.whiteAlpha15,
  },
  stepDotActive: {
    backgroundColor: Colors.accent,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.whiteAlpha08,
    marginHorizontal: 8,
  },
  modalSubheading: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    paddingBottom: 8,
    lineHeight: 19,
  },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  modalEmptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  modalEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Listing pick cards (step 1)
  listingPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 12,
  },
  listingPickThumb: {
    width: 60,
    height: 48,
    borderRadius: 8,
    flexShrink: 0,
  },
  listingPickThumbPlaceholder: {
    backgroundColor: Colors.whiteAlpha04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingPickTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  listingPickPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginTop: 3,
  },

  // Selected listing chip (step 2 header)
  selectedListingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successAlpha08,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedListingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.success,
    flex: 1,
  },

  // Form fields (step 2)
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  formHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.borderMuted,
    lineHeight: 15,
    marginBottom: 2,
  },
  formInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  formCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textMuted,
    marginRight: 4,
  },
  formInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 11,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha30,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerBtnText: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.infoBlueLight,
  },
  iosDatePicker: {
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  durationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Colors.infoBlueAlpha06,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    borderRadius: 10,
    padding: 10,
  },
  durationNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.paleBlue_93c5fd,
    flex: 1,
    lineHeight: 17,
  },
  createErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Colors.errorAlpha08,
    borderWidth: 1,
    borderColor: Colors.errorAlpha20,
    borderRadius: 10,
    padding: 10,
  },
  createErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.error,
    flex: 1,
    lineHeight: 17,
  },
  createSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  createSubmitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
