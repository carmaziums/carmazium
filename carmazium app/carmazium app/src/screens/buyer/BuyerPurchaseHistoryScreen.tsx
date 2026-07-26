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
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { getAccessToken } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── types ───────────────────────────────

type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
type TxType = 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'REFUND' | 'HPI_REPORT' | 'LISTING_FEE' | 'BOOST';

const TX_TYPE_LABEL: Record<TxType, string> = {
  DEPOSIT: 'Deposit',
  FULL_PAYMENT: 'Full Payment',
  COMMISSION: 'Commission',
  REFUND: 'Refund',
  HPI_REPORT: 'HPI Report',
  LISTING_FEE: 'Listing Fee',
  BOOST: 'Featured Boost',
};

interface HistoryItem {
  id: string;
  price: number;
  status: TxStatus;
  type: TxType;
  listing: { title: string; image?: string };
  listingId: string;
  createdAt: string;
}

// Raw shape from GET /transactions/my — same dedicated endpoint web uses
// (getMyTransactions), replacing the non-paginated history[] slice off
// /dashboard/buyer, which had no status field at all (every row silently
// rendered as "COMPLETED" regardless of real payment state). Field names
// match the Transaction Prisma model exactly (backend/prisma/schema.prisma)
// — there is no `currency` column, every amount is implicitly GBP.
interface RawTransaction {
  id: string;
  listingId: string;
  amount: number | string;
  status: TxStatus;
  type: TxType;
  createdAt: string;
  listing?: { id: string; title: string; images?: string[] };
}

