import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CzBadge, CzButton, CzChip, CzPrice, CzEyebrow } from '@/components/ui';
import { listingsApi, watchlistApi, auctionsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { CZM, FONT, SPACING, RADII } from '@/constants/tokens';

const { width } = Dimensions.get('window');

export default function VehicleDetailScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const qc         = useQueryClient();
  const { user }   = useAuthStore();
  const [imgIdx, setImgIdx] = useState(0);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn:  () => listingsApi.getById(id!),
    enabled:  !!id,
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn:  watchlistApi.getAll,
    enabled:  !!user,
  });

  const isWatched   = watchlist.some((w: any) => (w.listingId ?? w.listing?.id) === id);
  const watchlistId = watchlist.find((w: any) => (w.listingId ?? w.listing?.id) === id)?.id;

  const { mutate: toggleWatch } = useMutation({
    mutationFn: () =>
      isWatched
        ? watchlistApi.remove(watchlistId!)
        : watchlistApi.add(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  if (isLoading || !listing) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const images   = listing.images ?? [];
  const specs    = [
    { label: 'Year',         value: String(listing.year) },
    { label: 'Mileage',      value: `${listing.mileage?.toLocaleString()} mi` },
    { label: 'Fuel Type',    value: listing.fuelType },
    { label: 'Transmission', value: listing.transmission },
    { label: 'Body Type',    value: listing.bodyType },
    { label: 'Colour',       value: listing.colour },
  ];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Image gallery */}
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {images.map((uri: string, i: number) => (
              <Image
                key={i}
                source={{ uri }}
                style={{ width, height: 280 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          <LinearGradient
            colors={['rgba(10,13,20,0.3)', 'transparent', 'rgba(10,13,20,0.8)']}
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          />
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, { top: insets.top + 8 }]}
            onPress={() => toggleWatch()}
          >
            <Text style={[styles.saveIcon, isWatched && styles.saveIconActive]}>
              {isWatched ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_: any, i: number) => (
                <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title + price */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {listing.year} {listing.make} {listing.model}
              </Text>
              {listing.city && (
                <Text style={styles.location}>📍 {listing.city}</Text>
              )}
            </View>
            <CzPrice value={listing.price} size={24} />
          </View>

          {/* Key specs chips */}
          <View style={styles.chipsRow}>
            <CzChip icon={<Text style={{ fontSize: 10 }}>📅</Text>}>{listing.year}</CzChip>
            <CzChip icon={<Text style={{ fontSize: 10 }}>🛣️</Text>}>{listing.mileage?.toLocaleString()} mi</CzChip>
            <CzChip icon={<Text style={{ fontSize: 10 }}>⛽</Text>}>{listing.fuelType}</CzChip>
            <CzChip icon={<Text style={{ fontSize: 10 }}>⚙️</Text>}>{listing.transmission}</CzChip>
          </View>

          {/* Description */}
          {listing.description && (
            <View style={styles.section}>
              <CzEyebrow style={styles.sectionLabel}>About this car</CzEyebrow>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {/* Full spec table */}
          <View style={styles.section}>
            <CzEyebrow style={styles.sectionLabel}>Specifications</CzEyebrow>
            <View style={styles.specTable}>
              {specs.map((s) => (
                <View key={s.label} style={styles.specRow}>
                  <Text style={styles.specLabel}>{s.label}</Text>
                  <Text style={styles.specValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Seller info */}
          <View style={styles.section}>
            <CzEyebrow style={styles.sectionLabel}>Seller</CzEyebrow>
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>S</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName}>Verified Seller</Text>
                <Text style={styles.sellerMeta}>HPI-clear · Buyer protection</Text>
              </View>
              <CzBadge kind="verified">Verified</CzBadge>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
        <CzButton
          variant="outline"
          size="md"
          style={{ flex: 1 }}
          onPress={() => router.push(`/messages` as any)}
        >
          Message
        </CzButton>
        <CzButton
          variant="primary"
          size="md"
          style={{ flex: 1 }}
          onPress={() => router.push(`/offer/${id}` as any)}
        >
          Make Offer
        </CzButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: CZM.bg },
  scroll:       { paddingBottom: 120 },
  loading:      { flex: 1, backgroundColor: CZM.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText:  { fontFamily: FONT.body, color: CZM.fg3 },
  gallery:      { position: 'relative', height: 280 },
  backBtn:      { position: 'absolute', left: 16, width: 38, height: 38, borderRadius: 9999, backgroundColor: 'rgba(10,13,20,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CZM.border },
  backIcon:     { fontFamily: FONT.heading, fontSize: 24, color: '#fff', lineHeight: 28 },
  saveBtn:      { position: 'absolute', right: 16, width: 38, height: 38, borderRadius: 9999, backgroundColor: 'rgba(10,13,20,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: CZM.border },
  saveIcon:     { fontSize: 16, color: CZM.fg3 },
  saveIconActive:{ color: CZM.red },
  dots:         { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:          { width: 5, height: 5, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive:    { backgroundColor: '#fff', width: 16 },
  content:      { padding: SPACING.screen, gap: 0 },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  title:        { fontFamily: FONT.heading, fontSize: 22, color: '#fff', letterSpacing: -0.3, lineHeight: 28 },
  location:     { fontFamily: FONT.body, fontSize: 13, color: CZM.fg3, marginTop: 4 },
  chipsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  section:      { marginBottom: 24 },
  sectionLabel: { marginBottom: 12 },
  description:  { fontFamily: FONT.body, fontSize: 15, color: CZM.fg2, lineHeight: 24 },
  specTable:    { backgroundColor: CZM.bgElev, borderRadius: RADII.card, borderWidth: 1, borderColor: CZM.border, overflow: 'hidden' },
  specRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: CZM.border },
  specLabel:    { fontFamily: FONT.body, fontSize: 14, color: CZM.fg3 },
  specValue:    { fontFamily: FONT.bodySemi, fontSize: 14, color: '#fff' },
  sellerCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CZM.bgElev, borderRadius: RADII.card, borderWidth: 1, borderColor: CZM.border, padding: 16 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 9999, backgroundColor: CZM.secondary, alignItems: 'center', justifyContent: 'center' },
  sellerInitial:{ fontFamily: FONT.heading, fontSize: 18, color: '#fff' },
  sellerName:   { fontFamily: FONT.bodySemi, fontSize: 15, color: '#fff' },
  sellerMeta:   { fontFamily: FONT.body, fontSize: 12, color: CZM.fg3, marginTop: 2 },
  stickyBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.screen, paddingTop: 12, backgroundColor: 'rgba(10,13,20,0.92)', borderTopWidth: 1, borderTopColor: CZM.border },
});
