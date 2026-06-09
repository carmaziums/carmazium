import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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

// ─────────────────────────── types ───────────────────────────────

interface HistoryItem {
  id: string;
  price: number;
  listing: { title: string };
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
    bids: any[];
    offers: any[];
    history: HistoryItem[];
  };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

// ═══════════════════════════ COMPONENT ════════════════════════════

export const BuyerPurchaseHistoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tappingId, setTappingId] = useState<string | null>(null);

  const totalSpent = history.reduce((sum, h) => sum + h.price, 0);

  // ── fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    apiClient<BuyerDashResponse>('/dashboard/buyer')
      .then(res => {
        if (res.success) setHistory(res.data?.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        <Text style={styles.totalValue}>{history.length}</Text>
      </View>
    </View>
  );

  const renderHistoryCard = (item: HistoryItem) => {
    const isNavigating = tappingId === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.75}
        onPress={() => handleViewVehicle(item)}
        disabled={isNavigating}
      >
        <View style={[styles.historyCard, isNavigating && { opacity: 0.6 }]}>
          {/* Left icon circle */}
          <View style={styles.iconCircle}>
            {isNavigating ? (
              <ActivityIndicator size="small" color="#22C55E" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            )}
          </View>

          {/* Center text */}
          <View style={styles.historyCenter}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.listing?.title ?? 'Vehicle'}
            </Text>
            <Text style={styles.historyDate}>
              Purchased {formatDate(item.createdAt)}
            </Text>
          </View>

          {/* Right price + chip */}
          <View style={styles.historyRight}>
            <Text style={styles.historyPrice}>
              £{item.price.toLocaleString('en-GB')}
            </Text>
            <View style={styles.completedChip}>
              <Text style={styles.completedChipText}>COMPLETED</Text>
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
      >
        {/* Totals bar — only when there's data */}
        {!loading && history.length > 0 && renderTotalsBar()}

        {loading
          ? renderSkeletons()
          : history.length === 0
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
    backgroundColor: '#22C55E',
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
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },

  // ── Totals bar ──
  totalsCard: {
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  totalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
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

  // ── History card ──
  historyCard: {
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
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
    fontSize: 14,
    color: '#FFFFFF',
  },
  historyDate: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Right
  historyRight: {
    alignItems: 'flex-end',
  },
  historyPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: '#FFFFFF',
  },
  completedChip: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  completedChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#22C55E',
  },
});
