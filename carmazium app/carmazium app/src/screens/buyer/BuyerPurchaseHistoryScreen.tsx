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
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

import { IconButton } from '../../components/IconButton';
// ─────────────────────────── types ───────────────────────────────

type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

interface HistoryItem {
  id: string;
  price: number;
  status: TxStatus;
  listing: { title: string };
  listingId: string;
  createdAt: string;
}

// Raw shape from GET /transactions/my — same dedicated endpoint web uses
// (getMyTransactions), replacing the non-paginated history[] slice off
// /dashboard/buyer, which had no status field at all (every row silently
// rendered as "COMPLETED" regardless of real payment state).
interface RawTransaction {
  id: string;
  listingId: string;
  amount: number | string;
  status: TxStatus;
  createdAt: string;
  listing?: { id: string; title: string };
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

  // Total Spent only counts money actually taken — a PENDING or FAILED
  // transaction hasn't been paid yet and shouldn't inflate this figure.
  const completedItems = history.filter((h) => h.status === 'COMPLETED');
  const totalSpent = completedItems.reduce((sum, h) => sum + h.price, 0);

  // ── fetch ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await apiClient<TransactionsResponse>('/transactions/my?page=1&limit=20');
      if (res.success) {
        setHistory(
          (res.data || []).map((tx) => ({
            id: tx.id,
            price: Number(tx.amount),
            status: tx.status,
            listing: { title: tx.listing?.title ?? 'Vehicle' },
            listingId: tx.listingId,
            createdAt: tx.createdAt,
          })),
        );
      }
    } catch {
      setError('Could not load purchase history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.COMPLETED;

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.75}
        onPress={() => handleViewVehicle(item)}
        disabled={isNavigating}
      >
        <View style={[styles.historyCard, isNavigating && { opacity: 0.6 }]}>
          {/* Left icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: cfg.iconBg, borderColor: cfg.iconBorder }]}>
            {isNavigating ? (
              <ActivityIndicator size="small" color={cfg.color} />
            ) : (
              <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
            )}
          </View>

          {/* Center text */}
          <View style={styles.historyCenter}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.listing?.title ?? 'Vehicle'}
            </Text>
            <Text style={styles.historyDate}>
              {cfg.verb} {formatDate(item.createdAt)}
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
        </View>
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Icon circle
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
});
