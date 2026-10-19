import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { haptics } from '../../lib/haptics';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { mergeAppearanceStyles, lightReadableText, appearancePalette } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CounterLedger } from '../../components/offers/CounterLedger';
import { ReceivedDeliveryRequestsPanel } from '../../components/delivery/ReceivedDeliveryRequestsPanel';
import { SaleCancellationSheet } from '../../components/SaleCancellationSheet';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── interfaces ───────────────────────────

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';

interface Offer {
  id: string;
  amount: number;
  status: OfferStatus;
  counterAmount?: number | null;
  sellerCounterAmount?: number | null;
  buyerCounterAmount?: number | null;
  counterAttemptsBuyer?: number | null;
  counterAttemptsSeller?: number | null;
  counterExpiresAt?: string | null;
  lastCounteredBy?: 'BUYER' | 'SELLER' | null;
  listingId?: string;
  buyerId?: string;
  listing?: {
    id?: string;
    title?: string;
    price?: number;
    status?: string;
  };
  buyer?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ReceivedOffersResponse {
  success: boolean;
  data: Offer[];
}

interface PendingCountResponse {
  success: boolean;
  data: { count: number };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatPrice = (amount: number): string =>
  `£${amount.toLocaleString('en-GB')}`;

const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${Math.floor(diffHrs / 24)}d`;
};

const getBuyerInitials = (buyer?: Offer['buyer']): string => {
  const first = buyer?.firstName?.[0] ?? '';
  const last = buyer?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
};

const getBuyerName = (buyer?: Offer['buyer']): string => {
  const parts = [buyer?.firstName, buyer?.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unknown Buyer';
};

// ─────────────────────── status config ────────────────────────────

const STATUS_CONFIG: Record<
  OfferStatus,
  { leftBorder: string; chipBg: string; chipText: string; chipLabel: string }
> = {
  PENDING: {
    leftBorder: Colors.warning,
    chipBg: Colors.warningAlpha15,
    chipText: Colors.warning,
    chipLabel: 'PENDING',
  },
  ACCEPTED: {
    leftBorder: Colors.success,
    chipBg: Colors.successAlpha15,
    chipText: Colors.success,
    chipLabel: 'ACCEPTED',
  },
  REJECTED: {
    leftBorder: Colors.textMuted,
    chipBg: Colors.whiteAlpha06,
    chipText: Colors.textMuted,
    chipLabel: 'REJECTED',
  },
  COUNTERED: {
    leftBorder: Colors.infoBlue,
    chipBg: Colors.infoBlueAlpha15,
    chipText: Colors.infoBlue,
    chipLabel: 'COUNTERED',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerOffersScreen: React.FC = () => {
  const { tc } = useAppearance();
  const insets = useSafeAreaInsets();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(mergeAppearanceStyles(styles, lightReceivedOffersStyles), lightContrastStyles) : styles;
  const navigation = useNavigation<NavProp>();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counterModalOffer, setCounterModalOffer] = useState<Offer | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [messagingBuyerId, setMessagingBuyerId] = useState<string | null>(null);
  const [cancelOffer, setCancelOffer] = useState<Offer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Mark as Sold — same recordSale/PATCH /listings/:id/sold pattern as
  // SellerOffersScreen.tsx; web's offers page has this for dealers too.
  const [saleModalOffer, setSaleModalOffer] = useState<Offer | null>(null);
  const [saleSoldPrice, setSaleSoldPrice] = useState('');
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const [offersRes, countRes] = await Promise.allSettled([
        apiClient<ReceivedOffersResponse>('/offers/received'),
        apiClient<PendingCountResponse>('/offers/pending-count'),
      ]);

      if (offersRes.status === 'fulfilled' && offersRes.value?.success) {
        const raw = offersRes.value.data;
        setOffers(Array.isArray(raw) ? raw : []);
      }
      if (countRes.status === 'fulfilled' && countRes.value?.success) {
        setPendingCount(countRes.value.data?.count ?? 0);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on every focus (not just mount) — a notification tap that lands
  // on an already-mounted screen instance was showing stale/empty data
  // because this only ever ran once on the initial mount.
  const isFirstOffersFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstOffersFocus.current) {
        fetchData();
        isFirstOffersFocus.current = false;
      } else {
        fetchData(true);
      }
    }, [fetchData]),
  );

  const handleRetry = () => fetchData();

  // ─────────────── actions ────────────────

  const handleRespond = async (
    offer: Offer,
    // Backend's RespondOfferDto only accepts ACCEPTED/REJECTED/COUNTERED
    // (class-validator @IsEnum) — 'COUNTER' 400s with "status must be one
    // of the following values: ACCEPTED, REJECTED, COUNTERED".
    status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED',
    counterAmt?: number,
  ) => {
    setActionLoading(offer.id);
    try {
      await apiClient(`/offers/${offer.id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(counterAmt != null && { counterAmount: counterAmt }),
        }),
      });
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Action Failed', message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = (offer: Offer) => {
    Alert.alert(
      'Accept Offer',
      `Accept ${formatPrice(offer.amount)} from ${getBuyerName(offer.buyer)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => handleRespond(offer, 'ACCEPTED'),
        },
      ],
    );
  };

  const handleDecline = (offer: Offer) => {
    Alert.alert(
      'Decline Offer',
      `Decline this offer of ${formatPrice(offer.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => handleRespond(offer, 'REJECTED'),
        },
      ],
    );
  };

  const openCounterModal = (offer: Offer) => {
    setCounterModalOffer(offer);
    setCounterAmount(String(offer.amount + 2500));
  };

  const submitCounter = async () => {
    if (!counterModalOffer) return;
    const parsed = parseFloat(counterAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid counter amount.');
      return;
    }
    setCounterModalOffer(null);
    await handleRespond(counterModalOffer, 'COUNTERED', parsed);
  };

  const handleMessageBuyer = async (offer: Offer) => {
    const participantId = offer.buyerId ?? offer.buyer?.id;
    if (!participantId) {
      Alert.alert('Unable to open chat', 'Buyer information is not available.');
      return;
    }
    setMessagingBuyerId(offer.id);
    try {
      const res = await apiClient<{ success: boolean; data: { id: string } }>(
        '/chat/rooms',
        {
          method: 'POST',
          body: JSON.stringify({
            participantId,
            listingId: offer.listing?.id ?? offer.listingId,
          }),
        },
      );
      if (res?.success && res.data?.id) {
        navigation.navigate('ChatScreen', { threadId: res.data.id });
      }
    } catch (err: any) {
      Alert.alert('Could not open chat', err?.message ?? 'Please try again.');
    } finally {
      setMessagingBuyerId(null);
    }
  };

  const openSaleModal = (offer: Offer) => {
    setSaleModalOffer(offer);
    setSaleSoldPrice(String(offer.amount));
    setSaleError(null);
  };

  const handleConfirmSale = async () => {
    if (!saleModalOffer) return;
    const listingId = saleModalOffer.listing?.id ?? saleModalOffer.listingId;
    if (!listingId) {
      setSaleError('Missing listing information — please refresh and try again.');
      return;
    }
    const soldPrice = parseFloat(saleSoldPrice.replace(/[^0-9.]/g, ''));
    if (isNaN(soldPrice) || soldPrice <= 0) {
      setSaleError('Enter a valid sale price.');
      return;
    }
    setSaleSubmitting(true);
    setSaleError(null);
    try {
      const buyerNameParts = [saleModalOffer.buyer?.firstName, saleModalOffer.buyer?.lastName].filter(Boolean);
      await apiClient(`/listings/${listingId}/sold`, {
        method: 'PATCH',
        body: JSON.stringify({
          soldPrice,
          buyerId: saleModalOffer.buyerId ?? saleModalOffer.buyer?.id,
          ...(buyerNameParts.length > 0 && { buyerName: buyerNameParts.join(' ') }),
          ...(saleModalOffer.buyer?.email && { buyerEmail: saleModalOffer.buyer.email }),
        }),
      });
      haptics.success();
      setSaleModalOffer(null);
      setToast('✓ Sale recorded! Your earnings have been updated.');
      setTimeout(() => setToast(null), 5000);
      await fetchData();
    } catch (err: any) {
      setSaleError(err?.message ?? 'Could not record the sale. Please try again.');
    } finally {
      setSaleSubmitting(false);
    }
  };

  // ─────────────── render helpers ─────────────────────

  const renderSkeleton = () => (
    <View style={{ gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={`sk-${i}`} w={SCREEN_WIDTH - 32} h={110} r={18} />
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={ts.emptyState}>
      <EmptyState
        icon="pricetag-outline"
        title="No offers yet"
        subtitle="Offers from buyers on your dealership listings will appear here"
      />
    </View>
  );

  const renderOfferCard = useCallback(({ item: offer }: { item: Offer }) => {
    const cfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.PENDING;
    const initials = getBuyerInitials(offer.buyer);
    const name = getBuyerName(offer.buyer);
    const listingTitle = offer.listing?.title ?? 'Your listing';
    const askingPrice = offer.listing?.price;
    const diff = askingPrice != null ? offer.amount - askingPrice : null;
    const isActioning = actionLoading === offer.id;
    const isCountered = offer.status === 'COUNTERED';
    const displayedSellerCounter = offer.sellerCounterAmount ?? offer.counterAmount ?? null;
    // True when the buyer has counter-backed — ball is in the seller's court
    const buyerCounteredBack = isCountered && offer.lastCounteredBy === 'BUYER';
    // Matches web's needsSellerAction (dashboard/seller/offers/page.tsx) —
    // PENDING is the seller's first response; a buyer counter-back also
    // needs a response. Previously this was PENDING-only, so once a buyer
    // countered back the action row vanished and the dealer had no way to
    // accept/decline/re-counter through the UI at all.
    const showActions = offer.status === 'PENDING' || buyerCounteredBack;
    // Backend rejects a 6th seller counter (offers.service.ts respondToOffer).
    const sellerCounterLocked = (offer.counterAttemptsSeller ?? 0) >= 5;

    return (
      <View style={[ts.offerCard, { borderLeftColor: cfg.leftBorder }]}>
        {/* Top row */}
        <View style={ts.cardTopRow}>
          {/* Buyer avatar */}
          <LinearGradient
            colors={[Colors.darkBlue_2d3c63, Colors.darkBlue_1a2238]}
            style={ts.buyerAvatar}
          >
            <Text style={ts.buyerInitials}>{initials}</Text>
          </LinearGradient>

          {/* Name + chip */}
          <View style={ts.cardTopCenter}>
            <Text style={ts.buyerName} numberOfLines={1}>{name}</Text>
            <View style={[ts.statusChip, { backgroundColor: cfg.chipBg }]}>
              <Text style={[ts.statusChipText, { color: appearanceMode === 'light' ? (offer.status === 'ACCEPTED' ? lightReadableText.success : offer.status === 'PENDING' ? lightReadableText.warning : offer.status === 'COUNTERED' ? lightReadableText.info : lightReadableText.muted) : cfg.chipText }]}>
                {cfg.chipLabel}
              </Text>
            </View>
          </View>

          {/* Time */}
          <Text style={ts.timeAgo}>{timeAgo(offer.createdAt)}</Text>
        </View>

        {/* Amount row */}
        <View style={ts.amountRow}>
          <Text style={ts.offerAmount}>{formatPrice(offer.amount)}</Text>
          {diff != null && (
            <Text style={[ts.diffText, { color: diff >= 0 ? (appearanceMode === 'light' ? lightReadableText.success : Colors.success) : (appearanceMode === 'light' ? lightReadableText.error : Colors.accent) }]}>
              {diff >= 0 ? `+${formatPrice(diff)}` : formatPrice(diff)} vs asking
            </Text>
          )}
        </View>

        {/* Listing name */}
        <Text style={ts.listingName} numberOfLines={1}>{listingTitle}</Text>

        {/* Negotiation history — visible whenever any counter has occurred */}
        {(offer.sellerCounterAmount != null ||
          offer.buyerCounterAmount != null ||
          offer.counterAmount != null) && (
          <CounterLedger
            offer={{
              amount: offer.amount,
              createdAt: offer.createdAt,
              updatedAt: offer.updatedAt,
              status: offer.status,
              sellerCounterAmount: offer.sellerCounterAmount,
              buyerCounterAmount: offer.buyerCounterAmount,
              counterAmount: offer.counterAmount,
              counterAttemptsBuyer: offer.counterAttemptsBuyer,
              counterAttemptsSeller: offer.counterAttemptsSeller,
              lastCounteredBy: offer.lastCounteredBy,
              counterExpiresAt: offer.counterExpiresAt,
            }}
            viewerRole="SELLER"
          />
        )}

        {/* Counter state label */}
        {isCountered && (
          buyerCounteredBack ? (
            <View style={ts.buyerCounteredChip}>
              <Ionicons name="swap-horizontal-outline" size={12} color={tc(Colors.warning)} />
              <Text style={ts.buyerCounteredText}>
                BUYER COUNTERED
                {offer.buyerCounterAmount != null ? ` — ${formatPrice(offer.buyerCounterAmount)}` : ''}
              </Text>
            </View>
          ) : (
            <View style={ts.counterSentChip}>
              <Ionicons name="time-outline" size={12} color={Colors.infoBlue} />
              <Text style={ts.counterSentText}>
                Counter sent{displayedSellerCounter != null ? ` · ${formatPrice(displayedSellerCounter)}` : ''} — awaiting buyer response
              </Text>
            </View>
          )
        )}

        {/* Action row */}
        {showActions && (
          <>
          {sellerCounterLocked && (
            <View style={ts.counterLockedBanner}>
              <Ionicons name="lock-closed-outline" size={12} color={tc(Colors.warning)} />
              <Text style={ts.counterLockedText}>Counter limit reached — Accept or Decline.</Text>
            </View>
          )}
          <View style={[ts.actionsRow, { opacity: isActioning ? 0.5 : 1 }]}>
            <TouchableOpacity
              style={[ts.actionBtn, ts.actionBtnDecline]}
              activeOpacity={0.75}
              onPress={() => handleDecline(offer)}
              disabled={isActioning}
            >
              <Text style={[ts.actionBtnText, { color: tc(Colors.accent) }]}>Decline</Text>
            </TouchableOpacity>

            {!sellerCounterLocked && (
              <TouchableOpacity
                style={[ts.actionBtn, ts.actionBtnCounter]}
                activeOpacity={0.75}
                onPress={() => openCounterModal(offer)}
                disabled={isActioning}
              >
                <Text style={[ts.actionBtnText, { color: tc(Colors.warning) }]}>Counter</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[ts.actionBtn, ts.actionBtnAccept]}
              activeOpacity={0.75}
              onPress={() => handleAccept(offer)}
              disabled={isActioning}
            >
              <Text style={[ts.actionBtnText, { color: Colors.white }]}>Accept</Text>
            </TouchableOpacity>
          </View>
          </>
        )}

        {/* Actions: ACCEPTED — Message / Mark as Sold / Cancel & Relist,
            matching web's offers page (this row didn't exist on mobile at all).
            Mark as Sold / Cancel & Relist only make sense while the listing
            itself is still unsold — once another action (or a different
            accepted offer) already sold it, the backend correctly rejects a
            second sale, but the buttons shouldn't have been offered at all. */}
        {offer.status === 'ACCEPTED' && offer.listing?.status === 'SOLD' && (
          <View style={ts.soldNoticeBanner}>
            <Ionicons name="checkmark-circle" size={13} color={tc(Colors.accentGreen)} />
            <Text style={ts.soldNoticeText}>Vehicle already sold</Text>
          </View>
        )}
        {offer.status === 'ACCEPTED' && offer.listing?.status !== 'SOLD' && (
          <View style={[ts.actionsRow, { flexWrap: 'wrap' }]}>
            <TouchableOpacity
              style={[ts.actionBtn, ts.actionBtnMessage]}
              activeOpacity={0.75}
              onPress={() => handleMessageBuyer(offer)}
              disabled={messagingBuyerId === offer.id}
            >
              {messagingBuyerId === offer.id ? (
                <ActivityIndicator size="small" color={Colors.infoBlue} />
              ) : (
                <Text style={[ts.actionBtnText, { color: tc(Colors.infoLight) }]}>Message</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[ts.actionBtn, ts.actionBtnMarkSold]}
              activeOpacity={0.75}
              onPress={() => openSaleModal(offer)}
            >
              <Text style={[ts.actionBtnText, { color: Colors.white }]}>Mark as Sold</Text>
            </TouchableOpacity>

          </View>
        )}
        {offer.status === 'ACCEPTED' && (
          <TouchableOpacity
            style={[ts.actionBtn, ts.actionBtnDecline, { marginTop: 4 }]}
            activeOpacity={0.75}
            onPress={() => setCancelOffer(offer)}
            disabled={isActioning}
          >
            <Ionicons name="close-circle-outline" size={14} color={Colors.accent} style={{ marginRight: 6 }} />
            <Text style={[ts.actionBtnText, { color: tc(Colors.accent) }]}>Request Cancellation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    actionLoading,
    handleDecline,
    openCounterModal,
    handleAccept,
    messagingBuyerId,
    handleMessageBuyer,
    openSaleModal,
    appearanceMode,
  ]);

  // ─────────────── main render ───────────────────────

  return (
    <View style={ts.container}>
      {cancelOffer && (
        <SaleCancellationSheet
          visible={cancelOffer != null}
          listingId={cancelOffer.listing?.id ?? cancelOffer.listingId ?? ''}
          vehicleTitle={cancelOffer.listing?.title ?? 'Vehicle'}
          onClose={() => setCancelOffer(null)}
          onCreated={() => void fetchData(true)}
        />
      )}
      <ThemedStatusBar />
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.warningAlpha05, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area top spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={ts.header}>
        <IconButton style={ts.backBtn} icon={<Ionicons name="chevron-back" size={18} color={tc(Colors.white)} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <Text style={ts.headerTitle}>Offers Received</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {pendingCount > 0 && (
            <View style={ts.pendingBadge}>
              <Text style={ts.pendingBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
            </View>
          )}
          <HamburgerButton />
        </View>
      </View>

      {/* ── Content ── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 16, marginTop: 20 }}>
          <ErrorBanner message="Could not load offers. Check your connection." onRetry={handleRetry} />
        </View>
      ) : loading ? (
        <ScrollView style={ts.scroll} contentContainerStyle={ts.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeleton()}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        // Virtualized — an active dealership can accumulate hundreds of offers
        // over time, so we only mount rows near the viewport.
        <FlatList
          style={ts.scroll}
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOfferCard}
          ListHeaderComponent={<ReceivedDeliveryRequestsPanel contextLabel="your inventory" />}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={[ts.scrollContent, offers.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        />
      )}

      {/* ── Counter modal ── */}
      <BottomSheet
        visible={counterModalOffer != null}
        onClose={() => setCounterModalOffer(null)}
        title="Send Counter Offer"
        avoidKeyboard
        maxHeightPercent={60}
      >
        {/* gap replicates the old modalSheet wrapper's spacing, which BottomSheet's
            own sheet style doesn't provide */}
        <View style={{ gap: 14 }}>
          {counterModalOffer && (
            <Text style={ts.modalSubtitle}>
              Buyer offered {formatPrice(counterModalOffer.amount)} on{' '}
              {counterModalOffer.listing?.title ?? 'your listing'}
            </Text>
          )}

          <Text style={ts.inputLabel}>Your counter amount (£)</Text>
          <TextInput
            style={ts.counterInput}
            value={counterAmount}
            onChangeText={setCounterAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            placeholderTextColor={tc(Colors.textMuted)}
            selectionColor={Colors.accent}
          />

          <View style={ts.modalActions}>
            <TouchableOpacity
              style={[ts.modalBtn, ts.modalBtnCancel]}
              activeOpacity={0.75}
              onPress={() => setCounterModalOffer(null)}
            >
              <Text style={ts.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ts.modalBtn, ts.modalBtnConfirm]}
              activeOpacity={0.75}
              onPress={submitCounter}
            >
              <Text style={ts.modalBtnConfirmText}>Send Counter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* ── Mark as Sold modal ── */}
      <BottomSheet
        visible={saleModalOffer != null}
        onClose={() => setSaleModalOffer(null)}
        title="Mark as Sold"
        avoidKeyboard
        maxHeightPercent={60}
      >
        <View style={{ gap: 14 }}>
          {saleModalOffer && (
            <Text style={ts.modalSubtitle}>
              Confirm the price {getBuyerName(saleModalOffer.buyer)} paid for{' '}
              {saleModalOffer.listing?.title ?? 'this listing'}.
            </Text>
          )}

          <Text style={ts.inputLabel}>Sale price (£)</Text>
          <TextInput
            style={ts.counterInput}
            value={saleSoldPrice}
            onChangeText={v => { setSaleSoldPrice(v); setSaleError(null); }}
            keyboardType="numeric"
            placeholder="Enter sale price"
            placeholderTextColor={tc(Colors.textMuted)}
            selectionColor={Colors.accent}
          />

          {saleError && <ErrorBanner message={saleError} />}

          <View style={ts.modalActions}>
            <TouchableOpacity
              style={[ts.modalBtn, ts.modalBtnCancel]}
              activeOpacity={0.75}
              onPress={() => setSaleModalOffer(null)}
              disabled={saleSubmitting}
            >
              <Text style={ts.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ts.modalBtn, ts.modalBtnConfirmSale, saleSubmitting && { opacity: 0.6 }]}
              activeOpacity={0.75}
              onPress={handleConfirmSale}
              disabled={saleSubmitting}
            >
              {saleSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={ts.modalBtnConfirmSaleText}>Confirm Sold</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {toast && (
        <View style={ts.toastBanner} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={14} color={tc(Colors.success)} />
          <Text style={ts.toastBannerText}>{toast}</Text>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const lightReceivedOffersStyles = StyleSheet.create({
  container: { backgroundColor: '#EEF5FB' },
  header: { backgroundColor: '#EEF5FB' },
  backBtn: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  offerCard: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  skeletonCard: { backgroundColor: '#FFFFFF' },
  emptyState: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  counterLockedBanner: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  soldNoticeBanner: { backgroundColor: '#FFFFFF', borderColor: '#D5E1EC' },
  buyerAvatar: { backgroundColor: '#F7FBFF' },
  headerTitle: { color: '#0F172A' },
  emptyTitle: { color: '#0F172A' },
  buyerName: { color: '#0F172A' },
  offerAmount: { color: '#0F172A' },
  listingName: { color: '#0F172A' },
  emptySub: { color: '#526177' },
  timeAgo: { color: '#526177' },
  diffText: { color: '#526177' },
  counterLockedText: { color: '#526177' },
  soldNoticeText: { color: '#526177' },
  scrollContent: { backgroundColor: '#EEF5FB' },
  inputLabel: { color: '#526177' },
  counterInput: { backgroundColor: '#F7FBFF', color: '#0F172A', borderColor: '#D5E1EC' },
  amountRow: { backgroundColor: '#FFFFFF' },
  modalSubtitle: { color: '#526177' },
  toastBanner: { backgroundColor: '#F7FBFF' },
  actionBtn: { borderColor: '#D5E1EC' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 38,
  },
  pendingBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },

  // ── Skeleton ──
  skeletonCard: {
    height: 160,
    borderRadius: Radius.card,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha04,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 72,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  // ── Offer card ──
  offerCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderLeftWidth: 3,
    padding: 16,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buyerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  buyerInitials: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  cardTopCenter: {
    flex: 1,
    gap: 4,
  },
  buyerName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.5,
  },
  timeAgo: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  offerAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size22,
    color: Colors.textPrimary,
  },
  diffText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size12,
  },
  listingName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
  },
  counterSentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.infoBlueAlpha10,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha25,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterSentText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.infoLight,
  },
  buyerCounteredChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buyerCounteredText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  counterLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningAlpha10,
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  counterLockedText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  soldNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentGreenAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  soldNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.accentGreen,
  },

  // ── Action buttons ──
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnDecline: {
    backgroundColor: 'transparent',
    borderColor: Colors.accent,
  },
  actionBtnCounter: {
    backgroundColor: 'transparent',
    borderColor: Colors.warning,
  },
  actionBtnAccept: {
    backgroundColor: Colors.successSolid,
    borderColor: Colors.success,
  },
  actionBtnMessage: {
    backgroundColor: 'transparent',
    borderColor: Colors.infoBlue,
  },
  actionBtnMarkSold: {
    backgroundColor: Colors.successSolid,
    borderColor: Colors.success,
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    letterSpacing: 0.3,
  },

  // ── Counter modal ──
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  counterInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  modalBtnConfirm: {
    backgroundColor: Colors.warning,
  },
  modalBtnConfirmSale: {
    backgroundColor: Colors.successSolid,
  },
  modalBtnConfirmSaleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  modalBtnCancelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  modalBtnConfirmText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  toastBanner: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.successAlpha25,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  toastBannerText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  buyerCounteredText: { color: lightReadableText.warning },
  counterSentText: { color: lightReadableText.info },
  modalBtnCancelText: { color: LIGHT_PALETTE.secondary },
  toastBannerText: { color: LIGHT_PALETTE.text },
  actionBtnAccept: { backgroundColor: lightReadableText.success },
  actionBtnMarkSold: { backgroundColor: lightReadableText.success },
  modalBtnConfirmSale: { backgroundColor: lightReadableText.success },
});
