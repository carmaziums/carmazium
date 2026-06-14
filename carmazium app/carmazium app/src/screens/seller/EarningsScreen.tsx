import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
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
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

// ─────────────────────────── interfaces ───────────────────────────

interface SaleRecord {
  id: string;
  listing?: {
    title?: string;
    vrm?: string;
  };
  buyer?: {
    firstName?: string;
    lastName?: string;
  } | null;
  soldPrice: number;
  createdAt?: string;
}

interface EarningsResponse {
  success: boolean;
  data: {
    sales: SaleRecord[];
    totalRevenue: number;
    totalSales: number;
  };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatPrice = (amount: number): string =>
  `£${amount.toLocaleString('en-GB')}`;

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getBuyerName = (buyer?: SaleRecord['buyer']): string => {
  if (!buyer) return 'Private buyer';
  const parts = [buyer.firstName, buyer.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Private buyer';
};

const NET_RATE = 0.975; // 2.5% platform fee

// ═══════════════════════════ COMPONENT ════════════════════════════

export const EarningsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [res] = await Promise.allSettled([
        apiClient<EarningsResponse>('/listings/earnings'),
      ]);
      if (res.status === 'fulfilled' && res.value?.success) {
        const d = res.value.data;
        setSales(Array.isArray(d?.sales) ? d.sales : []);
        setTotalRevenue(d?.totalRevenue ?? 0);
        setTotalSales(d?.totalSales ?? 0);
      }
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────── render helpers ─────────────────────

  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <View key={`sk-${i}`} style={styles.skeletonRowWrap}>
        <Skeleton w={36} h={36} r={18} />
        <View style={styles.skeletonRowContent}>
          <Skeleton w={140} h={14} r={6} />
          <Skeleton w={80} h={12} r={5} />
          <Skeleton w={60} h={10} r={5} />
        </View>
        <View style={styles.skeletonRowRight}>
          <Skeleton w={70} h={16} r={6} />
          <Skeleton w={50} h={10} r={5} />
        </View>
      </View>
    ));

  const renderEmptyState = () => (
    <EmptyState
      icon="cash-outline"
      title="No earnings yet"
      subtitle="Your completed sales and payouts will show here."
    />
  );

  const renderSaleRow = (sale: SaleRecord) => {
    const net = Math.round(sale.soldPrice * NET_RATE);
    const title = sale.listing?.title ?? 'Vehicle';
    const buyerName = getBuyerName(sale.buyer);

    return (
      <View key={sale.id} style={styles.saleRow}>
        {/* Trophy icon circle */}
        <View style={styles.trophyCircle}>
          <Ionicons name="ribbon" size={18} color={Colors.success} />
        </View>

        {/* Details */}
        <View style={styles.saleDetails}>
          <Text style={styles.saleTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.saleBuyer} numberOfLines={1}>{buyerName}</Text>
          <Text style={styles.saleDate}>{formatDate(sale.createdAt)}</Text>
        </View>

        {/* Revenue */}
        <View style={styles.saleRevenue}>
          <Text style={styles.soldPrice}>{formatPrice(sale.soldPrice)}</Text>
          <Text style={styles.netAmount}>{formatPrice(net)} net</Text>
          <Text style={styles.feeLabel}>2.5% fee</Text>
        </View>
      </View>
    );
  };

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(34,197,94,0.05)', 'rgba(10,10,12,0)', '#0A0A0C']}
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

        <Text style={styles.headerTitle}>Earnings</Text>

        {/* Spacer to center the title */}
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary card ── */}
        <View style={styles.summaryCard}>
          {/* Left: total revenue */}
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>TOTAL REVENUE</Text>
            {loading ? (
              <View style={styles.skeletonRevenue} />
            ) : (
              <Text style={styles.summaryRevenue}>
                {formatPrice(totalRevenue)}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={styles.summaryDivider} />

          {/* Right: total sales */}
          <View style={[styles.summaryCol, styles.summaryColRight]}>
            <Text style={styles.summaryLabel}>TOTAL SALES</Text>
            {loading ? (
              <View style={styles.skeletonSalesCount} />
            ) : (
              <Text style={styles.summarySalesCount}>{totalSales}</Text>
            )}
          </View>
        </View>

        {/* ── Sale history ── */}
        <View style={styles.historySection}>
          <Text style={styles.sectionHeader}>SALE HISTORY</Text>

          {loading ? (
            renderSkeleton()
          ) : sales.length === 0 ? (
            renderEmptyState()
          ) : (
            sales.map(renderSaleRow)
          )}
        </View>

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
    paddingHorizontal: 20,
    paddingVertical: 12,
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

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 20,
    paddingBottom: 20,
  },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: 'rgba(20,26,42,0.70)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    gap: 4,
  },
  summaryColRight: {
    alignItems: 'flex-end',
  },
  summaryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryRevenue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize['4xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  summarySalesCount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
  },
  summaryDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  skeletonRevenue: {
    width: 120,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonSalesCount: {
    width: 48,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ── History section ──
  historySection: {
    gap: 10,
  },
  sectionHeader: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  // ── Skeleton rows ──
  skeletonRow: {
    height: 76,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  skeletonRowWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 14,
  },
  skeletonRowContent: {
    flex: 1,
    gap: 6,
  },
  skeletonRowRight: {
    alignItems: 'flex-end' as const,
    gap: 6,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
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

  // ── Sale row ──
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 12,
  },
  trophyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  saleDetails: {
    flex: 1,
    gap: 2,
  },
  saleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saleBuyer: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  saleDate: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  saleRevenue: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  soldPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  netAmount: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.success,
  },
  feeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: Colors.textMuted,
  },
});
