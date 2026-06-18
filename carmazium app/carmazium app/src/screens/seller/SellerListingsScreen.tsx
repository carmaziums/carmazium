import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

// ─────────────────────────── types ────────────────────────────────

interface ApiListing {
  id: string;
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  status?: string;
  images?: string[];
  viewCount?: number;
  badgeTier?: string;
  description?: string;
  mileage?: number;
}

type TabKey = 'ALL' | 'ACTIVE' | 'DRAFT' | 'SOLD';

// ────────────────────────── constants ─────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; chipBg: string; chipText: string; chipBorder: string; leftBorder: string }> = {
  ACTIVE: {
    label: '• LIVE',
    chipBg: 'rgba(16,185,129,0.18)',
    chipText: '#34d399',
    chipBorder: 'rgba(16,185,129,0.35)',
    leftBorder: '#22C55E',
  },
  DRAFT: {
    label: 'DRAFT',
    chipBg: 'rgba(245,158,11,0.18)',
    chipText: '#F59E0B',
    chipBorder: 'rgba(245,158,11,0.35)',
    leftBorder: '#F59E0B',
  },
  SOLD: {
    label: 'SOLD',
    chipBg: 'rgba(255,255,255,0.07)',
    chipText: '#A0A0AB',
    chipBorder: 'rgba(255,255,255,0.10)',
    leftBorder: 'rgba(255,255,255,0.15)',
  },
  WITHDRAWN: {
    label: 'WITHDRAWN',
    chipBg: 'rgba(255,255,255,0.05)',
    chipText: '#5C5C6B',
    chipBorder: 'rgba(255,255,255,0.06)',
    leftBorder: 'rgba(255,255,255,0.08)',
  },
};

const FALLBACK_STATUS = STATUS_CONFIG.DRAFT;

const TABS: TabKey[] = ['ALL', 'ACTIVE', 'DRAFT', 'SOLD'];

// ─────────────────────────── helpers ──────────────────────────────

const getTitle = (l: ApiListing): string => {
  if (l.title) return l.title;
  return [l.year, l.make, l.model].filter(Boolean).join(' ') || 'Untitled';
};

const formatPrice = (price?: number): string =>
  price ? `£${price.toLocaleString('en-GB')}` : '–';

// ────────────────────── action sheet config ───────────────────────

interface ActionItem {
  key: string;
  icon: string;
  label: string;
  tone: string;
  toneBg: string;
  isDestructive?: boolean;
}

