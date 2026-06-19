import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const MyListingDashboardScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
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
    };
    load();
  }, []);

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
        Alert.alert(
          'Boost Listing',
          'This will open a secure payment page to boost your listing to the top of search results.',
          [
            { text: 'Open', onPress: () => Linking.openURL(checkoutUrl) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not start the boost checkout. Please try again.');
    } finally {
      setActionBusy(false);
    }
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

  const renderTabBar = () => (
     <View style={[styles.mockTabBar, { paddingBottom: insets.bottom || 12 }]}>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Home')}>
            <Ionicons name="home-outline" size={24} color="#A0A0AB" />
            <Text style={styles.tabLabel}>HOME</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Search')}>
            <Ionicons name="search-outline" size={24} color="#A0A0AB" />
            <Text style={styles.tabLabel}>SEARCH</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Live')}>
            <MaterialCommunityIcons name="gavel" size={24} color="#A0A0AB" />
            <Text style={styles.tabLabel}>LIVE</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navTab('Saved')}>
            <Ionicons name="heart-outline" size={24} color="#A0A0AB" />
            <Text style={styles.tabLabel}>SAVED</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem} onPress={() => navigation?.openDrawer()}>
            <Ionicons name="person" size={24} color="#DC1F26" />
            <Text style={[styles.tabLabel, { color: '#DC1F26' }]}>PROFILE</Text>
         </TouchableOpacity>
      </View>
  );

  const renderMainView = () => {
    // Loading skeleton
    if (isLoading) {
      return (
        <View style={{ flex: 1 }}>
          <View style={[styles.scrollContent, { paddingTop: insets.top + 14, flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color="#DC1F26" />
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
              <TouchableOpacity style={styles.notifBtn} activeOpacity={0.7} onPress={() => navigation?.navigate('Alerts')}>
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={56} color="#5C5C6B" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySubtitle}>Sell your car on Carmazium and reach thousands of verified buyers.</Text>
              <TouchableOpacity
                style={styles.emptyCtaBtn}
                onPress={() => navigation?.navigate('SellCarFlow')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 14 }]}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSub}>MY LISTINGS</Text>
              <Text style={styles.headerTitle}>Selling</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn} activeOpacity={0.7} onPress={() => navigation?.navigate('Alerts')}>
              <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stats KPI bar from real API */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="car-outline" size={18} color="#A0A0AB" style={styles.statIcon} />
              <Text style={styles.statValue}>{stats?.activeListings ?? listings.filter((l) => l.status === 'ACTIVE').length}</Text>
              <Text style={styles.statLabel}>ACTIVE</Text>
              <Text style={styles.statChange}>{listings.length} total</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="eye-outline" size={18} color="#A0A0AB" style={styles.statIcon} />
              <Text style={styles.statValue}>{stats?.totalViews ?? primaryListing?.viewCount ?? 0}</Text>
              <Text style={styles.statLabel}>VIEWS</Text>
              <Text style={styles.statChange}>all listings</Text>
            </View>
            <TouchableOpacity style={styles.statCardOffers} activeOpacity={0.8} onPress={() => navigation?.navigate('SellerOffers')}>
              <LinearGradient
                colors={['rgba(245,158,11,0.1)', 'rgba(245,158,11,0.02)']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="pricetag-outline" size={18} color="#F59E0B" style={styles.statIcon} />
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

          {listings.map((item, idx) => {
            const listingTitle = item.title || `${item.make ?? ''} ${item.model ?? ''}`.trim() || 'Vehicle';
            const listingImage = item.images?.[0];
            const statusColor = item.status === 'ACTIVE' ? '#10B981' : item.status === 'SOLD' ? '#F59E0B' : '#A0A0AB';

            return (
              <View key={item.id ?? idx} style={styles.listingCard}>
                {listingImage ? (
                  <Image source={{ uri: listingImage }} style={styles.listingImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
                    <Ionicons name="car-outline" size={32} color="#5C5C6B" />
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
                        <Ionicons name="eye-outline" size={11} color="#606070" />
                        <Text style={styles.listingMeta}>{item.viewCount}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Live banner for primary active listing */}
          {isActive && (
            <View style={styles.liveBanner}>
              <LinearGradient
                colors={['rgba(255,255,255,0.05)', '#DC1F26']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => navigation?.navigate('SellCarFlow', { listingId: listings[0]?.id })}>
                <Ionicons name="create-outline" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Grid */}
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={handleBoostListing} disabled={actionBusy}>
              <Ionicons name="flash-outline" size={20} color="#F59E0B" style={styles.actionIcon} />
              <Text style={styles.actionTitle}>Boost listing</Text>
              <Text style={styles.actionSub}>Get more views</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={handleShareListing}>
              <Ionicons name="share-social-outline" size={20} color="#38BDF8" style={styles.actionIcon} />
              <Text style={styles.actionTitle}>Share listing</Text>
              <Text style={styles.actionSub}>Share with friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={handleViewInsights} disabled={actionBusy}>
              <Ionicons name="bar-chart-outline" size={20} color="#A78BFA" style={styles.actionIcon} />
              <Text style={styles.actionTitle}>View insights</Text>
              <Text style={styles.actionSub}>Views & performance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation?.navigate('SellCarFlow')}>
              <Ionicons name="add-circle-outline" size={20} color="#10B981" style={styles.actionIcon} />
              <Text style={styles.actionTitle}>New listing</Text>
              <Text style={styles.actionSub}>List another car</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {renderTabBar()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      {renderMainView()}

      {/* Floating Center Plus Button */}
      <TouchableOpacity 
        style={[styles.floatingPlusBtn, { bottom: (insets.bottom || 12) + 70 }]}
        onPress={() => navigation?.navigate('SellCarFlow')}
        activeOpacity={0.8}
      >
         <LinearGradient
            colors={['#EF4444', '#DC1F26']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
         />
         <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  floatingPlusBtn: {
     position: 'absolute',
     alignSelf: 'center',
     width: 56,
     height: 56,
     borderRadius: 28,
     alignItems: 'center',
     justifyContent: 'center',
     shadowColor: '#DC1F26',
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
    fontSize: 10,
    color: '#606070',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  liveBanner: {
     marginHorizontal: 24, height: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
     justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24, overflow: 'hidden'
  },
  livePill: {
     flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.2)',
     paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#10B981'
  },
  liveDot: {
     width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6
  },
  liveText: {
     fontFamily: FontFamily.bold, fontSize: 11, color: '#10B981', letterSpacing: 1
  },
  editBtn: {
     width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)',
     alignItems: 'center', justifyContent: 'center'
  },

  statsRow: {
     flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 32
  },
  statCard: {
     flex: 1, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
     padding: 16, alignItems: 'center'
  },
  statCardOffers: {
     flex: 1, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
     padding: 16, alignItems: 'center', overflow: 'hidden'
  },
  statIcon: {
     marginBottom: 12
  },
  statValue: {
     fontFamily: FontFamily.black, fontSize: 24, color: '#FFFFFF', marginBottom: 4
  },
  statLabel: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#A0A0AB', letterSpacing: 1, marginBottom: 4
  },
  statLabelOffers: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#F59E0B', letterSpacing: 1, marginBottom: 4
  },
  statChange: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#10B981'
  },
  statChangeOffers: {
     fontFamily: FontFamily.bold, fontSize: 10, color: '#F59E0B'
  },

  sectionHeaderWrap: {
     flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 24, marginBottom: 16
  },
  sectionTitle: {
     fontFamily: FontFamily.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 1.5
  },
  seeAllText: {
     fontFamily: FontFamily.bold, fontSize: 12, color: '#DC1F26'
  },

  actionGrid: {
     flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 24, gap: 12
  },
  actionCard: {
     width: (SCREEN_WIDTH - 60) / 2, backgroundColor: '#111116', borderRadius: 16, borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.06)', padding: 16
  },
  actionIcon: {
     marginBottom: 16
  },
  actionTitle: {
     fontFamily: FontFamily.bold, fontSize: 14, color: '#FFFFFF', marginBottom: 4
  },
  actionSub: {
     fontFamily: FontFamily.regular, fontSize: 11, color: '#A0A0AB'
  },

  // Mock Tab Bar
  mockTabBar: {
     position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around',
     paddingTop: 12, backgroundColor: '#0A0A0C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)'
  },
  tabItem: {
     alignItems: 'center', flex: 1
  },
  tabLabel: {
     fontFamily: FontFamily.bold, fontSize: 9, color: '#606070', marginTop: 4, letterSpacing: 0.5
  },

  // Loading
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#606070',
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
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#A0A0AB',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC1F26',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 32,
  },
  emptyCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },

  // Listing cards
  listingCard: {
    marginHorizontal: 24,
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 14,
    flexDirection: 'row',
  },
  listingImage: {
    width: 100,
    height: 80,
  },
  listingImagePlaceholder: {
    backgroundColor: '#1A1A22',
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
    fontSize: 14,
    color: '#FFFFFF',
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
    fontSize: 8,
    letterSpacing: 0.5,
  },
  listingPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  listingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingMeta: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#606070',
  },
  listingMetaDot: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#606070',
  },
});
