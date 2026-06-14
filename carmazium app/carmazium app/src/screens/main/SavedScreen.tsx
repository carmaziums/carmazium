import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontFamily } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { CarListing, formatPrice } from '../../data/listings';
import { useWatchlistStore } from '../../store/watchlistStore';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const { width } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type ViewMode = 'grid' | 'list';

// ─── Saved Screen ─────────────────────────────────────────────────────────────

export const SavedScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [viewMode,   setViewMode]   = useState<ViewMode>('grid');
  const [activeTab,  setActiveTab]  = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const { savedListings, isLoading, toggle, isSaved, hydrateFromApi } = useWatchlistStore();

  useEffect(() => {
    hydrateFromApi();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await hydrateFromApi();
    } finally {
      setRefreshing(false);
    }
  }, [hydrateFromApi]);

  const handleCardPress = useCallback(
    (listing: CarListing) => {
      navigation.navigate('VehicleDetail', { listing });
    },
    [navigation]
  );

  // Tab filter — only "All" is functional until backend provides richer data
  const displayedListings = savedListings;

  const totalCount = savedListings.length;
  const headerSub  = viewMode === 'grid'
    ? `${totalCount} SAVED`
    : `${totalCount} SAVED`;
  const headerTitle = viewMode === 'grid' ? 'Watchlist' : 'Saved cars';

  // ─── Empty State ───────────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <EmptyState
      icon="heart-outline"
      title="Nothing saved yet"
      subtitle="Tap the heart on any listing to save it here."
      ctaLabel="Browse listings"
      onCtaPress={() => navigation.navigate('Search' as any)}
    />
  );

  // ─── Skeleton ──────────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={`sk-${i}`} style={styles.skeletonCard}>
          <Skeleton w={(width - 40 - 16) / 2} h={116} r={0} />
          <View style={styles.skeletonInfo}>
            <Skeleton w={60} h={10} r={4} />
            <Skeleton w={90} h={13} r={5} />
            <Skeleton w={70} h={14} r={6} />
          </View>
        </View>
      ))}
    </View>
  );

  // ─── Grid View ─────────────────────────────────────────────────────────────

  const renderGridView = () => {
    if (displayedListings.length === 0) return renderEmptyState();

    // Group pairs for two-column layout
    const rows: CarListing[][] = [];
    for (let i = 0; i < displayedListings.length; i += 2) {
      rows.push(displayedListings.slice(i, i + 2));
    }

    return (
      <View style={styles.gridContainer}>
        {rows.map((pair, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {pair.map((listing) => {
              const saved = isSaved(listing.id);
              return (
                <TouchableOpacity
                  key={listing.id}
                  style={styles.gridCard}
                  activeOpacity={0.88}
                  onPress={() => handleCardPress(listing)}
                >
                  <View style={styles.gridImgWrap}>
                    {listing.images[0] ? (
                      <Image source={{ uri: listing.images[0] }} style={styles.gridImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.gridImg, { backgroundColor: '#18181E' }]} />
                    )}
                    <TouchableOpacity
                      style={styles.heartBtnIcon}
                      activeOpacity={0.7}
                      onPress={() => toggle(listing)}
                    >
                      <Ionicons
                        name={saved ? 'heart' : 'heart-outline'}
                        size={16}
                        color={saved ? Colors.accent : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gridInfo}>
                    <Text style={styles.cardMeta}>
                      {listing.year} · {listing.mileage.toLocaleString('en-GB')} MI
                    </Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {listing.make} {listing.model}
                    </Text>
                    <Text style={styles.cardPrice}>{formatPrice(listing.price)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {/* Pad odd rows with an invisible spacer */}
            {pair.length === 1 && <View style={styles.gridCardSpacer} />}
          </View>
        ))}
      </View>
    );
  };

  // ─── List View ─────────────────────────────────────────────────────────────

  const renderListView = () => {
    if (displayedListings.length === 0) return renderEmptyState();

    return (
      <View style={styles.listContainer}>
        <View style={styles.listSortRow}>
          <Text style={styles.listSortLabel}>SORTED BY: RECENTLY SAVED</Text>
          <TouchableOpacity style={styles.listSortChange} activeOpacity={0.7}>
            <Text style={styles.listSortChangeText}>Change</Text>
            <Ionicons name="chevron-down" size={12} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {displayedListings.map((listing) => {
          const saved = isSaved(listing.id);
          return (
            <TouchableOpacity
              key={listing.id}
              style={styles.listCard}
              activeOpacity={0.85}
              onPress={() => handleCardPress(listing)}
            >
              {listing.images[0] ? (
                <Image source={{ uri: listing.images[0] }} style={styles.listImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.listImg, { backgroundColor: '#18181E' }]} />
              )}
              <View style={styles.listInfo}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {listing.make} {listing.model}
                </Text>
                <Text style={styles.listMeta}>
                  {listing.year} · {listing.mileage.toLocaleString('en-GB')} mi · {listing.location || ''}
                </Text>
                <View style={styles.listPriceRow}>
                  <Text style={styles.listPrice}>{formatPrice(listing.price)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.listHeartBtn}
                activeOpacity={0.7}
                onPress={() => toggle(listing)}
              >
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={18}
                  color={saved ? Colors.accent : Colors.textMuted}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(220,31,38,0.03)', 'rgba(0,0,0,0)', '#0A0A0C']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.headerSub}>{headerSub}</Text>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color="#A0A0AB"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="filter" size={20} color="#A0A0AB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs / Filters (grid view only) */}
      {viewMode === 'grid' && (
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {['All', 'Price drops', 'Auctions', 'Sold'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {isLoading && savedListings.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
          {renderSkeleton()}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {viewMode === 'grid' ? renderGridView() : renderListView()}
        </ScrollView>
      )}
    </View>
  );
};

const CARD_WIDTH = (width - 40 - 16) / 2; // 20px padding each side + 16px gap

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 26,
  },
  headerSub: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#A0A0AB',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabsWrap: {
    marginBottom: 22,
  },
  tabsContent: {
    paddingHorizontal: 24,
    gap: 10,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabBtnActive: {
    backgroundColor: '#DC1F26',
    borderColor: '#DC1F26',
  },
  tabBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#A0A0AB',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  skeletonCard: {
    width: (width - 40 - 16) / 2,
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  skeletonInfo: {
    padding: 14,
    gap: 6,
  },

  // Grid View
  gridContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  gridCardSpacer: {
    flex: 1,
  },
  gridImgWrap: {
    width: '100%',
    height: 116,
    position: 'relative',
    backgroundColor: '#1E1E28',
  },
  gridImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heartBtnIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridInfo: {
    padding: 14,
  },
  cardMeta: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#8A8A93',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 7,
  },
  cardPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // List View
  listContainer: {
    flexDirection: 'column',
    gap: 14,
  },
  listSortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listSortLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#A0A0AB',
    letterSpacing: 1.5,
  },
  listSortChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listSortChangeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#DC1F26',
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#111116',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    alignItems: 'center',
  },
  listImg: {
    width: 92,
    height: 68,
    borderRadius: 10,
    marginRight: 16,
    resizeMode: 'cover',
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  listMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#A0A0AB',
    marginBottom: 10,
  },
  listPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listPrice: {
    fontFamily: FontFamily.mono,
    fontSize: 15,
    color: '#FFFFFF',
  },
  listHeartBtn: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
});
