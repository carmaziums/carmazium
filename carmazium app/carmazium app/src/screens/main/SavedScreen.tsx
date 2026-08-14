import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
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
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { Colors } from '../../constants/colors';
import { IconButton } from '../../components/IconButton';
import { CarListing, formatPrice } from '../../data/listings';
import { useWatchlistStore } from '../../store/watchlistStore';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const { width } = Dimensions.get('window');

// Matches web's watchlist page status pill colours (dashboard/buyer/watchlist/page.tsx)
const STATUS_BADGE_BG: Record<string, string> = {
  ACTIVE: Colors.success,
  SOLD: Colors.infoBlue,
};

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type ViewMode = 'grid' | 'list';

// ─── Saved Screen ─────────────────────────────────────────────────────────────

export const SavedScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [viewMode,   setViewMode]   = useState<ViewMode>('grid');
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

  // ─── Grid View — FlatList (numColumns=2) so a growing watchlist virtualizes
  // instead of mounting every row at once, same as the list view below
  // (mobile-audit.md P3). Cards use a fixed CARD_WIDTH rather than flex:1 so a
  // lone trailing item in an odd-numbered list sits left-aligned at half width
  // instead of stretching to fill the row. ──

  const renderGridItem = ({ item: listing }: { item: CarListing }) => {
    const saved = isSaved(listing.id);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.88}
        onPress={() => handleCardPress(listing)}
      >
        <View style={styles.gridImgWrap}>
          {listing.images[0] ? (
            <Image source={{ uri: listing.images[0] }} style={styles.gridImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.gridImg, { backgroundColor: Colors.bgTertiary }]} />
          )}
          {listing.status && (
            <View style={[styles.statusBadge, { backgroundColor: STATUS_BADGE_BG[listing.status] ?? Colors.textMuted }]}>
              <Text style={styles.statusBadgeText}>{listing.status}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.heartBtnIcon}
            activeOpacity={0.7}
            onPress={() => toggle(listing)}
            accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={16}
              color={saved ? Colors.accent : Colors.white}
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
          <View style={styles.gridPriceRow}>
            <Text style={styles.cardPrice}>{formatPrice(listing.price)}</Text>
            <Text style={styles.viewCountText}>{listing.viewCount ?? 0} views</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── List View — FlatList so a growing watchlist virtualizes instead of
  // mounting every row at once (mobile-audit.md P3/P6). ──

  const renderListSortRow = () => (
    <View style={styles.listSortRow}>
      <Text style={styles.listSortLabel}>SORTED BY: RECENTLY SAVED</Text>
      <TouchableOpacity style={styles.listSortChange} activeOpacity={0.7}>
        <Text style={styles.listSortChangeText}>Change</Text>
        <Ionicons name="chevron-down" size={12} color={Colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      </TouchableOpacity>
    </View>
  );

  const renderListItem = ({ item: listing }: { item: CarListing }) => {
    const saved = isSaved(listing.id);
    return (
      <TouchableOpacity
        style={styles.listCard}
        activeOpacity={0.85}
        onPress={() => handleCardPress(listing)}
      >
        {listing.images[0] ? (
          <Image source={{ uri: listing.images[0] }} style={styles.listImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.listImg, { backgroundColor: Colors.bgTertiary }]} />
        )}
        <View style={styles.listInfo}>
          <View style={styles.listTitleRow}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {listing.make} {listing.model}
            </Text>
            {listing.status && (
              <View style={[styles.statusBadgeSmall, { backgroundColor: STATUS_BADGE_BG[listing.status] ?? Colors.textMuted }]}>
                <Text style={styles.statusBadgeSmallText}>{listing.status}</Text>
              </View>
            )}
          </View>
          <Text style={styles.listMeta}>
            {listing.year} · {listing.mileage.toLocaleString('en-GB')} mi · {listing.location || ''}
          </Text>
          <View style={styles.listPriceRow}>
            <Text style={styles.listPrice}>{formatPrice(listing.price)}</Text>
            <Text style={styles.viewCountText}>{listing.viewCount ?? 0} views</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.listHeartBtn}
          activeOpacity={0.7}
          onPress={() => toggle(listing)}
          accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={18}
            color={saved ? Colors.accent : Colors.textMuted}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha03, 'rgba(0,0,0,0)', Colors.bgPrimary]}
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
          <IconButton
            icon={<Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color={Colors.textSecondary} />}
            accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            style={styles.iconBtn}
          />
        </View>
      </View>

      {/* Content */}
      {isLoading && savedListings.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
          {renderSkeleton()}
        </ScrollView>
      ) : viewMode === 'list' ? (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          data={displayedListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          ListHeaderComponent={displayedListings.length > 0 ? renderListSortRow() : null}
          ListEmptyComponent={renderEmptyState()}
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100, gap: 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          data={displayedListings}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item) => item.id}
          renderItem={renderGridItem}
          ListEmptyComponent={renderEmptyState()}
        />
      )}
    </View>
  );
};

// scrollContent uses paddingHorizontal: 24 on each side, with a 16px gap
// between the two grid columns.
const CARD_WIDTH = (width - 24 * 2 - 16) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
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
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize['3xl'],
    color: Colors.white,
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
    backgroundColor: Colors.whiteAlpha03,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
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
    width: CARD_WIDTH,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    overflow: 'hidden',
  },
  skeletonInfo: {
    padding: 14,
    gap: 6,
  },

  // Grid View
  gridRow: {
    gap: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    overflow: 'hidden',
  },
  gridImgWrap: {
    width: '100%',
    height: 116,
    position: 'relative',
    backgroundColor: Colors.deepBlue_1e1e28,
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
    backgroundColor: Colors.blackAlpha50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridInfo: {
    padding: 14,
  },
  cardMeta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textFaint,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    marginBottom: 7,
  },
  cardPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.size14,
    color: Colors.white,
  },
  gridPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  statusBadgeSmallText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.white,
  },
  viewCountText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
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
    fontSize: FontSize.size10,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  listSortChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listSortChangeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondaryAlt,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
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
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  listTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    flexShrink: 1,
  },
  listMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  listPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listPrice: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  listHeartBtn: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
});
