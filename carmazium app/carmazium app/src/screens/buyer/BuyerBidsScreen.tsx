import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { haptics } from '../../lib/haptics';

// ─────────────────────────── types ───────────────────────────────

type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

interface Bid {
  id: string;
  amount: number;
  auctionStatus: AuctionStatus;
  auctionId?: string | null;
  isWinner?: boolean;
  winningBidAmount?: number | null;
  paymentDeadline?: string | null;
  bidCount?: number | null;
  listing: { id?: string; title: string; images?: string[] };
  listingId: string;
  createdAt: string;
}

interface BuyerDashResponse {
  success: boolean;
  data: {
    activeBids: number;
    activeOffers: number;
    watchlistCount: number;
    wonAuctions: number;
    bids: Bid[];
    offers: any[];
    history: any[];
  };
}

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
    chipBg: 'rgba(220,31,38,0.15)',
    chipBorder: 'rgba(220,31,38,0.35)',
    chipText: Colors.accent,
    chipLabel: '● LIVE',
  },
  SCHEDULED: {
    borderLeft: '#F59E0B',
    chipBg: 'rgba(245,158,11,0.15)',
    chipBorder: undefined,
    chipText: '#F59E0B',
    chipLabel: 'SCHEDULED',
  },
  ENDED: {
    borderLeft: 'rgba(255,255,255,0.15)',
    chipBg: 'rgba(255,255,255,0.06)',
    chipBorder: undefined,
    chipText: Colors.textMuted,
    chipLabel: 'ENDED',
  },
  CANCELLED: {
    borderLeft: 'rgba(255,255,255,0.08)',
    chipBg: 'rgba(255,255,255,0.04)',
    chipBorder: undefined,
    chipText: Colors.textMuted,
    chipLabel: 'CANCELLED',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerBidsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tappingId, setTappingId] = useState<string | null>(null);

  // ── fetch ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await apiClient<BuyerDashResponse>('/dashboard/buyer');
      if (res.success) setBids(res.data?.bids || []);
    } catch {
      setError('Could not load bids. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  // ── render helpers ─────────────────────────────────────────────

  const renderSkeletons = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <View key={`sk-${i}`} style={styles.skeletonCard} />
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

  const renderBidCard = (bid: Bid) => {
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
        key={bid.id}
        activeOpacity={isNavigable ? 0.75 : 1}
        onPress={isNavigable ? () => handleViewAuction(bid) : undefined}
        disabled={(!isNavigable && !isWon) || isNavigating}
      >
        <View
          style={[
            styles.bidCard,
            { borderLeftColor: isWon ? '#10B981' : cfg.borderLeft },
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
              <View style={[styles.statusChip, { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)' }]}>
                <Text style={[styles.statusChipText, { color: '#10B981' }]}>WON</Text>
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

        {/* Winner CTA — pay buyer fee */}
        {isWon && (
          <TouchableOpacity
            style={styles.wonCtaBtn}
            activeOpacity={0.85}
            onPress={handlePayFee}
          >
            <Ionicons name="lock-closed-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.wonCtaBtnText}>PAY BUYER FEE · £125</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── main render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Gradient backdrop */}
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(59,130,246,0.04)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Safe-area spacer */}
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

        <Text style={styles.headerTitle}>Auction Bids</Text>

        {bids.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {bids.length > 99 ? '99+' : bids.length}
            </Text>
          </View>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      {/* ── Content ── */}
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

        {loading
          ? renderSkeletons()
          : bids.length === 0 && !error
          ? renderEmptyState()
          : bids.map(renderBidCard)}

        <View style={{ height: 110 }} />
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
    color: '#FFFFFF',
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
    gap: 14,
  },

  // ── Skeleton ──
  skeletonCard: {
    height: 76,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 0,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
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
    borderRadius: 10,
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
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 14,
    color: '#FFFFFF',
  },
  bidAmount: {
    fontFamily: FontFamily.mono,
    fontSize: 18,
    color: '#FFFFFF',
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
    fontSize: 9,
    letterSpacing: 0.5,
  },
  viewText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.accent,
  },
  wonCtaBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: -4,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wonCtaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
