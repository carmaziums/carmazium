import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../lib/apiClient';
import { getAccessToken } from '../../lib/supabase';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { useFocusEffect } from '@react-navigation/native';
// ─────────────────────────── interfaces ───────────────────────────

interface SaleRecord {
  id: string;
  listing?: {
    title?: string;
    vrm?: string;
    images?: string[];
  };
  buyer?: {
    firstName?: string;
    lastName?: string;
  } | null;
  buyerName?: string;
  soldPrice: number;
  createdAt?: string;
}

/**
 * An auction the seller has actually been paid out on. The backend only
 * includes auctions with `sellerBonusReleased: true`, which is set once an
 * admin approves the handover proof — so this never contains auctions still
 * mid-handover or ones that were denied (`listings.service.ts:1610-1633`).
 */
interface AuctionSaleRecord {
  id: string;
  listingId: string;
  winningBidAmount: number;
  sellerBonus: number;
  sellerBonusReleasedAt?: string | null;
  createdAt?: string;
  listing?: { title?: string; vrm?: string };
  winner?: { firstName?: string; lastName?: string } | null;
}

interface EarningsResponse {
  success: boolean;
  data: {
    sales: SaleRecord[];
    totalRevenue: number;
    totalSales: number;
    // All four already returned by GET /listings/earnings and simply never
    // read by mobile, so a seller could not see what they had earned in £100
    // auction bonuses anywhere (DASH-010). No backend change was needed.
    //
    // Note totalRevenue and totalSales ALREADY include the auction figures
    // (`listings.service.ts:1651-1656`) — mobile was not under-reporting, it
    // just could not show where the money came from.
    auctionSales?: AuctionSaleRecord[];
    totalAuctionSales?: number;
    totalAuctionRevenue?: number;
    totalAuctionBonus?: number;
  };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatPrice = (amount: number): string =>
  Number(amount).toLocaleString('en-GB', {style: 'currency', currency: 'GBP'});

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

// ═══════════════════════════ COMPONENT ════════════════════════════

export const EarningsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [auctionSales, setAuctionSales] = useState<AuctionSaleRecord[]>([]);
  const [totalAuctionBonus, setTotalAuctionBonus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const request = useRef(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    const id = ++request.current;
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [res] = await Promise.allSettled([
        apiClient<EarningsResponse>('/listings/earnings?scope=personal'),
      ]);
      if (id !== request.current) return;
      if (res.status === 'fulfilled' && res.value?.success && Array.isArray(res.value.data?.sales) && Number.isFinite(Number(res.value.data.totalRevenue)) && Number.isFinite(res.value.data.totalSales)) {
        const d = res.value.data;
        setSales(Array.isArray(d?.sales) ? d.sales : []);
        setTotalRevenue(d?.totalRevenue ?? 0);
        setTotalSales(d?.totalSales ?? 0);
        setAuctionSales(Array.isArray(d?.auctionSales) ? d.auctionSales : []);
        setTotalAuctionBonus(d?.totalAuctionBonus ?? 0);
        setError(null);
      } else {
        // allSettled swallows the rejection, so without this a failed
        // earnings call rendered as £0 earned — indistinguishable from a
        // seller who has genuinely earned nothing (CROSS-023).
        setSales([]);
        setTotalRevenue(0);
        setTotalSales(0);
        setAuctionSales([]);
        setTotalAuctionBonus(0);
        setError('Could not load your earnings.');
      }
    } catch {
      if (id === request.current) setError('Could not load your earnings.');
    } finally {
      if (id === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchData();
    return () => { request.current++; };
  }, [fetchData]));

