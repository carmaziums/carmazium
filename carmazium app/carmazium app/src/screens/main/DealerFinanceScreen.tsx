import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getMyFinanceApplications, FinanceApplication, FinanceApplicationStatus } from '../../lib/financeApi';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HALF_CARD = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────── status config ────────────────────────────
// Matches the real FinanceApplicationStatus enum (PENDING/APPROVED/REJECTED/
// COMPLETED) — not web's dealer/finance page, which references "FUNDED" and
// "REVIEWING" statuses that don't exist in the schema and PATCH-updates
// applications via an endpoint that 403s for any user without a
// FINANCE_PARTNER profile (i.e. every real dealer). This screen shows a
// dealer's own applications honestly rather than porting those dead buttons.

const STATUS_CONFIG: Record<
  FinanceApplicationStatus,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  PENDING: {
    label: 'Pending',
    icon: 'time-outline',
    color: Colors.warning,
    bg: Colors.warningAlpha12,
    border: Colors.warningAlpha25,
  },
  APPROVED: {
    label: 'Approved',
    icon: 'checkmark-circle-outline',
    color: Colors.success,
    bg: Colors.successAlpha12,
    border: Colors.successAlpha25,
  },
  COMPLETED: {
    label: 'Completed',
    icon: 'trophy-outline',
    color: Colors.infoBlue,
    bg: Colors.infoBlueAlpha12,
    border: Colors.infoBlueAlpha25,
  },
  REJECTED: {
    label: 'Rejected',
    icon: 'close-circle-outline',
    color: Colors.error,
    bg: Colors.errorAlpha08,
    border: 'rgba(239, 68, 68, 0.25)',
  },
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const formatPrice = (n: number): string => `£${n.toLocaleString('en-GB')}`;

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerFinanceScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [applications, setApplications] = useState<FinanceApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const data = await getMyFinanceApplications();
      setApplications(data);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const counts = applications.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    { PENDING: 0, APPROVED: 0, COMPLETED: 0, REJECTED: 0 } as Record<FinanceApplicationStatus, number>,
  );

  // ─────────────── render helpers ─────────────────────

  const renderSkeletons = () => (
    <View>
      <View style={styles.statsGrid}>
        <Skeleton w={HALF_CARD} h={80} r={16} />
        <Skeleton w={HALF_CARD} h={80} r={16} />
        <Skeleton w={HALF_CARD} h={80} r={16} />
        <Skeleton w={HALF_CARD} h={80} r={16} />
      </View>
      <View style={{ gap: 12, marginTop: 12 }}>
        <Skeleton w={SCREEN_WIDTH - 40} h={90} r={16} />
        <Skeleton w={SCREEN_WIDTH - 40} h={90} r={16} />
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <EmptyState
        icon="card-outline"
        title="No finance applications"
        subtitle="Applications your dealership submits when financing a vehicle purchase will show up here"
      />
    </View>
  );

  const renderStatsGrid = () => (
    <View style={styles.statsGrid}>
      {(Object.keys(STATUS_CONFIG) as FinanceApplicationStatus[]).map((status) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <View key={status} style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon} size={14} color={cfg.color} />
            </View>
            <Text style={styles.statValue}>{counts[status]}</Text>
            <Text style={styles.statLabel}>{cfg.label.toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderApplicationCard = useCallback(({ item }: { item: FinanceApplication }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
    const vehicleTitle = item.listing?.title
      || [item.listing?.make, item.listing?.model].filter(Boolean).join(' ')
      || 'Vehicle';

    return (
      <View style={styles.appCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardCenter}>
            <Text style={styles.vehicleTitle} numberOfLines={1}>{vehicleTitle}</Text>
            <Text style={styles.appliedDate}>Applied {formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.depositAmount}>{formatPrice(item.depositAmount)}</Text>
        </View>

        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMetaText}>{item.termMonths} month term</Text>
          {item.monthlyPayment != null && (
            <>
              <View style={styles.cardMetaDot} />
              <Text style={styles.cardMetaText}>{formatPrice(item.monthlyPayment)}/mo est.</Text>
            </>
          )}
        </View>

        <View style={[styles.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    );
  }, []);

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['rgba(74,222,128,0.05)', 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={styles.headerTitle}>Finance</Text>
        <HamburgerButton />
      </View>

      {/* ── Content ── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 20, marginTop: 20 }}>
          <ErrorBanner message="Could not load finance applications. Check your connection." onRetry={() => fetchData()} />
        </View>
      ) : loading ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeletons()}
          <View style={{ height: 110 }} />
        </ScrollView>
      ) : (
        <FlatList
          style={styles.scroll}
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicationCard}
          ListHeaderComponent={applications.length > 0 ? renderStatsGrid : null}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 110 }} />}
          contentContainerStyle={[styles.scrollContent, applications.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        />
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

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

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },

  // ── Stats grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 12,
  },
  statCard: {
    width: HALF_CARD,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 6,
  },
  statIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xl,
    color: Colors.white,
  },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },

  // ── Application card ──
  appCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCenter: { flex: 1, gap: 2 },
  vehicleTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  appliedDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  depositAmount: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMetaText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  cardMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },

  // ── Status chip ──
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    letterSpacing: 0.3,
  },
});
