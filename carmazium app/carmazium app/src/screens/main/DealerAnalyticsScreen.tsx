import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  RefreshControl,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { FontFamily, FontSize } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { RowDensity } from '../../constants/spacing';
import { apiClient } from '../../lib/apiClient';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HALF_CARD = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

type Period = '7D' | '30D' | '90D' | 'YTD' | 'ALL';
type SubView = 'analytics' | 'conversion';

// ─── Real analytics response shape — GET /dealers/analytics?range=... ──────
interface AnalyticsKPIs {
  totalRevenue: number; totalRevenueTrend: number;
  totalUnitsSold: number; totalUnitsSoldTrend: number;
  avgDaysToSell: number; avgDaysToSellTrend: number;
  offerConversionRate: number; offerConversionRateTrend: number;
  leadConversionRate: number; leadConversionRateTrend: number;
  avgViewsPerListing: number; avgViewsPerListingTrend: number;
}
interface RevenueTrendPoint { month: string; revenue: number; unitsSold: number }
interface LeadFunnel { NEW: number; CONTACTED: number; QUALIFIED: number; NEGOTIATING: number; WON: number; LOST: number }
interface OfferBreakdown {
  PENDING: number; ACCEPTED: number; REJECTED: number; COUNTERED: number; WITHDRAWN: number;
  avgAcceptedAmount: number; avgTimeToRespond: number;
}
interface InventoryHealth {
  DRAFT: number; ACTIVE: number; OFFER_ACCEPTED: number; SOLD: number; WITHDRAWN: number;
  avgAge: number; staleCount: number; agingBuckets: Record<string, number>;
}
interface TopVehicle {
  id: string; title: string; image: string | null; views: number;
  offerCount: number; price: number; status: string; daysListed: number;
}
interface AnalyticsData {
  kpis: AnalyticsKPIs;
  revenueTrend: RevenueTrendPoint[];
  leadFunnel: LeadFunnel;
  offerBreakdown: OfferBreakdown;
  inventoryHealth: InventoryHealth;
  topVehicles: TopVehicle[];
}

// Maps a UI period to the backend's range/from/to query params. The backend
// natively understands 7d/30d/90d (plus a default 30d); YTD and ALL have no
// native range so we ask for a wide custom window instead.
const periodToQuery = (p: Period): { range: string; from?: string; to?: string } => {
  const now = new Date();
  if (p === '7D') return { range: '7d' };
  if (p === '30D') return { range: '30d' };
  if (p === '90D') return { range: '90d' };
  if (p === 'YTD') {
    return { range: 'custom', from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString() };
  }
  return { range: 'custom', from: new Date(now.getFullYear() - 5, 0, 1).toISOString(), to: now.toISOString() };
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string): string => {
  const month = parseInt(ym.split('-')[1] ?? '', 10);
  return MONTH_NAMES[month - 1] ?? ym;
};

