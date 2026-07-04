import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { convertAndCompress, uploadToStorage } from '../../lib/storageHelper';
import { useAuthStore } from '../../store/authStore';
import { haptics } from '../../lib/haptics';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { alsoListRetail } from '../../lib/listingsApi';
import { createPaymentSheet } from '../../lib/paymentsApi';
import { submitHandoverProof } from '../../lib/auctionApi';
import { useStripe } from '@stripe/stripe-react-native';

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
  SCHEDULED: { borderColor: '#3B82F6', chipBg: 'rgba(59,130,246,0.15)',  chipText: '#60A5FA', label: 'SCHEDULED' },
  ACTIVE:    { borderColor: '#22C55E', chipBg: 'rgba(34,197,94,0.15)',   chipText: '#22C55E', label: 'LIVE' },
  ENDED:     { borderColor: 'rgba(255,255,255,0.15)', chipBg: 'rgba(255,255,255,0.06)', chipText: '#A0A0AB', label: 'ENDED' },
  CANCELLED: { borderColor: 'rgba(255,255,255,0.08)', chipBg: 'rgba(255,255,255,0.04)', chipText: '#5C5C6B', label: 'CANCELLED' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerAuctionsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.user?.id) ?? 'anon';
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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

  // ── Auction overflow menu (SCHEDULED + ACTIVE) ──
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
          text: 'Cancel Auction',
          style: 'destructive',
          onPress: () => confirmCancelAuction(item),
        },
        { text: 'Dismiss', style: 'cancel' },
      ],
    );
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
        });
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Carmazium',
          customerId: sheet.customerId,
          customerEphemeralKeySecret: sheet.ephemeralKey,
          paymentIntentClientSecret: sheet.clientSecret,
          allowsDelayedPaymentMethods: false,
          appearance: {
            colors: {
              primary: '#DC1F26',
              background: '#111116',
              componentBackground: '#18181f',
              componentBorder: 'rgba(255,255,255,0.08)',
              primaryText: '#FFFFFF',
              secondaryText: '#A0A0AB',
              componentText: '#FFFFFF',
              placeholderText: '#606070',
              icon: '#A0A0AB',
              error: '#DC1F26',
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

  async function openCreateModal() {
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
        setEligibleListings(items.filter(l => l.type === 'CLASSIFIED' && l.status === 'ACTIVE'));
      }
    } catch { /* show empty state */ }
    finally { setListingsLoading(false); }
  }

  function selectListing(listing: EligibleListing) {
    setSelectedListing(listing);
    setStartDate(new Date(Date.now() + 5 * 60 * 1000));
    setShowDatePicker(false);
    setPickerMode('date');
    setCreateError(null);
    setCreateStep(2);
  }

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
  const renderCard = ({ item }: { item: AuctionItem }) => {
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
              // Three-dots menu for SCHEDULED (edit/cancel) and ACTIVE (also-list-retail)
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => handleAuctionMenu(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
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
                <Ionicons name="alert-circle-outline" size={13} color="#FCA5A5" />
                <Text style={styles.payoutFailText}>
                  Payout failed — {item.stripePayoutError}
                </Text>
              </View>
            ) : item.sellerBonusReleased ? (
              <View style={styles.payoutOkPill}>
                <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                <Text style={styles.handoverDone}>£100 payout released</Text>
              </View>
            ) : handoverUploaded[item.id] || item.handoverProofUrl ? (
              <View style={styles.payoutOkPill}>
                <Ionicons name="hourglass-outline" size={13} color="#4ADE80" />
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.handoverButtonText}>Upload Handover Proof</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(59,130,246,0.03)', '#0A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Auctions</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.navigate('SellCarFlow')} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
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
                onPress={openCreateModal}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="gavel" size={18} color="#FFFFFF" />
                <Text style={styles.createAuctionText}>CREATE AUCTION</Text>
              </TouchableOpacity>
              <View style={{ height: 110 }} />
            </View>
          }
        />
      )}
      {/* ── Also List for Sale Modal ── */}
      <Modal
        visible={alsoRetailAuction !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAlsoRetailAuction(null)}
      >
        <TouchableOpacity style={styles.retailModalOverlay} activeOpacity={1} onPress={() => setAlsoRetailAuction(null)}>
          <View style={[styles.retailModalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]} onStartShouldSetResponder={() => true}>
            <View style={styles.retailModalHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="pricetag-outline" size={16} color="#3B82F6" />
              <Text style={styles.retailModalTitle}>Also List for Sale</Text>
            </View>
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
                { tier: 'BASIC' as const, label: 'Basic', price: 1, accent: '#FFFFFF' },
                { tier: 'STANDARD' as const, label: 'Standard', price: 10, accent: '#3B82F6' },
                { tier: 'PREMIUM' as const, label: 'Premium', price: 25, accent: '#F59E0B' },
              ]).map(plan => (
                <TouchableOpacity
                  key={plan.tier}
                  style={[styles.retailPlanCard, retailTier === plan.tier && { borderColor: plan.accent, backgroundColor: `${plan.accent}10` }]}
                  onPress={() => setRetailTier(plan.tier)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.retailPlanRadio, retailTier === plan.tier && { backgroundColor: plan.accent, borderColor: plan.accent }]}>
                    {retailTier === plan.tier && <Ionicons name="checkmark" size={11} color="#FFF" />}
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
              {retailSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : (
                <Text style={styles.retailSubmitText}>Create Listing</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Auction Modal ── */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setCreateModalVisible(false); resetCreateModal(); }}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <View style={{ height: insets.top }} />

          {/* Modal header */}
          <View style={styles.modalHeader}>
            {createStep === 2 ? (
              <TouchableOpacity
                style={styles.modalBackBtn}
                onPress={() => { setCreateStep(1); setCreateError(null); }}
                activeOpacity={0.75}
              >
                <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.modalBackBtn} />
            )}
            <Text style={styles.modalTitle}>
              {createStep === 1 ? 'Select a Listing' : 'Auction Settings'}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => { setCreateModalVisible(false); resetCreateModal(); }}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, createStep >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, createStep >= 2 && styles.stepDotActive]} />
          </View>

          {/* ── Step 1: Pick a listing ── */}
          {createStep === 1 && (
            <>
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
                  data={eligibleListings}
                  keyExtractor={l => l.id}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 10 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
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
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          )}

          {/* ── Step 2: Auction settings ── */}
          {createStep === 2 && selectedListing && (
            <ScrollView
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
                  <Ionicons name="calendar-outline" size={16} color="#60A5FA" />
                  <Text style={styles.datePickerBtnText}>
                    {startDate.toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
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
                <Ionicons name="time-outline" size={13} color="#60A5FA" />
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="gavel" size={16} color="#FFFFFF" />
                    <Text style={styles.createSubmitBtnText}>Schedule Auction</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftColor: 'rgba(255,255,255,0.10)',
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
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 3,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
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
    fontSize: 9,
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Auction info row (SCHEDULED) ──
  auctionInfoRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 0,
  },
  auctionInfoCell: {
    flex: 1,
    alignItems: 'center',
  },
  auctionInfoLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  auctionInfoValue: {
    fontFamily: FontFamily.mono,
    fontSize: 13,
    color: '#60A5FA',
  },

  // ── Inline edit form (SCHEDULED) ──
  editExpand: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  editExpandTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  editLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
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
    fontSize: 14,
    color: Colors.textMuted,
    marginRight: 4,
  },
  editInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  editError: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
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
    fontSize: 13,
    color: '#FFFFFF',
  },
  editDiscard: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // ── Handover section ──
  handoverSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  handoverButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  handoverButtonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
  },
  handoverDone: {
    color: '#4ADE80',
    fontFamily: FontFamily.medium,
    fontSize: 13,
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
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  payoutFailText: {
    color: '#FCA5A5',
    fontFamily: FontFamily.medium,
    fontSize: 12,
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
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Also List for Sale modal ──
  retailModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  retailModalSheet: { backgroundColor: '#0F0F14', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 22, paddingTop: 18 },
  retailModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 },
  retailModalTitle: { fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF' },
  retailModalSub: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  retailFieldLabel: { fontFamily: FontFamily.bold, fontSize: 9, color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  retailPriceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, paddingHorizontal: 12 },
  retailCurrency: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.textMuted, marginRight: 4 },
  retailInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 16, color: Colors.textPrimary, paddingVertical: 12 },
  retailPlanCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 },
  retailPlanRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  retailPlanLabel: { fontFamily: FontFamily.bold, fontSize: 14, flex: 1 },
  retailPlanPrice: { fontFamily: FontFamily.mono, fontSize: 15, flexShrink: 0 },
  retailErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)', borderRadius: 10, padding: 10, marginTop: 12 },
  retailErrorText: { fontFamily: FontFamily.medium, fontSize: 12, color: Colors.error, flex: 1, lineHeight: 17 },
  retailSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, backgroundColor: '#3B82F6', marginTop: 16, marginBottom: 4 },
  retailSubmitText: { fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.3 },

  // ── Create Auction Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDotActive: {
    backgroundColor: Colors.accent,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 8,
  },
  modalSubheading: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
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
    fontSize: 15,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  modalEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Listing pick cards (step 1)
  listingPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  listingPickThumb: {
    width: 60,
    height: 48,
    borderRadius: 8,
    flexShrink: 0,
  },
  listingPickThumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingPickTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  listingPickPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 3,
  },

  // Selected listing chip (step 2 header)
  selectedListingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedListingText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.success,
    flex: 1,
  },

  // Form fields (step 2)
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  formHint: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#404050',
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
    fontSize: 14,
    color: Colors.textMuted,
    marginRight: 4,
  },
  formInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 11,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerBtnText: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: '#60A5FA',
  },
  iosDatePicker: {
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  durationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    borderRadius: 10,
    padding: 10,
  },
  durationNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#93C5FD',
    flex: 1,
    lineHeight: 17,
  },
  createErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
    borderRadius: 10,
    padding: 10,
  },
  createErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
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
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
