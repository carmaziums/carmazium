import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { fetchAllMyListings } from '../../lib/myListingsApi';
import { fetchAllMyAuctions } from '../../lib/myAuctionsApi';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

type Vehicle = {
  id: string; title?: string; make?: string; model?: string; year?: number;
  status?: string; images?: string[]; type?: string;
  listing?: { id: string; title?: string; images?: string[]; year?: number; make?: string; model?: string };
};
type Channel = 'Listings' | 'Auctions';
type Filter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'SCHEDULED' | 'PENDING_REVIEW' | 'OFFER_ACCEPTED' | 'SOLD' | 'ENDED' | 'CANCELLED';
const FILTERS: Filter[] = ['ALL', 'ACTIVE', 'DRAFT', 'SCHEDULED', 'PENDING_REVIEW', 'OFFER_ACCEPTED', 'SOLD', 'ENDED', 'CANCELLED'];

/** A single entry point for every owned retail and auction car. */
export const MyCarsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [channel, setChannel] = useState<Channel>('Listings');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [listings, setListings] = useState<Vehicle[]>([]);
  const [auctions, setAuctions] = useState<Vehicle[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    const [listingResult, auctionResult] = await Promise.allSettled([
      fetchAllMyListings<Vehicle>(),
      fetchAllMyAuctions<Vehicle>('list'),
    ]);
    if (listingResult.status === 'fulfilled') setListings(listingResult.value);
    else setError('Your listings could not be loaded.');
    if (auctionResult.status === 'fulfilled') setAuctions(auctionResult.value);
    else setError(previous => previous ? previous + ' Auctions could not be loaded.' : 'Auctions could not be loaded.');
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const data = (channel === 'Listings' ? listings : auctions).filter(item =>
    filter === 'ALL' || item.status === filter);
  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.title}>My cars</Text>
        <Text style={styles.muted}>Manage your retail listings and car auctions in one place.</Text>
      </View>
      <View style={styles.channelRow}>
        {(['Listings', 'Auctions'] as const).map(value => (
          <TouchableOpacity key={value} accessibilityRole="button"
            accessibilityState={{ selected: channel === value }}
            onPress={() => { setChannel(value); setFilter('ALL'); }}
            style={[styles.channel, channel === value && styles.selected]}>
            <Text style={[styles.channelText, channel === value && styles.selectedText]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}
        contentContainerStyle={styles.filterContent}>
        {FILTERS.filter(status => channel === 'Listings'
          ? !['SCHEDULED', 'ENDED', 'CANCELLED'].includes(status)
          : !['DRAFT', 'PENDING_REVIEW', 'OFFER_ACCEPTED', 'SOLD'].includes(status)).map(status => (
          <TouchableOpacity key={status} accessibilityRole="button"
            accessibilityState={{ selected: filter === status }}
            onPress={() => setFilter(status)}
            style={[styles.filter, filter === status && styles.filterSelected]}>
            <Text style={styles.filterText}>{status === 'ALL' ? 'All' : status.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {busy ? <View style={styles.loading}><ActivityIndicator color={Colors.accent}/></View> : (
        <FlatList style={styles.list} data={data} keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.muted}>No {channel.toLowerCase()} matching this status.</Text>}
          renderItem={({ item }) => {
            const vehicle = item.listing || item;
            return (
              <TouchableOpacity style={styles.card} accessibilityRole="button"
                onPress={() => navigation.navigate(channel === 'Listings' ? 'SellerListings' : 'SellerAuctions')}
              >
                {vehicle.images?.[0]
                  ? <Image source={{ uri: vehicle.images[0] }} style={styles.image} contentFit="cover" />
                  : <View style={styles.thumb}><Ionicons name="car-outline" size={23} color={Colors.textMuted}/></View>}
                <View style={styles.details}>
                  <Text style={styles.name} numberOfLines={2}>{vehicle.title || [vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}</Text>
                  <Text style={styles.muted}>{item.status || 'Not provided'}</Text>
                  <Text style={styles.manage}>Manage {channel.toLowerCase()} and actions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.accent}/>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary, paddingTop: 56 },
  heading: { paddingHorizontal: 20, paddingBottom: 12, gap: 4 },
  title: { fontSize: 25, color: Colors.textPrimary, fontFamily: FontFamily.extraBold },
  muted: { fontSize: 12, color: Colors.textMuted, fontFamily: FontFamily.medium },
  channelRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  channel: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle },
  selected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  selectedText: { color: Colors.white },
  channelText: { color: Colors.textSecondary, fontFamily: FontFamily.bold },
  filters: { flexGrow: 0, marginVertical: 12, maxHeight: 48 },
  filterContent: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  filter: { minHeight: 38, borderWidth: 1, borderRadius: 10, borderColor: Colors.borderSubtle, justifyContent: 'center', paddingHorizontal: 11 },
  filterSelected: { borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 11, fontFamily: FontFamily.bold },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 110, gap: 10 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 13, backgroundColor: Colors.bgCard, padding: 13, borderWidth: 1, borderColor: Colors.borderSubtle },
  image: { width: 76, height: 67, borderRadius: 9 },
  thumb: { width: 76, height: 67, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgElevated },
  details: { flex: 1, gap: 5 },
  name: { color: Colors.textPrimary, fontFamily: FontFamily.bold, fontSize: 14 },
  manage: { color: Colors.accent, fontFamily: FontFamily.bold, fontSize: 11 },
  error: { paddingHorizontal: 20, color: Colors.warning, fontSize: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
