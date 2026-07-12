import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CounterLedger } from '../../components/offers/CounterLedger';
import { haptics } from '../../lib/haptics';
import {
  getMyDeliveryRequests,
  createDeliveryRequest,
  cancelDeliveryRequest,
  completeDeliveryRequest,
  type DeliveryRequest,
} from '../../lib/deliveryApi';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── interfaces ───────────────────────────

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

interface Offer {
  id: string;
  amount: number;
  status: OfferStatus;
  // Canonical counter fields — prefer these; fall back to counterAmount for old records
  sellerCounterAmount?: number | null;
  buyerCounterAmount?: number | null;
  lastCounteredBy?: 'BUYER' | 'SELLER' | null;
  counterAmount?: number | null; // legacy — kept for backwards compat
  counterAttemptsBuyer?: number | null;
  counterAttemptsSeller?: number | null;
  counterExpiresAt?: string | null;
  listingId?: string;
  sellerId?: string;
  createdAt?: string;
  updatedAt?: string;
  listing?: {
    id?: string;
    title?: string;
    price?: number;
    images?: string[];
    deliveryAvailable?: boolean;
    deliveryMaxMiles?: number | null;
  };
  seller?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dealerProfile?: { companyName?: string } | null;
  };
}

interface MyOffersResponse {
  success: boolean;
  data: Offer[];
}

// ─────────────────────────── helpers ──────────────────────────────

const formatPrice = (amount: number): string =>
  `£${amount.toLocaleString('en-GB')}`;

const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

// Returns display text + colour for a counter-offer expiry timestamp.
// Returns null when counterExpiresAt is absent (field not sent by older backend versions).
function formatCounterExpiry(
  iso: string | null | undefined,
): { text: string; color: string } | null {
  if (!iso) return null;
  const msLeft = new Date(iso).getTime() - Date.now();
  if (msLeft <= 0) {
    return { text: 'Counter has expired', color: Colors.textMuted };
  }
  const totalMins = Math.floor(msLeft / 60_000);
  if (totalMins < 60) {
    return { text: `Counter expires in ${totalMins}m`, color: Colors.warning };
  }
  const totalHours = Math.floor(totalMins / 60);
  if (totalHours < 24) {
    return { text: `Counter expires in ${totalHours}h`, color: Colors.warning };
  }
  const days = Math.floor(totalHours / 24);
  return {
    text: `Counter expires in ${days} day${days !== 1 ? 's' : ''}`,
    color: Colors.textMuted,
  };
}

// ─────────────────────── status config ────────────────────────────

const STATUS_CONFIG: Record<
  OfferStatus,
  {
    leftBorder: string;
    chipBg: string;
    chipText: string;
    chipLabel: string;
  }
