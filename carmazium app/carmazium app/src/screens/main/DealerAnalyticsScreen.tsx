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
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';

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
  const color = neutral ? '#9CA3AF' : positive ? '#22C55E' : '#EF4444';
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

// ─── Sparkline drawn as connected dots ──────────────────────────────────────
const SparkLine: React.FC<{ data: number[]; width: number; height: number }> = ({
  data, width, height,
}) => {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - v * height,
  }));

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {/* Area fill rows */}
      {pts.slice(0, -1).map((pt, i) => {
        const next = pts[i + 1];
        const segW = next.x - pt.x;
        const topY = Math.min(pt.y, next.y);
        const botH = height - topY;
        return (
          <View
            key={`area-${i}`}
            style={{
              position: 'absolute',
              left: pt.x,
              top: topY,
              width: segW,
              height: botH,
              backgroundColor: 'rgba(220,31,38,0.08)',
            }}
          />
        );
      })}

      {/* Line segments */}
      {pts.slice(0, -1).map((pt, i) => {
        const next = pts[i + 1];
        const dx = next.x - pt.x;
        const dy = next.y - pt.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: pt.x,
              top: pt.y - 1,
              width: len,
              height: 2,
              backgroundColor: '#DC1F26',
              transformOrigin: 'left center',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* End dot */}
      <View
        style={{
          position: 'absolute',
          left: pts[pts.length - 1].x - 4,
          top: pts[pts.length - 1].y - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#DC1F26',
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }}
      />
    </View>
  );
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
          borderColor: 'rgba(255,255,255,0.06)',
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
              borderTopColor: '#22C55E',
              borderRadius: 2,
            }}
          />
        );
      })}
      {/* Centre text */}
      <Text style={{ fontFamily: FontFamily.extraBold, fontSize: 20, color: '#FFFFFF' }}>
        {value}%
      </Text>
    </View>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const DealerAnalyticsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('30D');
  const [subView, setSubView] = useState<SubView>('analytics');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { range, from, to } = periodToQuery(period);
    const params = new URLSearchParams({ range });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    apiClient<{ success: boolean; data: AnalyticsData }>(`/dealers/analytics?${params.toString()}`)
      .then(res => { if (!cancelled && res.success) setAnalytics(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
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
  const sparkData = (() => {
    if (revenueTrend.length < 2) return [];
    const max = Math.max(...revenueTrend.map(r => r.revenue), 1);
    return revenueTrend.map(r => Math.max(0.04, r.revenue / max));
  })();
  const chartW = SCREEN_WIDTH - 64;
  const chartH = 80;

  const PERIODS: Period[] = ['7D', '30D', '90D', 'YTD', 'ALL'];

  // ── Conversion Deep Dive View ────────────────────────────────────────────
  const renderConversionView = () => {
    const lf = analytics?.leadFunnel;
    const ob = analytics?.offerBreakdown;
    const totalLeads = lf ? Object.values(lf).reduce((a, b) => a + b, 0) : 0;
    const totalOffers = ob ? ob.PENDING + ob.ACCEPTED + ob.REJECTED + ob.COUNTERED + ob.WITHDRAWN : 0;

    const FUNNEL_STAGES: { key: keyof LeadFunnel; label: string; color: string }[] = [
      { key: 'NEW', label: 'New', color: '#3B82F6' },
      { key: 'CONTACTED', label: 'Contacted', color: '#F59E0B' },
      { key: 'QUALIFIED', label: 'Qualified', color: '#A78BFA' },
      { key: 'NEGOTIATING', label: 'Negotiating', color: '#EC4899' },
      { key: 'WON', label: 'Won', color: '#22C55E' },
      { key: 'LOST', label: 'Lost', color: '#606070' },
    ];

    const OFFER_STAGES: { key: 'PENDING' | 'ACCEPTED' | 'COUNTERED' | 'REJECTED' | 'WITHDRAWN'; label: string; color: string }[] = [
      { key: 'PENDING', label: 'Pending', color: '#3B82F6' },
      { key: 'ACCEPTED', label: 'Accepted', color: '#22C55E' },
      { key: 'COUNTERED', label: 'Countered', color: '#F59E0B' },
      { key: 'REJECTED', label: 'Rejected', color: '#EF4444' },
      { key: 'WITHDRAWN', label: 'Withdrawn', color: '#606070' },
    ];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSubView('analytics')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CONVERSION DEEP DIVE</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Circular gauge card */}
        <View style={styles.convCard}>
          <LinearGradient
            colors={['rgba(34,197,94,0.06)', 'rgba(34,197,94,0.01)']}
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
                <Text style={{ fontFamily: FontFamily.bold, fontSize: 14, color: '#22C55E' }}>
                  {formatGBP(ob.avgAcceptedAmount)}
                </Text>
              </View>
              <View style={styles.benchRow}>
                <Text style={[styles.benchLabel, { width: 170 }]}>Avg time to respond</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: FontFamily.bold, fontSize: 14, color: '#3B82F6' }}>
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
  const renderAnalyticsView = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>SALES · LAST {period}</Text>
          <Text style={styles.headerTitleMain}>Analytics</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
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

      {/* Revenue chart card */}
      <Animated.View style={[styles.revenueCard, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['rgba(220,31,38,0.04)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.revenueTop}>
          <View>
            <Text style={styles.revLabel}>REVENUE · {period}</Text>
            <Text style={styles.revValue}>
              {loading ? '–' : formatGBP(kpis?.totalRevenue ?? 0)}
            </Text>
            {!loading && kpis && renderTrend(kpis.totalRevenueTrend, styles.revChangeText, styles.revChange, 12)}
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartArea}>
          {sparkData.length > 1 ? (
            <SparkLine data={sparkData} width={chartW} height={chartH} />
          ) : (
            <View style={{ height: chartH, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: FontFamily.regular, fontSize: 12, color: '#606070' }}>
                {loading ? 'Loading revenue trend…' : 'Not enough sales yet to chart a trend'}
              </Text>
            </View>
          )}
        </View>

        {/* Chart gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(17,17,22,0.6)']}
          style={styles.chartFade}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Stats grid */}
      <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
        {/* Cars Sold */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>CARS SOLD</Text>
          <Text style={styles.statValue}>
            {loading ? '–' : String(kpis?.totalUnitsSold ?? 0)}
          </Text>
          {!loading && kpis && renderTrend(kpis.totalUnitsSoldTrend, styles.statChangeGreen, styles.statChange, 11)}
        </View>

        {/* Avg Sell Time */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AVG SELL TIME</Text>
          <Text style={styles.statValue}>
            {loading ? '–' : `${kpis?.avgDaysToSell ?? 0}d`}
          </Text>
          {!loading && kpis && renderTrend(kpis.avgDaysToSellTrend, styles.statChangeGreen, styles.statChange, 11)}
        </View>

        {/* Avg Views per Listing */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AVG VIEWS / LISTING</Text>
          <Text style={styles.statValue}>
            {loading ? '–' : String(kpis?.avgViewsPerListing ?? 0)}
          </Text>
          {!loading && kpis && renderTrend(kpis.avgViewsPerListingTrend, styles.statChangeGreen, styles.statChange, 11)}
        </View>

        {/* Listings Live */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>LISTINGS LIVE</Text>
          <Text style={styles.statValue}>
            {loading ? '–' : String(analytics?.inventoryHealth.ACTIVE ?? 0)}
          </Text>
          <View style={styles.statChange}>
            <Ionicons
              name={(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? 'alert-circle' : 'checkmark-circle'}
              size={11}
              color={(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? '#F59E0B' : '#22C55E'}
            />
            <Text style={[styles.statChangeGreen, { color: (analytics?.inventoryHealth.staleCount ?? 0) > 0 ? '#F59E0B' : '#22C55E' }]}>
              {' '}{(analytics?.inventoryHealth.staleCount ?? 0) > 0 ? `${analytics?.inventoryHealth.staleCount} stale 60d+` : 'All listings fresh'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Top Performers */}
      <Text style={styles.sectionLabel}>TOP PERFORMERS</Text>
      <View style={styles.topSection}>
        {loading ? (
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            <ActivityIndicator color="#DC1F26" />
          </View>
        ) : (analytics?.topVehicles ?? []).length === 0 ? (
          <View style={{ paddingVertical: 28, paddingHorizontal: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: 12, color: '#606070', textAlign: 'center' }}>
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
                    <Ionicons name="car-sport-outline" size={18} color="#606070" />
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
          colors={['rgba(34,197,94,0.10)', 'rgba(34,197,94,0.04)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.convCTALeft}>
          <Text style={styles.convCTALabel}>LEAD CONVERSION RATE</Text>
          <Text style={styles.convCTAValue}>
            {loading ? '–' : `${kpis?.leadConversionRate ?? 0}%`}
            {!loading && kpis && (
              <Text style={styles.convCTABench}>
                {'  '}{kpis.leadConversionRateTrend > 0 ? '+' : ''}{kpis.leadConversionRateTrend}% vs prev period
              </Text>
            )}
          </Text>
        </View>
        <View style={styles.convCTARight}>
          <Text style={styles.convCTALink}>Deep dive</Text>
          <Ionicons name="chevron-forward" size={14} color="#22C55E" />
        </View>
      </TouchableOpacity>

      {/* Monthly breakdown */}
      <Text style={styles.sectionLabel}>MONTHLY BREAKDOWN</Text>
      {revenueTrend.length === 0 ? (
        <View style={[styles.monthCard, { justifyContent: 'center', paddingVertical: 36 }]}>
          <Text style={{ fontFamily: FontFamily.regular, fontSize: 12, color: '#606070' }}>
            {loading ? 'Loading monthly trend…' : 'No completed sales yet — monthly trends will appear here once you start selling.'}
          </Text>
        </View>
      ) : (
        <View style={styles.monthCard}>
          {revenueTrend.slice(-6).map((m, i, arr) => {
            const maxRev = Math.max(...arr.map(x => x.revenue), 1);
            const barH = Math.max(4, (m.revenue / maxRev) * 60);
            const isLast = i === arr.length - 1;
            return (
              <View key={m.month} style={styles.monthCol}>
                <Text style={styles.monthRev}>{formatGBP(m.revenue)}</Text>
                <View style={styles.monthBarTrack}>
                  <View
                    style={[
                      styles.monthBarFill,
                      { height: barH, backgroundColor: isLast ? '#DC1F26' : 'rgba(220,31,38,0.35)' },
                    ]}
                  />
                </View>
                <Text style={styles.monthSold}>{m.unitsSold}</Text>
                <Text style={styles.monthName}>{monthLabel(m.month)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <LinearGradient
        colors={['rgba(220,31,38,0.05)', 'rgba(59,130,246,0.03)', '#0A0A0C']}
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
    backgroundColor: '#0A0A0C',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  headerTitleMain: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillActive: {
    backgroundColor: '#DC1F26',
    borderColor: '#DC1F26',
  },
  pillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#606070',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  // ── Revenue card ─────────────────────────────────────────────────────────
  revenueCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  revValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 6,
  },
  revChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revChangeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#22C55E',
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
  statCard: {
    width: HALF_CARD,
    backgroundColor: '#111116',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  statLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 6,
  },
  statChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statChangeGreen: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#22C55E',
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#606070',
    letterSpacing: 1.6,
    marginHorizontal: 28,
    marginBottom: 12,
  },

  // ── Top Performers ───────────────────────────────────────────────────────
  topSection: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankBadgeRed: {
    backgroundColor: '#DC1F26',
  },
  rankText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  perfThumb: {
    width: 52,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 12,
  },
  perfInfo: {
    flex: 1,
  },
  perfTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  perfSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#606070',
  },
  perfPrice: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  perfPriceUnder: {
    textDecorationLine: 'underline',
  },
  perfDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ── Conversion CTA ───────────────────────────────────────────────────────
  convCTA: {
    marginHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    backgroundColor: '#111116',
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
    fontSize: 9,
    color: '#606070',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  convCTAValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: '#22C55E',
    letterSpacing: -0.5,
  },
  convCTABench: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
  },
  convCTARight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  convCTALink: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#22C55E',
  },

  // ── Monthly breakdown bars ───────────────────────────────────────────────
  monthCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 7,
    color: '#606070',
    marginBottom: 6,
    textAlign: 'center',
  },
  monthBarTrack: {
    width: 22,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  monthName: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: '#606070',
  },

  // ── Conversion Deep Dive ─────────────────────────────────────────────────
  convCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.15)',
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
    fontSize: 9,
    color: '#22C55E',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  convCardBig: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  convCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#606070',
  },

  // Funnel card
  funnelCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  funnelArrow: {
    color: '#DC1F26',
  },
  funnelSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#606070',
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
    fontSize: 14,
  },
  funnelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // AI Card
  aiCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.20)',
    backgroundColor: '#111116',
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
    backgroundColor: 'rgba(220,31,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiTextWrap: {
    flex: 1,
  },
  aiLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#DC1F26',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  aiBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#D0D0DA',
    lineHeight: 20,
  },

  // Benchmark card
  benchCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontSize: 12,
    color: '#A0A0AB',
    width: 110,
  },
  benchTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  benchFill: {
    height: '100%',
    borderRadius: 3,
  },
  benchVal: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    width: 42,
    textAlign: 'right',
  },
});
