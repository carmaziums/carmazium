import React from 'react';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CzBadge, CzChip, CzEyebrow, CzPrice, CzScreen } from '@/components/ui';
import { listingsApi, auctionsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { CZM, FONT, SPACING, RADII } from '@/constants/tokens';

const BODY_TYPES = [
  { id: 'SUV',       label: 'SUV' },
  { id: 'SALOON',    label: 'Saloon' },
  { id: 'HATCHBACK', label: 'Hatchback' },
  { id: 'ESTATE',    label: 'Estate' },
  { id: 'COUPE',     label: 'Coupe' },
  { id: 'CONVERTIBLE', label: 'Convertible' },
];

export default function HomeScreen() {
  const router    = useRouter();
  const { user }  = useAuthStore();
  const firstName = user?.firstName ?? 'there';

  const { data: listingsData } = useQuery({
    queryKey: ['listings', 'home'],
    queryFn:  () => listingsApi.getAll({ limit: 8, sortBy: 'createdAt_desc' }),
  });

  const { data: auctionsData } = useQuery({
    queryKey: ['auctions', 'active'],
    queryFn:  () => auctionsApi.getAll({ status: 'ACTIVE', limit: 4 }),
  });

  const listings = listingsData?.data ?? [];
  const auctions = auctionsData?.data ?? [];

  return (
    <CzScreen safe={false}>
      {/* Ambient red glow */}
      <LinearGradient
        colors={['rgba(255,0,55,0.09)', 'transparent']}
        style={[StyleSheet.absoluteFill, { height: 320, pointerEvents: 'none' }]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkCar}>CAR</Text>
            <Text style={styles.wordmarkMaz}>MAZIUM</Text>
          </Text>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications' as any)}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* ── Greeting ── */}
        <View style={styles.heroBlock}>
          <Text style={styles.greeting}>
            Find your next{'\n'}
            car, <Text style={styles.greetingName}>{firstName}.</Text>
          </Text>

          {/* AI Search bar — tappable, routes to search */}
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/search')}
          >
            <Text style={styles.searchIcon}>✦</Text>
            <Text style={styles.searchPlaceholder}>
              Ask AI — e.g. red SUV under £30k…
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Live Auctions ── */}
        {auctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <CzEyebrow>Live Auctions</CzEyebrow>
              <TouchableOpacity onPress={() => router.push('/(tabs)/live')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={auctions}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(a) => a.id}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.auctionCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/auction/${item.id}` as any)}
                >
                  <Image
                    source={{ uri: item.listing?.images?.[0] }}
                    style={styles.auctionImg}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(10,13,20,0.96)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.auctionLiveBadge}>
                    <CzBadge kind="live">LIVE</CzBadge>
                  </View>
                  <View style={styles.auctionInfo}>
                    <Text style={styles.auctionTitle} numberOfLines={1}>
                      {item.listing?.year} {item.listing?.make} {item.listing?.model}
                    </Text>
                    <View style={styles.auctionMeta}>
                      <CzPrice value={item.currentBid ?? item.listing?.price ?? 0} size={16} />
                      <Text style={styles.bidCount}>{item.bidCount ?? 0} bids</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Browse by Body Type ── */}
        <View style={styles.section}>
          <CzEyebrow style={styles.sectionLabel}>Browse by type</CzEyebrow>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
          >
            {BODY_TYPES.map((bt) => (
              <TouchableOpacity
                key={bt.id}
                style={styles.bodyChip}
                onPress={() => router.push(`/(tabs)/search?bodyType=${bt.id}` as any)}
              >
                <Text style={styles.bodyChipText}>{bt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Featured Listings ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <CzEyebrow>Featured cars</CzEyebrow>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={styles.seeAll}>Browse all →</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={listings}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(l) => l.id}
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.carCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/vehicle/${item.id}` as any)}
              >
                <Image
                  source={{ uri: item.images?.[0] }}
                  style={styles.carImg}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(10,13,20,0.90)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.carInfo}>
                  <Text style={styles.carTitle} numberOfLines={1}>
                    {item.year} {item.make} {item.model}
                  </Text>
                  <View style={styles.chips}>
                    <CzChip>{item.mileage?.toLocaleString()} mi</CzChip>
                    <CzChip>{item.fuelType}</CzChip>
                  </View>
                  <CzPrice value={item.price} size={18} />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </CzScreen>
  );
}

const styles = StyleSheet.create({
  scroll:          { paddingTop: 56 },
  header:          { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screen, paddingTop: 52, paddingBottom: 8 },
  wordmark:        { fontFamily: FONT.heading, fontSize: 18, letterSpacing: 2 },
  wordmarkCar:     { color: '#c0c0c0' },
  wordmarkMaz:     { color: CZM.red },
  notifBtn:        { width: 36, height: 36, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CZM.border },
  notifIcon:       { fontSize: 14 },
  heroBlock:       { paddingHorizontal: SPACING.screen, paddingTop: 16, paddingBottom: 8, gap: 16 },
  greeting:        { fontFamily: FONT.heading, fontSize: 30, color: '#fff', lineHeight: 38, letterSpacing: -0.5 },
  greetingName:    { color: CZM.red },
  searchBar:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: CZM.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  searchIcon:      { fontSize: 14, color: CZM.red },
  searchPlaceholder: { fontFamily: FONT.body, fontSize: 14, color: CZM.fg4 },
  section:         { marginTop: 28 },
  sectionHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screen, marginBottom: 14 },
  sectionLabel:    { paddingHorizontal: SPACING.screen, marginBottom: 14 },
  seeAll:          { fontFamily: FONT.bodySemi, fontSize: 12, color: CZM.fg3 },
  hList:           { paddingLeft: SPACING.screen, paddingRight: 8, gap: 12 },
  auctionCard:     { width: 220, height: 148, borderRadius: RADII.card, overflow: 'hidden', backgroundColor: CZM.bgCard },
  auctionImg:      { ...StyleSheet.absoluteFillObject },
  auctionLiveBadge:{ position: 'absolute', top: 10, left: 10 },
  auctionInfo:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  auctionTitle:    { fontFamily: FONT.headingSemi, fontSize: 13, color: '#fff', marginBottom: 4 },
  auctionMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bidCount:        { fontFamily: FONT.body, fontSize: 11, color: CZM.fg3 },
  bodyChip:        { backgroundColor: CZM.bgElev, borderWidth: 1, borderColor: CZM.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  bodyChipText:    { fontFamily: FONT.bodySemi, fontSize: 13, color: CZM.fg2 },
  carCard:         { width: 200, height: 240, borderRadius: RADII.card, overflow: 'hidden', backgroundColor: CZM.bgCard },
  carImg:          { ...StyleSheet.absoluteFillObject },
  carInfo:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 6 },
  carTitle:        { fontFamily: FONT.headingSemi, fontSize: 13, color: '#fff' },
  chips:           { flexDirection: 'row', gap: 6 },
});
