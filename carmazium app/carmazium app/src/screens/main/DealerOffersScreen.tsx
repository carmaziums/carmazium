import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { haptics } from '../../lib/haptics';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CounterLedger } from '../../components/offers/CounterLedger';
import { ReceivedDeliveryRequestsPanel } from '../../components/delivery/ReceivedDeliveryRequestsPanel';

import { IconButton } from '../../components/IconButton';
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
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = () => fetchData();

  // ─────────────── actions ────────────────

  const handleRespond = async (
    offer: Offer,
    status: 'ACCEPTED' | 'REJECTED' | 'COUNTER',
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
    await handleRespond(counterModalOffer, 'COUNTER', parsed);
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

  const handleCancelAndRelist = (offer: Offer) => {
    Alert.alert(
      'Cancel & Relist',
      'Are you sure you want to cancel this offer and relist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => handleRespond(offer, 'REJECTED'),
        },
      ],
    );
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
    <View style={styles.emptyState}>
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
    const showActions = offer.status === 'PENDING';
    const isCountered = offer.status === 'COUNTERED';

    return (
      <View style={[styles.offerCard, { borderLeftColor: cfg.leftBorder }]}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          {/* Buyer avatar */}
          <LinearGradient
            colors={[Colors.darkBlue_2d3c63, Colors.darkBlue_1a2238]}
            style={styles.buyerAvatar}
          >
            <Text style={styles.buyerInitials}>{initials}</Text>
          </LinearGradient>

          {/* Name + chip */}
          <View style={styles.cardTopCenter}>
            <Text style={styles.buyerName} numberOfLines={1}>{name}</Text>
            <View style={[styles.statusChip, { backgroundColor: cfg.chipBg }]}>
              <Text style={[styles.statusChipText, { color: cfg.chipText }]}>
                {cfg.chipLabel}
              </Text>
            </View>
          </View>

          {/* Time */}
          <Text style={styles.timeAgo}>{timeAgo(offer.createdAt)}</Text>
        </View>

        {/* Amount row */}
        <View style={styles.amountRow}>
          <Text style={styles.offerAmount}>{formatPrice(offer.amount)}</Text>
          {diff != null && (
            <Text style={[styles.diffText, { color: diff >= 0 ? Colors.success : Colors.accent }]}>
              {diff >= 0 ? `+${formatPrice(diff)}` : formatPrice(diff)} vs asking
            </Text>
          )}
        </View>

        {/* Listing name */}
        <Text style={styles.listingName} numberOfLines={1}>{listingTitle}</Text>

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

        {/* Counter sent label */}
        {isCountered && (
          <View style={styles.counterSentChip}>
            <Ionicons name="time-outline" size={12} color={Colors.infoBlue} />
            <Text style={styles.counterSentText}>Counter sent — awaiting buyer response</Text>
          </View>
        )}

        {/* Action row */}
        {showActions && (
          <View style={[styles.actionsRow, { opacity: isActioning ? 0.5 : 1 }]}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDecline]}
              activeOpacity={0.75}
              onPress={() => handleDecline(offer)}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCounter]}
              activeOpacity={0.75}
              onPress={() => openCounterModal(offer)}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAccept]}
              activeOpacity={0.75}
              onPress={() => handleAccept(offer)}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.white }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions: ACCEPTED — Message / Mark as Sold / Cancel & Relist,
            matching web's offers page (this row didn't exist on mobile at all). */}
        {offer.status === 'ACCEPTED' && (
          <View style={[styles.actionsRow, { flexWrap: 'wrap' }]}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnMessage]}
              activeOpacity={0.75}
              onPress={() => handleMessageBuyer(offer)}
              disabled={messagingBuyerId === offer.id}
            >
              {messagingBuyerId === offer.id ? (
                <ActivityIndicator size="small" color={Colors.infoBlue} />
              ) : (
                <Text style={[styles.actionBtnText, { color: Colors.infoBlue }]}>Message</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnMarkSold]}
              activeOpacity={0.75}
              onPress={() => openSaleModal(offer)}
            >
              <Text style={[styles.actionBtnText, { color: Colors.white }]}>Mark as Sold</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDecline]}
              activeOpacity={0.75}
              onPress={() => handleCancelAndRelist(offer)}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Cancel & Relist</Text>
            </TouchableOpacity>
          </View>
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
    handleCancelAndRelist,
    openSaleModal,
  ]);

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.warningAlpha05, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area top spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>Direct Offers</Text>

        {/* Pending count badge */}
        {pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
          </View>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* ── Content ── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 16, marginTop: 20 }}>
          <ErrorBanner message="Could not load offers. Check your connection." onRetry={handleRetry} />
        </View>
      ) : loading ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeleton()}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        // Virtualized — an active dealership can accumulate hundreds of offers
        // over time, so we only mount rows near the viewport.
        <FlatList
          style={styles.scroll}
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOfferCard}
          ListHeaderComponent={<ReceivedDeliveryRequestsPanel contextLabel="your inventory" />}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={[styles.scrollContent, offers.length === 0 && { flexGrow: 1 }]}
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
            <Text style={styles.modalSubtitle}>
              Buyer offered {formatPrice(counterModalOffer.amount)} on{' '}
              {counterModalOffer.listing?.title ?? 'your listing'}
            </Text>
          )}

          <Text style={styles.inputLabel}>Your counter amount (£)</Text>
          <TextInput
            style={styles.counterInput}
            value={counterAmount}
            onChangeText={setCounterAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.accent}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              activeOpacity={0.75}
              onPress={() => setCounterModalOffer(null)}
            >
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnConfirm]}
              activeOpacity={0.75}
              onPress={submitCounter}
            >
              <Text style={styles.modalBtnConfirmText}>Send Counter</Text>
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
            <Text style={styles.modalSubtitle}>
              Confirm the price {getBuyerName(saleModalOffer.buyer)} paid for{' '}
              {saleModalOffer.listing?.title ?? 'this listing'}.
            </Text>
          )}

          <Text style={styles.inputLabel}>Sale price (£)</Text>
          <TextInput
            style={styles.counterInput}
            value={saleSoldPrice}
            onChangeText={v => { setSaleSoldPrice(v); setSaleError(null); }}
            keyboardType="numeric"
            placeholder="Enter sale price"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.accent}
          />

          {saleError && <ErrorBanner message={saleError} />}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              activeOpacity={0.75}
              onPress={() => setSaleModalOffer(null)}
              disabled={saleSubmitting}
            >
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnConfirmSale, saleSubmitting && { opacity: 0.6 }]}
              activeOpacity={0.75}
              onPress={handleConfirmSale}
              disabled={saleSubmitting}
            >
              {saleSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalBtnConfirmSaleText}>Confirm Sold</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {toast && (
        <View style={styles.toastBanner} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.toastBannerText}>{toast}</Text>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

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
    borderRadius: 16,
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
    borderRadius: 16,
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
    color: Colors.infoBlue,
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
    borderRadius: 10,
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
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionBtnMessage: {
    backgroundColor: 'transparent',
    borderColor: Colors.infoBlue,
  },
  actionBtnMarkSold: {
    backgroundColor: Colors.success,
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
    borderRadius: 12,
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
    backgroundColor: Colors.success,
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
    borderRadius: 20,
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
