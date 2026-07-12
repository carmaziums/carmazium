import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { CounterLedger } from '../../components/offers/CounterLedger';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── interfaces ───────────────────────────

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

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
  sellerId?: string;
  createdAt?: string;
  updatedAt?: string;
  listing?: {
    id?: string;
    title?: string;
    price?: number;
    images?: string[];
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
    // textMuted (not textDisabled) — readable status label, not a disabled
    // control (mobile-ui-ux-audit.md contrast finding).
    leftBorder: Colors.textMuted,
    chipBg: Colors.whiteAlpha04,
    chipText: Colors.textMuted,
    chipLabel: 'WITHDRAWN',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerMyOffersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [res] = await Promise.allSettled([
        apiClient<MyOffersResponse>('/offers/my'),
      ]);
      if (res.status === 'fulfilled' && res.value?.success) {
        const raw = res.value.data;
        setOffers(Array.isArray(raw) ? raw : []);
      }
    } catch {
      // silently fail — show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────── actions ────────────────
  // Wrapped in useCallback (stable deps: fetchData/navigation only) so the
  // hoisted renderOfferCard renderItem below can carry a stable identity
  // instead of recreating on every render (mobile-audit.md P3/P4 pattern).

  // CarMazium doesn't collect payment for classified-listing sales — buyer and
  // seller agree price/delivery directly between themselves (confirmed against
  // the web dashboard's identical accepted-offer copy, which has no payment step
  // either, just "Contact the seller to complete the purchase"). Once an offer
  // is ACCEPTED, the only action here is opening a chat with the seller.
  const handleMessageSeller = useCallback(async (offer: Offer) => {
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
        },
      );
      if (res?.success && res.data?.id) {
        navigation.navigate('ChatScreen', { threadId: res.data.id });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Could not open chat', message);
    } finally {
      setActionLoading(null);
    }
  }, [navigation]);

  const handleWithdraw = useCallback((offer: Offer) => {
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
              await fetchData();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Something went wrong.';
              Alert.alert('Action Failed', message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [fetchData]);

  const handleCounterRespond = useCallback(async (
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
              await fetchData();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Something went wrong.';
              Alert.alert('Action Failed', message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [fetchData]);

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
        Offers your dealership makes on listings will appear here
      </Text>
      <TouchableOpacity
        style={styles.emptyCtaBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.emptyCtaBtnText}>Browse cars</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOfferCard = useCallback(({ item: offer }: { item: Offer }) => {
    const cfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.PENDING;
    const isActioning = actionLoading === offer.id;
    const listingTitle = offer.listing?.title ?? 'Vehicle listing';
    const isCountered = offer.status === 'COUNTERED';
    const displayCounterAmount = offer.sellerCounterAmount ?? offer.counterAmount;
    const counterDiff =
      isCountered && displayCounterAmount != null
        ? displayCounterAmount - offer.amount
        : null;

    return (
      <View
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
        {isCountered && displayCounterAmount != null && (
          <View style={styles.counterSection}>
            <View style={styles.counterHeader}>
              <Ionicons name="pricetag-outline" size={13} color={Colors.warning} />
              <Text style={styles.counterLabel}>SELLER’S COUNTER</Text>
            </View>
            <View style={styles.counterAmountRow}>
              <Text style={styles.counterAmount}>{formatPrice(displayCounterAmount)}</Text>
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

        {/* Actions: ACCEPTED — no in-app payment; contact the seller directly */}
        {offer.status === 'ACCEPTED' && (
          <>
            <Text style={styles.acceptedStatusText}>
              Your offer of {formatPrice(offer.amount)} was accepted! Contact the seller to
              complete the purchase.
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAcceptCounter, { flex: 1 }]}
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

        {/* Actions: COUNTERED — decline / accept counter */}
        {isCountered && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDeclineCounter]}
              activeOpacity={0.75}
              onPress={() => handleCounterRespond(offer, 'REJECTED')}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>
                Decline Counter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAcceptCounter]}
              activeOpacity={0.75}
              onPress={() => handleCounterRespond(offer, 'ACCEPTED')}
              disabled={isActioning}
            >
              <Text style={[styles.actionBtnText, { color: Colors.white }]}>
                Accept Counter
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [actionLoading, handleWithdraw, handleCounterRespond, handleMessageSeller]);

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
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>My Offers</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {counteredPending > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {counteredPending > 99 ? '99+' : counteredPending}
              </Text>
            </View>
          )}
          <HamburgerButton />
        </View>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeleton()}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        // Virtualized — a dealership's sent-offer history can grow large over
        // time, so we only mount rows near the viewport.
        <FlatList
          style={styles.scroll}
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOfferCard}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={[styles.scrollContent, offers.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
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
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    letterSpacing: 0.3,
  },
});
