import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Skeleton } from '../../components/ui/Skeleton';
import { haptics } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── types ───────────────────────────────

type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

// Raw shape from GET /bids/my — matches web's identical Bid type (listingApi.ts).
// Richer per-bid derived fields (isWinner, paymentDeadline, ...) that
// /dashboard/buyer used to compute server-side are now derived client-side
// below, since this dedicated, paginated endpoint carries the same
// auction sub-object those were always computed from.
interface RawBid {
  id: string;
  listingId: string;
  amount: number | string;
  isWinning: boolean;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    images?: string[];
    sellerId?: string | null;
    auction?: {
      id: string;
      status: AuctionStatus;
      endTime: string;
      winnerId: string | null;
      winningBidAmount: number | string | null;
    } | null;
  };
}

interface Bid {
  id: string;
  amount: number;
  auctionStatus: AuctionStatus;
  auctionId?: string | null;
  isWinning?: boolean;
  isWinner?: boolean;
  winningBidAmount?: number | null;
  paymentDeadline?: string | null;
  bidCount?: number | null;
  listing: { id?: string; title: string; images?: string[]; sellerId?: string | null };
  listingId: string;
  createdAt: string;
}

interface BidsResponse {
  success: boolean;
  data: RawBid[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

const PAGE_SIZE = 10;
const BID_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Web's /dashboard/buyer/bids page never had a cancel action at all — the
// backend's PATCH /bids/:id/cancel (24h window, no "must be highest
// bidder" restriction) was reachable only from the live auction screen.
const isCancelable = (bid: Bid) =>
  bid.auctionStatus === 'ACTIVE' && (Date.now() - new Date(bid.createdAt).getTime()) < BID_CANCEL_WINDOW_MS;

function formatCancelWindowRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// Same transform dashboard.service.ts used to apply server-side — kept
// client-side now that mobile reads the dedicated, paginated /bids/my
// endpoint directly instead of the dashboard's non-paginated bids slice.
const mapRawBid = (b: RawBid, currentUserId?: string): Bid => {
  const auction = b.listing.auction;
  return {
    id: b.id,
    amount: Number(b.amount),
    auctionStatus: auction?.status ?? 'ENDED',
    auctionId: auction?.id ?? null,
    isWinning: b.isWinning,
    isWinner: !!auction?.winnerId && auction.winnerId === currentUserId,
    winningBidAmount: auction?.winningBidAmount != null ? Number(auction.winningBidAmount) : null,
    paymentDeadline: auction?.endTime
      ? new Date(new Date(auction.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null,
    bidCount: null,
    listing: {
      id: b.listing.id,
      title: b.listing.title,
      images: b.listing.images,
      sellerId: b.listing.sellerId,
    },
    listingId: b.listingId,
    createdAt: b.createdAt,
  };
};

// ─────────────────────────── helpers ──────────────────────────────

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
};

// ─────────────────── status config ────────────────────────────────

interface StatusCfg {
  borderLeft: string;
  chipBg: string;
  chipBorder: string | undefined;
  chipText: string;
  chipLabel: string;
}

const STATUS_CFG: Record<AuctionStatus, StatusCfg> = {
  ACTIVE: {
    borderLeft: Colors.accent,
    chipBg: Colors.accentAlpha15,
    chipBorder: Colors.accentAlpha30,
    chipText: Colors.accent,
    chipLabel: '● LIVE',
  },
  SCHEDULED: {
    borderLeft: Colors.warning,
    chipBg: Colors.warningAlpha15,
    chipBorder: undefined,
    chipText: Colors.warning,
    chipLabel: 'SCHEDULED',
  },
  ENDED: {
    borderLeft: Colors.whiteAlpha15,
    chipBg: Colors.whiteAlpha06,
    chipBorder: undefined,
    chipText: Colors.textMuted,
    chipLabel: 'ENDED',
  },
  CANCELLED: {
    borderLeft: Colors.whiteAlpha08,
    chipBg: Colors.whiteAlpha04,
    chipBorder: undefined,
    chipText: Colors.textMuted,
    chipLabel: 'CANCELLED',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerBidsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tappingId, setTappingId] = useState<string | null>(null);
  const [connectingChatId, setConnectingChatId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ── fetch ──────────────────────────────────────────────────────
  // Dedicated, paginated /bids/my (same endpoint web uses) instead of the
  // non-paginated bids slice off /dashboard/buyer.
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await apiClient<BidsResponse>(`/bids/my?page=${page}&limit=${PAGE_SIZE}`);
      if (res.success) {
        setBids((res.data || []).map((b) => mapRawBid(b, currentUserId)));
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      }
    } catch {
      setError('Could not load bids. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, currentUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── navigate to auction ──────────────────────────────────────
  const handleViewAuction = async (bid: Bid) => {
    setTappingId(bid.id);
    try {
      const listing = await getListingById(bid.listingId);
      if (listing) {
        navigation?.navigate('LiveAuctionDetailed', { listing });
      } else {
        Alert.alert('Not available', 'This auction is no longer accessible.');
      }
    } catch {
      Alert.alert('Error', 'Could not load auction details.');
    } finally {
      setTappingId(null);
    }
  };

  // ── chat with seller (won auctions) ──────────────────────────
  const handleChatWithSeller = async (bid: Bid) => {
    const sellerId = bid.listing?.sellerId;
    if (!sellerId) {
      Alert.alert('Unable to open chat', 'Seller information is not available.');
      return;
    }
    setConnectingChatId(bid.id);
    try {
      const res = await apiClient<{ success: boolean; data: { id: string } }>(
        '/chat/rooms',
        {
          method: 'POST',
          body: JSON.stringify({ participantId: sellerId, listingId: bid.listing?.id ?? bid.listingId }),
        },
      );
      if (res?.success && res.data?.id) {
        navigation?.navigate('ChatScreen', { threadId: res.data.id });
      }
    } catch (err: any) {
      Alert.alert('Could not open chat', err?.message ?? 'Please try again.');
    } finally {
      setConnectingChatId(null);
    }
  };

  // ── cancel bid ────────────────────────────────────────────────
  const handleCancelBid = (bid: Bid) => {
    Alert.alert(
      'Cancel your bid?',
      'Your bid will be removed. The auction continues with the previous highest bid.',
      [
        { text: 'Keep Bid', style: 'cancel' },
        {
          text: 'Cancel Bid',
          style: 'destructive',
          onPress: async () => {
            setCancelingId(bid.id);
            try {
              await apiClient(`/bids/${bid.id}/cancel`, { method: 'PATCH' });
              haptics.light();
              setBids((prev) => prev.filter((b) => b.id !== bid.id));
              setTotalCount((prev) => Math.max(0, prev - 1));
            } catch (err: any) {
              Alert.alert('Failed', err?.message ?? 'Could not cancel bid. Please try again.');
            } finally {
              setCancelingId(null);
            }
          },
        },
      ],
    );
  };

  // ── render helpers ─────────────────────────────────────────────

  const renderSkeletons = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={`sk-${i}`} w={SCREEN_WIDTH - 48} h={76} r={14} />
    ));

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="gavel" size={40} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No auction bids yet</Text>
      <Text style={styles.emptySub}>Browse live auctions to start bidding</Text>
      <TouchableOpacity
        style={styles.emptyCtaBtn}
        activeOpacity={0.85}
        onPress={() => navigation?.navigate('Tabs', { screen: 'Live' })}
      >
        <Text style={styles.emptyCtaBtnText}>VIEW LIVE AUCTIONS</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBidCard = useCallback(({ item: bid }: { item: Bid }) => {
    const cfg = STATUS_CFG[bid.auctionStatus] ?? STATUS_CFG.ENDED;
    const isNavigable = bid.auctionStatus === 'ACTIVE' || bid.auctionStatus === 'SCHEDULED';
    const isNavigating = tappingId === bid.id;
    const isWon = bid.auctionStatus === 'ENDED' && bid.isWinner;

    const handlePayFee = () => {
      haptics.success();
      navigation?.navigate('AuctionComplete', {
        listingId: bid.listing?.id ?? bid.listingId,
        auctionId: bid.auctionId ?? '',
        hammerPrice: bid.winningBidAmount ?? bid.amount,
        buyerFee: 125,
        bidCount: bid.bidCount ?? undefined,
        listingTitle: bid.listing?.title ?? 'Vehicle',
        listingImage: bid.listing?.images?.[0],
        paymentDeadline: bid.paymentDeadline ?? undefined,
      });
    };

    return (
      <TouchableOpacity
        activeOpacity={isNavigable ? 0.75 : 1}
        onPress={isNavigable ? () => handleViewAuction(bid) : undefined}
        disabled={(!isNavigable && !isWon) || isNavigating}
      >
        <View
          style={[
            styles.bidCard,
            { borderLeftColor: isWon ? Colors.accentGreen : cfg.borderLeft },
            isNavigating && { opacity: 0.6 },
          ]}
        >
          {/* Left section */}
          <View style={styles.bidLeft}>
            <Text style={styles.bidTitle} numberOfLines={1}>
              {bid.listing?.title ?? 'Vehicle'}
            </Text>
            <Text style={styles.bidAmount}>
              £{bid.amount.toLocaleString('en-GB')}
            </Text>
            <Text style={styles.bidTime}>{timeAgo(bid.createdAt)}</Text>
          </View>

          {/* Right section */}
          <View style={styles.bidRight}>
            {/* Status chip — or WON chip */}
            {isWon ? (
              <View style={[styles.statusChip, { backgroundColor: Colors.accentGreenAlpha15, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)' }]}>
                <Text style={[styles.statusChipText, { color: Colors.accentGreen }]}>WON</Text>
              </View>
            ) : bid.auctionStatus === 'ACTIVE' ? (
              // Web's dashboard/buyer/bids/page.tsx distinguishes Winning vs
              // Outbid on every active bid — mobile fetched bid.isWinning from
              // /bids/my but never rendered it, showing a generic "LIVE" chip
              // that couldn't tell a buyer whether they'd just been outbid.
              <View style={[styles.statusChip, bid.isWinning
                ? { backgroundColor: Colors.accentGreenAlpha15, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)' }
                : { backgroundColor: Colors.warningAlpha15, borderWidth: 1, borderColor: Colors.warningAlpha25 }]}
              >
                <Text style={[styles.statusChipText, { color: bid.isWinning ? Colors.accentGreen : Colors.warning }]}>
                  {bid.isWinning ? '● WINNING' : 'OUTBID'}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: cfg.chipBg,
                    borderWidth: cfg.chipBorder ? 1 : 0,
                    borderColor: cfg.chipBorder ?? 'transparent',
                  },
                ]}
              >
                <Text style={[styles.statusChipText, { color: cfg.chipText }]}>
                  {cfg.chipLabel}
                </Text>
              </View>
            )}

            {/* View button or loading */}
            {isNavigable && (
              isNavigating ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.viewText}>View</Text>
              )
            )}
          </View>
        </View>

        {/* Winner CTAs — pay buyer fee, and chat with the seller (matches
            web's bids page "Chat with Seller" action on a won row) */}
        {isWon && (
          <View style={styles.wonCtaRow}>
            <TouchableOpacity
              style={[styles.wonCtaBtn, { flex: 1 }]}
              activeOpacity={0.85}
              onPress={handlePayFee}
            >
              <Ionicons name="lock-closed-outline" size={14} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.wonCtaBtnText}>PAY BUYER FEE · £125</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.wonChatBtn}
              activeOpacity={0.85}
              onPress={() => handleChatWithSeller(bid)}
              disabled={connectingChatId === bid.id}
            >
              {connectingChatId === bid.id ? (
                <ActivityIndicator size="small" color={Colors.accentGreen} />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.accentGreen} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel bid — 24h window, any own bid on a still-ACTIVE auction
            regardless of current ranking (matches the live auction screen). */}
        {isCancelable(bid) && (
          <View style={styles.cancelRow}>
            <Text style={styles.cancelRowHint}>
              {formatCancelWindowRemaining(BID_CANCEL_WINDOW_MS - (Date.now() - new Date(bid.createdAt).getTime()))} left to cancel
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.85}
              onPress={() => handleCancelBid(bid)}
              disabled={cancelingId === bid.id}
            >
              {cancelingId === bid.id ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.cancelBtnText}>CANCEL BID</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [tappingId, handleViewAuction, connectingChatId, handleChatWithSeller, cancelingId]);

  // ── main render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Gradient backdrop */}
      <LinearGradient
        colors={[Colors.accentAlpha04, Colors.infoBlueAlpha04, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area spacer */}
      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>Auction Bids</Text>

        {totalCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {totalCount > 99 ? '99+' : totalCount}
            </Text>
          </View>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      {/* ── Content ── */}
      {loading || (bids.length === 0 && !error) ? (
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
          {loading ? renderSkeletons() : renderEmptyState()}
        </ScrollView>
      ) : (
        // FlatList so a long bid history virtualizes instead of mounting every
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
          data={bids}
          keyExtractor={(item) => item.id}
          renderItem={renderBidCard}
          ListHeaderComponent={error ? <ErrorBanner message={error} onRetry={() => fetchData()} /> : null}
          ListFooterComponent={
            <>
              {totalPages > 1 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.pageBtnText}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageIndicator}>Page {page} of {totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.pageBtnText}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ height: 110 }} />
            </>
          }
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
    color: Colors.white,
  },
  headerPlaceholder: {
    width: 38,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
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
    gap: 14,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 0,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size17,
    color: Colors.white,
    marginTop: 12,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  emptyCtaBtn: {
    marginTop: 16,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 0.6,
  },

  // ── Bid card ──
  bidCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderLeftWidth: 3,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Left
  bidLeft: {
    flex: 1,
  },
  bidTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  bidAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.lg,
    color: Colors.white,
    marginTop: 3,
  },
  bidTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // Right
  bidRight: {
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
  viewText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  wonCtaRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: -4,
  },
  wonCtaBtn: {
    backgroundColor: Colors.accentGreen,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wonCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 0.8,
  },
  wonChatBtn: {
    width: 44,
    borderRadius: 8,
    backgroundColor: Colors.accentGreenAlpha15,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Cancel bid ──
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: -4,
  },
  cancelRowHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  cancelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accent,
    letterSpacing: 0.5,
  },

  // ── Pagination ──
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 16,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  pageIndicator: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
