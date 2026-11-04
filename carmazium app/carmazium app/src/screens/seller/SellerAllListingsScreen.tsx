import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { IconButton } from '../../components/IconButton';
import { VehicleCard } from '../../components/VehicleCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { apiClient } from '../../lib/apiClient';
import { mapApiListingToCarListing, ApiListing, BackendPaginatedResponse } from '../../lib/listingsApi';
import type { CarListing } from '../../data/listings';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'SellerAllListings'>;
const PAGE_SIZE = 20;

/**
 * Every active listing by one seller (website: /seller/[id]/listings). The
 * Seller Profile shows a 6-car preview; this pages through all of them
 * (GET /sellers/:userId/listings?page&limit — public).
 */
export const SellerAllListingsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sellerId, sellerName } = route.params;
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CarListing[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const res = await apiClient<BackendPaginatedResponse<ApiListing>>(
        `/sellers/${sellerId}/listings?page=${nextPage}&limit=${PAGE_SIZE}`,
      );
      const mapped = (Array.isArray(res?.data) ? res.data : []).map(mapApiListingToCarListing);
      setItems(prev => {
        if (replace) return mapped;
        const seen = new Set(prev.map(x => x.id));
        return [...prev, ...mapped.filter(x => !seen.has(x.id))];
      });
      setPage(nextPage);
      setTotal(res?.pagination?.total ?? null);
      setTotalPages(res?.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.message || 'Could not load this seller’s listings.');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [sellerId]);

  useEffect(() => { void load(1, true); }, [load]);

  const openListing = useCallback((id: string) => {
    const listing = items.find(x => x.id === id);
    if (listing) navigation.navigate('VehicleDetail', { listing });
  }, [items, navigation]);

  const renderItem = useCallback(({ item }: { item: CarListing }) => (
    <View style={styles.cardWrap}>
      <VehicleCard listing={item} onPress={openListing} />
    </View>
  ), [openListing]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton
          style={styles.backBtn}
          icon={<Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{sellerName || 'Seller'}</Text>
          <Text style={styles.subtitle}>
            {total != null ? `${total.toLocaleString('en-GB')} active listing${total === 1 ? '' : 's'}` : 'Active listings'}
          </Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(1, true); }}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!loading && !loadingMore && page < totalPages) {
            setLoadingMore(true);
            void load(page + 1, false);
          }
        }}
        ListHeaderComponent={error ? <ErrorBanner message={error} onRetry={() => void load(items.length ? page + 1 : 1, !items.length)} /> : null}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
          : !error ? <EmptyState icon="car-outline" title="No active listings" subtitle="This seller has no cars for sale right now." /> : null}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} /> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 44, height: 44 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  subtitle: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  list: { paddingHorizontal: 16, gap: 14 },
  cardWrap: { width: '100%' },
});
