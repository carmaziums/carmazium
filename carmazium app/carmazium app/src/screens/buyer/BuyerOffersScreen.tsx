import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

// ─────────────────────────── interfaces ───────────────────────────

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

interface Offer {
  id: string;
  amount: number;
  status: OfferStatus;
  counterAmount?: number | null;
  listingId?: string;
  createdAt?: string;
  listing?: {
    id?: string;
    title?: string;
    price?: number;
    images?: string[];
  };
  seller?: {
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
    leftBorder: '#F59E0B',
    chipBg: 'rgba(245,158,11,0.15)',
    chipText: '#F59E0B',
    chipLabel: 'PENDING',
  },
  COUNTERED: {
    leftBorder: Colors.accent,
    chipBg: 'rgba(220,31,38,0.12)',
    chipText: Colors.accent,
    chipLabel: 'COUNTER-OFFER',
  },
  ACCEPTED: {
    leftBorder: '#22C55E',
    chipBg: 'rgba(34,197,94,0.15)',
    chipText: '#22C55E',
    chipLabel: 'ACCEPTED',
  },
  REJECTED: {
    leftBorder: '#5C5C6B',
    chipBg: 'rgba(255,255,255,0.06)',
    chipText: '#5C5C6B',
    chipLabel: 'REJECTED',
  },
  WITHDRAWN: {
    leftBorder: '#3A3A47',
    chipBg: 'rgba(255,255,255,0.04)',
    chipText: '#3A3A47',
    chipLabel: 'WITHDRAWN',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerOffersScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

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
      `Are you sure you want to ${label} the seller's counter of ${formatPrice(offer.counterAmount ?? 0)}?`,
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
                // Navigate directly to payment flow — the agreed price is the counter amount
                navigateToPurchase(offer, offer.counterAmount ?? offer.amount);
              } else {
                await fetchData();
              }
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

  const navigateToPurchase = (offer: Offer, agreedAmount: number) => {
    const sellerName =
      offer.seller?.dealerProfile?.companyName ??
      ([offer.seller?.firstName, offer.seller?.lastName].filter(Boolean).join(' ') || undefined);
    navigation?.navigate('PurchaseFlow', {
      listingId: offer.listing?.id ?? offer.listingId ?? '',
      salePrice: agreedAmount,
      buyerFee: 95,
      listingTitle: offer.listing?.title ?? 'Vehicle',
      listingImage: offer.listing?.images?.[0],
      sellerName,
      paymentType: 'FULL_PAYMENT',
    });
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

  const renderOfferCard = (offer: Offer) => {
    const cfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.PENDING;
    const isActioning = actionLoading === offer.id;
    const listingTitle = offer.listing?.title ?? 'Vehicle listing';
    const isCountered = offer.status === 'COUNTERED';
    const counterDiff =
      isCountered && offer.counterAmount != null
        ? offer.counterAmount - offer.amount
        : null;

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
        {isCountered && offer.counterAmount != null && (
          <View style={styles.counterSection}>
            <View style={styles.counterHeader}>
              <Ionicons name="pricetag-outline" size={13} color={Colors.warning} />
              <Text style={styles.counterLabel}>SELLER'S COUNTER</Text>
            </View>
            <View style={styles.counterAmountRow}>
              <Text style={styles.counterAmount}>{formatPrice(offer.counterAmount)}</Text>
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

        {/* Actions: ACCEPTED — complete purchase */}
        {offer.status === 'ACCEPTED' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAcceptCounter, { flex: 1 }]}
              activeOpacity={0.75}
              onPress={() => navigateToPurchase(offer, offer.amount)}
            >
              <Ionicons name="lock-closed-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                Complete Purchase
              </Text>
            </TouchableOpacity>
          </View>
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
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                Accept Counter
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.06)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area top spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.75}
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading
          ? renderSkeleton()
          : offers.length === 0
          ? renderEmptyState()
          : offers.map(renderOfferCard)}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
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
    fontSize: 11,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
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
    color: '#FFFFFF',
  },

  // ── Offer card ──
  offerCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 15,
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
    fontSize: 9,
    letterSpacing: 0.4,
  },

  // ── Offer amount ──
  offerAmountSection: {
    gap: 2,
  },
  offerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  offerAmount: {
    fontFamily: FontFamily.mono,
    fontSize: 20,
    color: Colors.textPrimary,
  },

  // ── Counter section ──
  counterSection: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.20)',
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
    fontSize: 9,
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
    fontSize: 16,
    color: Colors.warning,
  },
  counterDiff: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },

  // ── Time ──
  timeText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },

  // ── Actions ──
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnWithdrawText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
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
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
