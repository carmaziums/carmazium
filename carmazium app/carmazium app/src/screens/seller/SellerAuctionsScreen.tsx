import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/apiClient';
import { getListingById } from '../../lib/listingsApi';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

// ─────────────────────────── Types ───────────────────────────

type ListingStatus = 'ACTIVE' | 'DRAFT' | 'SOLD' | 'WITHDRAWN' | 'OFFER_ACCEPTED';
type TabFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'ENDED';

interface ApiListing {
  id: string;
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  status?: ListingStatus;
  images?: string[];
  viewCount?: number;
  badgeTier?: string;
  description?: string;
  mileage?: number;
  vrm?: string;
  condition?: string;
}

// ─────────────────────────── Status Config ───────────────────────────

const STATUS_CFG: Record<string, { borderColor: string; chipBg: string; chipText: string; label: string }> = {
  ACTIVE:         { borderColor: '#22C55E', chipBg: 'rgba(34,197,94,0.15)',    chipText: '#22C55E', label: 'LIVE' },
  OFFER_ACCEPTED: { borderColor: '#3B82F6', chipBg: 'rgba(59,130,246,0.15)',   chipText: '#3B82F6', label: 'OFFER' },
  DRAFT:          { borderColor: '#F59E0B', chipBg: 'rgba(245,158,11,0.15)',   chipText: '#F59E0B', label: 'DRAFT' },
  SOLD:           { borderColor: 'rgba(255,255,255,0.15)', chipBg: 'rgba(255,255,255,0.06)', chipText: '#A0A0AB', label: 'ENDED' },
  WITHDRAWN:      { borderColor: 'rgba(255,255,255,0.08)', chipBg: 'rgba(255,255,255,0.04)', chipText: '#5C5C6B', label: 'WITHDRAWN' },
};
const cfgFor = (status?: string) => STATUS_CFG[status || ''] ?? STATUS_CFG.WITHDRAWN;

const isEnded = (status?: string) =>
  status === 'SOLD' || status === 'WITHDRAWN';

// ═══════════════════════════ COMPONENT ════════════════════════════

export const SellerAuctionsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [navigating, setNavigating] = useState<string | null>(null);

  // ── Fetch ──
  const fetchListings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!refreshing) setLoading(true);
    try {
      const res = await apiClient<{ success: boolean; data: ApiListing[]; pagination: any }>(
        '/listings/my?listingType=AUCTION&page=1&limit=50'
      );
      if (res.success) setListings(Array.isArray(res.data) ? res.data : []);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ── Tab counts ──
  const counts: Record<TabFilter, number> = {
    ALL:    listings.length,
    ACTIVE: listings.filter(l => l.status === 'ACTIVE' || l.status === 'OFFER_ACCEPTED').length,
    DRAFT:  listings.filter(l => l.status === 'DRAFT').length,
    ENDED:  listings.filter(l => isEnded(l.status)).length,
  };

  // ── Filtered listings ──
  const displayed = (() => {
    switch (activeTab) {
      case 'ACTIVE': return listings.filter(l => l.status === 'ACTIVE' || l.status === 'OFFER_ACCEPTED');
      case 'DRAFT':  return listings.filter(l => l.status === 'DRAFT');
      case 'ENDED':  return listings.filter(l => isEnded(l.status));
      default:       return listings;
    }
  })();

  // ── Tap handler ──
  const handleTap = async (item: ApiListing) => {
    setNavigating(item.id);
    try {
      const listing = await getListingById(item.id);
      if (!listing) {
        Alert.alert('Not available', 'Could not load listing.');
        return;
      }
      if (item.status === 'ACTIVE') {
        navigation?.navigate('LiveAuctionDetailed', { listing });
      } else {
        navigation?.navigate('VehicleDetail', { listing });
      }
    } catch {
      Alert.alert('Error', 'Could not load listing details.');
    } finally {
      setNavigating(null);
    }
  };

  // ── Render card ──
  const renderCard = ({ item }: { item: ApiListing }) => {
    const cfg = cfgFor(item.status);
    const thumb = item.images?.[0];
    const title = item.title || [item.year, item.make, item.model].filter(Boolean).join(' ') || 'Untitled';
    const price = item.price ? `£${Number(item.price).toLocaleString('en-GB')}` : '–';
    const isLoading = navigating === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: cfg.borderColor }]}
        onPress={() => handleTap(item)}
        activeOpacity={0.8}
        disabled={!!navigating}
      >
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <MaterialCommunityIcons name="gavel" size={22} color={Colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardPrice}>{price}</Text>
          <Text style={styles.cardMeta}>{item.viewCount ?? 0} views</Text>
        </View>

        <View style={styles.cardRight}>
          <View style={[styles.statusChip, { backgroundColor: cfg.chipBg }]}>
            <Text style={[styles.statusChipText, { color: cfg.chipText }]}>{cfg.label}</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.textMuted} style={{ width: 28, height: 28 }} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.04)', 'rgba(59,130,246,0.03)', '#0A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.7 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Auctions</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.navigate('SellCars')} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {(['ALL', 'ACTIVE', 'DRAFT', 'ENDED'] as TabFilter[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}{counts[tab] > 0 ? ` (${counts[tab]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="gavel" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No auctions yet</Text>
          <Text style={styles.emptySub}>
            {activeTab === 'ALL'
              ? 'Create an auction listing to start selling by auction.'
              : `No ${activeTab.toLowerCase()} auctions.`}
          </Text>
          {activeTab === 'ALL' && (
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => navigation?.navigate('SellCars')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyCtaText}>Create Auction Listing</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchListings(true)}
              tintColor={Colors.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListFooterComponent={
            <View>
              <TouchableOpacity
                style={styles.createAuctionBtn}
                onPress={() => navigation?.navigate('SellCars')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="gavel" size={18} color="#FFFFFF" />
                <Text style={styles.createAuctionText}>CREATE AUCTION</Text>
              </TouchableOpacity>
              <View style={{ height: 110 }} />
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyCtaBtn: {
    marginTop: 8,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#111115',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 12,
    alignItems: 'center',
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
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  createAuctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    marginTop: 20,
  },
  createAuctionText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
