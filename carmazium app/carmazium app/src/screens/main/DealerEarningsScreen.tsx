import React, { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../lib/apiClient';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { getAccessToken } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
// ─────────────────────────── interfaces ───────────────────────────
// Same GET /listings/earnings endpoint as the private-seller EarningsScreen —
// web's dealer earnings page (src/app/dashboard/dealer/earnings/page.tsx)
// calls the identical getEarnings()/listings/earnings, scoped server-side to
// the dealership's own sales.

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
  `£${Math.round(amount).toLocaleString('en-GB')}`;

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getBuyerName = (buyer?: SaleRecord['buyer']): string => {
  if (!buyer) return 'Direct buyer';
  const parts = [buyer.firstName, buyer.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Direct buyer';
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerEarningsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
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
      setError('Could not load your earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Use raw fetch — apiClient calls response.json() which fails on CSV text
      const token = await getAccessToken();
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
      const response = await fetch(`${API_URL}/listings/earnings/export`, {
        headers: {
          Accept: 'text/csv',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const csvContent = await response.text();
      const fileName = `carmazium-dealer-earnings-${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Dealership Sales Registry',
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

  const avgUnitMargin = totalSales > 0 ? totalRevenue / totalSales : 0;

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
      title="No sales yet"
      subtitle="Vehicles your dealership sells will appear here as they're marked Sold."
    />
  );

  const renderSaleRow = (sale: SaleRecord) => {
    const title = sale.listing?.title ?? 'Vehicle';
    const buyerName = getBuyerName(sale.buyer);

    return (
      <View key={sale.id} style={styles.saleRow}>
        <View style={styles.trophyCircle}>
          <Ionicons name="car-sport" size={17} color={Colors.success} />
        </View>

        <View style={styles.saleDetails}>
          <Text style={styles.saleTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.saleBuyer} numberOfLines={1}>{buyerName}</Text>
          <Text style={styles.saleDate}>{formatDate(sale.createdAt)}</Text>
        </View>

        <View style={styles.saleRevenue}>
          <Text style={styles.soldPrice}>{formatPrice(sale.soldPrice)}</Text>
          <Text style={styles.netAmount}>closing price</Text>
        </View>
      </View>
    );
  };

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(34,197,94,0.05)', 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>Dealership Earnings</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
          activeOpacity={0.75}
          onPress={handleExport}
          disabled={exporting}
        >
          <Ionicons name="download-outline" size={15} color={Colors.success} />
          <Text style={styles.exportBtnText}>
            {exporting ? 'Exporting…' : 'Export'}
          </Text>
        </TouchableOpacity>
        <HamburgerButton />
        </View>
      </View>

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
        {error ? (
          <View style={{ marginBottom: 16 }}>
            <ErrorBanner message={error} onRetry={() => fetchData()} />
          </View>
        ) : null}

        {/* ── Summary — 3 KPIs, matching web's dealer earnings stat row ── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL REVENUE</Text>
            {loading ? <Skeleton w={90} h={26} r={6} /> : (
              <Text style={styles.summaryValue}>{formatPrice(totalRevenue)}</Text>
            )}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>UNITS SOLD</Text>
            {loading ? <Skeleton w={36} h={26} r={6} /> : (
              <Text style={styles.summaryValue}>{totalSales}</Text>
            )}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>AVG. UNIT MARGIN</Text>
            {loading ? <Skeleton w={70} h={26} r={6} /> : (
              <Text style={styles.summaryValue}>{formatPrice(avgUnitMargin)}</Text>
            )}
          </View>
        </View>


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
            {auctionSales.slice(0, 5).map((a) => (
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
            {auctionSales.length > 5 && (
              <Text style={styles.bonusMore}>
                +{auctionSales.length - 5} more
              </Text>
            )}
          </View>
        )}

        {/* ── Receipts — reuses the existing payment-history screen rather
            than re-implementing it inline (web's tab switch, mobile's push
            navigation instead) ── */}
        <TouchableOpacity
          style={styles.receiptsRow}
          activeOpacity={0.8}
          onPress={() => navigation?.navigate('PaymentHistory')}
        >
          <View style={styles.receiptsIconWrap}>
            <Ionicons name="receipt-outline" size={17} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.receiptsTitle}>Payment receipts</Text>
            <Text style={styles.receiptsSub}>All platform fees, listing charges, and KYC payments</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.iconMuted} />
        </TouchableOpacity>

        {/* ── Sales registry ── */}
        <View style={styles.historySection}>
          <Text style={styles.sectionHeader}>SALES REGISTRY</Text>

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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.successAlpha10,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.successAlpha25,
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
    gap: 16,
    paddingBottom: 20,
  },

  // ── Summary ──
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bonusCard: {
    backgroundColor: Colors.successAlpha08,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    borderRadius: Radius.card,
    padding: 16,
    marginTop: 16,
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
    flex: 1,
    backgroundColor: 'rgba(20,26,42,0.70)',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    padding: 14,
    gap: 6,
  },
  summaryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  // ── Receipts link ──
  receiptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha07,
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
    color: Colors.textPrimary,
  },
  receiptsSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── History section ──
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
  skeletonRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'flex-end',
    gap: 6,
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
});