const formatGBP = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${Math.round(value).toLocaleString('en-GB')}`;
  return `£${Math.round(value)}`;
};

// Trend badge — green when improving, red when declining, grey when flat.
// (Backend pre-inverts avgDaysToSellTrend so positive always means "better".)
const renderTrend = (
  value: number,
  textStyle: StyleProp<TextStyle>,
  wrapStyle: StyleProp<ViewStyle>,
  iconSize: number,
) => {
  const positive = value > 0;
  const neutral = value === 0;
  const color = neutral ? Colors.lightBlue_9ca3af : positive ? Colors.success : Colors.error;
  const icon = neutral ? 'remove' : positive ? 'trending-up' : 'trending-down';
  return (
    <View style={wrapStyle}>
      <Ionicons name={icon} size={iconSize} color={color} style={{ marginRight: 4 }} />
      <Text style={[textStyle, { color }]}>
        {neutral ? 'No change vs prev' : `${positive ? '+' : ''}${value}% vs prev`}
      </Text>
    </View>
  );
};

// ─── Gifted-charts data mapping helpers ────────────────────────────────────
const toBarData = (points: RevenueTrendPoint[]): { value: number; label: string; frontColor: string }[] =>
  points.map((p, i) => ({
    value: Math.max(p.revenue, 0),
    label: monthLabel(p.month),
    frontColor: i === points.length - 1 ? Colors.accent : Colors.accentSubtle.replace('0.15', '0.45'),
  }));

const toLineData = (points: RevenueTrendPoint[]): { value: number; label: string }[] =>
  points.map(p => ({ value: Math.max(p.unitsSold, 0), label: monthLabel(p.month) }));

const toLeadBarData = (lf: LeadFunnel): { value: number; label: string; frontColor: string }[] => {
  const entries: { key: keyof LeadFunnel; label: string; color: string }[] = [
    { key: 'NEW', label: 'New', color: Colors.infoBlue },
    { key: 'CONTACTED', label: 'Ctd', color: Colors.warning },
    { key: 'QUALIFIED', label: 'Qual', color: Colors.palePurple_a78bfa },
    { key: 'NEGOTIATING', label: 'Neg', color: Colors.lightPink },
    { key: 'WON', label: 'Won', color: Colors.success },
    { key: 'LOST', label: 'Lost', color: Colors.iconMuted },
  ];
  return entries.map(e => ({ value: Math.max(lf[e.key], 0), label: e.label, frontColor: e.color }));
};

const toAgingBarData = (buckets: Record<string, number>): { value: number; label: string; frontColor: string }[] => {
  const entries: { key: string; label: string; color: string }[] = [
    { key: '0-7d',   label: '0-7d',   color: Colors.success },
    { key: '8-30d',  label: '8-30d',  color: Colors.infoBlue },
    { key: '31-60d', label: '31-60d', color: Colors.warning },
    { key: '60d+',   label: '60d+',   color: Colors.accent },
  ];
  return entries.map(e => ({ value: Math.max(buckets[e.key] ?? 0, 0), label: e.label, frontColor: e.color }));
};

// ─── Circular gauge ─────────────────────────────────────────────────────────
const CircularGauge: React.FC<{ value: number; size: number }> = ({ value, size }) => {
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (value / 100) * circumference;

  // Build arc segments using Views rotated around centre
  const segments = 40;
  const filledSegments = Math.round((value / 100) * segments);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: Colors.whiteAlpha06,
        }}
      />
      {/* Progress arc using conic-like approach with segments */}
      {Array.from({ length: segments }).map((_, i) => {
        const angle = (i / segments) * 360 - 90;
        const isFilled = i < filledSegments;
        if (!isFilled) return null;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: 2,
              height: r + strokeWidth / 2,
              top: size / 2 - r - strokeWidth / 2,
              left: size / 2 - 1,
              transformOrigin: `1px ${r + strokeWidth / 2}px`,
              transform: [{ rotate: `${angle}deg` }],
              borderTopWidth: strokeWidth,
              borderTopColor: Colors.success,
              borderRadius: 2,
            }}
          />
        );
      })}
      {/* Centre text */}
      <Text style={{ fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: Colors.white }}>
        {value}%
      </Text>
    </View>
  );
};

// ─── Skeleton rows for loading state ────────────────────────────────────────
const AnalyticsSkeleton: React.FC = () => (
  <View style={{ paddingHorizontal: 24, gap: 14 }}>
    <Skeleton w={SCREEN_WIDTH - 48} h={160} r={20} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton w={HALF_CARD} h={90} r={18} />
      <Skeleton w={HALF_CARD} h={90} r={18} />
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Skeleton w={HALF_CARD} h={90} r={18} />
      <Skeleton w={HALF_CARD} h={90} r={18} />
    </View>
    <Skeleton w={SCREEN_WIDTH - 48} h={120} r={20} />
  </View>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export const DealerAnalyticsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('30D');
  const [subView, setSubView] = useState<SubView>('analytics');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const doFetch = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { range, from, to } = periodToQuery(period);
    const params = new URLSearchParams({ range });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    apiClient<{ success: boolean; data: AnalyticsData }>(`/dealers/analytics?${params.toString()}`)
      .then(res => { if (res.success) setAnalytics(res.data); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const switchPeriod = (p: Period) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setPeriod(p);
  };

  const kpis = analytics?.kpis;
  const revenueTrend = analytics?.revenueTrend ?? [];
  const chartW = SCREEN_WIDTH - 64;

  const PERIODS: Period[] = ['7D', '30D', '90D', 'YTD', 'ALL'];

  // ── Conversion Deep Dive View ────────────────────────────────────────────
  const renderConversionView = () => {
    const lf = analytics?.leadFunnel;
    const ob = analytics?.offerBreakdown;
    const totalLeads = lf ? Object.values(lf).reduce((a, b) => a + b, 0) : 0;
    const totalOffers = ob ? ob.PENDING + ob.ACCEPTED + ob.REJECTED + ob.COUNTERED + ob.WITHDRAWN : 0;

    const FUNNEL_STAGES: { key: keyof LeadFunnel; label: string; color: string }[] = [
      { key: 'NEW', label: 'New', color: Colors.infoBlue },
      { key: 'CONTACTED', label: 'Contacted', color: Colors.warning },
      { key: 'QUALIFIED', label: 'Qualified', color: Colors.palePurple_a78bfa },
      { key: 'NEGOTIATING', label: 'Negotiating', color: Colors.lightPink },
      { key: 'WON', label: 'Won', color: Colors.success },
      { key: 'LOST', label: 'Lost', color: Colors.iconMuted },
    ];

    const OFFER_STAGES: { key: 'PENDING' | 'ACCEPTED' | 'COUNTERED' | 'REJECTED' | 'WITHDRAWN'; label: string; color: string }[] = [
      { key: 'PENDING', label: 'Pending', color: Colors.infoBlue },
      { key: 'ACCEPTED', label: 'Accepted', color: Colors.success },
      { key: 'COUNTERED', label: 'Countered', color: Colors.warning },
      { key: 'REJECTED', label: 'Rejected', color: Colors.error },
      { key: 'WITHDRAWN', label: 'Withdrawn', color: Colors.iconMuted },
    ];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => setSubView('analytics')} accessibilityLabel="Go back" />
          <Text style={styles.headerTitle}>CONVERSION DEEP DIVE</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Circular gauge card */}
        <View style={styles.convCard}>
          <LinearGradient
            colors={[Colors.successAlpha06, 'rgba(34,197,94,0.01)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.convCardInner}>
            <CircularGauge value={loading ? 0 : Math.round(kpis?.leadConversionRate ?? 0)} size={90} />
            <View style={styles.convCardText}>
              <Text style={styles.convCardLabel}>LEAD → WON CONVERSION</Text>
              <Text style={styles.convCardBig}>
                {loading ? '–' : `${kpis?.leadConversionRate ?? 0}% of leads won`}
              </Text>
              {!loading && kpis && (
                <Text style={styles.convCardSub}>
                  {kpis.leadConversionRateTrend > 0 ? '+' : ''}{kpis.leadConversionRateTrend}% vs previous period
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Lead pipeline */}
        <Text style={styles.sectionLabel}>LEAD PIPELINE · {totalLeads} TOTAL</Text>
        <View style={styles.funnelCard}>
          {FUNNEL_STAGES.map((stage, i, arr) => {
            const count = lf?.[stage.key] ?? 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 1000) / 10 : 0;
            return (
              <View key={stage.key}>
                <View style={styles.funnelRow}>
                  <View style={styles.funnelLeft}>
                    <Text style={styles.funnelStep}>{stage.label}</Text>
                    <Text style={styles.funnelSub}>{count} lead{count === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={[styles.funnelBadge, { backgroundColor: `${stage.color}22` }]}>
                    <Text style={[styles.funnelPct, { color: stage.color }]}>{pct}%</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={styles.funnelDivider} />}
              </View>
            );
          })}
        </View>

        {/* Offer breakdown */}
        <Text style={styles.sectionLabel}>OFFER BREAKDOWN · {totalOffers} TOTAL</Text>
        <View style={styles.funnelCard}>
          {OFFER_STAGES.map((stage, i, arr) => {
            const count = ob?.[stage.key] ?? 0;
            const pct = totalOffers > 0 ? Math.round((count / totalOffers) * 1000) / 10 : 0;
            return (
              <View key={stage.key}>
                <View style={styles.funnelRow}>
                  <View style={styles.funnelLeft}>
                    <Text style={styles.funnelStep}>{stage.label}</Text>
                    <Text style={styles.funnelSub}>{count} offer{count === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={[styles.funnelBadge, { backgroundColor: `${stage.color}22` }]}>
                    <Text style={[styles.funnelPct, { color: stage.color }]}>{pct}%</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={styles.funnelDivider} />}
              </View>
            );
          })}
        </View>

        {/* Offer performance */}
        {ob && (ob.avgAcceptedAmount > 0 || ob.avgTimeToRespond > 0) && (
          <>
            <Text style={styles.sectionLabel}>OFFER PERFORMANCE</Text>
            <View style={styles.benchCard}>
              <View style={styles.benchRow}>
                <Text style={[styles.benchLabel, { width: 170 }]}>Avg accepted offer</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.success }}>
                  {formatGBP(ob.avgAcceptedAmount)}
                </Text>
              </View>
              <View style={styles.benchRow}>
                <Text style={[styles.benchLabel, { width: 170 }]}>Avg time to respond</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.infoBlue }}>
                  {ob.avgTimeToRespond < 1 ? '< 1h' : `${ob.avgTimeToRespond}h`}
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // ── Main Analytics View ──────────────────────────────────────────────────
  const renderAnalyticsView = () => {
    const barData = revenueTrend.length > 0 ? toBarData(revenueTrend.slice(-6)) : [];
    const lineData = revenueTrend.length > 0 ? toLineData(revenueTrend.slice(-6)) : [];
    const leadFunnelData = analytics?.leadFunnel ? toLeadBarData(analytics.leadFunnel) : [];
    const agingData = analytics?.inventoryHealth?.agingBuckets ? toAgingBarData(analytics.inventoryHealth.agingBuckets) : [];
    const hasData = !!analytics && (revenueTrend.length > 0 || (kpis?.totalUnitsSold ?? 0) > 0);

    return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => doFetch(true)}
          tintColor={Colors.accent}
          colors={[Colors.accent]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation?.goBack()} accessibilityLabel="Go back" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>SALES · LAST {period}</Text>
          <Text style={styles.headerTitleMain}>Analytics</Text>
        </View>
        <HamburgerButton />
      </View>

      {/* Period pills */}
      <View style={styles.pillRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.pill, period === p && styles.pillActive]}
            onPress={() => switchPeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, period === p && styles.pillTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Skeleton while loading */}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !hasData ? (
        <View style={{ marginHorizontal: 24, marginTop: 40 }}>
          <EmptyState
            icon="bar-chart-outline"
            title="No analytics data yet"
            subtitle="Start listing and selling cars to see your performance charts here."
          />
        </View>
      ) : (
        <>
          {/* Revenue BarChart card */}
          <Animated.View style={[styles.revenueCard, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.revenueTop}>
              <View>
                <Text style={styles.revLabel}>REVENUE · {period}</Text>
                <Text style={styles.revValue}>
                  {formatGBP(kpis?.totalRevenue ?? 0)}
                </Text>
                {kpis && renderTrend(kpis.totalRevenueTrend, styles.revChangeText, styles.revChange, 12)}
              </View>
            </View>

            {/* Gifted-charts BarChart */}
            <View style={styles.chartArea}>
              {barData.length > 0 ? (
                <BarChart
                  data={barData}
                  width={chartW - 8}
                  height={90}
                  barWidth={Math.max(10, Math.floor((chartW - 60) / Math.max(barData.length, 1)) - 4)}
                  barBorderRadius={4}
                  hideRules
                  hideYAxisText
                  xAxisColor="transparent"
                  yAxisColor="transparent"
                  xAxisLabelTextStyle={{ fontFamily: FontFamily.mono, fontSize: FontSize.size8, color: Colors.textMuted }}
                  noOfSections={3}
                  maxValue={Math.max(...barData.map(d => d.value), 1)}
                  isAnimated
                />
              ) : (
                <View style={{ height: 90, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted }}>
                    Not enough sales yet to chart a trend
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Units Sold LineChart card */}
          {lineData.length > 1 && (
            <Animated.View style={[styles.revenueCard, { opacity: fadeAnim, marginTop: 0 }]}>
              <View style={styles.revenueTop}>
                <View>
                  <Text style={styles.revLabel}>UNITS SOLD TREND</Text>
                  <Text style={[styles.revValue, { fontSize: FontSize['2xl'] }]}>
                    {kpis?.totalUnitsSold ?? 0}
                  </Text>
                </View>
              </View>
              <View style={styles.chartArea}>
                <LineChart
                  data={lineData}
                  width={chartW - 8}
                  height={90}
                  color={Colors.accentGlow}
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
            </Animated.View>
          )}

          {/* Stats grid */}
          <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
            {/* Cars Sold */}
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>CARS SOLD</Text>
              <Text style={styles.statValue}>
                {String(kpis?.totalUnitsSold ?? 0)}
              </Text>
              {kpis && renderTrend(kpis.totalUnitsSoldTrend, styles.statChangeGreen, styles.statChange, 11)}
            </View>

            {/* Avg Sell Time */}
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>AVG SELL TIME</Text>
              <Text style={styles.statValue}>
                {`${kpis?.avgDaysToSell ?? 0}d`}
              </Text>
              {kpis && renderTrend(kpis.avgDaysToSellTrend, styles.statChangeGreen, styles.statChange, 11)}
            </View>

            {/* Avg Views per Listing */}
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>AVG VIEWS / LISTING</Text>
              <Text style={styles.statValue}>
                {String(kpis?.avgViewsPerListing ?? 0)}
              </Text>
              {kpis && renderTrend(kpis.avgViewsPerListingTrend, styles.statChangeGreen, styles.statChange, 11)}
            </View>

            {/* Listings Live */}
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>LISTINGS LIVE</Text>
              <Text style={styles.statValue}>
                {String(analytics?.inventoryHealth.ACTIVE ?? 0)}
              </Text>
              <View style={styles.statChange}>
                <Ionicons
                  name={(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? 'alert-circle' : 'checkmark-circle'}
                  size={11}
                  color={(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? Colors.warning : Colors.success}
                />
                <Text style={[styles.statChangeGreen, { color: (analytics?.inventoryHealth.staleCount ?? 0) > 0 ? Colors.warning : Colors.success }]}>
                  {' '}{(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? `${analytics?.inventoryHealth.staleCount} stale 60d+` : 'All listings fresh'}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Lead Funnel BarChart */}
          {leadFunnelData.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>LEAD FUNNEL</Text>
              <View style={[styles.monthCard, { flexDirection: 'column', alignItems: 'flex-start', paddingTop: 20 }]}>
                <BarChart
                  data={leadFunnelData}
                  width={chartW - 8}
                  height={100}
                  barWidth={Math.floor((chartW - 60) / 6) - 4}
                  barBorderRadius={4}
                  hideRules
                  hideYAxisText
                  xAxisColor="transparent"
                  yAxisColor="transparent"
                  xAxisLabelTextStyle={{ fontFamily: FontFamily.mono, fontSize: FontSize.size8, color: Colors.textMuted }}
                  maxValue={Math.max(...leadFunnelData.map(d => d.value), 1)}
                  isAnimated
                />
              </View>
            </>
          )}

          {/* Inventory Aging BarChart */}
          {agingData.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>INVENTORY AGING</Text>
              <View style={[styles.monthCard, { flexDirection: 'column', alignItems: 'flex-start', paddingTop: 20 }]}>
                <BarChart
                  data={agingData}
                  width={chartW - 8}
                  height={100}
                  barWidth={Math.floor((chartW - 60) / 4) - 4}
                  barBorderRadius={4}
                  hideRules
                  hideYAxisText
                  xAxisColor="transparent"
                  yAxisColor="transparent"
                  xAxisLabelTextStyle={{ fontFamily: FontFamily.mono, fontSize: FontSize.size8, color: Colors.textMuted }}
                  maxValue={Math.max(...agingData.map(d => d.value), 1)}
                  isAnimated
                />
              </View>
            </>
          )}

          {/* Top Performers */}
          <Text style={styles.sectionLabel}>TOP PERFORMERS</Text>
          <View style={styles.topSection}>
            {(analytics?.topVehicles ?? []).length === 0 ? (
              <View style={{ paddingVertical: 28, paddingHorizontal: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.textMuted, textAlign: 'center' }}>
                  No listings yet — your top performers will appear here once your cars start getting views.
                </Text>
              </View>
            ) : (
              (analytics?.topVehicles ?? []).slice(0, 5).map((car, i, arr) => (
                <View key={car.id}>
                  <View style={styles.perfRow}>
                    <View style={[styles.rankBadge, i === 0 && styles.rankBadgeRed]}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    {car.image ? (
                      <Image source={{ uri: car.image }} style={styles.perfThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.perfThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="car-sport-outline" size={18} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.perfInfo}>
                      <Text style={styles.perfTitle} numberOfLines={1}>{car.title}</Text>
                      <Text style={styles.perfSub}>
                        {car.daysListed}d listed · {car.views.toLocaleString('en-GB')} views · {car.offerCount} offer{car.offerCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={styles.perfPrice}>{formatGBP(car.price)}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.perfDivider} />}
                </View>
              ))
            )}
          </View>

          {/* Conversion deep dive CTA */}
          <TouchableOpacity
            style={styles.convCTA}
            onPress={() => setSubView('conversion')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.successAlpha10, 'rgba(34,197,94,0.04)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.convCTALeft}>
              <Text style={styles.convCTALabel}>LEAD CONVERSION RATE</Text>
              <Text style={styles.convCTAValue}>
                {`${kpis?.leadConversionRate ?? 0}%`}
                {kpis && (
                  <Text style={styles.convCTABench}>
                    {'  '}{kpis.leadConversionRateTrend > 0 ? '+' : ''}{kpis.leadConversionRateTrend}% vs prev period
                  </Text>
                )}
              </Text>
            </View>
            <View style={styles.convCTARight}>
              <Text style={styles.convCTALink}>Deep dive</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.success} accessibilityElementsHidden importantForAccessibility="no" />
            </View>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </>
      )}
    </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <LinearGradient
        colors={[Colors.accentAlpha05, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />

      {subView === 'analytics' ? renderAnalyticsView() : renderConversionView()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  headerTitleMain: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size22,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 1.4,
  },

  // ── Period pills ─────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  pill: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: Colors.white,
  },

  // ── Revenue card ─────────────────────────────────────────────────────────
  revenueCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    overflow: 'hidden',
    marginBottom: 14,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  revenueTop: {
    marginBottom: 16,
  },
  revLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  revValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size30,
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: 6,
  },
  revChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revChangeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.success,
  },
  chartArea: {
    marginHorizontal: -4,
    marginBottom: 0,
  },
  chartFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },

  // ── Stats grid ───────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  // Dealer analytics is a power-user surface, so KPI cards use the compact row
  // density preset instead of buyer-card spacing (mobile-ui-ux-audit.md §DA1).
  statCard: {
    width: HALF_CARD,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: RowDensity.compact.borderRadius,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: RowDensity.compact.padding,
  },
  statLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size26,
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statChangeGreen: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.success,
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1.6,
    marginHorizontal: 28,
    marginBottom: 12,
  },

  // ── Top Performers ───────────────────────────────────────────────────────
  topSection: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankBadgeRed: {
    backgroundColor: Colors.accent,
  },
  rankText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  perfThumb: {
    width: 52,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.whiteAlpha04,
    marginRight: 12,
  },
  perfInfo: {
    flex: 1,
  },
  perfTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 3,
  },
  perfSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
  },
  perfPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  perfPriceUnder: {
    textDecorationLine: 'underline',
  },
  perfDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha04,
  },

  // ── Conversion CTA ───────────────────────────────────────────────────────
  convCTA: {
    marginHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.successAlpha20,
    backgroundColor: Colors.bgSecondaryAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },
  convCTALeft: {},
  convCTALabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.iconMuted,
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  convCTAValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.success,
    letterSpacing: -0.5,
  },
  convCTABench: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
  },
  convCTARight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  convCTALink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.success,
  },

  // ── Monthly breakdown bars ───────────────────────────────────────────────
  monthCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 16,
  },
  monthCol: {
    flex: 1,
    alignItems: 'center',
  },
  monthRev: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size7,
    color: Colors.iconMuted,
    marginBottom: 6,
    textAlign: 'center',
  },
  monthBarTrack: {
    width: 22,
    height: 60,
    backgroundColor: Colors.whiteAlpha04,
    borderRadius: 4,
    justifyContent: 'flex-end',
    marginBottom: 6,
    overflow: 'hidden',
  },
  monthBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  monthSold: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    marginBottom: 2,
  },
  monthName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
  },

  // ── Conversion Deep Dive ─────────────────────────────────────────────────
  convCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.successAlpha15,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 28,
  },
  convCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  convCardText: {
    flex: 1,
  },
  convCardLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.success,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  convCardBig: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size22,
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  convCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
  },

  // Funnel card
  funnelCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 16,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  funnelLeft: {
    flex: 1,
  },
  funnelStep: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginBottom: 3,
  },
  funnelArrow: {
    color: Colors.accent,
  },
  funnelSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
  },
  funnelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  funnelPct: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
  },
  funnelDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha04,
  },

  // AI Card
  aiCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accentAlpha20,
    backgroundColor: Colors.bgSecondaryAlt,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    gap: 14,
    overflow: 'hidden',
    marginBottom: 28,
  },
  aiIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiTextWrap: {
    flex: 1,
  },
  aiLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.accent,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  aiBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.paleBlue_d0d0da,
    lineHeight: 20,
  },

  // Benchmark card
  benchCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 20,
    gap: 14,
  },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benchLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size12,
    color: Colors.textSecondary,
    width: 110,
  },
  benchTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.whiteAlpha06,
    borderRadius: 3,
    overflow: 'hidden',
  },
  benchFill: {
    height: '100%',
    borderRadius: 3,
  },
  benchVal: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    width: 42,
    textAlign: 'right',
  },
});
