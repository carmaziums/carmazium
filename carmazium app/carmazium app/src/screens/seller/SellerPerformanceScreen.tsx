import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { FontFamily } from '../../constants/typography';

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
}

// ─────────────────────────── helpers ──────────────────────────────

const formatCurrency = (n: number): string => {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}k`;
  return `£${n.toLocaleString('en-GB')}`;
};

const formatViews = (n: number): string => {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerPerformanceScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<SellerPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: SellerPerformanceData }>('/listings/performance');
      if (res?.success && res.data) {
        setData(res.data);
      }
    } catch {
      // silently fail — empty state covers it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderSkeleton = () => (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={styles.statsGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.statCard, styles.skeletonBlock]} />
        ))}
      </View>
      <View style={[styles.skeletonBlock, { height: 180, borderRadius: 16, marginTop: 24 }]} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No performance data yet</Text>
      <Text style={styles.emptySub}>Once your listings start getting views, your stats will appear here.</Text>
    </View>
  );

  const renderViewsChart = () => {
    if (!data || data.recentListingViews.length === 0) return null;
    const maxViews = Math.max(...data.recentListingViews.map((l) => l.views), 1);

    return (
      <View>
        <Text style={styles.sectionLabel}>RECENT LISTING VIEWS</Text>
        <View style={styles.chartCard}>
          {data.recentListingViews.map((item, i) => (
            <View key={item.id} style={styles.viewRow}>
              <Text style={styles.viewRowLabel} numberOfLines={1}>{item.title}</Text>
              <View style={styles.viewTrack}>
                <View
                  style={[
                    styles.viewFill,
                    {
                      width: `${Math.max(6, (item.views / maxViews) * 100)}%`,
                      backgroundColor: i === 0 ? Colors.accent : 'rgba(220,31,38,0.35)',
                    },
                  ]}
                />
              </View>
              <Text style={styles.viewRowValue}>{formatViews(item.views)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.06)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.75} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          renderSkeleton()
        ) : !data ? (
          renderEmptyState()
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <Ionicons name="cash-outline" size={16} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{formatCurrency(data.totalRevenue)}</Text>
                <Text style={styles.statLabel}>TOTAL REVENUE</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Ionicons name="eye-outline" size={16} color="#3B82F6" />
                </View>
                <Text style={styles.statValue}>{formatViews(data.totalViews)}</Text>
                <Text style={styles.statLabel}>TOTAL VIEWS</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Ionicons name="car-sport-outline" size={16} color={Colors.warning} />
                </View>
                <Text style={styles.statValue}>{data.totalListings}</Text>
                <Text style={styles.statLabel}>LISTINGS</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: 'rgba(220,31,38,0.12)' }]}>
                  <Ionicons name="trending-up-outline" size={16} color={Colors.accent} />
                </View>
                <Text style={styles.statValue}>{data.conversionRate.toFixed(1)}%</Text>
                <Text style={styles.statLabel}>CONVERSION</Text>
              </View>
            </View>

            {renderViewsChart()}

            {data.recentListingViews.length === 0 && (
              <Text style={styles.sectionEmptyText}>No recent listing view activity to show.</Text>
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 16,
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
    fontSize: 19,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionEmptyText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    marginTop: 20,
  },

  chartCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewRowLabel: {
    width: 96,
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },
  viewTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  viewFill: {
    height: '100%',
    borderRadius: 4,
  },
  viewRowValue: {
    width: 36,
    textAlign: 'right',
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },

  skeletonBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
