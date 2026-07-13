import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, ActivityIndicator, FlatList,
  RefreshControl, Switch, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { CarListing } from '../../data/listings';
import { searchListings } from '../../lib/listingsApi';
import { naturalLanguageSearch } from '../../lib/aiApi';
import { HorizontalVehicleCard } from '../../components/HorizontalVehicleCard';
import { BottomSheet } from '../../components/BottomSheet';
import { useLocation } from '../../context/LocationContext';
import { haversineDistanceMiles } from '../../lib/distance';
import { Colors } from '../../constants/colors';
import { getBodyTypeIcon } from '../../constants/bodyTypes';
import {FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

const { width: SW } = Dimensions.get('window');

// ─── Quick filter chips ───────────────────────────────────────────────────────

interface QuickFilter {
  id: string;
  label: string;
  params: {
    maxPrice?: number;
    fuelType?: string;
    bodyType?: string;
    minYear?: number;
    transmission?: string;
  };
}

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'all',       label: 'All',          params: {} },
  { id: 'u15k',      label: 'Under £15k',   params: { maxPrice: 15000 } },
  { id: 'u30k',      label: 'Under £30k',   params: { maxPrice: 30000 } },
  { id: 'electric',  label: 'Electric',     params: { fuelType: 'ELECTRIC' } },
  { id: 'hybrid',    label: 'Hybrid',       params: { fuelType: 'HYBRID' } },
  { id: 'suv',       label: 'SUVs',         params: { bodyType: 'SUV' } },
  { id: 'saloon',    label: 'Saloon',       params: { bodyType: 'SALOON' } },
  { id: 'new',       label: '2020+',        params: { minYear: 2020 } },
  { id: 'manual',    label: 'Manual',       params: { transmission: 'MANUAL' } },
];

const MAKES = ['BMW', 'Audi', 'Mercedes', 'Volkswagen', 'Ford', 'Toyota', 'Honda', 'Porsche', 'Range Rover', 'Tesla'];
const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric'];
// Icons sourced from the shared body-type set (src/constants/bodyTypes.ts) so
// Home/Search/Sell all show identical icons per body type (mobile-ui-ux-audit.md §C6).
const BODY_TYPES = [
  { id: 'SUV', label: 'SUV', icon: getBodyTypeIcon('SUV') },
  { id: 'SALOON', label: 'Saloon', icon: getBodyTypeIcon('SALOON') },
  { id: 'HATCHBACK', label: 'Hatchback', icon: getBodyTypeIcon('HATCHBACK') },
  { id: 'ESTATE', label: 'Estate', icon: getBodyTypeIcon('ESTATE') },
  { id: 'COUPE', label: 'Coupé', icon: getBodyTypeIcon('COUPE') },
  { id: 'CONVERTIBLE', label: 'Convertible', icon: getBodyTypeIcon('CONVERTIBLE') },
  { id: 'VAN', label: 'Van', icon: getBodyTypeIcon('VAN') },
  { id: 'PICKUP', label: 'Pickup', icon: getBodyTypeIcon('PICKUP') },
];
const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'price_asc', label: 'Price: low → high' },
  { id: 'price_desc', label: 'Price: high → low' },
  { id: 'mileage_asc', label: 'Mileage: low → high' },
  { id: 'mileage_desc', label: 'Mileage: high → low' },
  { id: 'year_asc', label: 'Year: oldest first' },
  { id: 'year_desc', label: 'Year: newest first' },
];
const YEAR_OPTS = ['Any', '2015', '2017', '2019', '2020', '2021', '2022', '2023'];
const YEAR_OPTS_MAX = ['Any', '2016', '2018', '2020', '2021', '2022', '2023', '2024'];
const MILES_OPTS = ['Any', '10k', '20k', '30k', '40k', '60k', '80k', '100k'];
const MILES_OPTS_MIN = ['Any', '5k', '10k', '20k', '30k', '40k', '60k', '80k'];
const CONDITIONS = [
  { id: 'EXCELLENT', label: 'Excellent' },
  { id: 'GOOD',      label: 'Good' },
  { id: 'FAIR',      label: 'Fair' },
  { id: 'POOR',      label: 'Poor' },
  { id: 'CAT_S',     label: 'Cat S' },
  { id: 'CAT_N',     label: 'Cat N' },
];
// Mirrors web's src/app/search/page.tsx exactly — same doors/seats quick-select
// values, same Euro Standard options, same 18-item features checklist.
const DOOR_OPTS = ['2', '3', '4', '5'];
const SEAT_OPTS = ['2', '4', '5', '7'];
const EURO_OPTIONS = [
  { value: 'EURO_4', label: 'Euro 4' },
  { value: 'EURO_5', label: 'Euro 5' },
  { value: 'EURO_6', label: 'Euro 6' },
  { value: 'EURO_6D', label: 'Euro 6d' },
];
const POPULAR_FEATURES = [
  'Air Conditioning', 'Climate Control', 'Alloy Wheels',
  'Parking Sensors (Front)', 'Parking Sensors (Rear)', 'Reverse Camera',
  'Sat Nav', 'Bluetooth / Hands Free', 'DAB Radio',
  'Heated Seats', 'Cruise Control', 'Panoramic Roof',
  'Apple CarPlay', 'Android Auto', 'Keyless Entry',
  'Lane Assist', 'Blind Spot Monitoring', 'Adaptive Cruise Control',
];
// "Near Me" — the backend has no lat/lng/radius filter param at all (confirmed
// against listing-filter.dto.ts), so web itself just filters/sorts the already-
// fetched page client-side by haversine distance (src/app/search/page.tsx).
// Mirrors that same (imperfect — doesn't reach across pages) behavior here
// rather than inventing server-side geo support that doesn't exist.
const DISTANCE_CHIPS = [10, 25, 50, 100, 200];

