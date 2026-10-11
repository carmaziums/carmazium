import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { BottomSheet } from '../../components/BottomSheet';
import { SaleCancellationSheet } from '../../components/SaleCancellationSheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── types ───────────────────────────────

type PurchaseStatus =
  | 'AWAITING_CONFIRMATION'
  | 'REVIEWING_DOCS'
  | 'CHECKS_COMPLETE'
  | 'DELIVERY_REQUESTED';

interface PurchaseItem {
  id: string;
  listingId: string;
  vehicleTitle: string;
  vehicleSubtitle?: string;
  imageUrl?: string;
  purchasePrice: number;
  purchaseDate: string;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  status: PurchaseStatus;
}

interface PurchasesResponse {
  success: boolean;
  data: PurchaseItem[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

// ─────────────────────────── helpers ──────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatPrice = (n: number): string => `£${n.toLocaleString('en-GB')}`;

// ─────────────────────── status config ────────────────────────────

const STATUS_CONFIG: Record<
  PurchaseStatus,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  AWAITING_CONFIRMATION: {
    label: 'Awaiting Confirmation',
    icon: 'time-outline',
    color: Colors.warning,
    bg: Colors.warningAlpha12,
    border: Colors.warningAlpha25,
  },
  REVIEWING_DOCS: {
    label: 'Reviewing Documents',
    icon: 'document-text-outline',
    color: Colors.infoBlue,
    bg: Colors.infoBlueAlpha12,
    border: Colors.infoBlueAlpha25,
  },
  CHECKS_COMPLETE: {
    label: 'Checks Complete',
    icon: 'checkmark-circle-outline',
    color: Colors.success,
    bg: Colors.successAlpha12,
    border: Colors.successAlpha25,
  },
  DELIVERY_REQUESTED: {
    label: 'Delivery Requested',
    icon: 'car-sport-outline',
    color: Colors.palePurple_a78bfa,
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerPurchasesScreen: React.FC = () => {
  const { palette, resolvedAppearance } = useNativeAppearance();
  const themed = useDealerPurchasesScreenPalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [summaryItem, setSummaryItem] = useState<PurchaseItem | null>(null);
  const [cancelItem, setCancelItem] = useState<PurchaseItem | null>(null);

  const totalSpent = purchases.reduce((sum, p) => sum + p.purchasePrice, 0);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const res = await apiClient<PurchasesResponse>('/dealers/purchases?page=1&limit=100');
      if (res?.success) {
        setPurchases(Array.isArray(res.data) ? res.data : []);
      }
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

  // ─────────────── actions ────────────────

  const handleEmailSeller = (item: PurchaseItem) => {
    if (item.sellerEmail) Linking.openURL(`mailto:${item.sellerEmail}`);
  };

  const handleCallSeller = (item: PurchaseItem) => {
    if (item.sellerPhone) Linking.openURL(`tel:${item.sellerPhone}`);
  };

  // ─────────────── render helpers ─────────────────────

  const renderSkeletons = () => (
    <View style={{ gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={`sk-${i}`} w={SCREEN_WIDTH - 32} h={90} r={18} />
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={themed.emptyState}>
      <EmptyState
        icon="receipt-outline"
        title="No purchases yet"
        subtitle="Vehicles your dealership buys will show up here with their delivery status"
      />
    </View>
  );

  const renderTotalsBar = () => (
    <View style={themed.totalsCard}>
      <View style={themed.totalCol}>
        <Text style={themed.totalLabel}>TOTAL SPENT</Text>
        <Text style={themed.totalValue}>{formatPrice(totalSpent)}</Text>
      </View>
      <View style={themed.totalDivider} />
      <View style={themed.totalCol}>
        <Text style={themed.totalLabel}>VEHICLES PURCHASED</Text>
        <Text style={themed.totalValue}>{purchases.length}</Text>
      </View>
    </View>
  );

  const renderPurchaseCard = useCallback(({ item }: { item: PurchaseItem }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.AWAITING_CONFIRMATION;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSummaryItem(item)}
      >
        <View style={themed.purchaseCard}>
          <View style={themed.cardTopRow}>
            {/* Thumbnail */}
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={themed.thumb} contentFit="cover" transition={200} cachePolicy="memory-disk" alt={item.vehicleTitle} />
            ) : (
              <View style={[themed.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="car-outline" size={20} color={Colors.textMuted} />
              </View>
            )}

            {/* Center text */}
            <View style={themed.cardCenter}>
              <Text style={themed.vehicleTitle} numberOfLines={1}>{item.vehicleTitle}</Text>
              {!!item.vehicleSubtitle && (
                <Text style={themed.vehicleSubtitle} numberOfLines={1}>{item.vehicleSubtitle}</Text>
              )}
              <Text style={themed.purchaseDate}>Purchased {formatDate(item.purchaseDate)}</Text>
            </View>

            {/* Price */}
            <Text style={themed.purchasePrice}>{formatPrice(item.purchasePrice)}</Text>
          </View>

          {/* Status pipeline chip */}
          <View style={[themed.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.color} />
            <Text style={[themed.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, []);

  // ─────────────── main render ───────────────────────

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'} translucent backgroundColor={palette.bgBody} />

      <LinearGradient
        colors={['rgba(167,139,250,0.05)', 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={themed.header}>
        <IconButton style={themed.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <Text style={themed.headerTitle}>Purchases</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {purchases.length > 0 && (
            <View style={themed.countBadge}>
              <Text style={themed.countBadgeText}>
                {purchases.length > 99 ? '99+' : purchases.length}
              </Text>
            </View>
          )}
          <HamburgerButton />
        </View>
      </View>

      {/* ── Content ── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 16, marginTop: 20 }}>
          <ErrorBanner message="Could not load purchases. Check your connection." onRetry={() => fetchData()} />
        </View>
      ) : loading ? (
        <ScrollView style={themed.scroll} contentContainerStyle={themed.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeletons()}
          <View style={{ height: 110 }} />
        </ScrollView>
      ) : (
        // Virtualized — a dealership's purchase history grows over its
        // lifetime, so we only mount rows near the viewport.
        <FlatList
          style={themed.scroll}
          data={purchases}
          keyExtractor={(item) => item.id}
          renderItem={renderPurchaseCard}
          ListHeaderComponent={purchases.length > 0 ? renderTotalsBar : null}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 110 }} />}
          contentContainerStyle={[themed.scrollContent, purchases.length === 0 && { flexGrow: 1 }]}
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

      {cancelItem && (
        <SaleCancellationSheet
          visible
          listingId={cancelItem.listingId}
          vehicleTitle={cancelItem.vehicleTitle}
          onClose={() => setCancelItem(null)}
          onCreated={() => void fetchData(true)}
        />
      )}

      {/* ── Purchase summary / seller contact modal ── */}
      <BottomSheet
        visible={summaryItem != null}
        onClose={() => setSummaryItem(null)}
      >
          {summaryItem && (
            // gap replicates the old modalSheet wrapper's spacing, which BottomSheet's
            // own sheet style doesn't provide
            <View style={{ gap: 12 }}>
              <View style={themed.modalTopRow}>
                {summaryItem.imageUrl ? (
                  <Image source={{ uri: summaryItem.imageUrl }} style={themed.modalThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" alt={summaryItem.vehicleTitle} />
                ) : (
                  <View style={[themed.modalThumb, styles.thumbPlaceholder]}>
                    <Ionicons name="car-outline" size={24} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={themed.modalVehicleTitle} numberOfLines={1}>{summaryItem.vehicleTitle}</Text>
                  {!!summaryItem.vehicleSubtitle && (
                    <Text style={themed.modalVehicleSubtitle} numberOfLines={1}>{summaryItem.vehicleSubtitle}</Text>
                  )}
                </View>
              </View>

              <View style={themed.modalDivider} />

              {/* Price + date */}
              <View style={themed.modalRow}>
                <Text style={themed.modalLabel}>PURCHASE PRICE</Text>
                <Text style={themed.modalValue}>{formatPrice(summaryItem.purchasePrice)}</Text>
              </View>
              <View style={themed.modalRow}>
                <Text style={themed.modalLabel}>PURCHASE DATE</Text>
                <Text style={themed.modalValueSecondary}>{formatDate(summaryItem.purchaseDate)}</Text>
              </View>

              {/* Status */}
              {(() => {
                const cfg = STATUS_CONFIG[summaryItem.status] ?? STATUS_CONFIG.AWAITING_CONFIRMATION;
                return (
                  <View style={[themed.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border, alignSelf: 'flex-start' }]}>
                    <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                    <Text style={[themed.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })()}

              <View style={themed.modalDivider} />

              {/* Seller details */}
              <Text style={themed.sellerSectionLabel}>SELLER DETAILS</Text>
              <View style={themed.sellerRow}>
                <View style={themed.sellerAvatar}>
                  <Text style={themed.sellerInitial}>
                    {summaryItem.sellerName?.charAt(0)?.toUpperCase() ?? 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={themed.sellerName} numberOfLines={1}>
                    {summaryItem.sellerName ?? 'Private Seller'}
                  </Text>
                  {!!summaryItem.sellerEmail && (
                    <Text style={themed.sellerSub} numberOfLines={1}>{summaryItem.sellerEmail}</Text>
                  )}
                </View>
              </View>

              <View style={themed.sellerActionsRow}>
                <TouchableOpacity
                  style={[themed.sellerActionBtn, !summaryItem.sellerEmail && styles.sellerActionBtnDisabled]}
                  activeOpacity={0.75}
                  disabled={!summaryItem.sellerEmail}
                  onPress={() => handleEmailSeller(summaryItem)}
                >
                  <Ionicons name="mail-outline" size={15} color={summaryItem.sellerEmail ? Colors.textPrimary : Colors.textMuted} />
                  <Text style={[themed.sellerActionText, !summaryItem.sellerEmail && { color: Colors.textMuted }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themed.sellerActionBtn, !summaryItem.sellerPhone && styles.sellerActionBtnDisabled]}
                  activeOpacity={0.75}
                  disabled={!summaryItem.sellerPhone}
                  onPress={() => handleCallSeller(summaryItem)}
                >
                  <Ionicons name="call-outline" size={15} color={summaryItem.sellerPhone ? Colors.textPrimary : Colors.textMuted} />
                  <Text style={[themed.sellerActionText, !summaryItem.sellerPhone && { color: Colors.textMuted }]}>Call</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.accentAlpha30,
                  backgroundColor: Colors.accentAlpha08,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.75}
                onPress={() => {
                  const item = summaryItem;
                  setSummaryItem(null);
                  setCancelItem(item);
                }}
              >
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent }}>
                  Request Sale Cancellation
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={themed.modalCloseBtn}
                activeOpacity={0.75}
                onPress={() => setSummaryItem(null)}
              >
                <Text style={themed.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
      </BottomSheet>
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
  headerPlaceholder: { width: 38 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.palePurple_a78bfa,
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },

  // ── Totals bar ──
  totalsCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalCol: { flex: 1, gap: 4 },
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
    height: 100,
    borderRadius: Radius.inline,
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

  // ── Purchase card ──
  purchaseCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 14,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    flexShrink: 0,
  },
  thumbPlaceholder: {
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: { flex: 1, gap: 2 },
  vehicleTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  vehicleSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  purchaseDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  purchasePrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.md,
    color: Colors.white,
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

  // ── Modal ──
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    flexShrink: 0,
  },
  modalVehicleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  modalVehicleSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha08,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  modalValueSecondary: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // ── Seller section ──
  sellerSectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size10,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentAlpha12,
    borderWidth: 1,
    borderColor: Colors.accentAlpha25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.accent,
  },
  sellerName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.size14,
    color: Colors.textPrimary,
  },
  sellerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sellerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sellerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  sellerActionBtnDisabled: {
    opacity: 0.4,
  },
  sellerActionText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: Radius.inline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
});

function useDealerPurchasesScreenPalette() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...styles,
    container: [styles.container, { backgroundColor: palette.bgBody }],
    header: [styles.header, { backgroundColor: palette.bgHeader, borderBottomColor: palette.borderDefault }],
    backBtn: [styles.backBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    headerTitle: [styles.headerTitle, { color: palette.textPrimary }],
    totalsCard: [styles.totalsCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    totalDivider: [styles.totalDivider, { backgroundColor: palette.borderDefault }],
    totalLabel: [styles.totalLabel, { color: palette.textMuted }],
    totalValue: [styles.totalValue, { color: palette.textPrimary }],
    skeletonCard: [styles.skeletonCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    emptyState: [styles.emptyState, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    emptyTitle: [styles.emptyTitle, { color: palette.textPrimary }],
    emptySub: [styles.emptySub, { color: palette.textSecondary }],
    purchaseCard: [styles.purchaseCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    vehicleTitle: [styles.vehicleTitle, { color: palette.textPrimary }],
    vehicleSubtitle: [styles.vehicleSubtitle, { color: palette.textSecondary }],
    purchaseDate: [styles.purchaseDate, { color: palette.textMuted }],
    purchasePrice: [styles.purchasePrice, { color: palette.textPrimary }],
    modalVehicleTitle: [styles.modalVehicleTitle, { color: palette.textPrimary }],
    modalVehicleSubtitle: [styles.modalVehicleSubtitle, { color: palette.textSecondary }],
    modalDivider: [styles.modalDivider, { backgroundColor: palette.borderDefault }],
    modalLabel: [styles.modalLabel, { color: palette.textMuted }],
    modalValue: [styles.modalValue, { color: palette.textPrimary }],
    modalValueSecondary: [styles.modalValueSecondary, { color: palette.textSecondary }],
    sellerSectionLabel: [styles.sellerSectionLabel, { color: palette.textSecondary }],
    sellerName: [styles.sellerName, { color: palette.textPrimary }],
    sellerSub: [styles.sellerSub, { color: palette.textMuted }],
    sellerActionBtn: [styles.sellerActionBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    sellerActionText: [styles.sellerActionText, { color: palette.textPrimary }],
    modalCloseBtn: [styles.modalCloseBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    modalCloseBtnText: [styles.modalCloseBtnText, { color: palette.textPrimary }],
  }), [palette]);
}