> = {
  PENDING: {
    leftBorder: Colors.warning,
    chipBg: Colors.warningAlpha15,
    chipText: Colors.warning,
    chipLabel: 'PENDING',
  },
  COUNTERED: {
    leftBorder: Colors.accent,
    chipBg: Colors.accentAlpha12,
    chipText: Colors.accent,
    chipLabel: 'COUNTER-OFFER',
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
  WITHDRAWN: {
    // textMuted (not textDisabled) — this is a readable status label, not a
    // disabled control, and textDisabled's contrast is intentionally too low
    // for real text (mobile-ui-ux-audit.md contrast finding).
    leftBorder: Colors.textMuted,
    chipBg: Colors.whiteAlpha04,
    chipText: Colors.textMuted,
    chipLabel: 'WITHDRAWN',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerOffersScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counterBackOfferId, setCounterBackOfferId] = useState<string | null>(null);
  const [counterBackAmount, setCounterBackAmount] = useState('');
  const [counterBackLoading, setCounterBackLoading] = useState(false);
  const [counterBackError, setCounterBackError] = useState<string | null>(null);

  // Delivery request — inline on the offer instead of requiring a detour
  // through the listing detail screen (mobile-web parity audit, 2026-07-12:
  // web's offers page embeds this per-row; mobile previously had no
  // delivery UI on this screen at all). Only one form open at a time, same
  // pattern as the counter-back fields above.
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [deliveryFormOfferId, setDeliveryFormOfferId] = useState<string | null>(null);
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryPostcode, setDeliveryPostcode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryActionId, setDeliveryActionId] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [res, deliveryRes] = await Promise.allSettled([
        apiClient<MyOffersResponse>('/offers/my'),
        getMyDeliveryRequests(),
      ]);
      if (res.status === 'fulfilled' && res.value?.success) {
        const raw = res.value.data;
        setOffers(Array.isArray(raw) ? raw : []);
      } else if (res.status === 'rejected') {
        setError('Could not load offers. Please try again.');
      }
      if (deliveryRes.status === 'fulfilled') {
        setDeliveryRequests(deliveryRes.value);
      }
    } catch {
      setError('Could not load offers. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────── actions ────────────────

  const handleWithdraw = (offer: Offer) => {
    Alert.alert(
      'Withdraw Offer',
      `Withdraw your offer of ${formatPrice(offer.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(offer.id);
            try {
              await apiClient(`/offers/${offer.id}/withdraw`, { method: 'PATCH' });
              haptics.medium();
              await fetchData();
            } catch (err: any) {
              Alert.alert('Action Failed', err?.message ?? 'Something went wrong.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleCounterRespond = async (
    offer: Offer,
    status: 'ACCEPTED' | 'REJECTED',
  ) => {
    const label = status === 'ACCEPTED' ? 'accept' : 'decline';
    Alert.alert(
      status === 'ACCEPTED' ? 'Accept Counter-Offer' : 'Decline Counter-Offer',
      `Are you sure you want to ${label} the seller's counter of ${formatPrice((offer.sellerCounterAmount ?? offer.counterAmount) ?? 0)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'ACCEPTED' ? 'Accept' : 'Decline',
          style: status === 'ACCEPTED' ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(offer.id);
            try {
              await apiClient(`/offers/${offer.id}/respond-counter`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
              });
              if (status === 'ACCEPTED') {
                haptics.success();
              } else {
                haptics.medium();
              }
              await fetchData();
            } catch (err: any) {
              Alert.alert('Action Failed', err?.message ?? 'Something went wrong.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleCounterBack = async (offer: Offer) => {
    const parsed = parseFloat(counterBackAmount.replace(/[^0-9.]/g, ''));
    const ceiling = (offer.sellerCounterAmount ?? offer.counterAmount) ?? Infinity;

    if (!counterBackAmount.trim() || isNaN(parsed) || parsed <= 0) {
      setCounterBackError('Enter a valid amount.');
      return;
    }
    if (parsed >= ceiling) {
      setCounterBackError(
        `Must be less than the seller's counter of ${formatPrice(ceiling as number)}.`,
      );
      return;
    }

    setCounterBackLoading(true);
    setCounterBackError(null);
    try {
      await apiClient(`/offers/${offer.id}/respond-counter`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COUNTERED', counterAmount: parsed }),
      });
      haptics.medium();
      // Optimistically flip to PENDING — ball is now in the seller's court
      setOffers(prev =>
        prev.map(o =>
          o.id === offer.id
            ? { ...o, status: 'PENDING' as const, buyerCounterAmount: parsed }
            : o,
        ),
      );
      setCounterBackOfferId(null);
      setCounterBackAmount('');
    } catch (err: any) {
      setCounterBackError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setCounterBackLoading(false);
    }
  };

  const openDeliveryForm = (offer: Offer) => {
    setDeliveryFormOfferId(offer.id);
    setDeliveryStreet('');
    setDeliveryCity('');
    setDeliveryPostcode('');
    setDeliveryNotes('');
    setDeliveryError(null);
  };

  const handleSubmitDeliveryRequest = async (offer: Offer) => {
    const listingId = offer.listing?.id ?? offer.listingId;
    if (!listingId) return;
    if (!deliveryStreet.trim() || !deliveryCity.trim() || !deliveryPostcode.trim()) {
      setDeliveryError('Street, city and postcode are required.');
      return;
    }
    setDeliverySubmitting(true);
    setDeliveryError(null);
    try {
      const created = await createDeliveryRequest({
        listingId,
        deliveryAddress: {
          street: deliveryStreet.trim(),
          city: deliveryCity.trim(),
          postcode: deliveryPostcode.trim().toUpperCase(),
        },
        deliveryNotes: deliveryNotes.trim() || undefined,
      });
      haptics.success();
      setDeliveryRequests(prev => [...prev, created]);
      setDeliveryFormOfferId(null);
    } catch (err: any) {
      setDeliveryError(err?.message ?? 'Could not request delivery. Please try again.');
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleCancelDelivery = async (deliveryId: string) => {
    setDeliveryActionId(deliveryId);
    try {
      const updated = await cancelDeliveryRequest(deliveryId);
      haptics.medium();
      setDeliveryRequests(prev => prev.map(r => (r.id === deliveryId ? updated : r)));
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message ?? 'Could not cancel delivery request.');
    } finally {
      setDeliveryActionId(null);
    }
  };

  const handleCompleteDelivery = async (deliveryId: string) => {
    setDeliveryActionId(deliveryId);
    try {
      const updated = await completeDeliveryRequest(deliveryId);
      haptics.success();
      setDeliveryRequests(prev => prev.map(r => (r.id === deliveryId ? updated : r)));
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message ?? 'Could not mark delivery as received.');
    } finally {
      setDeliveryActionId(null);
    }
  };

  const handleMessageSeller = async (offer: Offer) => {
    const participantId = offer.sellerId ?? offer.seller?.id;
    if (!participantId) {
      Alert.alert('Unable to open chat', 'Seller information is not available.');
      return;
    }
    setActionLoading(offer.id);
    try {
      const res = await apiClient<{ success: boolean; data: { id: string } }>(
        '/chat/rooms',
        {
          method: 'POST',
          body: JSON.stringify({
            participantId,
            listingId: offer.listing?.id ?? offer.listingId,
          }),
        }
      );
      if (res?.success && res.data?.id) {
        haptics.success();
        navigation?.navigate('ChatScreen', { threadId: res.data.id });
      }
    } catch (err: any) {
      Alert.alert('Could not open chat', err?.message ?? 'Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─────────────── computed ───────────────

  const counteredPending = offers.filter((o) => o.status === 'COUNTERED').length;

  // ─────────────── render helpers ─────────────────────

  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <View key={`sk-${i}`} style={styles.skeletonCard} />
    ));

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No offers sent yet</Text>
      <Text style={styles.emptySub}>
        Make offers on listings to see them here
      </Text>
      <TouchableOpacity
        style={styles.emptyCtaBtn}
        activeOpacity={0.85}
        onPress={() => navigation?.navigate('Search')}
      >
        <Text style={styles.emptyCtaBtnText}>Browse cars</Text>
      </TouchableOpacity>
    </View>
  );

  // Wrapped in useCallback (though this row still closes over a lot of local
  // counter-back state, so its identity churns whenever that state changes —
  // this is the "at minimum stable when unrelated state is untouched" case,
  // mobile-audit.md P3/P4).
  const renderOfferCard = useCallback(({ item: offer }: { item: Offer }) => {
    const cfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.PENDING;
    const isActioning = actionLoading === offer.id;
    const listingTitle = offer.listing?.title ?? 'Vehicle listing';
    const isCountered = offer.status === 'COUNTERED';
    // Canonical counter amount from the seller (fall back to legacy field for old records)
    const displayedCounter = offer.sellerCounterAmount ?? offer.counterAmount ?? null;
    const counterDiff =
      isCountered && displayedCounter != null
        ? displayedCounter - offer.amount
        : null;
    const counterExpiry = isCountered
      ? formatCounterExpiry(offer.counterExpiresAt)
      : null;
    // Delivery is a listing-level feature, available regardless of offer
    // status (matches web's offers/page.tsx, which shows this row for any
    // offer whose listing has deliveryAvailable set).
    const listingId = offer.listing?.id ?? offer.listingId;
    const deliveryReq = deliveryRequests.find(r => r.listingId === listingId);
    const deliveryLive = !!deliveryReq && deliveryReq.status !== 'DECLINED' && deliveryReq.status !== 'CANCELLED';
    const showDeliveryCTA = offer.listing?.deliveryAvailable && !deliveryLive;

    return (
      <View
        key={offer.id}
        style={[
          styles.offerCard,
          { borderLeftColor: cfg.leftBorder },
          isActioning && { opacity: 0.5 },
        ]}
      >
        {/* Status chip */}
        <View style={styles.cardTopRow}>
          <Text style={styles.listingTitle} numberOfLines={1}>{listingTitle}</Text>
          <View style={[styles.statusChip, { backgroundColor: cfg.chipBg }]}>
            <Text style={[styles.statusChipText, { color: cfg.chipText }]}>
              {cfg.chipLabel}
            </Text>
          </View>
        </View>

        {/* Your offer */}
        <View style={styles.offerAmountSection}>
          <Text style={styles.offerLabel}>YOUR OFFER</Text>
          <Text style={styles.offerAmount}>{formatPrice(offer.amount)}</Text>
        </View>

        {/* Counter-offer section */}
        {isCountered && displayedCounter != null && (
          <View style={styles.counterSection}>
            <View style={styles.counterHeader}>
              <Ionicons name="pricetag-outline" size={13} color={Colors.warning} />
              <Text style={styles.counterLabel}>SELLER'S COUNTER</Text>
            </View>
            <View style={styles.counterAmountRow}>
              <Text style={styles.counterAmount}>{formatPrice(displayedCounter)}</Text>
              {counterDiff != null && (
                <Text
                  style={[
                    styles.counterDiff,
                    { color: counterDiff > 0 ? Colors.accent : Colors.success },
                  ]}
                >
                  {counterDiff > 0 ? `+${formatPrice(counterDiff)}` : formatPrice(counterDiff)}{' '}
                  vs your offer
                </Text>
              )}
            </View>
            {counterExpiry && (
              <Text style={[styles.counterExpiryText, { color: counterExpiry.color }]}>
                {counterExpiry.text}
              </Text>
            )}
          </View>
        )}

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
            viewerRole="BUYER"
          />
        )}

        {/* Time */}
        <Text style={styles.timeText}>{timeAgo(offer.createdAt)}</Text>

        {/* Actions: PENDING — withdraw */}
        {offer.status === 'PENDING' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnWithdraw]}
              activeOpacity={0.75}
              onPress={() => handleWithdraw(offer)}
              disabled={isActioning}
            >
              <Text style={styles.actionBtnWithdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions: ACCEPTED — CarMazium doesn't collect payment for classified-listing
            sales; buyer and seller agree price/delivery directly between themselves
            (confirmed against the web dashboard's identical accepted-offer copy at
            src/app/dashboard/buyer/offers/page.tsx:46-49 — no payment step there
            either, just "Contact the seller to complete the purchase"). There is no
            "Pay Now" step here — only Message Seller. */}
        {offer.status === 'ACCEPTED' && (
          <>
            <Text style={styles.acceptedStatusText}>
              Your offer of {formatPrice(offer.amount)} was accepted! Contact the seller to
              complete the purchase.
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnMessage]}
                activeOpacity={0.75}
                onPress={() => handleMessageSeller(offer)}
                disabled={isActioning}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: Colors.white }]}>
                  Message Seller
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Actions: COUNTERED — decline / accept / counter back */}
        {isCountered && (
          <>
            {/* Primary row: Decline + Accept */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDeclineCounter]}
                activeOpacity={0.75}
                onPress={() => handleCounterRespond(offer, 'REJECTED')}
                disabled={isActioning || counterBackLoading}
              >
                <Text style={[styles.actionBtnText, { color: Colors.accent }]}>
                  Decline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAcceptCounter]}
                activeOpacity={0.75}
                onPress={() => handleCounterRespond(offer, 'ACCEPTED')}
                disabled={isActioning || counterBackLoading}
              >
                <Text style={[styles.actionBtnText, { color: Colors.white }]}>
                  Accept
                </Text>
              </TouchableOpacity>
            </View>

            {/* Counter-back button — visible when expand is closed */}
            {counterBackOfferId !== offer.id && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCounterBack]}
                activeOpacity={0.75}
                onPress={() => {
                  setCounterBackOfferId(offer.id);
                  setCounterBackAmount(String(offer.amount));
                  setCounterBackError(null);
                }}
                disabled={isActioning}
              >
                <Ionicons name="return-down-back-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.actionBtnCounterBackText}>Counter Back</Text>
              </TouchableOpacity>
            )}

            {/* Inline counter-back input — expands inside the card */}
            {counterBackOfferId === offer.id && (
              <View style={styles.counterBackExpand}>
                <Text style={styles.counterBackExpandLabel}>YOUR COUNTER AMOUNT</Text>
                <View style={styles.counterBackRow}>
                  <View style={styles.counterBackInputWrap}>
                    <Text style={styles.counterBackCurrency}>£</Text>
                    <TextInput
                      style={styles.counterBackInput}
                      value={counterBackAmount}
                      onChangeText={v => {
                        setCounterBackAmount(v);
                        setCounterBackError(null);
                      }}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={() => handleCounterBack(offer)}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnAcceptCounter, { paddingHorizontal: 18 }]}
                    onPress={() => handleCounterBack(offer)}
                    disabled={counterBackLoading || isActioning}
                    activeOpacity={0.8}
                  >
                    {counterBackLoading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: Colors.white }]}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {counterBackError && (
                  <Text style={styles.counterBackError}>{counterBackError}</Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setCounterBackOfferId(null);
                    setCounterBackAmount('');
                    setCounterBackError(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.counterBackCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Delivery — inline request/track/cancel, no detour to the listing page */}
        {(deliveryLive || showDeliveryCTA) && (
          <View style={styles.deliverySection}>
            {deliveryLive && deliveryReq ? (
              <View style={styles.deliveryStatusRow}>
                <View style={styles.deliveryStatusLeft}>
                  <Ionicons name="car-outline" size={13} color={Colors.accentGreen} />
                  <Text style={styles.deliveryStatusText}>
                    {deliveryReq.status === 'PENDING' && 'Delivery requested · awaiting seller'}
                    {deliveryReq.status === 'ACCEPTED' && 'Delivery confirmed by seller'}
                    {deliveryReq.status === 'COMPLETED' && 'Delivery received'}
                  </Text>
                </View>
                {deliveryReq.status === 'PENDING' && (
                  <TouchableOpacity
                    onPress={() => handleCancelDelivery(deliveryReq.id)}
                    disabled={deliveryActionId === deliveryReq.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deliveryLinkMuted}>Cancel request</Text>
                  </TouchableOpacity>
                )}
                {deliveryReq.status === 'ACCEPTED' && (
                  <TouchableOpacity
                    onPress={() => handleCompleteDelivery(deliveryReq.id)}
                    disabled={deliveryActionId === deliveryReq.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deliveryLinkSuccess}>Mark as received</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : deliveryFormOfferId !== offer.id ? (
              <TouchableOpacity
                style={styles.deliveryCtaBtn}
                activeOpacity={0.75}
                onPress={() => openDeliveryForm(offer)}
              >
                <Ionicons name="car-outline" size={13} color={Colors.accentGreen} />
                <Text style={styles.deliveryCtaText}>Add delivery request</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.deliveryFormExpand}>
                <Text style={styles.deliveryFormLabel}>DELIVERY ADDRESS</Text>
                <TextInput
                  style={styles.deliveryFormInput}
                  value={deliveryStreet}
                  onChangeText={setDeliveryStreet}
                  placeholder="Street address"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.deliveryFormRow}>
                  <TextInput
                    style={[styles.deliveryFormInput, styles.deliveryFormInputHalf]}
                    value={deliveryCity}
                    onChangeText={setDeliveryCity}
                    placeholder="City"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.deliveryFormInput, styles.deliveryFormInputHalf]}
                    value={deliveryPostcode}
                    onChangeText={v => setDeliveryPostcode(v.toUpperCase())}
                    placeholder="Postcode"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <TextInput
                  style={[styles.deliveryFormInput, styles.deliveryFormNotes]}
                  value={deliveryNotes}
                  onChangeText={setDeliveryNotes}
                  placeholder="Delivery notes (optional)"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                {offer.listing?.deliveryMaxMiles != null && (
                  <Text style={styles.deliveryFormHint}>
                    Seller delivers up to {offer.listing.deliveryMaxMiles} miles — exact cost is confirmed once requested.
                  </Text>
                )}
                {deliveryError && <Text style={styles.counterBackError}>{deliveryError}</Text>}
                <View style={styles.counterBackRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnAcceptCounter, { flex: 1 }]}
                    onPress={() => handleSubmitDeliveryRequest(offer)}
                    disabled={deliverySubmitting}
                    activeOpacity={0.8}
                  >
                    {deliverySubmitting ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: Colors.white }]}>Request Delivery</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDeliveryFormOfferId(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.counterBackCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }, [
    actionLoading,
    counterBackLoading,
    counterBackOfferId,
    counterBackAmount,
    counterBackError,
    handleWithdraw,
    handleMessageSeller,
    handleCounterRespond,
    handleCounterBack,
    deliveryRequests,
    deliveryFormOfferId,
    deliveryStreet,
    deliveryCity,
    deliveryPostcode,
    deliveryNotes,
    deliverySubmitting,
    deliveryError,
    deliveryActionId,
  ]);

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area top spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>My Sent Offers</Text>

        {counteredPending > 0 ? (
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>
              {counteredPending > 99 ? '99+' : counteredPending}
            </Text>
          </View>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* ── Content ── */}
      {loading || (offers.length === 0 && !error) ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {error && !loading && (
            <ErrorBanner message={error} onRetry={() => fetchData()} />
          )}
          {loading ? renderSkeleton() : renderEmptyState()}
        </ScrollView>
      ) : (
        // FlatList so a long offer history virtualizes instead of mounting every
        // card at once (mobile-audit.md P3).
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          data={offers}
          keyExtractor={(item) => item.id}
          renderItem={renderOfferCard}
          ListHeaderComponent={error ? <ErrorBanner message={error} onRetry={() => fetchData()} /> : null}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
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
    paddingHorizontal: 24,
    paddingVertical: 16,
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
  counterBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  counterBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },

  // ── Skeleton ──
  skeletonCard: {
    height: 140,
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
  emptyCtaBtn: {
    marginTop: 8,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.white,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  listingTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    letterSpacing: 0.4,
  },

  // ── Offer amount ──
  offerAmountSection: {
    gap: 2,
  },
  offerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  offerAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },

  // ── Counter section ──
  counterSection: {
    backgroundColor: Colors.warningAlpha06,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  counterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  counterLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.warning,
    letterSpacing: 1,
  },
  counterAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  counterAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.warning,
  },
  counterDiff: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
  },
  counterExpiryText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    // colour applied inline from formatCounterExpiry()
  },

  // ── Time ──
  timeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },

  // ── Actions ──
  acceptedStatusText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.success,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  actionBtnWithdraw: {
    backgroundColor: 'transparent',
    borderColor: Colors.whiteAlpha15,
  },
  actionBtnWithdrawText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },
  actionBtnDeclineCounter: {
    flex: 1,
    backgroundColor: 'transparent',
    borderColor: Colors.accent,
  },
  actionBtnAcceptCounter: {
    flex: 1,
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionBtnMessage: {
    flex: 1,
    backgroundColor: Colors.infoBlue,
    borderColor: Colors.infoBlue,
    flexDirection: 'row',
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    letterSpacing: 0.3,
  },

  // ── Counter-back ghost button ──
  actionBtnCounterBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderColor: Colors.whiteAlpha12,
    alignSelf: 'flex-start',
  },
  actionBtnCounterBackText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ── Inline counter-back expand ──
  counterBackExpand: {
    backgroundColor: Colors.whiteAlpha03,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 2,
  },
  counterBackExpandLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  counterBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterBackInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  counterBackCurrency: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textMuted,
    marginRight: 4,
  },
  counterBackInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  counterBackError: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.error,
  },
  counterBackCancel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    alignSelf: 'flex-start',
  },

  // ── Delivery ──
  deliverySection: {
    marginTop: 2,
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.accentGreenAlpha06,
    borderWidth: 1,
    borderColor: Colors.accentGreenAlpha20,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  deliveryStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  deliveryStatusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size12,
    color: Colors.accentGreen,
    flexShrink: 1,
  },
  deliveryLinkMuted: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  deliveryLinkSuccess: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.accentGreen,
    textDecorationLine: 'underline',
  },
  deliveryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  deliveryCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.accentGreen,
  },
  deliveryFormExpand: {
    backgroundColor: Colors.whiteAlpha03,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  deliveryFormLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  deliveryFormInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    color: Colors.textPrimary,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    paddingHorizontal: 12,
  },
  deliveryFormRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deliveryFormInputHalf: {
    flex: 1,
  },
  deliveryFormNotes: {
    height: 56,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  deliveryFormHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    lineHeight: 14,
  },
});
