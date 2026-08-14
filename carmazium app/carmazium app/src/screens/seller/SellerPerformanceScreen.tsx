import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_W = SCREEN_WIDTH - 64;

// ─────────────────────────── interfaces ───────────────────────────

interface RecentListingView {
  id: string;
  title: string;
  views: number;
  date: string;
}

interface SellerPerformanceData {
  totalRevenue: number;
  totalViews: number;
  totalListings: number;
  conversionRate: number;
  recentListingViews: RecentListingView[];
  // Optional trend arrays the backend may return
  revenueTrend?: Array<{ month: string; revenue: number }>;
  viewsTrend?: Array<{ month: string; views: number }>;
}

// ─────────────────────────── helpers ──────────────────────────────

const formatCurrency = (n: number): string => {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${Math.round(n).toLocaleString('en-GB')}`;
  return `£${Math.round(n)}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string): string => {
  const month = parseInt(ym.split('-')[1] ?? '', 10);
  return MONTH_NAMES[month - 1] ?? ym;
};

// Build gifted-charts data arrays from API response.
// Falls back to synthesising a single-point array from the total so charts
// always have something to render (rather than crashing on empty arrays).
const buildRevenueData = (d: SellerPerformanceData): { value: number; label: string }[] => {
  if (d.revenueTrend && d.revenueTrend.length > 0) {
    return d.revenueTrend.map(p => ({ value: Math.max(p.revenue, 0), label: monthLabel(p.month) }));
  }
  // Synthesise from totalRevenue so the chart renders something meaningful
  return [{ value: Math.max(d.totalRevenue, 0), label: 'Total' }];
};

const buildViewsData = (d: SellerPerformanceData): { value: number; label: string; frontColor: string }[] => {
  if (d.viewsTrend && d.viewsTrend.length > 0) {
    return d.viewsTrend.map(p => ({ value: Math.max(p.views, 0), label: monthLabel(p.month), frontColor: Colors.accentGlow }));
  }
  // Fall back to recentListingViews if available
  if (d.recentListingViews && d.recentListingViews.length > 0) {
    return d.recentListingViews.slice(0, 8).map((item, i) => ({
      value: Math.max(item.views, 0),
      label: item.title.split(' ')[0] ?? String(i + 1),
      frontColor: i === 0 ? Colors.accent : Colors.accentAlpha40,
    }));
  }
  return [{ value: Math.max(d.totalViews, 0), label: 'Total', frontColor: Colors.accent }];
};

// ─────────────────── skeleton ─────────────────────────────────────

