import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

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
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
  },
  REVIEWING_DOCS: {
    label: 'Reviewing Documents',
    icon: 'document-text-outline',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.25)',
  },
  CHECKS_COMPLETE: {
    label: 'Checks Complete',
    icon: 'checkmark-circle-outline',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.25)',
  },
  DELIVERY_REQUESTED: {
    label: 'Delivery Requested',
    icon: 'car-sport-outline',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const DealerPurchasesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [summaryItem, setSummaryItem] = useState<PurchaseItem | null>(null);

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
    <View style={styles.emptyState}>
      <EmptyState
        icon="receipt-outline"
        title="No purchases yet"
        subtitle="Vehicles your dealership buys will show up here with their delivery status"
      />
    </View>
  );

  const renderTotalsBar = () => (
    <View style={styles.totalsCard}>
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>TOTAL SPENT</Text>
        <Text style={styles.totalValue}>{formatPrice(totalSpent)}</Text>
      </View>
      <View style={styles.totalDivider} />
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>VEHICLES PURCHASED</Text>
        <Text style={styles.totalValue}>{purchases.length}</Text>
      </View>
    </View>
  );

  const renderPurchaseCard = (item: PurchaseItem) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.AWAITING_CONFIRMATION;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSummaryItem(item)}
      >
        <View style={styles.purchaseCard}>
          <View style={styles.cardTopRow}>
            {/* Thumbnail */}
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" transition={200} cachePolicy="memory-disk" alt={item.vehicleTitle} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="car-outline" size={20} color={Colors.textMuted} />
              </View>
            )}

            {/* Center text */}
            <View style={styles.cardCenter}>
              <Text style={styles.vehicleTitle} numberOfLines={1}>{item.vehicleTitle}</Text>
              {!!item.vehicleSubtitle && (
                <Text style={styles.vehicleSubtitle} numberOfLines={1}>{item.vehicleSubtitle}</Text>
              )}
              <Text style={styles.purchaseDate}>Purchased {formatDate(item.purchaseDate)}</Text>
            </View>

            {/* Price */}
            <Text style={styles.purchasePrice}>{formatPrice(item.purchasePrice)}</Text>
          </View>

          {/* Status pipeline chip */}
          <View style={[styles.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.color} />
            <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['rgba(167,139,250,0.05)', 'rgba(10,10,12,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.75}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Purchases</Text>

        {purchases.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {purchases.length > 99 ? '99+' : purchases.length}
            </Text>
          </View>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      {/* ── Content ── */}
      {fetchError ? (
        <View style={{ marginHorizontal: 16, marginTop: 20 }}>
          <ErrorBanner message="Could not load purchases. Check your connection." onRetry={() => fetchData()} />
        </View>
      ) : loading ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSkeletons()}
          <View style={{ height: 110 }} />
        </ScrollView>
      ) : (
        // Virtualized — a dealership's purchase history grows over its
        // lifetime, so we only mount rows near the viewport.
        <FlatList
          style={styles.scroll}
          data={purchases}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderPurchaseCard(item)}
          ListHeaderComponent={purchases.length > 0 ? renderTotalsBar : null}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<View style={{ height: 110 }} />}
          contentContainerStyle={[styles.scrollContent, purchases.length === 0 && { flexGrow: 1 }]}
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

      {/* ── Purchase summary / seller contact modal ── */}
      <Modal
        visible={summaryItem != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSummaryItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSummaryItem(null)}
          />
          {summaryItem && (
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.modalHandle} />

              <View style={styles.modalTopRow}>
                {summaryItem.imageUrl ? (
                  <Image source={{ uri: summaryItem.imageUrl }} style={styles.modalThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" alt={summaryItem.vehicleTitle} />
                ) : (
                  <View style={[styles.modalThumb, styles.thumbPlaceholder]}>
                    <Ionicons name="car-outline" size={24} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalVehicleTitle} numberOfLines={1}>{summaryItem.vehicleTitle}</Text>
                  {!!summaryItem.vehicleSubtitle && (
                    <Text style={styles.modalVehicleSubtitle} numberOfLines={1}>{summaryItem.vehicleSubtitle}</Text>
                  )}
                </View>
              </View>

              <View style={styles.modalDivider} />

              {/* Price + date */}
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>PURCHASE PRICE</Text>
                <Text style={styles.modalValue}>{formatPrice(summaryItem.purchasePrice)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>PURCHASE DATE</Text>
                <Text style={styles.modalValueSecondary}>{formatDate(summaryItem.purchaseDate)}</Text>
              </View>

              {/* Status */}
              {(() => {
                const cfg = STATUS_CONFIG[summaryItem.status] ?? STATUS_CONFIG.AWAITING_CONFIRMATION;
                return (
                  <View style={[styles.statusChip, { backgroundColor: cfg.bg, borderColor: cfg.border, alignSelf: 'flex-start' }]}>
                    <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                    <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })()}

              <View style={styles.modalDivider} />

              {/* Seller details */}
              <Text style={styles.sellerSectionLabel}>SELLER DETAILS</Text>
              <View style={styles.sellerRow}>
                <View style={styles.sellerAvatar}>
                  <Text style={styles.sellerInitial}>
                    {summaryItem.sellerName?.charAt(0)?.toUpperCase() ?? 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {summaryItem.sellerName ?? 'Private Seller'}
                  </Text>
                  {!!summaryItem.sellerEmail && (
                    <Text style={styles.sellerSub} numberOfLines={1}>{summaryItem.sellerEmail}</Text>
                  )}
                </View>
              </View>

              <View style={styles.sellerActionsRow}>
                <TouchableOpacity
                  style={[styles.sellerActionBtn, !summaryItem.sellerEmail && styles.sellerActionBtnDisabled]}
                  activeOpacity={0.75}
                  disabled={!summaryItem.sellerEmail}
                  onPress={() => handleEmailSeller(summaryItem)}
                >
                  <Ionicons name="mail-outline" size={15} color={summaryItem.sellerEmail ? Colors.textPrimary : Colors.textMuted} />
                  <Text style={[styles.sellerActionText, !summaryItem.sellerEmail && { color: Colors.textMuted }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sellerActionBtn, !summaryItem.sellerPhone && styles.sellerActionBtnDisabled]}
                  activeOpacity={0.75}
                  disabled={!summaryItem.sellerPhone}
                  onPress={() => handleCallSeller(summaryItem)}
                >
                  <Ionicons name="call-outline" size={15} color={summaryItem.sellerPhone ? Colors.textPrimary : Colors.textMuted} />
                  <Text style={[styles.sellerActionText, !summaryItem.sellerPhone && { color: Colors.textMuted }]}>Call</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
                onPress={() => setSummaryItem(null)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
  headerPlaceholder: { width: 38 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A78BFA',
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
  scroll: { flex: 1 },
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
  totalCol: { flex: 1, gap: 4 },
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
    height: 100,
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

  // ── Purchase card ──
  purchaseCard: {
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: { flex: 1, gap: 2 },
  vehicleTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  vehicleSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  purchaseDate: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  purchasePrice: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: '#FFFFFF',
  },

  // ── Status chip ──
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: '#16161C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 4,
  },
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
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
    fontSize: 10,
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
    backgroundColor: 'rgba(220,31,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,31,38,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.accent,
  },
  sellerName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sellerSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sellerActionBtnDisabled: {
    opacity: 0.4,
  },
  sellerActionText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
});
