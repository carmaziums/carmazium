import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {FontFamily, FontSize } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { StripeCheckoutModal } from '../../components/StripeCheckoutModal';
import { haptics } from '../../lib/haptics';
import { Colors } from '../../constants/colors';
import { useDrawer } from '../../context/DrawerContext';

import { IconButton } from '../../components/IconButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Hoisted + memoized so FlatList only re-renders the row whose props
// actually changed, instead of recreating this JSX inline in renderItem on
// every parent re-render (mobile-audit.md P3/P4).
const ListingRow: React.FC<{
  item: any;
  onPress: () => void;
  onPutOnAuction?: () => void;
  onOpenLinkedAuction?: () => void;
}> = React.memo(({ item, onPress, onPutOnAuction, onOpenLinkedAuction }) => {
  const listingTitle = item.title || `${item.make ?? ''} ${item.model ?? ''}`.trim() || 'Vehicle';
  const listingImage = item.images?.[0];
  const statusColor = item.status === 'ACTIVE' ? Colors.accentGreen : item.status === 'SOLD' ? Colors.warning : Colors.textSecondary;
  // Cross-listing state — a retail listing can also be running as an auction
  // (or vice versa). Backend exposes this as item.linkedListing with the
  // linked side's id + type + auction status when applicable.
  const linkedAuctionStatus = item.linkedListing?.auction?.status as string | undefined;
  const hasLinkedAuction = !!item.linkedListingId && (item.linkedListing?.type === 'AUCTION' || !!linkedAuctionStatus);
  const linkedAuctionLive = linkedAuctionStatus === 'ACTIVE';
  const canPutOnAuction = item.status === 'ACTIVE' && !hasLinkedAuction;

  return (
    <TouchableOpacity style={styles.listingCard} onPress={onPress} activeOpacity={0.75}>
      {listingImage ? (
        <Image source={{ uri: listingImage }} style={styles.listingImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
          <Ionicons name="car-outline" size={32} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.listingInfo}>
        <View style={styles.listingTitleRow}>
          <Text style={styles.listingTitle} numberOfLines={1}>{listingTitle}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}66` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status ?? 'DRAFT'}</Text>
          </View>
        </View>
        <Text style={styles.listingPrice}>£{Number(item.price ?? 0).toLocaleString('en-GB')}</Text>
        <View style={styles.listingMetaRow}>
          {item.year ? <Text style={styles.listingMeta}>{item.year}</Text> : null}
          {item.year && item.mileage ? <Text style={styles.listingMetaDot}>·</Text> : null}
          {item.mileage ? <Text style={styles.listingMeta}>{Number(item.mileage).toLocaleString('en-GB')} mi</Text> : null}
          {item.viewCount != null ? (
            <>
              <Text style={styles.listingMetaDot}>·</Text>
              <Ionicons name="eye-outline" size={11} color={Colors.iconMuted} />
              <Text style={styles.listingMeta}>{item.viewCount}</Text>
            </>
          ) : null}
        </View>
        {/* Cross-listing row: either shows the linked auction chip, or a
            "Put on auction" shortcut when eligible. */}
        {hasLinkedAuction ? (
          <TouchableOpacity
            style={[styles.crossListingChip, linkedAuctionLive && styles.crossListingChipLive]}
            onPress={onOpenLinkedAuction}
            activeOpacity={0.7}
            accessibilityLabel="Open linked auction"
          >
            <Ionicons name="gavel" size={11} color={linkedAuctionLive ? Colors.accentGreen : Colors.textMuted} />
            <Text style={[styles.crossListingChipText, linkedAuctionLive && { color: Colors.accentGreen }]}>
              {linkedAuctionLive ? 'Linked auction — LIVE' : `Linked auction${linkedAuctionStatus ? ` — ${linkedAuctionStatus}` : ''}`}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.iconMuted} />
          </TouchableOpacity>
        ) : canPutOnAuction && onPutOnAuction ? (
          <TouchableOpacity
            style={styles.putOnAuctionInline}
            onPress={onPutOnAuction}
            activeOpacity={0.7}
            accessibilityLabel="Also list this vehicle on auction"
          >
            <Ionicons name="gavel" size={11} color={Colors.accent} />
            <Text style={styles.putOnAuctionInlineText}>Also list on auction</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export const MyListingDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [boostCheckoutUrl, setBoostCheckoutUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadListings = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    try {
      const [listingsRes, statsRes] = await Promise.all([
        apiClient<any>('/listings/my?page=1&limit=20'),
        apiClient<any>('/listings/stats').catch(() => null),
      ]);
      setListings(listingsRes?.data || []);
      setStats(statsRes?.data || statsRes || null);
    } catch (e) {
      console.warn('Failed to load listings:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refetch on every focus (initial mount + every return-from-child, e.g.
  // after editing a listing in SellCarFlow). Silent on returns so the whole
  // screen doesn't blank out with a spinner every time.
  const isFirstFocus = React.useRef(true);
  useFocusEffect(useCallback(() => {
    loadListings({ silent: !isFirstFocus.current });
    isFirstFocus.current = false;
  }, [loadListings]));

  const navTab = (tabName: string) => {
     navigation?.navigate('Tabs', { screen: tabName });
  };

  const handleBoostListing = async () => {
    const listing = listings[0];
    if (!listing?.id || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await apiClient<{ success: boolean; data: { checkoutUrl: string } }>(
        `/featured-boost/${listing.id}`,
        { method: 'POST' }
      );
      const checkoutUrl = res?.data?.checkoutUrl;
      if (checkoutUrl) {
        // Open the Stripe hosted checkout inside our own WebView modal.
        // The old flow used Linking.openURL which punted sellers to the
        // system browser and left them re-authenticating on return.
        setBoostCheckoutUrl(checkoutUrl);
      } else {
        Alert.alert('Error', 'No checkout URL returned.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not start the boost checkout. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBoostSuccess = async () => {
    setBoostCheckoutUrl(null);
    haptics.success();
    // Was "7 days" — backend's BOOST_DURATION_DAYS is actually 28.
    setToast('Boosted for 28 days');
    // Refetch so the isFeatured flag/UI updates on this screen once the
    // Stripe webhook has flipped the boost status. Silent refresh — the
    // toast is the primary success signal.
    loadListings({ silent: true });
    setTimeout(() => setToast(null), 3000);
  };

  const handleShareListing = async () => {
    const listing = listings[0];
    if (!listing) return;
    const title = listing.title || `${listing.make ?? ''} ${listing.model ?? ''}`.trim() || 'my car';
    const price = `£${Number(listing.price ?? 0).toLocaleString('en-GB')}`;
    try {
      await Share.share({ message: `Check out ${title} for ${price} on Carmazium` });
    } catch {
      // user dismissed the share sheet
    }
  };

  const handleViewInsights = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/listings/performance');
      const perf = res?.data;
      Alert.alert(
        'Listing Insights',
        `Total views: ${perf?.totalViews ?? 0}\n` +
        `Active listings: ${perf?.totalListings ?? 0}\n` +
        `Conversion rate: ${perf?.conversionRate ?? 0}%\n` +
        `Total revenue: £${Number(perf?.totalRevenue ?? 0).toLocaleString('en-GB')}`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load your insights right now.');
    } finally {
      setActionBusy(false);
    }
  };

  const renderListingRow = useCallback(
    ({ item }: { item: any }) => (
      <ListingRow
        item={item}
        onPress={() => navigation?.navigate('SellCarFlow', { listingId: item.id })}
        onPutOnAuction={() =>
          // SellerAuctionsScreen accepts preselectListingId — same shortcut
          // dealers already use from DealerInventoryScreen's "PUT ON AUCTION".
          navigation?.navigate('SellerAuctions', { preselectListingId: item.id })
        }
        onOpenLinkedAuction={() =>
          navigation?.navigate('SellerAuctions', { preselectListingId: item.linkedListingId })
        }
      />
    ),
    [navigation]
  );
  const keyExtractor = useCallback((item: any, idx: number) => item.id ?? String(idx), []);

  const renderTabBar = () => (
     <View style={[styles.mockTabBar, { paddingBottom: insets.bottom || 12 }]}>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Home')} activeOpacity={0.8}>
            <Ionicons name="home-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.tabLabel}>HOME</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Search')} activeOpacity={0.8}>
            <Ionicons name="search-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.tabLabel}>SEARCH</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Live')} activeOpacity={0.8}>
            <MaterialCommunityIcons name="gavel" size={24} color={Colors.textSecondary} />
            <Text style={styles.tabLabel}>LIVE</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Saved')} activeOpacity={0.8}>
            <Ionicons name="heart-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.tabLabel}>SAVED</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={openDrawer} activeOpacity={0.8}>
            <Ionicons name="person" size={24} color={Colors.accent} />
            <Text style={[styles.tabLabel, { color: Colors.accent }]}>PROFILE</Text>
         </TouchableOpacity>
      </View>
  );

  const renderMainView = () => {
    // Loading skeleton
    if (isLoading) {
      return (
        <View style={{ flex: 1 }}>
          <View style={[styles.scrollContent, { paddingTop: insets.top + 14, flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading your listings…</Text>
          </View>
          {renderTabBar()}
        </View>
      );
    }

    // Empty state
    if (listings.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSub}>MY LISTINGS</Text>
                <Text style={styles.headerTitle}>Selling</Text>
              </View>
              <IconButton style={styles.notifBtn} icon={<Ionicons name="notifications-outline" size={20} color={Colors.white} />} onPress={() => navigation?.navigate('Notifications')} accessibilityLabel="Notifications" />
            </View>

            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={56} color={Colors.textMuted} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySubtitle}>Sell your car on Carmazium and reach thousands of verified buyers.</Text>
              <TouchableOpacity
                style={styles.emptyCtaBtn}
                onPress={() => navigation?.navigate('SellCarFlow')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.emptyCtaText}>LIST YOUR CAR</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          {renderTabBar()}
        </View>
      );
    }

    // Main listing dashboard (first listing as primary)
    const primaryListing = listings[0];
    const isActive = primaryListing?.status === 'ACTIVE';

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}
          data={listings}
          keyExtractor={keyExtractor}
          renderItem={renderListingRow}
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerSub}>MY LISTINGS</Text>
                  <Text style={styles.headerTitle}>Selling</Text>
                </View>
                <IconButton style={styles.notifBtn} icon={<Ionicons name="notifications-outline" size={20} color={Colors.white} />} onPress={() => navigation?.navigate('Notifications')} accessibilityLabel="Notifications" />
              </View>

              {/* Stats KPI bar from real API */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="car-outline" size={18} color={Colors.textSecondary} style={styles.statIcon} />
                  <Text style={styles.statValue}>{stats?.activeListings ?? listings.filter((l) => l.status === 'ACTIVE').length}</Text>
                  <Text style={styles.statLabel}>ACTIVE</Text>
                  <Text style={styles.statChange}>{listings.length} total</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="eye-outline" size={18} color={Colors.textSecondary} style={styles.statIcon} />
                  <Text style={styles.statValue}>{stats?.totalViews ?? primaryListing?.viewCount ?? 0}</Text>
                  <Text style={styles.statLabel}>VIEWS</Text>
                  <Text style={styles.statChange}>all listings</Text>
                </View>
                <TouchableOpacity style={styles.statCardOffers} activeOpacity={0.8} onPress={() => navigation?.navigate('SellerOffers')}>
                  <LinearGradient
                    colors={[Colors.warningAlpha10, 'rgba(245,158,11,0.02)']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Ionicons name="pricetag-outline" size={18} color={Colors.warning} style={styles.statIcon} />
                  <Text style={styles.statValue}>{stats?.offersReceived ?? 0}</Text>
                  <Text style={styles.statLabelOffers}>OFFERS</Text>
                  <Text style={styles.statChangeOffers}>tap to view</Text>
                </TouchableOpacity>
              </View>

              {/* Listings */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>YOUR LISTINGS</Text>
                <Text style={styles.seeAllText}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
              </View>
            </>
          }
          ListFooterComponent={
            <>
              {/* Live banner for primary active listing */}
              {isActive && (
                <View style={styles.liveBanner}>
                  <LinearGradient
                    colors={[Colors.whiteAlpha05, Colors.accent]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <IconButton style={styles.editBtn} icon={<Ionicons name="create-outline" size={14} color={Colors.white} />} onPress={() => navigation?.navigate('SellCarFlow', { listingId: listings[0]?.id })} accessibilityLabel="Edit listing" />
                </View>
              )}

              {/* Action Grid */}
              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.actionCard} onPress={handleBoostListing} disabled={actionBusy} activeOpacity={0.8}>
                  <Ionicons name="flash-outline" size={20} color={Colors.warning} style={styles.actionIcon} />
                  <Text style={styles.actionTitle}>Boost listing</Text>
                  <Text style={styles.actionSub}>Get more views</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={handleShareListing} activeOpacity={0.8}>
                  <Ionicons name="share-social-outline" size={20} color={Colors.lightTeal_38bdf8} style={styles.actionIcon} />
                  <Text style={styles.actionTitle}>Share listing</Text>
                  <Text style={styles.actionSub}>Share with friends</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={handleViewInsights} disabled={actionBusy} activeOpacity={0.8}>
                  <Ionicons name="bar-chart-outline" size={20} color={Colors.palePurple_a78bfa} style={styles.actionIcon} />
                  <Text style={styles.actionTitle}>View insights</Text>
                  <Text style={styles.actionSub}>Views & performance</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation?.navigate('SellCarFlow')} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={20} color={Colors.accentGreen} style={styles.actionIcon} />
                  <Text style={styles.actionTitle}>New listing</Text>
                  <Text style={styles.actionSub}>List another car</Text>
                </TouchableOpacity>
              </View>
            </>
          }
        />

        {renderTabBar()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      {renderMainView()}

      {/* Boost checkout — hosted Stripe checkout in-app */}
      <StripeCheckoutModal
        url={boostCheckoutUrl}
        title="Featured Boost Checkout"
        onSuccess={handleBoostSuccess}
        onCancel={() => setBoostCheckoutUrl(null)}
        onClose={() => setBoostCheckoutUrl(null)}
      />

      {/* Small transient toast for boost success */}
      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="flash" size={14} color={Colors.warning} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Floating Center Plus Button */}
      <TouchableOpacity 
        style={[styles.floatingPlusBtn, { bottom: (insets.bottom || 12) + 70 }]}
        onPress={() => navigation?.navigate('SellCarFlow')}
        activeOpacity={0.8}
       accessibilityLabel="Add listing" accessibilityRole="button">
         <LinearGradient
            colors={[Colors.error, Colors.accent]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
         />
         <Ionicons name="add" size={32} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  floatingPlusBtn: {
     position: 'absolute',
     alignSelf: 'center',
     width: 56,
     height: 56,
     borderRadius: 28,
     alignItems: 'center',
     justifyContent: 'center',
     shadowColor: Colors.accent,
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.4,
     shadowRadius: 10,
     elevation: 8,
     zIndex: 100,
     overflow: 'hidden',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.iconMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'],
    color: Colors.white,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },

  liveBanner: {
     marginHorizontal: 24, height: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
     justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24, overflow: 'hidden'
  },
  livePill: {
     flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accentGreenAlpha20,
     paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.accentGreen
  },
  liveDot: {
     width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentGreen, marginRight: 6
  },
  liveText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accentGreen, letterSpacing: 1
  },
  editBtn: {
     width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)',
     alignItems: 'center', justifyContent: 'center'
  },

  statsRow: {
     flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 32
  },
  statCard: {
     flex: 1, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 16, borderWidth: 1, borderColor: Colors.whiteAlpha06,
     padding: 16, alignItems: 'center'
  },
  statCardOffers: {
     flex: 1, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 16, borderWidth: 1, borderColor: Colors.warningAlpha30,
     padding: 16, alignItems: 'center', overflow: 'hidden'
  },
  statIcon: {
     marginBottom: 12
  },
  statValue: {
     fontFamily: FontFamily.black, fontSize: FontSize['2xl'], color: Colors.white, marginBottom: 4
  },
  statLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 4
  },
  statLabelOffers: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.warning, letterSpacing: 1, marginBottom: 4
  },
  statChange: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accentGreen
  },
  statChangeOffers: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.warning
  },

  sectionHeaderWrap: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 24, marginBottom: 16
  },
  sectionTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white, letterSpacing: 1.5
  },
  seeAllText: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.accent
  },

  actionGrid: {
     flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 24, gap: 12
  },
  actionCard: {
     width: (SCREEN_WIDTH - 60) / 2, backgroundColor: Colors.bgSecondaryAlt, borderRadius: 16, borderWidth: 1,
     borderColor: Colors.whiteAlpha06, padding: 16
  },
  actionIcon: {
     marginBottom: 16
  },
  actionTitle: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size14, color: Colors.white, marginBottom: 4
  },
  actionSub: {
     fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary
  },

  // Mock Tab Bar
  mockTabBar: {
     position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around',
     paddingTop: 12, backgroundColor: Colors.bgPrimary, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha05
  },
  tabItem: {
     alignItems: 'center', flex: 1
  },
  tabLabel: {
     fontFamily: FontFamily.bold, fontSize: FontSize.size9, color: Colors.iconMuted, marginTop: 4, letterSpacing: 0.5
  },

  // Loading
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.iconMuted,
    marginTop: 16,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.size22,
    color: Colors.white,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 32,
  },
  emptyCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    letterSpacing: 0.6,
  },

  // Listing cards
  listingCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    overflow: 'hidden',
    marginBottom: 14,
    flexDirection: 'row',
  },
  listingImage: {
    width: 100,
    height: 80,
  },
  listingImagePlaceholder: {
    backgroundColor: Colors.deepBlue_1a1a22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    letterSpacing: 0.5,
  },
  listingPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.md,
    color: Colors.white,
    marginBottom: 4,
  },
  listingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingMeta: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
  },
  listingMetaDot: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.iconMuted,
  },
  crossListingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.whiteAlpha04,
  },
  crossListingChipLive: {
    borderColor: Colors.accentGreen + '55',
    backgroundColor: Colors.accentGreen + '15',
  },
  crossListingChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    letterSpacing: 0.3,
    color: Colors.textMuted,
  },
  putOnAuctionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
    backgroundColor: Colors.accentAlpha10,
  },
  putOnAuctionInlineText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    letterSpacing: 0.3,
    color: Colors.accent,
  },
  toast: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17,17,22,0.95)',
    borderWidth: 1,
    borderColor: Colors.warningAlpha30,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