interface TransactionsResponse {
  success: boolean;
  data: RawTransaction[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

// Web's history table colours PENDING/FAILED/REFUNDED distinctly from
// COMPLETED (dashboard/buyer/history/page.tsx) — mobile used to render
// every row as a hardcoded "COMPLETED" chip regardless of real status.
const STATUS_CFG: Record<TxStatus, {
  icon: string; color: string; iconBg: string; iconBorder: string; chipBg: string; verb: string;
}> = {
  COMPLETED: {
    icon: 'checkmark-circle',
    color: Colors.success,
    iconBg: Colors.successAlpha10,
    iconBorder: Colors.successAlpha20,
    chipBg: Colors.successAlpha10,
    verb: 'Purchased',
  },
  PENDING: {
    icon: 'time-outline',
    color: Colors.warning,
    iconBg: Colors.warningAlpha10,
    iconBorder: Colors.warningAlpha20,
    chipBg: Colors.warningAlpha10,
    verb: 'Started',
  },
  FAILED: {
    icon: 'close-circle-outline',
    color: Colors.error,
    iconBg: Colors.errorAlpha10,
    iconBorder: Colors.errorAlpha20,
    chipBg: Colors.errorAlpha10,
    verb: 'Attempted',
  },
  REFUNDED: {
    icon: 'return-up-back-outline',
    color: Colors.infoBlue,
    iconBg: Colors.infoBlueAlpha10,
    iconBorder: Colors.infoBlueAlpha20,
    chipBg: Colors.infoBlueAlpha10,
    verb: 'Refunded',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerPurchaseHistoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tappingId, setTappingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── pagination ────────────────────────────────────────────────
  const PAGE_LIMIT = 20;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Total Spent only counts money actually taken — a PENDING or FAILED
  // transaction hasn't been paid yet and shouldn't inflate this figure.
  const completedItems = history.filter((h) => h.status === 'COMPLETED');
  const totalSpent = completedItems.reduce((sum, h) => sum + h.price, 0);

  const mapRow = (tx: RawTransaction): HistoryItem => ({
    id: tx.id,
    price: Number(tx.amount),
    status: tx.status,
    type: tx.type,
    listing: { title: tx.listing?.title ?? 'Vehicle', image: tx.listing?.images?.[0] },
    listingId: tx.listingId,
    createdAt: tx.createdAt,
  });

  // ── fetch ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient<TransactionsResponse>(`/transactions/my?page=1&limit=${PAGE_LIMIT}`);
      if (res.success) {
        setHistory((res.data || []).map(mapRow));
        setPage(1);
        setTotalPages(res.pagination?.totalPages ?? 1);
      }
    } catch {
      setError('Could not load purchase history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await apiClient<TransactionsResponse>(`/transactions/my?page=${nextPage}&limit=${PAGE_LIMIT}`);
      if (res.success) {
        setHistory((prev) => [...prev, ...(res.data || []).map(mapRow)]);
        setPage(nextPage);
        setTotalPages(res.pagination?.totalPages ?? nextPage);
      }
    } catch {
      // Non-fatal — the user can retap "Load more" to retry.
    } finally {
      setLoadingMore(false);
    }
  }, [page, totalPages, loadingMore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── receipt download ──────────────────────────────────────────
  // Must NOT use Linking.openURL() — it hands off to the OS browser as a
  // fresh anonymous request with no Bearer token attached, so the
  // authenticated PDF endpoint 401s (the exact bug the web app hit first).
  // FileSystem.downloadAsync lets us attach the header directly.
  const handleDownloadReceipt = async (item: HistoryItem) => {
    setDownloadingId(item.id);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in.');
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
      const fileUri = `${FileSystem.cacheDirectory}carmazium-receipt-${item.id.slice(0, 8)}.pdf`;
      const result = await FileSystem.downloadAsync(
        `${API_URL}/transactions/${item.id}/receipt.pdf`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (result.status !== 200) throw new Error(`Download failed (${result.status})`);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Downloaded', `Receipt saved to: ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message ?? 'Could not download the receipt. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── navigate to vehicle ──────────────────────────────────────
  const handleViewVehicle = async (item: HistoryItem) => {
    setTappingId(item.id);
    try {
      const listing = await getListingById(item.listingId);
      if (listing) {
        navigation?.navigate('VehicleDetail', { listing });
      } else {
        Alert.alert('Not available', 'This vehicle listing is no longer accessible.');
      }
    } catch {
      Alert.alert('Error', 'Could not load vehicle details.');
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
      <Ionicons name="receipt-outline" size={36} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No purchases yet</Text>
      <Text style={styles.emptySub}>Completed vehicle purchases will appear here</Text>
    </View>
  );

  const renderTotalsBar = () => (
    <View style={styles.totalsCard}>
      {/* Total Spent */}
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>TOTAL SPENT</Text>
        <Text style={styles.totalValue}>
          £{totalSpent.toLocaleString('en-GB')}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.totalDivider} />

      {/* Vehicles Purchased */}
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>VEHICLES PURCHASED</Text>
        <Text style={styles.totalValue}>{completedItems.length}</Text>
      </View>
    </View>
  );

  const renderHistoryCard = (item: HistoryItem) => {
    const isNavigating = tappingId === item.id;
    const isDownloading = downloadingId === item.id;
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.COMPLETED;

    return (
      <View key={item.id} style={[styles.historyCard, isNavigating && { opacity: 0.6 }]}>
        <TouchableOpacity
          style={styles.historyTopRow}
          activeOpacity={0.75}
          onPress={() => handleViewVehicle(item)}
          disabled={isNavigating}
        >
          {/* Left: thumbnail or status icon */}
          {item.listing.image ? (
            <Image source={{ uri: item.listing.image }} style={styles.thumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: cfg.iconBg, borderColor: cfg.iconBorder }]}>
              {isNavigating ? (
                <ActivityIndicator size="small" color={cfg.color} />
              ) : (
                <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
              )}
            </View>
          )}

          {/* Center text */}
          <View style={styles.historyCenter}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.listing?.title ?? 'Vehicle'}
            </Text>
            <Text style={styles.historyDate}>
              {TX_TYPE_LABEL[item.type] ?? item.type} · {formatDate(item.createdAt)}
            </Text>
          </View>

          {/* Right price + chip */}
          <View style={styles.historyRight}>
            <Text style={styles.historyPrice}>
              £{item.price.toLocaleString('en-GB')}
            </Text>
            <View style={[styles.completedChip, { backgroundColor: cfg.chipBg }]}>
              <Text style={[styles.completedChipText, { color: cfg.color }]}>{item.status}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Download Receipt */}
        <TouchableOpacity
          style={[styles.receiptBtn, isDownloading && { opacity: 0.6 }]}
          activeOpacity={0.75}
          onPress={() => handleDownloadReceipt(item)}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <Ionicons name="download-outline" size={14} color={Colors.textSecondary} />
          )}
          <Text style={styles.receiptBtnText}>
            {isDownloading ? 'Preparing receipt…' : 'Download Receipt'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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

        <Text style={styles.headerTitle}>Purchase History</Text>

        {history.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {history.length > 99 ? '99+' : history.length}
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

        {/* Totals bar — only when there's data */}
        {!loading && history.length > 0 && renderTotalsBar()}

        {loading
          ? renderSkeletons()
          : history.length === 0 && !error
          ? renderEmptyState()
          : history.map(renderHistoryCard)}

        {!loading && page < totalPages && (
          <TouchableOpacity
            style={[styles.loadMoreBtn, loadingMore && { opacity: 0.6 }]}
            activeOpacity={0.75}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Text style={styles.loadMoreBtnText}>Load more</Text>
            )}
          </TouchableOpacity>
        )}

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
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    backgroundColor: Colors.success,
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
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },

  // ── Totals bar ──
  totalsCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalCol: {
    flex: 1,
    gap: 4,
  },
  totalDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.whiteAlpha08,
    marginHorizontal: 16,
  },
  totalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.white,
  },

  // ── Skeleton ──
  skeletonCard: {
    height: 76,
    borderRadius: 14,
    backgroundColor: Colors.whiteAlpha04,
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

  // ── History card ──
  historyCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Thumbnail / icon circle
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgTertiary,
    flexShrink: 0,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.successAlpha10,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  receiptBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
  },

  // Center
  historyCenter: {
    flex: 1,
  },
  historyTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  historyDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Right
  historyRight: {
    alignItems: 'flex-end',
  },
  historyPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  completedChip: {
    backgroundColor: Colors.successAlpha10,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  completedChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.success,
  },

  // ── Load more ──
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  loadMoreBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
