import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import {
  getNativeAdminAuctions, personName, paymentAmount, type AdminAuctionRecord,
} from '../../lib/nativeAdminRecords';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;
const pageLimit = 20;

/** Native read-only auction history; never changes reserve, bids or winners. */
export const AdminAuctionsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const clearance = useTabBarClearance();
  const [rows, setRows] = useState<AdminAuctionRecord[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getNativeAdminAuctions(page, pageLimit, search);
      setRows(Array.isArray(result.data) ? result.data : []);
      setTotal(result.pagination?.total ?? null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load auction history.');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const navigateUser = (id?: string) => {
    if (id) navigation.navigate('AdminAccountDetail', { userId: id });
  };

  const render = ({ item }: { item: AdminAuctionRecord }) => {
    const listing = item.listing;
    const bid = listing?.bids?.[0]?.amount;
    const seller = listing?.seller;
    return <View style={styles.auction}>
      <View style={styles.vehicleRow}>
        {listing?.images?.[0]
          ? <Image source={{ uri: listing.images[0] }} style={styles.photo} contentFit="cover" />
          : <View style={[styles.photo, styles.photoFallback]}><Ionicons name="car-outline" size={24} color={Colors.textMuted} /></View>}
        <View style={styles.flex}>
          <Text style={styles.vehicleName} numberOfLines={2}>{listing?.title || 'Vehicle details unavailable'}</Text>
          <Text style={styles.secondary}>{[listing?.vrm || 'No VRM', listing?.year, listing?.make].filter(Boolean).join(' · ')}</Text>
        </View>
        <Text style={[styles.status, { color: item.status === 'ACTIVE' ? Colors.success : Colors.textSecondary }]}>{item.status}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel={seller?.id ? 'View auction seller account' : 'Seller details unavailable'}
        disabled={!seller?.id} style={styles.seller}
        onPress={() => navigateUser(seller?.id)}>
        <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
        <View style={styles.flex}>
          <Text style={styles.label}>Seller: {personName(seller)}</Text>
          <Text style={styles.secondary} numberOfLines={1}>{seller?.email || 'Email unavailable'}</Text>
        </View>
        {seller?.id && <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />}
      </TouchableOpacity>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.secondary}>Reserve</Text><Text style={styles.number}>{item.reservePrice == null ? '—' : paymentAmount(item.reservePrice)}</Text></View>
        <View style={styles.metric}><Text style={styles.secondary}>Top bid</Text><Text style={styles.number}>{bid == null ? '—' : paymentAmount(bid)}</Text></View>
        <View style={styles.metric}><Text style={styles.secondary}>Bids</Text><Text style={styles.number}>{listing?._count?.bids ?? 0}</Text></View>
      </View>
      <TouchableOpacity style={styles.seller} accessibilityRole="button"
        accessibilityLabel={item.winner?.id ? 'View winner account' : 'No winning dealer recorded'}
        disabled={!item.winner?.id}
        onPress={() => navigateUser(item.winner?.id)}>
        <Ionicons name="trophy-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.label}>Winner: {item.winner ? personName(item.winner) : 'Not assigned'}</Text>
        {item.winner?.id && <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />}
      </TouchableOpacity>
      {['PENDING_REVIEW', 'REJECTED'].includes(listing?.status || '') && (
        <Text style={styles.alert}>Listing {listing?.status === 'REJECTED' ? 'rejected' : 'awaiting review'} — not cleared for auction.</Text>
      )}
    </View>;
  };

  const header = <View>
    <WebsiteTopBar />
    <View style={styles.pageHeader}>
      <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')} accessibilityRole="button" style={styles.back}>
        <Ionicons name="arrow-back" size={17} color={Colors.textSecondary} />
        <Text style={styles.backLabel}>Back to Overview</Text>
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">AUCTION MANAGEMENT</Text>
      <Text style={styles.secondary}>{total == null ? 'Loading auction totals…' : `${total} total auctions across the platform`}</Text>
    </View>
    <View style={styles.searchPanel}>
      <Text style={styles.sectionLabel}>SEARCH AUCTIONS</Text>
      <TextInput value={searchDraft} onChangeText={setSearchDraft} autoCapitalize="none"
        accessibilityLabel="Search auction history"
        placeholder="Seller name or vehicle registration"
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search" onSubmitEditing={() => { setPage(1); setSearch(searchDraft.trim()); }}
        style={styles.input} />
      <TouchableOpacity style={styles.searchButton} onPress={() => { setPage(1); setSearch(searchDraft.trim()); }} accessibilityRole="button">
        <Ionicons name="search-outline" size={18} color={Colors.onAccent} />
        <Text style={styles.searchText}>Search</Text>
      </TouchableOpacity>
      {search ? <TouchableOpacity accessibilityRole="button" onPress={() => { setPage(1); setSearch(''); setSearchDraft(''); }} style={styles.clear}>
        <Text style={styles.clearText}>Clear search</Text>
      </TouchableOpacity> : null}
      <Text style={styles.secondary}>Search the complete auction history by seller name or registration number.</Text>
    </View>
    {error && <ErrorBanner message={error} onRetry={() => void load(true)} />}
    <Text style={styles.readOnly}>Auction price corrections, winner assignments and listing edits are not submitted from this read-only screen.</Text>
  </View>;

  const footer = <View style={styles.pager}>
    <TouchableOpacity accessibilityRole="button" disabled={page <= 1 || loading} onPress={() => setPage(p => Math.max(1, p - 1))} style={styles.pageButton}><Text style={styles.pageButtonText}>Previous</Text></TouchableOpacity>
    <Text style={styles.secondary}>Page {page}{total == null ? '' : ` of ${Math.max(1, Math.ceil(total / pageLimit))}`}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={loading || (total != null && page * pageLimit >= total)} onPress={() => setPage(p => p + 1)} style={styles.pageButton}><Text style={styles.pageButtonText}>Next</Text></TouchableOpacity>
  </View>;

  return <View style={styles.screen}>
    <FlatList data={rows} keyExtractor={item => item.id} renderItem={render}
      ListHeaderComponent={header} ListFooterComponent={footer}
      ListEmptyComponent={loading ? <ActivityIndicator color={Colors.accent} style={styles.spinner} /> : <Text style={styles.empty}>No auctions match this search.</Text>}
      contentContainerStyle={{ paddingBottom: clearance + 20, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.accent} />}
      keyboardShouldPersistTaps="handled" />
  </View>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  flex: { flex: 1 },
  pageHeader: { margin: 16, marginTop: 24, backgroundColor: Colors.bgSecondary, padding: 23, borderRadius: 20, gap: 7 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
  backLabel: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: FontSize.base },
  title: { fontFamily: FontFamily.extraBold, fontSize: FontSize.xl, color: Colors.textPrimary },
  secondary: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 19 },
  searchPanel: { marginHorizontal: 16, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, gap: 11 },
  sectionLabel: { color: Colors.textSecondary, fontFamily: FontFamily.bold, letterSpacing: 1, fontSize: FontSize.sm },
  input: { minHeight: 51, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSecondary, fontSize: FontSize.base, color: Colors.textPrimary },
  searchButton: { minHeight: 48, borderRadius: 13, backgroundColor: Colors.accent, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: Colors.onAccent, fontSize: FontSize.base, fontFamily: FontFamily.bold },
  clear: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' },
  clearText: { color: Colors.accent, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  auction: { marginHorizontal: 16, padding: 15, borderRadius: 17, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  vehicleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  photo: { width: 64, height: 64, borderRadius: 10 },
  photoFallback: { backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.base, marginBottom: 4 },
  status: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  seller: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 },
  label: { color: Colors.textPrimary, fontSize: FontSize.sm, fontFamily: FontFamily.medium },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, paddingVertical: 10 },
  metric: { flex: 1, gap: 4 },
  number: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.base },
  alert: { color: Colors.warning, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
  readOnly: { color: Colors.textMuted, fontSize: FontSize.sm, margin: 16 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 18 },
  pageButton: { borderWidth: 1, borderRadius: 12, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: Colors.bgCard },
  pageButtonText: { color: Colors.textPrimary, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  spinner: { marginVertical: 20 },
  empty: { padding: 22, textAlign: 'center', color: Colors.textMuted },
});