const PerformanceSkeleton: React.FC = () => (
  <View style={{ paddingHorizontal: 20, gap: 14 }}>
    {/* KPI grid */}
    <View style={styles.statsGrid}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} w={(SCREEN_WIDTH - 50) / 2} h={90} r={16} />
      ))}
    </View>
    {/* Chart placeholders */}
    <Skeleton w={SCREEN_WIDTH - 40} h={160} r={18} />
    <Skeleton w={SCREEN_WIDTH - 40} h={140} r={18} />
  </View>
);

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerPerformanceScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<SellerPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiClient<{ success: boolean; data: SellerPerformanceData }>('/listings/performance');
      if (res?.success && res.data) {
        setData(res.data);
      }
    } catch {
      // silently fail — EmptyState covers missing data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const revenueData = data ? buildRevenueData(data) : [];
  const viewsData = data ? buildViewsData(data) : [];
  const hasData = data !== null;
  const hasRevenueTrend = revenueData.length > 1;
  const hasViewsTrend = viewsData.length > 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Performance</Text>
        <HamburgerButton />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 8 }}
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
        {loading ? (
          <PerformanceSkeleton />
        ) : !hasData ? (
          <View style={{ marginHorizontal: 20, marginTop: 40 }}>
            <EmptyState
              icon="bar-chart-outline"
              title="No performance data yet"
              subtitle="Publish a listing and start getting views to see your stats here."
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* ── KPI grid ── */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.successAlpha12 }]}>
                  <Ionicons name="cash-outline" size={16} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{formatCurrency(data!.totalRevenue)}</Text>
                <Text style={styles.statLabel}>TOTAL REVENUE</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.infoBlueAlpha12 }]}>
                  <Ionicons name="eye-outline" size={16} color={Colors.infoBlue} />
                </View>
                <Text style={styles.statValue}>{data!.totalViews.toLocaleString('en-GB')}</Text>
                <Text style={styles.statLabel}>TOTAL VIEWS</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.warningAlpha12 }]}>
                  <Ionicons name="car-sport-outline" size={16} color={Colors.warning} />
                </View>
                <Text style={styles.statValue}>{String(data!.totalListings)}</Text>
                <Text style={styles.statLabel}>LISTINGS</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.accentAlpha12 }]}>
                  <Ionicons name="trending-up-outline" size={16} color={Colors.accent} />
                </View>
                <Text style={styles.statValue}>{data!.conversionRate.toFixed(1)}%</Text>
                <Text style={styles.statLabel}>CONVERSION</Text>
              </View>
            </View>

            {/* ── Revenue trend LineChart ── */}
            {hasRevenueTrend && (
              <>
                <Text style={styles.sectionLabel}>REVENUE TREND</Text>
                <View style={styles.chartCard}>
                  <LineChart
                    data={revenueData}
                    width={CHART_W}
                    height={100}
                    color={Colors.accent}
                    thickness={2}
                    areaChart
                    startFillColor={Colors.accent}
                    startOpacity={0.18}
                    endFillColor={Colors.accent}
                    endOpacity={0.02}
                    dataPointsColor={Colors.white}
                    dataPointsRadius={3}
                    hideRules
                    hideYAxisText
                    xAxisColor="transparent"
                    yAxisColor="transparent"
                    xAxisLabelTextStyle={{ fontFamily: FontFamily.mono, fontSize: FontSize.size8, color: Colors.textMuted }}
                    isAnimated
                  />
                </View>
              </>
            )}

            {/* ── Views over time BarChart ── */}
            {hasViewsTrend && (
              <>
                <Text style={styles.sectionLabel}>VIEWS OVER TIME</Text>
                <View style={styles.chartCard}>
                  <BarChart
                    data={viewsData}
                    width={CHART_W}
                    height={90}
                    barWidth={Math.max(10, Math.floor((CHART_W - 60) / Math.max(viewsData.length, 1)) - 4)}
                    barBorderRadius={4}
                    hideRules
                    hideYAxisText
                    xAxisColor="transparent"
                    yAxisColor="transparent"
                    xAxisLabelTextStyle={{ fontFamily: FontFamily.mono, fontSize: FontSize.size8, color: Colors.textMuted }}
                    noOfSections={3}
                    maxValue={Math.max(...viewsData.map(d => d.value), 1)}
                    isAnimated
                  />
                </View>
              </>
            )}

            {/* ── Conversion KPI tile (no chart needed per plan) ── */}
            <Text style={styles.sectionLabel}>CONVERSION RATE</Text>
            <View style={styles.convCard}>
              <View style={[styles.convIconWrap, { backgroundColor: Colors.accentAlpha12 }]}>
                <Ionicons name="analytics-outline" size={22} color={Colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.convValue}>{data!.conversionRate.toFixed(1)}%</Text>
                <Text style={styles.convLabel}>of listing views convert to an enquiry or offer</Text>
              </View>
            </View>

            {/* ── No chart fallback for single-point data ── */}
            {!hasRevenueTrend && !hasViewsTrend && (
              <View style={{ marginTop: 12 }}>
                <EmptyState
                  icon="trending-up-outline"
                  title="Not enough data for trend charts"
                  subtitle="Trend charts appear once you have listings with multiple months of activity."
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ═══════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.card,
    padding: 16,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: FontSize.size19,
    fontFamily: FontFamily.mono,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.size9,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },

  chartCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    overflow: 'hidden',
  },

  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.card,
    padding: 20,
  },
  convIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convValue: {
    fontSize: FontSize['3xl'],
    fontFamily: FontFamily.mono,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  convLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