// ─── Screen ───────────────────────────────────────────────────────────────────

export const SearchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const { postcode: userPostcode, latitude: userLat, longitude: userLng, setPostcode: saveUserPostcode } = useLocation();

  // ── Search state ──
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<string>(
    (route.params?.bodyType || route.params?.fuelType || route.params?.maxPrice) ? 'custom' : 'all'
  );
  const [sortId, setSortId] = useState(route.params?.sortBy ?? 'newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── Filter modal state ──
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(route.params?.maxPrice ? Number(route.params.maxPrice) : 150000);
  const [selectedBody, setSelectedBody] = useState<string>(route.params?.bodyType ?? '');
  const [selectedFuels, setSelectedFuels] = useState<string[]>(
    route.params?.fuelType ? [route.params.fuelType] : []
  );
  const [minYear, setMinYear] = useState<string>(
    route.params?.minYear ? String(route.params.minYear) : 'Any'
  );
  const [maxYear, setMaxYear] = useState('Any');
  const [minMiles, setMinMiles] = useState('Any');
  const [maxMiles, setMaxMiles] = useState('Any');
  const [transmissions, setTransmissions] = useState<string[]>([]);
  // New filter dimensions
  const [conditions, setConditions] = useState<string[]>([]);
  const [ulezCompliant, setUlezCompliant] = useState(false);
  const [minBhp, setMinBhp] = useState('');
  const [maxBhp, setMaxBhp] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [sellerType, setSellerType] = useState<'' | 'DEALER' | 'PRIVATE'>('');
  const [listingType, setListingType] = useState<'' | 'CLASSIFIED' | 'AUCTION'>('');
  const [vehicleType, setVehicleType] = useState<'' | 'CAR' | 'HGV' | 'MOTORCYCLE'>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [minDoors, setMinDoors] = useState('');
  const [minSeats, setMinSeats] = useState('');
  const [euroStandard, setEuroStandard] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isImported, setIsImported] = useState(false);
  const [markedForExport, setMarkedForExport] = useState(false);
  const [maxDistanceMi, setMaxDistanceMi] = useState<number | null>(null);
  const [postcodeInput, setPostcodeInput] = useState('');
  const [postcodeSaving, setPostcodeSaving] = useState(false);
  const [distancePickerVisible, setDistancePickerVisible] = useState(false);
  // AI search state
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  // ── Results state ──
  const [listings, setListings] = useState<CarListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Stable id-keyed press handler so HorizontalVehicleCard's React.memo isn't busted by a
  // fresh closure every render (mobile-audit.md P4) — looked up via ref so its identity
  // never changes, including across pagination.
  const listingsRef = useRef<CarListing[]>([]);
  useEffect(() => { listingsRef.current = listings; }, [listings]);
  const handleCardPress = useCallback((id: string) => {
    const item = listingsRef.current.find(l => l.id === id);
    if (item) navigation.navigate('VehicleDetail', { listing: item });
  }, [navigation]);
  const renderListingItem = useCallback(
    ({ item }: { item: CarListing }) => <HorizontalVehicleCard listing={item} onPress={handleCardPress} />,
    [handleCardPress],
  );

  const debounceRef = useRef<any>(null);

  // When navigating to this screen from Home with params (e.g. pill chips), apply
  // new filters even if the tab was already mounted. The _t timestamp ensures this
  // fires on repeated taps of the same pill.
  useEffect(() => {
    const p = route.params as any;
    if (!p?._t) return;
    let hasNew = false;
    // AI filters from HomeScreen's inline search ("View matching cars") —
    // same mapping this screen's own AI Search modal already applies.
    if (p.aiFilters) {
      const f = p.aiFilters;
      if (f.make) { setSelectedMakes([f.make]); hasNew = true; }
      if (f.fuelType) { setSelectedFuels([f.fuelType]); hasNew = true; }
      if (f.bodyType) { setSelectedBody(f.bodyType); hasNew = true; }
      if (f.maxPrice) { setMaxPrice(parseInt(f.maxPrice)); hasNew = true; }
      if (f.minPrice) { setMinPrice(parseInt(f.minPrice)); hasNew = true; }
      if (f.minYear) { setMinYear(f.minYear); hasNew = true; }
      if (f.maxYear) { setMaxYear(f.maxYear); hasNew = true; }
      if (f.transmission) { setTransmissions([f.transmission]); hasNew = true; }
      if (f.listingType) { setListingType(f.listingType as any); hasNew = true; }
      if (f.sellerType) { setSellerType(f.sellerType as any); hasNew = true; }
      if (f.vehicleType) { setVehicleType(f.vehicleType as any); hasNew = true; }
      if (f.location) { setLocationFilter(f.location); hasNew = true; }
      if (f.model) { setModelFilter(f.model); hasNew = true; }
      if (f.ulezCompliant === 'true') { setUlezCompliant(true); hasNew = true; }
      if (f.deliveryAvailable === 'true') { setDeliveryAvailable(true); hasNew = true; }
      if (p.aiExplanation) setAiExplanation(p.aiExplanation);
    }
    if (p.fuelType !== undefined) { setSelectedFuels([p.fuelType]); hasNew = true; }
    if (p.bodyType !== undefined) { setSelectedBody(p.bodyType); hasNew = true; }
    if (p.maxPrice != null) { setMaxPrice(Number(p.maxPrice)); hasNew = true; }
    if (p.sortBy !== undefined) { setSortId(p.sortBy); hasNew = true; }
    if (p.make !== undefined) { setSelectedMakes([p.make]); hasNew = true; }
    if (hasNew) {
      setQuickFilter('custom');
      setQuery('');
      if (!p.make) setSelectedMakes([]);
      setMinPrice(0);
      if (!p.maxPrice) setMaxPrice(150000);
      setMinYear('Any');
      setMaxMiles('Any');
      setTransmissions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route.params as any)?._t]);

  // ── Build API params ──

  function buildParams(p = 1) {
    const qf = QUICK_FILTERS.find(f => f.id === quickFilter);
    const parseMi = (s: string) => {
      if (s === 'Any') return undefined;
      return parseInt(s.replace('k', ''), 10) * 1000;
    };
    return {
      search: query.trim() || undefined,
      make: selectedMakes[0] ?? (qf?.params.bodyType ? undefined : undefined),
      model: modelFilter.trim() || undefined,
      vehicleType: vehicleType || undefined,
      location: locationFilter.trim() || undefined,
      maxPrice: maxPrice < 150000 ? maxPrice : qf?.params.maxPrice,
      minPrice: minPrice > 0 ? minPrice : undefined,
      bodyType: selectedBody || qf?.params.bodyType,
      // Was selectedFuels[0] — selecting 2+ fuel chips silently ignored
      // everything past the first. fuelTypes sends the full selection; the
      // quick-filter fallback only applies when nothing was explicitly picked.
      fuelTypes: selectedFuels.length ? selectedFuels : undefined,
      fuelType: selectedFuels.length ? undefined : qf?.params.fuelType,
      minYear: minYear !== 'Any' ? parseInt(minYear) : qf?.params.minYear,
      maxYear: maxYear !== 'Any' ? parseInt(maxYear) : undefined,
      minMileage: parseMi(minMiles),
      maxMileage: parseMi(maxMiles),
      conditions: conditions.length ? conditions : undefined,
      transmissions: transmissions.length ? transmissions : undefined,
      ulezCompliant: ulezCompliant ? true : undefined,
      minBhp: minBhp ? parseInt(minBhp) : undefined,
      maxBhp: maxBhp ? parseInt(maxBhp) : undefined,
      deliveryAvailable: deliveryAvailable ? true : undefined,
      sellerType: sellerType || undefined,
      listingType: listingType || undefined,
      color: colorFilter.trim() || undefined,
      minDoors: minDoors ? parseInt(minDoors) : undefined,
      minSeats: minSeats ? parseInt(minSeats) : undefined,
      euroStandard: euroStandard || undefined,
      features: selectedFeatures.length ? selectedFeatures : undefined,
      isImported: isImported ? true : undefined,
      markedForExport: markedForExport ? true : undefined,
      sortBy: sortId,
      page: p,
      limit: 20,
    };
  }

  const fetch = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    const p = reset ? 1 : page;
    try {
      const { listings: rawItems, total: t } = await searchListings(buildParams(p));
      // Backend has no lat/lng/radius filter param — same client-side
      // haversine filter+sort web's search page does on the already-fetched
      // page (doesn't reach across pagination, matching web's actual, if
      // imperfect, behavior).
      let items = rawItems;
      if (maxDistanceMi != null && userLat != null && userLng != null) {
        items = rawItems
          .filter(l => l.latitude != null && l.longitude != null &&
            haversineDistanceMiles(userLat, userLng, l.latitude, l.longitude) <= maxDistanceMi)
          .sort((a, b) =>
            haversineDistanceMiles(userLat, userLng, a.latitude!, a.longitude!) -
            haversineDistanceMiles(userLat, userLng, b.latitude!, b.longitude!));
      }
      if (reset) {
        setListings(items);
        setPage(2);
        setTotal(t);
      } else {
        setListings(prev => [...prev, ...items]);
        setPage(prev => prev + 1);
        setTotal(t);
      }
      setHasMore(rawItems.length === 20);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmissions, conditions, ulezCompliant, minBhp, maxBhp, deliveryAvailable, sellerType, listingType, vehicleType, locationFilter, modelFilter, colorFilter, minDoors, minSeats, euroStandard, selectedFeatures, isImported, markedForExport, maxDistanceMi, userLat, userLng, page]);

  // Initial load
  useEffect(() => { fetch(true); }, []);

  // Text query: debounce to avoid hitting the API on every keystroke.
  // All other filter/sort changes are instant (fired by the non-text useEffect below).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch(true), 350);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Instant re-fetch when any filter/sort state changes (not debounced).
  useEffect(() => {
    fetch(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmissions, conditions, ulezCompliant, minBhp, maxBhp, deliveryAvailable, sellerType, listingType, vehicleType, locationFilter, modelFilter, colorFilter, minDoors, minSeats, euroStandard, selectedFeatures, isImported, markedForExport, maxDistanceMi]);

  const onRefresh = () => { setRefreshing(true); fetch(true); };

  // Active filter count
  const filterCount = [
    selectedMakes.length > 0,
    minPrice > 0 || maxPrice < 150000,
    !!selectedBody,
    selectedFuels.length > 0,
    minYear !== 'Any',
    maxYear !== 'Any',
    minMiles !== 'Any',
    maxMiles !== 'Any',
    transmissions.length > 0,
    conditions.length > 0,
    ulezCompliant,
    !!minBhp || !!maxBhp,
    deliveryAvailable,
    !!sellerType,
    !!listingType,
    !!vehicleType,
    !!locationFilter,
    !!modelFilter,
    !!colorFilter,
    !!minDoors,
    !!minSeats,
    !!euroStandard,
    selectedFeatures.length > 0,
    isImported,
    markedForExport,
    maxDistanceMi != null,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedMakes([]);
    setMinPrice(0);
    setMaxPrice(150000);
    setSelectedBody('');
    setSelectedFuels([]);
    setMinYear('Any');
    setMaxYear('Any');
    setMinMiles('Any');
    setMaxMiles('Any');
    setTransmissions([]);
    setConditions([]);
    setUlezCompliant(false);
    setMinBhp('');
    setMaxBhp('');
    setDeliveryAvailable(false);
    setSellerType('');
    setListingType('');
    setVehicleType('');
    setLocationFilter('');
    setModelFilter('');
    setColorFilter('');
    setMinDoors('');
    setMinSeats('');
    setEuroStandard('');
    setSelectedFeatures([]);
    setIsImported(false);
    setMarkedForExport(false);
    setMaxDistanceMi(null);
  };

  const handleSavePostcode = async () => {
    if (!postcodeInput.trim() || postcodeSaving) return;
    setPostcodeSaving(true);
    try {
      await saveUserPostcode(postcodeInput.trim());
      setPostcodeInput('');
    } finally {
      setPostcodeSaving(false);
    }
  };

  const applyQuickFilter = (id: string) => {
    setQuickFilter(id);
    // Reset manual filters when switching quick filters
    if (id !== 'custom') {
      setSelectedMakes([]);
      setMinPrice(0);
      setMaxPrice(150000);
      setSelectedBody('');
      setSelectedFuels([]);
      setMinYear('Any');
      setMaxMiles('Any');
    }
  };

  const sortLabel = SORT_OPTIONS.find(s => s.id === sortId)?.label ?? 'Sort';

  const handleAiSearch = async () => {
    if (!aiQuery.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await naturalLanguageSearch(aiQuery.trim());
      const f = result.filters ?? {};
      // Apply whatever filter params the AI returned
      if (f.make) setSelectedMakes([f.make]);
      if (f.fuelType) setSelectedFuels([f.fuelType]);
      if (f.bodyType) setSelectedBody(f.bodyType);
      if (f.maxPrice) setMaxPrice(parseInt(f.maxPrice));
      if (f.minPrice) setMinPrice(parseInt(f.minPrice));
      if (f.minYear)  setMinYear(f.minYear);
      if (f.maxYear)  setMaxYear(f.maxYear);
      if (f.transmission) setTransmissions([f.transmission]);
      if (f.listingType)  setListingType(f.listingType as any);
      if (f.sellerType)   setSellerType(f.sellerType as any);
      if (f.vehicleType)  setVehicleType(f.vehicleType as any);
      if (f.location)     setLocationFilter(f.location);
      if (f.model)        setModelFilter(f.model);
      if (f.ulezCompliant === 'true') setUlezCompliant(true);
      if (f.deliveryAvailable === 'true') setDeliveryAvailable(true);
      setQuickFilter('custom');
      setAiExplanation(result.explanation ?? null);
      setAiModalVisible(false);
      setAiQuery('');
    } catch (err: any) {
      Alert.alert('AI Search failed', err?.message ?? 'Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', Colors.bgPrimary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>BUY CARS</Text>
          <Text style={s.headerTitle}>
            {total > 0 ? `${total.toLocaleString('en-GB')} listings` : 'Browse cars'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton style={s.iconBtn} icon={<Ionicons name="notifications-outline" size={19} color={Colors.white} />} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Notifications" />
          <HamburgerButton />
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Make, model, or keyword..."
            placeholderTextColor={Colors.borderMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <IconButton icon={<Ionicons name="close" size={16} color={Colors.iconMuted} />} onPress={() => setQuery('')} accessibilityLabel="Clear search" />
          )}
        </View>
      </View>

      {/* ── AI Search button ── */}
      <View style={s.aiSearchWrap}>
        <TouchableOpacity style={s.aiSearchBtn} onPress={() => setAiModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={13} color={Colors.warning} />
          <Text style={s.aiSearchBtnText}>Try AI Search ✦</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI Explanation banner ── */}
      {aiExplanation && (
        <View style={s.aiExplanationBanner}>
          <Ionicons name="sparkles" size={12} color={Colors.warning} />
          <Text style={s.aiExplanationText} numberOfLines={2}>{aiExplanation}</Text>
          <IconButton icon={<Ionicons name="close" size={14} color={Colors.warning} />} onPress={() => setAiExplanation(null)} accessibilityLabel="Dismiss AI search explanation" />
        </View>
      )}

      {/* ── Quick filters ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.quickScroll}
        contentContainerStyle={s.quickRow}
      >
        {QUICK_FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[s.quickChip, quickFilter === f.id && s.quickChipActive]}
            onPress={() => applyQuickFilter(f.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.quickChipText, quickFilter === f.id && s.quickChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Sort + Filter row ── */}
      <View style={s.sortRow}>
        <Text style={s.resultsCount}>
          {loading ? '...' : `${total.toLocaleString('en-GB')} results`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Sort */}
          <TouchableOpacity style={s.sortBtn} onPress={() => setShowSortMenu(v => !v)} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={s.sortBtnText}>{sortLabel}</Text>
          </TouchableOpacity>
          {/* Filter */}
          <TouchableOpacity
            style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={filterCount > 0 ? Colors.white : Colors.textSecondary} />
            <Text style={[s.filterBtnText, filterCount > 0 && { color: Colors.white }]}>
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sort dropdown */}
        {showSortMenu && (
          <View style={s.sortDropdown}>
            {SORT_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.id}
                style={[s.sortOption, o.id === sortId && s.sortOptionActive]}
                onPress={() => { setSortId(o.id); setShowSortMenu(false); }}
              >
                <Text style={[s.sortOptionText, o.id === sortId && { color: Colors.accent }]}>{o.label}</Text>
                {o.id === sortId && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Results ── */}
      {loading && listings.length === 0 ? (
        <View style={s.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={`sk-${i}`} style={s.skeletonCard}>
              <Skeleton w={92} h={72} r={10} />
              <View style={s.skeletonInfo}>
                <Skeleton w={160} h={14} r={6} />
                <Skeleton w={100} h={12} r={5} />
                <Skeleton w={80} h={18} r={6} />
              </View>
            </View>
          ))}
        </View>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No results"
          subtitle="Try a different make, model, or filter."
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
          renderItem={renderListingItem}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          onEndReached={() => { if (hasMore && !loadingMore) fetch(false); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={s.loadMoreWrap}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : hasMore ? null : listings.length > 10 ? (
              <Text style={s.endText}>All {total.toLocaleString('en-GB')} results shown</Text>
            ) : null
          }
        />
      )}

      {/* ── AI Search Modal ── */}
      <BottomSheet
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        title="AI Car Search"
        avoidKeyboard
        maxHeightPercent={60}
      >
        {/* gap replicates the old aiModalSheet wrapper's spacing, which BottomSheet's
            own sheet style doesn't provide */}
        <View style={{ gap: 12 }}>
          <Text style={s.aiModalSubtitle}>Describe what you're looking for in plain English</Text>
          <TextInput
            style={s.aiModalInput}
            value={aiQuery}
            onChangeText={setAiQuery}
            placeholder="Describe the car you're looking for…"
            placeholderTextColor={Colors.borderMuted}
            multiline
            numberOfLines={3}
            onSubmitEditing={handleAiSearch}
            blurOnSubmit
            autoFocus
          />
          <TouchableOpacity
            style={[s.aiModalBtn, (aiLoading || !aiQuery.trim()) && { opacity: 0.5 }]}
            onPress={handleAiSearch}
            disabled={aiLoading || !aiQuery.trim()}
            activeOpacity={0.85}
          >
            {aiLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color={Colors.white} />
                <Text style={s.aiModalBtnText}>Search with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Advanced Filters Modal ── */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} maxHeightPercent={92}>
        {/* Custom header (with Reset) kept as content — BottomSheet's own title
            row doesn't support a second right-side action. */}
        <View style={s.modalHeader}>
          <IconButton style={s.modalClose} icon={<Ionicons name="close" size={18} color={Colors.white} />} onPress={() => setFilterOpen(false)} accessibilityLabel="Close" />
          <Text style={s.modalTitle}>Refine Search</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={s.modalReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalBody}>

              {/* Make */}
              <Text style={s.filterLabel}>MAKE</Text>
              <View style={s.chipGrid}>
                {MAKES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.filterChip, selectedMakes.includes(m) && s.filterChipActive]}
                    // Was a multi-select toggle, but the backend's Make filter
                    // only ever accepts one value (no `makes` array param
                    // exists) — buildParams() only ever sent selectedMakes[0],
                    // so picking a 2nd/3rd chip silently did nothing. Single-
                    // select here is honest about what actually filters,
                    // matching how Body Type already behaves in this screen.
                    onPress={() => setSelectedMakes(prev => prev.includes(m) ? [] : [m])}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterChipText, selectedMakes.includes(m) && s.filterChipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Price */}
              <Text style={s.filterLabel}>PRICE RANGE</Text>
              <View style={s.twoCol}>
                <View style={s.inputBox}>
                  <Text style={s.inputBoxLabel}>MIN</Text>
                  <TextInput
                    style={s.inputBoxValue}
                    value={minPrice > 0 ? `£${minPrice.toLocaleString()}` : ''}
                    onChangeText={t => setMinPrice(parseInt(t.replace(/[^0-9]/g, '') || '0'))}
                    placeholder="£ 0"
                    placeholderTextColor={Colors.borderMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={s.inputBox}>
                  <Text style={s.inputBoxLabel}>MAX</Text>
                  <TextInput
                    style={s.inputBoxValue}
                    value={maxPrice < 150000 ? `£${maxPrice.toLocaleString()}` : ''}
                    onChangeText={t => setMaxPrice(parseInt(t.replace(/[^0-9]/g, '') || '150000'))}
                    placeholder="£ Any"
                    placeholderTextColor={Colors.borderMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={s.divider} />

              {/* Body type */}
              <Text style={s.filterLabel}>BODY TYPE</Text>
              <View style={s.chipGrid}>
                {BODY_TYPES.map(bt => (
                  <TouchableOpacity
                    key={bt.id}
                    style={[s.bodyChip, selectedBody === bt.id && s.bodyChipActive]}
                    onPress={() => setSelectedBody(prev => prev === bt.id ? '' : bt.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={bt.icon as any} size={16} color={selectedBody === bt.id ? Colors.white : Colors.textSecondary} />
                    <Text style={[s.filterChipText, selectedBody === bt.id && s.filterChipTextActive]}>
                      {bt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Fuel */}
              <Text style={s.filterLabel}>FUEL TYPE</Text>
              <View style={s.chipGrid}>
                {FUELS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, selectedFuels.includes(f) && s.filterChipActive]}
                    onPress={() => setSelectedFuels(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterChipText, selectedFuels.includes(f) && s.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Year Range */}
              <Text style={s.filterLabel}>YEAR RANGE</Text>
              <View style={s.inputBox}>
                <Text style={s.inputBoxLabel}>FROM YEAR</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {YEAR_OPTS.map(y => (
                      <TouchableOpacity key={y} style={[s.miniChip, minYear === y && s.filterChipActive]} onPress={() => setMinYear(y)}>
                        <Text style={[s.miniChipText, minYear === y && { color: Colors.white }]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={s.inputBox}>
                  <Text style={s.inputBoxLabel}>TO YEAR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {YEAR_OPTS_MAX.map(y => (
                        <TouchableOpacity key={y} style={[s.miniChip, maxYear === y && s.filterChipActive]} onPress={() => setMaxYear(y)}>
                          <Text style={[s.miniChipText, maxYear === y && { color: Colors.white }]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={s.divider} />

              {/* Mileage Range */}
              <Text style={s.filterLabel}>MILEAGE RANGE</Text>
              <View style={s.inputBox}>
                <Text style={s.inputBoxLabel}>MIN MILES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {MILES_OPTS_MIN.map(m => (
                      <TouchableOpacity key={m} style={[s.miniChip, minMiles === m && s.filterChipActive]} onPress={() => setMinMiles(m)}>
                        <Text style={[s.miniChipText, minMiles === m && { color: Colors.white }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={s.inputBox}>
                  <Text style={s.inputBoxLabel}>MAX MILES</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {MILES_OPTS.map(m => (
                        <TouchableOpacity key={m} style={[s.miniChip, maxMiles === m && s.filterChipActive]} onPress={() => setMaxMiles(m)}>
                          <Text style={[s.miniChipText, maxMiles === m && { color: Colors.white }]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={s.divider} />

              {/* Transmission — multi-select, mirrors the fuel-types chip pattern */}
              <Text style={s.filterLabel}>TRANSMISSION</Text>
              <View style={s.chipGrid}>
                {['AUTOMATIC', 'MANUAL', 'SEMI_AUTO'].map(t => {
                  const selected = transmissions.includes(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.filterChip, selected && s.filterChipActive]}
                      onPress={() =>
                        setTransmissions(prev =>
                          prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, selected && s.filterChipTextActive]}>
                        {t.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.divider} />

              {/* Condition */}
              <Text style={s.filterLabel}>CONDITION</Text>
              <View style={s.chipGrid}>
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.filterChip, conditions.includes(c.id) && s.filterChipActive]}
                    onPress={() => setConditions(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterChipText, conditions.includes(c.id) && s.filterChipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* BHP Range */}
              <Text style={s.filterLabel}>POWER (BHP)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[s.inputBox, { flex: 1 }]}>
                  <Text style={s.inputBoxLabel}>MIN BHP</Text>
                  <TextInput
                    style={s.inputBoxValue}
                    value={minBhp}
                    onChangeText={setMinBhp}
                    placeholder="0"
                    placeholderTextColor={Colors.borderMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[s.inputBox, { flex: 1 }]}>
                  <Text style={s.inputBoxLabel}>MAX BHP</Text>
                  <TextInput
                    style={s.inputBoxValue}
                    value={maxBhp}
                    onChangeText={setMaxBhp}
                    placeholder="Any"
                    placeholderTextColor={Colors.borderMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={s.divider} />

              {/* Vehicle Type */}
              <Text style={s.filterLabel}>VEHICLE TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const,            label: 'All' },
                  { id: 'CAR' as const,         label: 'Car' },
                  { id: 'HGV' as const,         label: 'HGV' },
                  { id: 'MOTORCYCLE' as const,  label: 'Motorcycle' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.segmentBtn, vehicleType === opt.id && s.segmentBtnActive]}
                    onPress={() => setVehicleType(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segmentBtnText, vehicleType === opt.id && s.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Model + Location */}
              <Text style={s.filterLabel}>MODEL</Text>
              <View style={s.inputBox}>
                <Text style={s.inputBoxLabel}>MODEL NAME</Text>
                <TextInput
                  style={s.inputBoxValue}
                  value={modelFilter}
                  onChangeText={setModelFilter}
                  placeholder="e.g. Q7, 3 Series"
                  placeholderTextColor={Colors.borderMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.divider} />

              <Text style={s.filterLabel}>COLOUR</Text>
              <View style={s.inputBox}>
                <Text style={s.inputBoxLabel}>e.g. White, Black, Blue</Text>
                <TextInput
                  style={s.inputBoxValue}
                  value={colorFilter}
                  onChangeText={setColorFilter}
                  placeholder="Any colour"
                  placeholderTextColor={Colors.borderMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.divider} />

              {/* Doors / Seats — mirrors web's quick-select buttons */}
              <Text style={s.filterLabel}>DOORS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DOOR_OPTS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[s.segmentBtn, minDoors === d && s.segmentBtnActive]}
                    onPress={() => setMinDoors(prev => prev === d ? '' : d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segmentBtnText, minDoors === d && s.segmentBtnTextActive]}>{d}+</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 16 }} />

              <Text style={s.filterLabel}>SEATS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SEAT_OPTS.map(sv => (
                  <TouchableOpacity
                    key={sv}
                    style={[s.segmentBtn, minSeats === sv && s.segmentBtnActive]}
                    onPress={() => setMinSeats(prev => prev === sv ? '' : sv)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segmentBtnText, minSeats === sv && s.segmentBtnTextActive]}>{sv}+</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Euro Standard */}
              <Text style={s.filterLabel}>EURO STANDARD</Text>
              <View style={s.chipGrid}>
                <TouchableOpacity
                  style={[s.filterChip, !euroStandard && s.filterChipActive]}
                  onPress={() => setEuroStandard('')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterChipText, !euroStandard && s.filterChipTextActive]}>Any</Text>
                </TouchableOpacity>
                {EURO_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.value}
                    style={[s.filterChip, euroStandard === o.value && s.filterChipActive]}
                    onPress={() => setEuroStandard(prev => prev === o.value ? '' : o.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterChipText, euroStandard === o.value && s.filterChipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Features / Options — 18-item checklist, matches web's POPULAR_FEATURES */}
              <Text style={s.filterLabel}>FEATURES / OPTIONS</Text>
              <View style={s.chipGrid}>
                {POPULAR_FEATURES.map(feat => {
                  const selected = selectedFeatures.includes(feat);
                  return (
                    <TouchableOpacity
                      key={feat}
                      style={[s.filterChip, selected && s.filterChipActive]}
                      onPress={() =>
                        setSelectedFeatures(prev =>
                          prev.includes(feat) ? prev.filter(x => x !== feat) : [...prev, feat],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, selected && s.filterChipTextActive]}>{feat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.divider} />

              <Text style={s.filterLabel}>LOCATION</Text>
              <View style={s.inputBox}>
                <Text style={s.inputBoxLabel}>CITY OR POSTCODE</Text>
                <TextInput
                  style={s.inputBoxValue}
                  value={locationFilter}
                  onChangeText={setLocationFilter}
                  placeholder="e.g. London"
                  placeholderTextColor={Colors.borderMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.divider} />

              {/* Distance ("Near Me") — needs a postcode on record since the
                  app doesn't request device geolocation (deliberate choice,
                  see LocationContext.tsx); geocodes via postcodes.io same as
                  web's fallback path. */}
              <Text style={s.filterLabel}>DISTANCE</Text>
              {userLat != null ? (
                <>
                  <View style={s.postcodeRow}>
                    <Ionicons name="location" size={14} color={Colors.accent} />
                    <Text style={s.postcodeRowText}>Using {userPostcode}</Text>
                    <TouchableOpacity onPress={() => setPostcodeInput(userPostcode ?? '')}>
                      <Text style={s.postcodeChangeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[s.inputBox, { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setDistancePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.inputBoxValue}>{maxDistanceMi != null ? `${maxDistanceMi} mi` : 'Any distance'}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={s.toggleHint}>Add your postcode to filter by distance.</Text>
              )}
              {(userLat == null || postcodeInput) && (
                <View style={[s.inputBox, { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <TextInput
                    style={[s.inputBoxValue, { flex: 1 }]}
                    value={postcodeInput}
                    onChangeText={setPostcodeInput}
                    placeholder="e.g. SW1X 7LY"
                    placeholderTextColor={Colors.borderMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleSavePostcode} disabled={postcodeSaving || !postcodeInput.trim()}>
                    {postcodeSaving
                      ? <ActivityIndicator size="small" color={Colors.accent} />
                      : <Text style={[s.postcodeChangeLink, (!postcodeInput.trim()) && { opacity: 0.4 }]}>Save</Text>}
                  </TouchableOpacity>
                </View>
              )}

              <View style={s.divider} />

              {/* Listing Type */}
              <Text style={s.filterLabel}>LISTING TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const,           label: 'All' },
                  { id: 'CLASSIFIED' as const, label: 'Buy Now' },
                  { id: 'AUCTION' as const,    label: 'Auction' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.segmentBtn, listingType === opt.id && s.segmentBtnActive]}
                    onPress={() => setListingType(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segmentBtnText, listingType === opt.id && s.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Seller Type */}
              <Text style={s.filterLabel}>SELLER TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const,        label: 'All' },
                  { id: 'DEALER' as const,  label: 'Dealer' },
                  { id: 'PRIVATE' as const, label: 'Private' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.segmentBtn, sellerType === opt.id && s.segmentBtnActive]}
                    onPress={() => setSellerType(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.segmentBtnText, sellerType === opt.id && s.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.divider} />

              {/* Toggle filters */}
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>ULEZ COMPLIANT ONLY</Text>
                  <Text style={s.toggleHint}>Meets London Ultra Low Emission Zone standards</Text>
                </View>
                <Switch
                  value={ulezCompliant}
                  onValueChange={setUlezCompliant}
                  trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
              <View style={[s.toggleRow, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>DELIVERY AVAILABLE ONLY</Text>
                  <Text style={s.toggleHint}>Only show listings where seller offers delivery</Text>
                </View>
                <Switch
                  value={deliveryAvailable}
                  onValueChange={setDeliveryAvailable}
                  trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
              <View style={[s.toggleRow, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>IMPORTED ONLY</Text>
                  <Text style={s.toggleHint}>Only show vehicles imported from abroad</Text>
                </View>
                <Switch
                  value={isImported}
                  onValueChange={setIsImported}
                  trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
              <View style={[s.toggleRow, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>MARKED FOR EXPORT ONLY</Text>
                  <Text style={s.toggleHint}>Only show vehicles marked for export</Text>
                </View>
                <Switch
                  value={markedForExport}
                  onValueChange={setMarkedForExport}
                  trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={{ height: 80 }} />
            </ScrollView>

        {/* Sticky apply button */}
        <View style={s.modalFooter}>
          <PrimaryCTA
            label={`SHOW ${total > 0 ? total.toLocaleString('en-GB') + ' CARS' : 'RESULTS'}`}
            onPress={() => { setFilterOpen(false); setQuickFilter('custom'); }}
            hasChamfer
          />
        </View>
      </BottomSheet>

      {/* ── Distance picker — was a row of 5 individual chips ("10 mi", "25 mi",
          ...) reading like a number line; a single dropdown trigger + sheet is
          more compact and matches how this app already presents single-choice
          pickers (BottomSheet, same as the sort menu). ── */}
      <BottomSheet visible={distancePickerVisible} onClose={() => setDistancePickerVisible(false)} title="Distance">
        <View style={{ padding: 8 }}>
          <TouchableOpacity
            style={[s.sortOption, maxDistanceMi == null && s.sortOptionActive]}
            onPress={() => { setMaxDistanceMi(null); setDistancePickerVisible(false); }}
          >
            <Text style={[s.sortOptionText, maxDistanceMi == null && { color: Colors.accent }]}>Any distance</Text>
            {maxDistanceMi == null && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
          </TouchableOpacity>
          {DISTANCE_CHIPS.map(mi => (
            <TouchableOpacity
              key={mi}
              style={[s.sortOption, maxDistanceMi === mi && s.sortOptionActive]}
              onPress={() => { setMaxDistanceMi(mi); setDistancePickerVisible(false); }}
            >
              <Text style={[s.sortOptionText, maxDistanceMi === mi && { color: Colors.accent }]}>{mi} mi</Text>
              {maxDistanceMi === mi && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 18 },
  headerSub: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.size22, color: Colors.white },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { paddingHorizontal: 24, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16, height: 52, gap: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.white },

  quickScroll: { height: 48, marginBottom: 4 },
  quickRow: { paddingHorizontal: 24, gap: 10, alignItems: 'center', flexDirection: 'row' },
  quickChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  quickChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  quickChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.paleGrey_cccccc },
  quickChipTextActive: { color: Colors.white },

  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8, marginTop: 4, position: 'relative', zIndex: 10 },
  resultsCount: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  sortBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  sortDropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: Colors.bgTertiary, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 4, zIndex: 99, minWidth: 160, shadowColor: Colors.black, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  sortOption: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 },
  sortOptionActive: { backgroundColor: Colors.accentAlpha08 },
  sortOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },

  listContent: { paddingHorizontal: 24 },
  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  endText: { textAlign: 'center', fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.borderMuted, paddingVertical: 20 },
  skeletonList: { paddingHorizontal: 24, gap: 14 },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 14 },
  skeletonInfo: { flex: 1, gap: 6 },

  // Filter modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha06 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  modalReset: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
  modalBody: { paddingHorizontal: 22, paddingTop: 20 },
  modalFooter: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha06, backgroundColor: Colors.deepBlue_0f0f14 },

  filterLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 14 },
  divider: { height: 1, backgroundColor: Colors.whiteAlpha05, marginVertical: 20 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontFamily: FontFamily.bold },
  bodyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  bodyChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  twoCol: { gap: 10 },
  inputBox: { flex: 1, backgroundColor: Colors.whiteAlpha03, borderRadius: 10, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 12 },
  inputBoxLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 6 },
  inputBoxValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  miniChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  miniChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  postcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postcodeRowText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },
  postcodeChangeLink: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },

  // AI search button
  aiSearchWrap: { paddingHorizontal: 24, marginBottom: 6 },
  aiSearchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.warningAlpha10, borderWidth: 1, borderColor: Colors.warningAlpha25 },
  aiSearchBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.warning },

  // AI explanation banner
  aiExplanationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 24, marginBottom: 6, backgroundColor: Colors.warningAlpha08, borderWidth: 1, borderColor: Colors.warningAlpha20, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  aiExplanationText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.lightYellow, lineHeight: 18 },

  // AI modal
  aiModalSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.iconMuted, lineHeight: 19 },
  aiModalInput: { backgroundColor: Colors.bgSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.white, minHeight: 80, textAlignVertical: 'top' },
  aiModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: Colors.warning },
  aiModalBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },

  // Segmented controls (listing type / seller type)
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  segmentBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  segmentBtnTextActive: { color: Colors.white, fontFamily: FontFamily.bold },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, marginBottom: 3 },
  toggleHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, lineHeight: 15 },
});