const getActionsForStatus = (status?: string): ActionItem[] => {
  const s = (status ?? 'DRAFT').toUpperCase();
  if (s === 'ACTIVE') {
    return [
      { key: 'boost', icon: 'flash-outline', label: 'Boost listing', tone: '#F59E0B', toneBg: 'rgba(245,158,11,0.14)' },
      { key: 'edit', icon: 'pencil-outline', label: 'Edit listing', tone: '#3B82F6', toneBg: 'rgba(59,130,246,0.14)' },
      { key: 'withdraw', icon: 'arrow-undo-outline', label: 'Withdraw', tone: '#A0A0AB', toneBg: 'rgba(255,255,255,0.07)' },
      { key: 'mark_sold', icon: 'checkmark-circle-outline', label: 'Mark as Sold', tone: '#22C55E', toneBg: 'rgba(34,197,94,0.14)' },
      { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: '#EF4444', toneBg: 'rgba(239,68,68,0.14)', isDestructive: true },
    ];
  }
  if (s === 'DRAFT') {
    return [
      { key: 'edit', icon: 'pencil-outline', label: 'Edit listing', tone: '#3B82F6', toneBg: 'rgba(59,130,246,0.14)' },
      { key: 'publish', icon: 'rocket-outline', label: 'Publish', tone: '#22C55E', toneBg: 'rgba(34,197,94,0.14)' },
      { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: '#EF4444', toneBg: 'rgba(239,68,68,0.14)', isDestructive: true },
    ];
  }
  // SOLD / WITHDRAWN
  return [
    { key: 'delete', icon: 'trash-outline', label: 'Delete', tone: '#EF4444', toneBg: 'rgba(239,68,68,0.14)', isDestructive: true },
  ];
};

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerListingsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [actionMenuListing, setActionMenuListing] = useState<ApiListing | null>(null);
  const [sellPriceModal, setSellPriceModal] = useState<ApiListing | null>(null);
  const [soldPriceInput, setSoldPriceInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ─── data fetch ───────────────────────────────────────────────

  const fetchListings = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = activeTab !== 'ALL' ? `&status=${activeTab}` : '';
      const res = await apiClient<{ success: boolean; data: ApiListing[]; pagination: any }>(
        `/listings/my?page=1&limit=50${params}`
      );
      if (res.success) setListings(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ─── tab counts ───────────────────────────────────────────────

  const counts: Record<TabKey, number> = {
    ALL: listings.length,
    ACTIVE: listings.filter(l => l.status === 'ACTIVE').length,
    DRAFT: listings.filter(l => l.status === 'DRAFT').length,
    SOLD: listings.filter(l => l.status === 'SOLD').length,
  };

  // ─── action handlers ──────────────────────────────────────────

  const handleAction = async (key: string, listing: ApiListing) => {
    setActionMenuListing(null);

    if (key === 'edit') {
      navigation?.navigate('SellCarFlow', { listingId: listing.id });
      return;
    }

    if (key === 'mark_sold') {
      setSoldPriceInput(listing.price ? listing.price.toLocaleString('en-GB') : '');
      setSellPriceModal(listing);
      return;
    }

    if (key === 'delete') {
      Alert.alert(
        'Delete Listing',
        'Are you sure you want to delete this listing? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                await apiClient(`/listings/${listing.id}`, { method: 'DELETE' });
                setListings(prev => prev.filter(l => l.id !== listing.id));
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Could not delete listing.');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    if (key === 'withdraw') {
      setActionLoading(true);
      try {
        await apiClient(`/listings/${listing.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'WITHDRAWN' }),
        });
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, status: 'WITHDRAWN' } : l)
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not withdraw listing.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (key === 'publish') {
      setActionLoading(true);
      try {
        await apiClient(`/listings/${listing.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE' }),
        });
        setListings(prev =>
          prev.map(l => l.id === listing.id ? { ...l, status: 'ACTIVE' } : l)
        );
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not publish listing.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (key === 'boost') {
      setActionLoading(true);
      try {
        const res = await apiClient<{ success: boolean; data: { checkoutUrl: string } }>(
          `/featured-boost/${listing.id}`,
          { method: 'POST' }
        );
        const checkoutUrl = res?.data?.checkoutUrl;
        if (checkoutUrl) {
          Alert.alert(
            'Boost Listing',
            'This will open a secure payment page to boost your listing.',
            [
              { text: 'Open', onPress: () => Linking.openURL(checkoutUrl) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not initiate boost.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleConfirmSold = async () => {
    if (!sellPriceModal) return;
    const raw = soldPriceInput.replace(/[^0-9.]/g, '');
    const soldPrice = parseFloat(raw);
    if (!soldPrice || isNaN(soldPrice)) {
      Alert.alert('Invalid price', 'Please enter a valid sold price.');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient(`/listings/${sellPriceModal.id}/sold`, {
        method: 'PATCH',
        body: JSON.stringify({ soldPrice }),
      });
      setListings(prev =>
        prev.map(l => l.id === sellPriceModal.id ? { ...l, status: 'SOLD' } : l)
      );
      setSellPriceModal(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark as sold.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── filtered list ────────────────────────────────────────────

  const displayed = activeTab === 'ALL'
    ? listings
    : listings.filter(l => (l.status ?? '').toUpperCase() === activeTab);

  // ─── render helpers ───────────────────────────────────────────

  const renderSkeletonRows = () => (
    <View style={styles.skeletonList}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={`sk-${i}`} style={styles.skeletonRow}>
          <Skeleton w={64} h={56} r={10} />
          <View style={styles.skeletonInfo}>
            <Skeleton w={140} h={14} r={6} />
            <Skeleton w={80} h={16} r={6} />
            <Skeleton w={60} h={12} r={5} />
          </View>
          <View style={styles.skeletonRight}>
            <Skeleton w={48} h={20} r={10} />
            <Skeleton w={28} h={28} r={8} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      icon="pricetags-outline"
      title="No listings yet"
      subtitle="List your first vehicle to start selling."
      ctaLabel="Sell a car"
      onCtaPress={() => navigation?.navigate('SellCarFlow')}
    />
  );

  const renderCard = ({ item }: { item: ApiListing }) => {
    const statusKey = (item.status ?? 'DRAFT').toUpperCase();
    const cfg = STATUS_CONFIG[statusKey] ?? FALLBACK_STATUS;
    const thumb = item.images?.[0];

    return (
      <View style={[styles.card, { borderLeftColor: cfg.leftBorder }]}>
        {/* Thumbnail */}
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="car-outline" size={24} color={Colors.textMuted} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{getTitle(item)}</Text>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
          <Text style={styles.cardViews}>Views: {item.viewCount ?? 0}</Text>
        </View>

        {/* Right */}
        <View style={styles.cardRight}>
          <View style={[styles.statusChip, { backgroundColor: cfg.chipBg, borderColor: cfg.chipBorder }]}>
            <Text style={[styles.statusChipText, { color: cfg.chipText }]}>{cfg.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.menuBtn}
            activeOpacity={0.7}
            onPress={() => setActionMenuListing(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.dotWrap}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── action sheet ─────────────────────────────────────────────

  const renderActionSheet = () => {
    if (!actionMenuListing) return null;
    const actions = getActionsForStatus(actionMenuListing.status);
    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => setActionMenuListing(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActionMenuListing(null)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle} numberOfLines={1}>{getTitle(actionMenuListing)}</Text>

          {actions.map(action => (
            <TouchableOpacity
              key={action.key}
              style={styles.sheetRow}
              activeOpacity={0.75}
              onPress={() => handleAction(action.key, actionMenuListing)}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: action.toneBg }]}>
                <Ionicons name={action.icon} size={18} color={action.tone} />
              </View>
              <Text style={[styles.sheetRowLabel, action.isDestructive && { color: Colors.error }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.sheetRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.75}
            onPress={() => setActionMenuListing(null)}
          >
            <Text style={[styles.sheetRowLabel, { color: Colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  // ─── mark as sold modal ───────────────────────────────────────

  const renderSoldModal = () => {
    if (!sellPriceModal) return null;
    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => setSellPriceModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlayFull}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSellPriceModal(null)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Mark as Sold</Text>
            <Text style={styles.soldSubtitle}>Enter the final sale price for this vehicle.</Text>

            <View style={styles.soldInputWrap}>
              <Text style={styles.soldCurrencySymbol}>£</Text>
              <TextInput
                style={styles.soldInput}
                value={soldPriceInput}
                onChangeText={setSoldPriceInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.accent}
              />
            </View>

            <TouchableOpacity
              style={[styles.soldConfirmBtn, actionLoading && { opacity: 0.6 }]}
              activeOpacity={0.8}
              onPress={handleConfirmSold}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.soldConfirmBtnText}>Confirm Sale</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.soldCancelBtn}
              activeOpacity={0.75}
              onPress={() => setSellPriceModal(null)}
            >
              <Text style={styles.soldCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ─── main render ──────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(0,0,0,0)', '#0A0A0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.75}
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>My Listings</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.75}
          onPress={() => navigation?.navigate('SellCars')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Status tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsRow}
      >
        {TABS.map(tab => {
          const isActive = tab === activeTab;
          const count = counts[tab];
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              activeOpacity={0.75}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {loading ? (
        renderSkeletonRows()
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            displayed.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchListings(true)}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Modals ── */}
      {renderActionSheet()}
      {renderSoldModal()}

      {/* Global action loading overlay */}
      {actionLoading && !sellPriceModal && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },

  // ── header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },

  // ── tabs ──
  tabsRow: {
    marginBottom: 16,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  // ── list ──
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  listContentEmpty: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    gap: 12,
  },
  skeletonInfo: {
    flex: 1,
    gap: 6,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: 6,
  },

  // ── card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 3,
  },
  cardViews: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },


  // ── action sheet ──
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetOverlayFull: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 8,
    letterSpacing: 0.3,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sheetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── sold modal ──
  soldSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  soldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
  },
  soldCurrencySymbol: {
    fontFamily: FontFamily.mono,
    fontSize: 22,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  soldInput: {
    flex: 1,
    fontFamily: FontFamily.mono,
    fontSize: 22,
    color: '#FFFFFF',
  },
  soldConfirmBtn: {
    marginHorizontal: 20,
    height: 52,
    borderRadius: 13,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  soldConfirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  soldCancelBtn: {
    marginHorizontal: 20,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldCancelBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.error,
  },

  // ── global action loading overlay ──
  actionLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
