import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { PurchaseDestinations, type PurchaseDestination } from '../../components/dealer/PurchaseDestinations';
import {
  getMySaleCancellations,
  SALE_CANCELLATION_REASON_LABELS,
  type SaleCancellationRequest,
} from '../../lib/saleCancellationApi';
import { useAuthStore } from '../../store/authStore';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { CompletePurchaseButton } from '../../components/purchases/CompletePurchaseButton';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── types ───────────────────────────────

type PurchaseStatus =
  | 'AWAITING_CONFIRMATION'
  | 'REVIEWING_DOCS'
  | 'CHECKS_COMPLETE'
  | 'DELIVERY_REQUESTED'
  | 'SOLD';

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
  retailSold?: boolean;
  purchaseChannel?: 'AUCTION' | 'RETAIL';
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

// An accepted retail offer reserves the car but is not a Sale until either
// party completes it. Same rule as web pendingRetailPurchases().
interface PendingRetailOffer {
  id: string;
  listingId: string;
  status: string;
  amount: number;
  counterAmount?: number | null;
  finalAmount?: number | null;
  updatedAt: string;
  listing?: { id?: string; title?: string; status?: string; images?: string[] } | null;
}

const pendingRetailFrom = (offers: PendingRetailOffer[], recordedListingIds: Set<string>): PendingRetailOffer[] => {
  const seen = new Set<string>();
  return offers
    .map(o => ({ ...o, listingId: o.listingId || o.listing?.id || '' }))
    .filter(o => o.listingId !== '')
    .filter(o => o.status === 'ACCEPTED' && o.listing?.status === 'OFFER_ACCEPTED' && !recordedListingIds.has(o.listingId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter(o => (seen.has(o.listingId) ? false : (seen.add(o.listingId), true)));
};

const PURCHASE_PAGE_SIZE = 100;
const PURCHASE_MAX_PAGES = 20; // safety cap, same as web

async function loadAllPurchasePages(): Promise<PurchaseItem[]> {
  const page = (n: number) => apiClient<PurchasesResponse>(`/dealers/purchases?page=${n}&limit=${PURCHASE_PAGE_SIZE}`);
  const first = await page(1);
  const lastPage = Math.min(Math.max(1, Number(first?.pagination?.totalPages) || 1), PURCHASE_MAX_PAGES);
  const rest = lastPage > 1
    ? await Promise.all(Array.from({ length: lastPage - 1 }, (_, i) => page(i + 2)))
    : [];
  return [first, ...rest].flatMap(r => (r?.success && Array.isArray(r.data) ? r.data : []));
}

// Same split as web (src/lib/purchaseDestinations.ts): Purchase History holds
// completed stages and cancelled sales; earlier stages stay in All Purchases.
// A view filter only — it never changes a purchase's status.
const HISTORY_STATUSES: PurchaseStatus[] = ['SOLD', 'CHECKS_COMPLETE', 'DELIVERY_REQUESTED'];
const STATUS_FILTER_ORDER: PurchaseStatus[] = [
  'AWAITING_CONFIRMATION', 'SOLD', 'REVIEWING_DOCS', 'CHECKS_COMPLETE', 'DELIVERY_REQUESTED',
];

const matchesSearch = (fields: (string | undefined | null)[], query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compact = q.replace(/\s+/g, '');
  return fields.some(field => {
    if (!field) return false;
    const value = field.toLowerCase();
    return value.includes(q) || value.replace(/\s+/g, '').includes(compact);
  });
};

// ─────────────────────── status config ────────────────────────────

const STATUS_CONFIG: Record<
  PurchaseStatus,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  SOLD: {
    // The dealer bought this car, so it reads "Purchased", as on web.
    label: 'Purchased',
    icon: 'checkmark-circle-outline',
    color: Colors.success,
    bg: Colors.successAlpha12,
    border: Colors.successAlpha25,
  },
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<MainStackParamList, 'DealerPurchases'>>();
  const isHistory = route.params?.view === 'history';
  const isRetail = route.params?.view === 'retail';
  const userId = useAuthStore((s) => s.user?.id);
  // Staff act for the dealership owner, whose id is on every Sale.
  const { access } = useDealerAccess();
  const dealershipBuyerId = access?.ownerUserId ?? userId;

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseStatus>('ALL');
  const [cancelled, setCancelled] = useState<SaleCancellationRequest[]>([]);
  const [pendingRetail, setPendingRetail] = useState<PendingRetailOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Switching destination resets the filter so a stage hidden in this view
  // can't leave the list looking empty.
  useEffect(() => { setStatusFilter('ALL'); }, [isHistory, isRetail]);

  const visible = useMemo(() => purchases.filter(p => {
    if (isRetail && !(p.purchaseChannel === 'RETAIL' || (!p.purchaseChannel && p.retailSold))) return false;
    if (isHistory && !HISTORY_STATUSES.includes(p.status)) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return matchesSearch([p.vehicleTitle, p.vehicleSubtitle, p.sellerName, p.id], query);
  }), [purchases, isHistory, isRetail, statusFilter, query]);
  // Same rule as web buyerCancelledSales: the server's viewer.isBuyer is
  // authoritative; otherwise compare with the dealership owner id.
  const shownCancelled = useMemo(() => (isHistory ? cancelled : [])
    .filter(c => c.status === 'APPROVED' && (typeof c.viewer?.isBuyer === 'boolean'
      ? c.viewer.isBuyer
      : !!dealershipBuyerId && c.buyerId === dealershipBuyerId))
    .filter(c => matchesSearch([c.listing?.title, c.listing?.vrm, c.id], query)), [cancelled, isHistory, query, dealershipBuyerId]);
  const statusChoices = STATUS_FILTER_ORDER.filter(s =>
    (!isHistory || HISTORY_STATUSES.includes(s)) && (s === statusFilter || purchases.some(p =>
      (!isRetail || p.purchaseChannel === 'RETAIL' || (!p.purchaseChannel && p.retailSold)) && p.status === s)));

  const totalSpent = visible.reduce((sum, p) => sum + p.purchasePrice, 0);

  const selectDestination = useCallback((destination: PurchaseDestination) => {
    if (destination === 'wins') navigation.navigate('SellerAuctions', { initialTab: 'WON' });
    else navigation.setParams({ view: destination === 'history' ? 'history' : destination === 'retail' ? 'retail' : 'all' });
  }, [navigation]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const [all, cancellations, offers] = await Promise.all([
        // Every page (as on web), so search and history include older purchases.
        loadAllPurchasePages(),
        // An approved cancellation deletes the Sale, so the request is the
        // only remaining record. Only buyer-side, approved ones are history.
        isHistory
          ? getMySaleCancellations('purchase-history').catch(() => [] as SaleCancellationRequest[])
          : Promise.resolve([] as SaleCancellationRequest[]),
        // Agreed retail deals (Sale Pending) belong to All Purchases only.
        isHistory
          ? Promise.resolve([] as PendingRetailOffer[])
          : apiClient<{ data: PendingRetailOffer[] }>('/offers/my').then(r => r?.data ?? []).catch(() => [] as PendingRetailOffer[]),
      ]);
      setCancelled(cancellations);
      setPendingRetail(pendingRetailFrom(offers, new Set(all.map(p => p.listingId))));
      setPurchases(all.map(item => ({ ...item, status: item.retailSold ? 'SOLD' as const : item.status })));
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isHistory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─────────────── render helpers ─────────────────────

  const renderSkeletons = () => (
    <View style={{ gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={`sk-${i}`} w={SCREEN_WIDTH - 32} h={90} r={18} />
      ))}
    </View>
  );

  const narrowed = query.trim() !== '' || statusFilter !== 'ALL';
  const renderEmptyState = () => (shownCancelled.length > 0 || shownPendingRetail.length > 0 ? null : (
    <View style={styles.emptyState}>
      <EmptyState
        icon="receipt-outline"
        title={narrowed ? 'No purchases match' : isHistory ? 'No completed purchases yet' : isRetail ? 'No retail purchases yet' : 'No purchases yet'}
        subtitle={narrowed
          ? 'Try a different search or status.'
          : isHistory
            ? 'Purchased, Checks Complete and Delivery Requested purchases, plus cancelled sales, are kept here. Earlier stages are under All Purchases.'
            : isRetail
              ? 'Accepted retail offers can be viewed under My Offers. Recorded retail purchases appear here at every stage.'
              : 'Vehicles your dealership buys will show up here with their delivery status'}
      />
    </View>
  ));

  const renderFilters = () => (
    <View style={styles.filters}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search vehicle, reg, seller or reference"
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="Search purchases"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      {statusChoices.length > 0 && (
        // Wraps onto a second line instead of scrolling off-screen.
        <View style={styles.statusWrap} accessibilityLabel="Status">
          {(['ALL', ...statusChoices] as ('ALL' | PurchaseStatus)[]).map(s => {
            const selected = statusFilter === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusPill, selected && styles.statusPillActive]}
                onPress={() => setStatusFilter(s)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.statusPillText, selected && styles.statusPillTextActive]}>
                  {s === 'ALL' ? (isHistory ? 'All completed' : 'All statuses') : STATUS_CONFIG[s].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const shownPendingRetail = isHistory || statusFilter !== 'ALL' ? [] : pendingRetail.filter(o =>
    matchesSearch([o.listing?.title, o.id], query));
  const renderPendingRetail = () => (shownPendingRetail.length === 0 ? null : (
    <View style={styles.pendingSection}>
      <Text style={styles.totalLabel}>SALE PENDING ({shownPendingRetail.length})</Text>
      <Text style={styles.pendingHint}>
        The seller accepted your offer and the car is reserved for you. Once you have paid, either you or the seller can complete the sale.
      </Text>
      {shownPendingRetail.map(o => (
        <View key={o.id} style={styles.purchaseCard}>
          <View style={styles.cardTopRow}>
            {o.listing?.images?.[0] ? (
              <Image source={{ uri: o.listing.images[0] }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="car-outline" size={20} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.cardCenter}>
              <Text style={styles.vehicleTitle} numberOfLines={1}>{o.listing?.title || 'Retail vehicle'}</Text>
              <Text style={styles.purchaseDate}>Accepted {formatDate(o.updatedAt)}</Text>
            </View>
            <Text style={styles.purchasePrice}>{formatPrice(Number(o.finalAmount ?? o.counterAmount ?? o.amount))}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: Colors.warningAlpha12, borderColor: Colors.warningAlpha25 }]}>
            <Ionicons name="time-outline" size={13} color={Colors.warning} />
            <Text style={[styles.statusChipText, { color: Colors.warning }]}>Sale Pending</Text>
          </View>
          <TouchableOpacity style={styles.pendingLink} onPress={() => navigation.navigate('DealerMyOffers')} accessibilityRole="button">
            <Text style={styles.pendingLinkText}>View accepted offer and contact seller</Text>
          </TouchableOpacity>
          <CompletePurchaseButton listingId={o.listingId} onCompleted={() => void fetchData(true)} />
        </View>
      ))}
    </View>
  ));

  const renderCancelled = () => (shownCancelled.length === 0 ? null : (
    <View style={styles.cancelledSection}>
      <Text style={styles.totalLabel}>CANCELLED SALES ({shownCancelled.length})</Text>
      {shownCancelled.map(c => (
        <TouchableOpacity
          key={c.id}
          style={styles.purchaseCard}
          onPress={() => navigation.navigate('SaleCancellations')}
          accessibilityRole="button"
        >
          <Text style={styles.vehicleTitle} numberOfLines={1}>{c.listing?.title || 'Vehicle'}</Text>
          <Text style={styles.purchaseDate}>
            Cancelled {formatDate(c.resolvedAt || c.createdAt)} · {SALE_CANCELLATION_REASON_LABELS[c.reason] ?? 'Cancelled'}
            {c.buyerFeeRefunded ? ' · Buyer fee refunded' : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ));

  const renderTotalsBar = () => (
    <View style={styles.totalsCard}>
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>TOTAL SPENT</Text>
        <Text style={styles.totalValue}>{formatPrice(totalSpent)}</Text>
      </View>
      <View style={styles.totalDivider} />
      <View style={styles.totalCol}>
        <Text style={styles.totalLabel}>{isHistory ? 'COMPLETED' : 'VEHICLES PURCHASED'}</Text>
        <Text style={styles.totalValue}>{visible.length}</Text>
      </View>
    </View>
  );

  const renderPurchaseCard = useCallback(({ item }: { item: PurchaseItem }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.AWAITING_CONFIRMATION;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('DealerPurchaseDetail', { saleId: item.id })}
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
  }, [navigation]);

  // ─────────────── main render ───────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['rgba(167,139,250,0.05)', 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />

        <Text style={styles.headerTitle}>{isHistory ? 'Purchase History' : isRetail ? 'Retail Purchases' : 'All Purchases'}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {purchases.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {purchases.length > 99 ? '99+' : purchases.length}
              </Text>
            </View>
          )}
          <HamburgerButton />
        </View>
      </View>

      <PurchaseDestinations active={isHistory ? 'history' : isRetail ? 'retail' : 'all'} onSelect={selectDestination} />

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
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderPurchaseCard}
          ListHeaderComponent={
            <>
              {renderPendingRetail()}
              {(purchases.length > 0 || isRetail) && renderFilters()}
              {isRetail && shownPendingRetail.length === 0 && (
                <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('DealerMyOffers')}
                  style={[styles.purchaseCard, { marginBottom: 12 }]}
                >
                  <Text style={styles.vehicleTitle}>Accepted retail offers — Sale Pending</Text>
                  <Text style={styles.purchaseDate}>View accepted offers, message sellers and arrange collection in My Offers.</Text>
                </TouchableOpacity>
              )}
              {visible.length > 0 && renderTotalsBar()}
            </>
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={<>{renderCancelled()}<View style={{ height: 110 }} /></>}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, visible.length === 0 && { flexGrow: 1 }]}
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

  // ── Search + status ──
  filters: { gap: 8, marginBottom: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusPill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
  statusPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  statusPillText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textMuted },
  statusPillTextActive: { color: Colors.white },
  cancelledSection: { gap: 10, marginTop: 14 },
  pendingSection: { gap: 10, marginBottom: 12 },
  pendingHint: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19, color: Colors.textMuted },
  pendingLink: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  pendingLinkText: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },

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