  const handleExport = async () => {
    setExporting(true);
    try {
      // Use raw fetch — apiClient calls response.json() which fails on CSV text
      const token = await getAccessToken();
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
      const response = await fetch(`${API_URL}/listings/earnings/export?scope=personal`, {
        headers: {
          Accept: 'text/csv',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const csvContent = await response.text();
      const fileName = `carmazium-earnings-${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Earnings Ledger',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `Saved to: ${fileName}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message ?? 'Could not export the ledger.');
    } finally {
      setExporting(false);
    }
  };

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

  const renderSaleRow = (sale: SaleRecord) => (
    <View key={sale.id} style={styles.saleRow}>
      <View style={{width: 64, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.bgTertiary, alignItems: 'center', justifyContent: 'center'}}>
        {sale.listing?.images?.[0] ? <Image source={{uri: sale.listing.images[0]}} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Ionicons name="car-outline" size={18} color={Colors.textMuted} />}
      </View>
      <View style={{flex: 1, gap: 6}}>
        <Text style={styles.saleTitle}>{sale.listing?.title || sale.listing?.vrm || 'Vehicle'}</Text>
        <Text style={styles.saleBuyer}>{sale.buyer ? getBuyerName(sale.buyer) : sale.buyerName || 'Direct buyer'}</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between'}}>
          <Text style={styles.soldPrice}>{formatPrice(sale.soldPrice)}</Text>
          <Text style={styles.saleDate}>{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-GB') : '—'}</Text>
        </View>
      </View>
    </View>
  );

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(34,197,94,0.05)', Colors.groundClear, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />

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
        <View style={{gap: 12, marginBottom: 24}}>
          <Text accessibilityRole="header" style={{fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary}}>Sales & Earnings</Text>
          <Text style={{fontSize: 14, lineHeight: 22, color: Colors.textMuted}}>Cars you have sold and what you earned.</Text>
          <Button label="Payment receipts" variant="outline" onPress={() => navigation?.navigate('PaymentHistory')} />
          <Button label="Export Ledger" variant="outline" loading={exporting} onPress={handleExport} />
        </View>
        {error ? (
          <View style={{ marginBottom: 16 }}>
            <ErrorBanner message={error} onRetry={() => fetchData()} />
          </View>
        ) : null}

        {!error && <View style={{gap: 16, marginBottom: 24}}>
          {[
            ['Total Earnings', formatPrice(totalRevenue), 'Sourced from finalised sales', Colors.success],
            ['Vehicles Sold', String(totalSales), 'Lifetime', Colors.accent],
            ['Avg. Sale Price', formatPrice(totalSales > 0 ? totalRevenue / totalSales : 0), 'Mean across all sales', Colors.infoBlue],
          ].map(([label, value, hint, color]) => <View key={label} style={{padding: 20, gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, backgroundColor: Colors.bgCard}}>
            <Text style={{fontSize: 12, fontFamily: FontFamily.bold, color, textTransform: 'uppercase'}}>{label}</Text>
            <Text style={{fontSize: 30, fontFamily: FontFamily.bold, color: Colors.textPrimary}}>{loading ? '—' : value}</Text>
            <Text style={{fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase'}}>{hint}</Text>
          </View>)}
        </View>}

        {/* ── Auction bonuses (DASH-010) ──
            The £100 seller bonus is the only money CarMazium itself pays out —
            the winning bid is settled directly between buyer and seller — so it
            is shown as its own figure rather than folded into revenue. Only
            auctions whose handover proof an admin has approved appear here, so
            this is money actually received, not money expected. ── */}
        {!loading && auctionSales.length > 0 && (
          <View style={styles.bonusCard}>
            <View style={styles.bonusHeader}>
              <Ionicons name="trophy-outline" size={16} color={Colors.success} />
              <Text style={styles.bonusTitle}>AUCTION BONUSES</Text>
              <Text style={styles.bonusTotal}>{formatPrice(totalAuctionBonus)}</Text>
            </View>
            <Text style={styles.bonusBlurb}>
              {auctionSales.length} auction{auctionSales.length === 1 ? '' : 's'} paid out at £100 each.
            </Text>
            {auctionSales.map((a) => (
              <View key={a.id} style={styles.bonusRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bonusRowTitle} numberOfLines={1}>
                    {a.listing?.title || a.listing?.vrm || 'Vehicle'}
                  </Text>
                  <Text style={styles.bonusRowMeta}>
                    {formatDate(a.sellerBonusReleasedAt ?? a.createdAt)}
                    {a.winningBidAmount ? ` · won at ${formatPrice(a.winningBidAmount)}` : ''}
                  </Text>
                </View>
                <Text style={styles.bonusRowAmount}>+{formatPrice(a.sellerBonus)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Sale history ── */}
        {!error && <View style={styles.historySection}>
          <Text style={styles.sectionHeader}>SALE HISTORY</Text>

          {loading ? (
            renderSkeleton()
          ) : sales.length === 0 ? (
            renderEmptyState()
          ) : (
            sales.map(renderSaleRow)
          )}
        </View>}

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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 38,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.successAlpha25,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 3,
    ...Elevation.card,
  },
  exportBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.success,
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
  bonusCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    marginTop: 16,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  bonusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bonusTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.success,
    letterSpacing: 1.2,
  },
  bonusTotal: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.success,
  },
  bonusBlurb: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha06,
  },
  bonusRowTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  bonusRowMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bonusRowAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.success,
  },
  bonusMore: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 10,
  },
  summaryCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.cardHi,
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
    fontSize: FontSize.size9,
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
    backgroundColor: Colors.whiteAlpha08,
    marginHorizontal: 20,
  },
  skeletonRevenue: {
    width: 120,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.whiteAlpha06,
  },
  skeletonSalesCount: {
    width: 48,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.whiteAlpha06,
  },

  // ── History section ──
  // ── Payment receipts row ──
  receiptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 14,
  },
  receiptsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  receiptsSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
    marginTop: 1,
  },

  historySection: {
    gap: 10,
  },
  sectionHeader: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  // ── Skeleton rows ──
  skeletonRow: {
    height: 76,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha04,
  },
  skeletonRowWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: Colors.whiteAlpha04,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha04,
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
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 12,
  },
  trophyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.successAlpha10,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
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
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },
  saleBuyer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
  },
  saleDate: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
  },
  saleRevenue: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  soldPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  netAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size10,
    color: Colors.success,
  },

  // ── Payouts / Stripe Connect ──
  payoutsSection: {
    gap: 10,
  },
  payoutsCard: {
    borderRadius: Radius.inline,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  payoutsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  payoutsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.successAlpha10,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  payoutsCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  payoutsCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  connectButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.onAccent,
    textAlign: 'center',
  },
});
