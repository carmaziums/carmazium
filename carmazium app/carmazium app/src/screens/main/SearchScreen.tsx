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
import { CAR_MAKES } from '../../data/carData';
import { searchListings } from '../../lib/listingsApi';
import { naturalLanguageSearch } from '../../lib/aiApi';
import { HorizontalVehicleCard } from '../../components/HorizontalVehicleCard';
import { BottomSheet } from '../../components/BottomSheet';
import { useLocation } from '../../context/LocationContext';
import { haversineDistanceMiles } from '../../lib/distance';
import { Colors } from '../../constants/colors';
import { useNativeAppearance } from '../../theme/NativeAppearanceProvider';
import { getBodyTypeIcon } from '../../constants/bodyTypes';
import {FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/authStore';

import { IconButton } from '../../components/IconButton';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
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
  { id: 'sedan',     label: 'Sedan',        params: { bodyType: 'SEDAN' } },
  { id: 'new',       label: '2020+',        params: { minYear: 2020 } },
  { id: 'manual',    label: 'Manual',       params: { transmission: 'MANUAL' } },
];

// The ten shown before any search is typed. The full list is CAR_MAKES (71
// entries, byte-identical to web's `src/lib/carData.ts` — checked, no
// difference in either direction), which mobile already shipped and this screen
// simply never used: any make outside these ten was unfilterable (BUY-007).
// Web solves the same problem with a text input over a datalist; this is the
// native equivalent.
const POPULAR_MAKES = ['BMW', 'Audi', 'Mercedes', 'Volkswagen', 'Ford', 'Toyota', 'Honda', 'Porsche', 'Range Rover', 'Tesla'];
// Display labels only — the backend's FuelType enum uses different casing/wording
// for several of these ('Plug-in Hybrid' -> 'PLUGIN_HYBRID', 'Hydrogen' ->
// 'HYDROGEN_CELL', etc.), so FUEL_MAP below must run before any of these reach the
// network. Mirrors web's src/app/search/page.tsx FUEL_MAP exactly (mobile-
// production-readiness-plan.md F10 — mobile used to send these labels raw, which
// silently matched nothing since Prisma enum comparison is exact-match).
const FUELS = [
  'Petrol', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric',
  'LPG', 'Hydrogen', 'Bi Fuel', 'Natural Gas',
  'Petrol Hybrid', 'Diesel Hybrid', 'Petrol Plug-in Hybrid', 'Diesel Plug-in Hybrid', 'Unlisted',
];
const FUEL_MAP: Record<string, string> = {
  'Petrol': 'PETROL', 'Diesel': 'DIESEL', 'Hybrid': 'HYBRID', 'Electric': 'ELECTRIC',
  'Plug-in Hybrid': 'PLUGIN_HYBRID', 'LPG': 'LPG', 'Hydrogen': 'HYDROGEN_CELL',
  'Bi Fuel': 'BI_FUEL', 'Natural Gas': 'NATURAL_GAS', 'Petrol Hybrid': 'PETROL_HYBRID',
  'Diesel Hybrid': 'DIESEL_HYBRID', 'Petrol Plug-in Hybrid': 'PETROL_PLUGIN_HYBRID',
  'Diesel Plug-in Hybrid': 'DIESEL_PLUGIN_HYBRID', 'Unlisted': 'UNLISTED',
};
// Icons sourced from the shared body-type set (src/constants/bodyTypes.ts) so
// Home/Search/Sell all show identical icons per body type (mobile-ui-ux-audit.md §C6).
// `id` values are the real backend BodyType enum members (mobile-production-
// readiness-plan.md F11 — used to contain invented 'SALOON'/'PICKUP' values that
// 400'd against the backend, and was missing 5 of the 13 real body types).
const BODY_TYPES = [
  { id: 'SUV', label: 'SUV', icon: getBodyTypeIcon('SUV') },
  { id: 'SEDAN', label: 'Sedan', icon: getBodyTypeIcon('SEDAN') },
  { id: 'HATCHBACK', label: 'Hatchback', icon: getBodyTypeIcon('HATCHBACK') },
  { id: 'ESTATE', label: 'Estate', icon: getBodyTypeIcon('ESTATE') },
  { id: 'STATION_WAGON', label: 'Station Wagon', icon: getBodyTypeIcon('STATION_WAGON') },
  { id: 'COUPE', label: 'Coupé', icon: getBodyTypeIcon('COUPE') },
  { id: 'SPORTS_CAR', label: 'Sports Car', icon: getBodyTypeIcon('SPORTS_CAR') },
  { id: 'CONVERTIBLE', label: 'Convertible', icon: getBodyTypeIcon('CONVERTIBLE') },
  { id: 'CROSSOVER', label: 'Crossover', icon: getBodyTypeIcon('CROSSOVER') },
  { id: 'MINIVAN', label: 'Minivan', icon: getBodyTypeIcon('MINIVAN') },
  { id: 'MPV', label: 'MPV', icon: getBodyTypeIcon('MPV') },
  { id: 'VAN', label: 'Van', icon: getBodyTypeIcon('VAN') },
  { id: 'PICKUP_TRUCK', label: 'Pickup Truck', icon: getBodyTypeIcon('PICKUP_TRUCK') },
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
// All eight values web offers (`src/app/search/page.tsx:59-68`). CAT_C and CAT_D
// were missing, so those write-off categories could not be filtered on mobile
// at all (BUY-008).
const CONDITIONS = [
  { id: 'EXCELLENT', label: 'Excellent' },
  { id: 'GOOD',      label: 'Good' },
  { id: 'FAIR',      label: 'Fair' },
  { id: 'POOR',      label: 'Poor' },
  { id: 'CAT_S',     label: 'Cat S' },
  { id: 'CAT_N',     label: 'Cat N' },
  { id: 'CAT_C',     label: 'Cat C' },
  { id: 'CAT_D',     label: 'Cat D' },
];

// Values are `TransmissionType` members (`backend/prisma/schema.prisma:49-56`);
// labels are display-only. Mobile used to send `SEMI_AUTO`, which is **not** a
// member of that enum — and `transmissions` has `@IsArray()` but no per-item
// `@IsEnum` (`listing-filter.dto.ts:92-96`), so the bad value passed validation
// and reached Prisma unchecked. `CVT` was missing entirely, making CVT vehicles
// unreachable through this filter (BUY-006).
const TRANSMISSIONS = [
  { id: 'AUTOMATIC',      label: 'Automatic' },
  { id: 'MANUAL',         label: 'Manual' },
  { id: 'SEMI_AUTOMATIC', label: 'Semi-Automatic' },
  { id: 'CVT',            label: 'CVT' },
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
  const themed = useSearchDiscoveryStyles();
  const { resolvedAppearance, palette } = useNativeAppearance();
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  // Make filter query. Empty shows the popular ten; typing filters all 71 so a
  // make outside the popular set is reachable (BUY-007). A selected make is
  // always kept in the list, so it never disappears from view while active.
  const [makeQuery, setMakeQuery] = useState('');
  const makeQueryTrimmed = makeQuery.trim().toLowerCase();
  const visibleMakes = makeQueryTrimmed
    ? CAR_MAKES.filter(m => m.toLowerCase().includes(makeQueryTrimmed))
    // Union, not concat: a selected make outside the popular ten must stay
    // visible, or the active filter looks unset.
    : Array.from(new Set([...POPULAR_MAKES, ...selectedMakes]));
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
  // Match web's three-state ULEZ filter: Any / compliant / not compliant.
  const [ulezCompliant, setUlezCompliant] = useState<'' | 'yes' | 'no'>('');
  const [minBhp, setMinBhp] = useState('');
  const [maxBhp, setMaxBhp] = useState('');
  const [minEngine, setMinEngine] = useState('');
  const [maxEngine, setMaxEngine] = useState('');
  const [maxCo2, setMaxCo2] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [sellerType, setSellerType] = useState<'' | 'DEALER' | 'PRIVATE'>('');
  // Public marketplace defaults to Cars on both web and mobile.
  const [vehicleType, setVehicleType] = useState<'' | 'CAR' | 'HGV' | 'MOTORCYCLE'>('CAR');
  const [locationFilter, setLocationFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [minDoors, setMinDoors] = useState('');
  const [minSeats, setMinSeats] = useState('');
  const [euroStandard, setEuroStandard] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  // Tri-state: '' = any, 'yes' = imported only, 'no' = explicitly hide
  // imported cars (was a plain boolean toggle with no way to exclude imports).
  const [isImported, setIsImported] = useState<'' | 'yes' | 'no'>('');
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
    if (!item) return;
    // Public Search is the retail marketplace. Trade Exchange auctions use the
    // verified-Trader auction screens and endpoints instead.
    navigation.navigate('VehicleDetail', { listing: item });
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
    // same mapping this screen's own AI Search modal already applies (keys
    // per ai.service.ts's SEARCH_SYSTEM_PROMPT).
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
      if (f.model) { setModelFilter(f.model); hasNew = true; }
      if (f.color) { setColorFilter(f.color); hasNew = true; }
      if (f.minDoors) { setMinDoors(f.minDoors); hasNew = true; }
      if (f.minSeats) { setMinSeats(f.minSeats); hasNew = true; }
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
      // Do not immediately erase filters received from Mazium's card.
      // Reset only dimensions that were NOT supplied in this navigation.
      if (!p.make && !p.aiFilters?.make) setSelectedMakes([]);
      if (!p.aiFilters?.minPrice) setMinPrice(0);
      if (!p.maxPrice && !p.aiFilters?.maxPrice) setMaxPrice(150000);
      if (!p.aiFilters?.minYear) setMinYear('Any');
      setMaxMiles('Any');
      if (!p.aiFilters?.transmission) setTransmissions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route.params as any)?._t]);

  // ── Build API params ──

  function buildParams(p = 1) {
    const qf = QUICK_FILTERS.find(f => f.id === quickFilter);
    const parseMi = (s: string) => {
      if (s === 'Any') return undefined;
      return parseInt(themed.replace('k', ''), 10) * 1000;
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
      // Translate display labels to backend enum values (F10) — selectedFuels
      // holds labels (e.g. 'Plug-in Hybrid') since that's what the chip UI and
      // any nav-param seed (route.params?.fuelType) both use.
      fuelTypes: selectedFuels.length ? selectedFuels.map(f => FUEL_MAP[f] ?? f) : undefined,
      fuelType: selectedFuels.length ? undefined : qf?.params.fuelType,
      minYear: minYear !== 'Any' ? parseInt(minYear) : qf?.params.minYear,
      maxYear: maxYear !== 'Any' ? parseInt(maxYear) : undefined,
      minMileage: parseMi(minMiles),
      maxMileage: parseMi(maxMiles),
      conditions: conditions.length ? conditions : undefined,
      transmissions: transmissions.length ? transmissions : undefined,
      ulezCompliant: ulezCompliant === 'yes' ? true : ulezCompliant === 'no' ? false : undefined,
      minBhp: minBhp ? parseInt(minBhp) : undefined,
      maxBhp: maxBhp ? parseInt(maxBhp) : undefined,
      minEngine: minEngine ? parseInt(minEngine) : undefined,
      maxEngine: maxEngine ? parseInt(maxEngine) : undefined,
      maxCo2: maxCo2 ? parseInt(maxCo2) : undefined,
      deliveryAvailable: deliveryAvailable ? true : undefined,
      sellerType: sellerType || undefined,
      color: colorFilter.trim() || undefined,
      minDoors: minDoors ? parseInt(minDoors) : undefined,
      minSeats: minSeats ? parseInt(minSeats) : undefined,
      euroStandard: euroStandard || undefined,
      features: selectedFeatures.length ? selectedFeatures : undefined,
      isImported: isImported === 'yes' ? true : isImported === 'no' ? false : undefined,
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
  }, [query, quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmissions, conditions, ulezCompliant, minBhp, maxBhp, minEngine, maxEngine, maxCo2, deliveryAvailable, sellerType, vehicleType, locationFilter, modelFilter, colorFilter, minDoors, minSeats, euroStandard, selectedFeatures, isImported, maxDistanceMi, userLat, userLng, page]);

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
  }, [quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmissions, conditions, ulezCompliant, minBhp, maxBhp, minEngine, maxEngine, maxCo2, deliveryAvailable, sellerType, vehicleType, locationFilter, modelFilter, colorFilter, minDoors, minSeats, euroStandard, selectedFeatures, isImported, maxDistanceMi]);

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
    !!ulezCompliant,
    !!minBhp || !!maxBhp,
    !!minEngine || !!maxEngine,
    !!maxCo2,
    deliveryAvailable,
    !!sellerType,
    vehicleType !== 'CAR',
    !!locationFilter,
    !!modelFilter,
    !!colorFilter,
    !!minDoors,
    !!minSeats,
    !!euroStandard,
    selectedFeatures.length > 0,
    !!isImported,
    maxDistanceMi != null,
  ].filter(Boolean).length;

  const advancedFilterCount = [
    conditions.length > 0, !!minBhp || !!maxBhp, !!minEngine || !!maxEngine,
    !!maxCo2, vehicleType !== 'CAR', !!colorFilter, !!minDoors, !!minSeats,
    !!euroStandard, selectedFeatures.length > 0, !!locationFilter,
    maxDistanceMi != null, !!sellerType, !!ulezCompliant,
    deliveryAvailable, !!isImported,
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
    setUlezCompliant('');
    setMinBhp('');
    setMaxBhp('');
    setMinEngine('');
    setMaxEngine('');
    setMaxCo2('');
    setDeliveryAvailable(false);
    setSellerType('');
    setVehicleType('CAR');
    setLocationFilter('');
    setModelFilter('');
    setColorFilter('');
    setMinDoors('');
    setMinSeats('');
    setEuroStandard('');
    setSelectedFeatures([]);
    setIsImported('');
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

  const sortLabel = SORT_OPTIONS.find(option => option.id === sortId)?.label ?? 'Sort';

  const searchAiConsentKey = () => {
    const userId = useAuthStore.getState().user?.id;
    return userId ? `mazium_ai_consent_v1:${userId}` : 'mazium_ai_consent_v1:anonymous';
  };

  const ensureAiSearchConsent = async (): Promise<boolean> => {
    const key = searchAiConsentKey();
    try {
      if (await AsyncStorage.getItem(key) === 'accepted') return true;
    } catch {
      // Continue to the explicit consent prompt.
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'AI data sharing',
        'Your AI search text will be sent to OpenAI to generate search guidance. AI can make mistakes. Do not include passwords, payment credentials or unnecessary sensitive personal information. Do you consent?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Privacy',
            onPress: () => {
              try { navigation.navigate('PrivacyPolicy'); } catch {}
              resolve(false);
            },
          },
          {
            text: 'I consent',
            onPress: () => {
              AsyncStorage.setItem(key, 'accepted')
                .then(() => resolve(true))
                .catch(() => resolve(false));
            },
          },
        ],
        { cancelable: false },
      );
    });
  };

  const handleAiSearch = async () => {
    if (!aiQuery.trim() || aiLoading) return;
    if (!(await ensureAiSearchConsent())) return;
    setAiLoading(true);
    try {
      const result = await naturalLanguageSearch(aiQuery.trim());
      const f = result.filterCard?.params ?? {};
      // Apply whatever filter params the AI returned. Keys must match
      // ai.service.ts's SEARCH_SYSTEM_PROMPT exactly (make, model, bodyType,
      // fuelType, transmission, color, min/maxPrice, min/maxYear,
      // min/maxMileage, minDoors, minSeats) — sellerType/vehicleType/
      // location/ulezCompliant/deliveryAvailable are NOT
      // extracted by the AI and were dead branches here.
      if (f.make) setSelectedMakes([f.make]);
      if (f.fuelType) setSelectedFuels([f.fuelType]);
      if (f.bodyType) setSelectedBody(f.bodyType);
      if (f.maxPrice) setMaxPrice(parseInt(f.maxPrice));
      if (f.minPrice) setMinPrice(parseInt(f.minPrice));
      if (f.minYear)  setMinYear(f.minYear);
      if (f.maxYear)  setMaxYear(f.maxYear);
      if (f.transmission) setTransmissions([f.transmission]);
      if (f.model)        setModelFilter(f.model);
      if (f.color)        setColorFilter(f.color);
      if (f.minDoors)     setMinDoors(f.minDoors);
      if (f.minSeats)     setMinSeats(f.minSeats);
      setQuickFilter('custom');
      setAiExplanation(result.text ?? null);
      setAiModalVisible(false);
      setAiQuery('');
    } catch (err: any) {
      Alert.alert('AI Search failed', err?.message ?? 'Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={themed.container}>
      <StatusBar barStyle={resolvedAppearance === "dark" ? "light-content" : "dark-content"} translucent backgroundColor={palette.bgBody} />
      <LinearGradient
        colors={[Colors.accentAlpha04, 'rgba(0,0,0,0)', palette.bgBody]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />
      {/* Match website Search title; result counts belong beside sorting,
          not as a changing page title that jumps between 0 and a number. */}
      <View style={[themed.header, { paddingTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={themed.headerSub}>BUY CARS · RETAIL</Text>
          <Text style={themed.headerTitle}>Find Your Perfect Car</Text>
          <Text style={themed.headerResults}>
            {loading ? 'Loading vehicles…' : `${total.toLocaleString('en-GB')} vehicles available`}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={themed.auctionBrowseBanner}
        onPress={() => navigation.navigate('Tabs', { screen: 'Live' })}
        accessibilityRole="button" accessibilityLabel="Browse Live Auctions">
        <Ionicons name="hammer-outline" size={19} color={Colors.accent}/>
        <View style={{ flex: 1 }}>
          <Text style={themed.auctionBrowseTitle}>Looking for dealer auctions?</Text>
          <Text style={themed.auctionBrowseDesc}>Browse Live Auctions in TradeXchange</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={Colors.accent}/>
      </TouchableOpacity>

      {/* ── Search bar ── */}
      <View style={themed.searchWrap}>
        <View style={themed.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
          <TextInput
            style={themed.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Make, model, or keyword..."
            placeholderTextColor={palette.textMuted}
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
      <View style={themed.aiSearchWrap}>
        <TouchableOpacity style={themed.aiSearchBtn} onPress={() => setAiModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={13} color={Colors.warning} />
          <Text style={themed.aiSearchBtnText}>Try AI Search ✦</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI Explanation banner ── */}
      {aiExplanation && (
        <View style={themed.aiExplanationBanner}>
          <Ionicons name="sparkles" size={12} color={Colors.warning} />
          <Text style={themed.aiExplanationText} numberOfLines={2}>{aiExplanation}</Text>
          <IconButton icon={<Ionicons name="close" size={14} color={Colors.warning} />} onPress={() => setAiExplanation(null)} accessibilityLabel="Dismiss AI search explanation" />
        </View>
      )}

      {/* ── Quick filters ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={themed.quickScroll}
        contentContainerStyle={themed.quickRow}
      >
        {QUICK_FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[themed.quickChip, quickFilter === f.id && themed.quickChipActive]}
            onPress={() => applyQuickFilter(f.id)}
            activeOpacity={0.7}
          >
            <Text style={[themed.quickChipText, quickFilter === f.id && themed.quickChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Sort + Filter row ── */}
      <View style={themed.sortRow}>
        <Text style={themed.resultsCount}>
          {loading ? '...' : `${total.toLocaleString('en-GB')} results`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Sort */}
          <TouchableOpacity style={themed.sortBtn} onPress={() => setShowSortMenu(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Sort cars, currently ${sortLabel}`}>
            <Ionicons name="swap-vertical-outline" size={16} color={Colors.textSecondary} />
            <Text style={themed.sortBtnText}>Sort</Text>
          </TouchableOpacity>
          {/* Filter */}
          <TouchableOpacity
            style={[themed.filterBtn, filterCount > 0 && themed.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={filterCount > 0 ? Colors.white : Colors.textSecondary} />
            <Text style={[themed.filterBtnText, filterCount > 0 && { color: Colors.white }]}>
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Text>
          </TouchableOpacity>

        </View>

      </View>
      {filterCount > 0 && (
        <TouchableOpacity style={themed.clearBelowRow} onPress={resetFilters} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Clear all search filters">
          <Ionicons name="close-circle-outline" size={15} color={Colors.accent} />
          <Text style={themed.clearBelowText}>Clear {filterCount} {filterCount === 1 ? 'filter' : 'filters'}</Text>
        </TouchableOpacity>
      )}

      {/* ── Results ── */}
      {loading && listings.length === 0 ? (
        <View style={themed.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={`sk-${i}`} style={themed.skeletonCard}>
              <Skeleton w={92} h={72} r={10} />
              <View style={themed.skeletonInfo}>
                <Skeleton w={160} h={14} r={6} />
                <Skeleton w={100} h={12} r={5} />
                <Skeleton w={80} h={18} r={6} />
              </View>
            </View>
          ))}
        </View>
      ) : listings.length === 0 ? (
        // No-results is the most-hit dead end in the app and had no way out —
        // the user had to work out for themselves that a filter was the cause.
        // Deliberately NOT the accent treatment: this is informational, not an
        // invitation, so the CTA stays quiet.
        <EmptyState
          icon="search-outline"
          eyebrow="No results"
          title="Nothing matched that search"
          subtitle="Try a different make or model, or clear your filters to see everything."
          ctaLabel="Clear filters"
          onCtaPress={resetFilters}
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          contentContainerStyle={[themed.listContent, { paddingBottom: insets.bottom + 110 }]}
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
              <View style={themed.loadMoreWrap}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : hasMore ? null : listings.length > 10 ? (
              <Text style={themed.endText}>All {total.toLocaleString('en-GB')} results shown</Text>
            ) : null
          }
        />
      )}

      {/* Sort choices live in a native sheet instead of a narrow overlay. */}
      <BottomSheet visible={showSortMenu} onClose={() => setShowSortMenu(false)} title="Sort cars" maxHeightPercent={65}>
        <View style={{ padding: 12, gap: 4 }}>
          {SORT_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.id}
              style={[themed.sortOption, o.id === sortId && themed.sortOptionActive]}
              onPress={() => { setSortId(o.id); setShowSortMenu(false); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: o.id === sortId }}
            >
              <Text style={[themed.sortOptionText, o.id === sortId && { color: Colors.accent }]}>{o.label}</Text>
              {o.id === sortId && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

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
          <Text style={themed.aiModalSubtitle}>Describe what you're looking for in plain English</Text>
          <Text style={themed.aiPrivacyHint}>
            AI Search sends your search text to OpenAI. Do not include sensitive information; you will be asked for consent before the first search.
          </Text>
          <TextInput
            style={themed.aiModalInput}
            value={aiQuery}
            onChangeText={setAiQuery}
            placeholder="Describe the car you're looking for…"
            placeholderTextColor={palette.textMuted}
            multiline
            numberOfLines={3}
            onSubmitEditing={handleAiSearch}
            blurOnSubmit
            autoFocus
          />
          <TouchableOpacity
            style={[themed.aiModalBtn, (aiLoading || !aiQuery.trim()) && { opacity: 0.5 }]}
            onPress={handleAiSearch}
            disabled={aiLoading || !aiQuery.trim()}
            activeOpacity={0.85}
          >
            {aiLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color={Colors.white} />
                <Text style={themed.aiModalBtnText}>Search with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Advanced Filters Modal ── */}
      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} maxHeightPercent={92} avoidKeyboard>
        {/* Custom header (with Reset) kept as content — BottomSheet's own title
            row doesn't support a second right-side action. */}
        <View style={themed.modalHeader}>
          <IconButton style={themed.modalClose} icon={<Ionicons name="close" size={18} color={Colors.white} />} onPress={() => setFilterOpen(false)} accessibilityLabel="Close" />
          <Text style={themed.modalTitle}>Filter cars</Text>
          <TouchableOpacity onPress={resetFilters} activeOpacity={0.7}>
            <Text style={themed.modalReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={themed.modalBody}>
          <Text style={themed.filterIntro}>Choose the details that matter. More options are available below.</Text>

              {/* Make — type to filter the full 71-make list, otherwise the ten
                  popular ones. Selection stays single-value: the backend has no
                  `makes[]` param, buildParams() only ever sent selectedMakes[0],
                  so a second chip silently did nothing. */}
              <Text style={themed.filterLabel}>MAKE</Text>
              <View style={themed.makeSearchBox}>
                <Ionicons name="search" size={14} color={Colors.iconMuted} />
                <TextInput
                  style={themed.makeSearchInput}
                  placeholder="Search all makes"
                  placeholderTextColor={palette.textMuted}
                  value={makeQuery}
                  onChangeText={setMakeQuery}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                />
                {makeQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMakeQuery('')} activeOpacity={0.7} accessibilityLabel="Clear make search">
                    <Ionicons name="close-circle" size={15} color={Colors.iconMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {visibleMakes.length === 0 ? (
                <Text style={themed.makeEmptyText}>No makes match “{makeQuery.trim()}”</Text>
              ) : (
                <View style={themed.chipGrid}>
                  {visibleMakes.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[themed.filterChip, selectedMakes.includes(m) && themed.filterChipActive]}
                      onPress={() => setSelectedMakes(prev => prev.includes(m) ? [] : [m])}
                      activeOpacity={0.7}
                    >
                      <Text style={[themed.filterChipText, selectedMakes.includes(m) && themed.filterChipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={themed.divider} />

              {/* Model + Location */}
              <Text style={themed.filterLabel}>MODEL</Text>
              <View style={themed.inputBox}>
                <Text style={themed.inputBoxLabel}>MODEL NAME</Text>
                <TextInput
                  style={themed.inputBoxValue}
                  value={modelFilter}
                  onChangeText={setModelFilter}
                  placeholder="e.g. Q7, 3 Series"
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={themed.divider} />

              {/* Price */}
              <Text style={themed.filterLabel}>PRICE RANGE</Text>
              <View style={themed.twoCol}>
                <View style={themed.inputBox}>
                  <Text style={themed.inputBoxLabel}>MIN</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={minPrice > 0 ? `£${minPrice.toLocaleString()}` : ''}
                    onChangeText={t => setMinPrice(parseInt(t.replace(/[^0-9]/g, '') || '0'))}
                    placeholder="£ 0"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={themed.inputBox}>
                  <Text style={themed.inputBoxLabel}>MAX</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={maxPrice < 150000 ? `£${maxPrice.toLocaleString()}` : ''}
                    onChangeText={t => setMaxPrice(parseInt(t.replace(/[^0-9]/g, '') || '150000'))}
                    placeholder="£ Any"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={themed.divider} />

              {/* Body type */}
              <Text style={themed.filterLabel}>BODY TYPE</Text>
              <View style={themed.chipGrid}>
                {BODY_TYPES.map(bt => (
                  <TouchableOpacity
                    key={bt.id}
                    style={[themed.bodyChip, selectedBody === bt.id && themed.bodyChipActive]}
                    onPress={() => setSelectedBody(prev => prev === bt.id ? '' : bt.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={bt.icon as any} size={16} color={selectedBody === bt.id ? Colors.white : Colors.textSecondary} />
                    <Text style={[themed.filterChipText, selectedBody === bt.id && themed.filterChipTextActive]}>
                      {bt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* Fuel */}
              <Text style={themed.filterLabel}>FUEL TYPE</Text>
              <View style={themed.chipGrid}>
                {FUELS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[themed.filterChip, selectedFuels.includes(f) && themed.filterChipActive]}
                    onPress={() => setSelectedFuels(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.filterChipText, selectedFuels.includes(f) && themed.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* Year Range */}
              <Text style={themed.filterLabel}>YEAR RANGE</Text>
              <View style={themed.inputBox}>
                <Text style={themed.inputBoxLabel}>FROM YEAR</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {YEAR_OPTS.map(y => (
                      <TouchableOpacity key={y} style={[themed.miniChip, minYear === y && themed.filterChipActive]} onPress={() => setMinYear(y)} activeOpacity={0.7}>
                        <Text style={[themed.miniChipText, minYear === y && { color: Colors.white }]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={themed.inputBox}>
                  <Text style={themed.inputBoxLabel}>TO YEAR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {YEAR_OPTS_MAX.map(y => (
                        <TouchableOpacity key={y} style={[themed.miniChip, maxYear === y && themed.filterChipActive]} onPress={() => setMaxYear(y)} activeOpacity={0.7}>
                          <Text style={[themed.miniChipText, maxYear === y && { color: Colors.white }]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={themed.divider} />

              {/* Mileage Range */}
              <Text style={themed.filterLabel}>MILEAGE RANGE</Text>
              <View style={themed.inputBox}>
                <Text style={themed.inputBoxLabel}>MIN MILES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {MILES_OPTS_MIN.map(m => (
                      <TouchableOpacity key={m} style={[themed.miniChip, minMiles === m && themed.filterChipActive]} onPress={() => setMinMiles(m)} activeOpacity={0.7}>
                        <Text style={[themed.miniChipText, minMiles === m && { color: Colors.white }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={themed.inputBox}>
                  <Text style={themed.inputBoxLabel}>MAX MILES</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {MILES_OPTS.map(m => (
                        <TouchableOpacity key={m} style={[themed.miniChip, maxMiles === m && themed.filterChipActive]} onPress={() => setMaxMiles(m)} activeOpacity={0.7}>
                          <Text style={[themed.miniChipText, maxMiles === m && { color: Colors.white }]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={themed.divider} />

              {/* Transmission — multi-select, mirrors the fuel-types chip pattern */}
              <Text style={themed.filterLabel}>TRANSMISSION</Text>
              <View style={themed.chipGrid}>
                {TRANSMISSIONS.map(t => {
                  const selected = transmissions.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[themed.filterChip, selected && themed.filterChipActive]}
                      onPress={() =>
                        setTransmissions(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[themed.filterChipText, selected && themed.filterChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={themed.divider} />

              <TouchableOpacity
                style={themed.moreFiltersToggle}
                onPress={() => setShowAdvancedFilters(v => !v)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ expanded: showAdvancedFilters }}
                accessibilityLabel={`More filters, ${advancedFilterCount} active`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={themed.moreFiltersTitle}>More filters {advancedFilterCount > 0 ? `(${advancedFilterCount} active)` : ''}</Text>
                  <Text style={themed.moreFiltersSubtitle}>Condition, location, features and technical details</Text>
                </View>
                <Ionicons name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showAdvancedFilters && (
                <>
              {/* Condition */}
              <Text style={themed.filterLabel}>CONDITION</Text>
              <View style={themed.chipGrid}>
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[themed.filterChip, conditions.includes(c.id) && themed.filterChipActive]}
                    onPress={() => setConditions(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.filterChipText, conditions.includes(c.id) && themed.filterChipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* BHP Range */}
              <Text style={themed.filterLabel}>POWER (BHP)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[themed.inputBox, { flex: 1 }]}>
                  <Text style={themed.inputBoxLabel}>MIN BHP</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={minBhp}
                    onChangeText={setMinBhp}
                    placeholder="0"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[themed.inputBox, { flex: 1 }]}>
                  <Text style={themed.inputBoxLabel}>MAX BHP</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={maxBhp}
                    onChangeText={setMaxBhp}
                    placeholder="Any"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={themed.divider} />

              {/* Engine Size */}
              <Text style={themed.filterLabel}>ENGINE SIZE (CC)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[themed.inputBox, { flex: 1 }]}>
                  <Text style={themed.inputBoxLabel}>MIN CC</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={minEngine}
                    onChangeText={setMinEngine}
                    placeholder="0"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[themed.inputBox, { flex: 1 }]}>
                  <Text style={themed.inputBoxLabel}>MAX CC</Text>
                  <TextInput
                    style={themed.inputBoxValue}
                    value={maxEngine}
                    onChangeText={setMaxEngine}
                    placeholder="Any"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={themed.divider} />

              {/* CO2 Emissions */}
              <Text style={themed.filterLabel}>CO₂ EMISSIONS (G/KM)</Text>
              <View style={[themed.inputBox, { marginBottom: 10 }]}>
                <Text style={themed.inputBoxLabel}>MAX G/KM</Text>
                <TextInput
                  style={themed.inputBoxValue}
                  value={maxCo2}
                  onChangeText={setMaxCo2}
                  placeholder="Any"
                  placeholderTextColor={palette.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['100', '120', '150', '200'].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[themed.segmentBtn, maxCo2 === v && themed.segmentBtnActive]}
                    onPress={() => setMaxCo2(prev => prev === v ? '' : v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, maxCo2 === v && themed.segmentBtnTextActive]}>≤{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* Vehicle Type */}
              <Text style={themed.filterLabel}>VEHICLE TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const,            label: 'All' },
                  { id: 'CAR' as const,         label: 'Car' },
                  { id: 'HGV' as const,         label: 'HGV' },
                  { id: 'MOTORCYCLE' as const,  label: 'Motorcycle' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[themed.segmentBtn, vehicleType === opt.id && themed.segmentBtnActive]}
                    onPress={() => setVehicleType(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, vehicleType === opt.id && themed.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              <Text style={themed.filterLabel}>COLOUR</Text>
              <View style={themed.inputBox}>
                <Text style={themed.inputBoxLabel}>e.g. White, Black, Blue</Text>
                <TextInput
                  style={themed.inputBoxValue}
                  value={colorFilter}
                  onChangeText={setColorFilter}
                  placeholder="Any colour"
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={themed.divider} />

              {/* Doors / Seats — mirrors web's quick-select buttons */}
              <Text style={themed.filterLabel}>DOORS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DOOR_OPTS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[themed.segmentBtn, minDoors === d && themed.segmentBtnActive]}
                    onPress={() => setMinDoors(prev => prev === d ? '' : d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, minDoors === d && themed.segmentBtnTextActive]}>{d}+</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 16 }} />

              <Text style={themed.filterLabel}>SEATS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SEAT_OPTS.map(sv => (
                  <TouchableOpacity
                    key={sv}
                    style={[themed.segmentBtn, minSeats === sv && themed.segmentBtnActive]}
                    onPress={() => setMinSeats(prev => prev === sv ? '' : sv)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, minSeats === sv && themed.segmentBtnTextActive]}>{sv}+</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* Euro Standard */}
              <Text style={themed.filterLabel}>EURO STANDARD</Text>
              <View style={themed.chipGrid}>
                <TouchableOpacity
                  style={[themed.filterChip, !euroStandard && themed.filterChipActive]}
                  onPress={() => setEuroStandard('')}
                  activeOpacity={0.7}
                >
                  <Text style={[themed.filterChipText, !euroStandard && themed.filterChipTextActive]}>Any</Text>
                </TouchableOpacity>
                {EURO_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.value}
                    style={[themed.filterChip, euroStandard === o.value && themed.filterChipActive]}
                    onPress={() => setEuroStandard(prev => prev === o.value ? '' : o.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.filterChipText, euroStandard === o.value && themed.filterChipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* Features / Options — 18-item checklist, matches web's POPULAR_FEATURES */}
              <Text style={themed.filterLabel}>FEATURES / OPTIONS</Text>
              <View style={themed.chipGrid}>
                {POPULAR_FEATURES.map(feat => {
                  const selected = selectedFeatures.includes(feat);
                  return (
                    <TouchableOpacity
                      key={feat}
                      style={[themed.filterChip, selected && themed.filterChipActive]}
                      onPress={() =>
                        setSelectedFeatures(prev =>
                          prev.includes(feat) ? prev.filter(x => x !== feat) : [...prev, feat],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[themed.filterChipText, selected && themed.filterChipTextActive]}>{feat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={themed.divider} />

              <Text style={themed.filterLabel}>LOCATION</Text>
              <View style={themed.inputBox}>
                <Text style={themed.inputBoxLabel}>CITY OR POSTCODE</Text>
                <TextInput
                  style={themed.inputBoxValue}
                  value={locationFilter}
                  onChangeText={setLocationFilter}
                  placeholder="e.g. London"
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={themed.divider} />

              {/* Distance ("Near Me") — needs a postcode on record since the
                  app doesn't request device geolocation (deliberate choice,
                  see LocationContext.tsx); geocodes via postcodes.io same as
                  web's fallback path. */}
              <Text style={themed.filterLabel}>DISTANCE</Text>
              {userLat != null ? (
                <>
                  <View style={themed.postcodeRow}>
                    <Ionicons name="location" size={14} color={Colors.accent} />
                    <Text style={themed.postcodeRowText}>Using {userPostcode}</Text>
                    <TouchableOpacity onPress={() => setPostcodeInput(userPostcode ?? '')} activeOpacity={0.7}>
                      <Text style={themed.postcodeChangeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[themed.inputBox, { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setDistancePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={themed.inputBoxValue}>{maxDistanceMi != null ? `${maxDistanceMi} mi` : 'Any distance'}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={themed.toggleHint}>Add your postcode to filter by distance.</Text>
              )}
              {(userLat == null || postcodeInput) && (
                <View style={[themed.inputBox, { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <TextInput
                    style={[themed.inputBoxValue, { flex: 1 }]}
                    value={postcodeInput}
                    onChangeText={setPostcodeInput}
                    placeholder="e.g. SW1X 7LY"
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleSavePostcode} disabled={postcodeSaving || !postcodeInput.trim()} activeOpacity={0.7}>
                    {postcodeSaving
                      ? <ActivityIndicator size="small" color={Colors.accent} />
                      : <Text style={[themed.postcodeChangeLink, (!postcodeInput.trim()) && { opacity: 0.4 }]}>Save</Text>}
                  </TouchableOpacity>
                </View>
              )}

              <View style={themed.divider} />

              {/* Seller Type */}
              <Text style={themed.filterLabel}>SELLER TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const,        label: 'All' },
                  { id: 'DEALER' as const,  label: 'Dealer' },
                  { id: 'PRIVATE' as const, label: 'Private' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[themed.segmentBtn, sellerType === opt.id && themed.segmentBtnActive]}
                    onPress={() => setSellerType(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, sellerType === opt.id && themed.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={themed.divider} />

              {/* ULEZ — same tri-state choice as web */}
              <Text style={themed.filterLabel}>ULEZ / CAZ</Text>
              <Text style={[themed.toggleHint, { marginBottom: 10 }]}>
                Filter by Ultra Low Emission Zone compliance
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const, label: 'Any' },
                  { id: 'yes' as const, label: 'Compliant' },
                  { id: 'no' as const, label: 'Not compliant' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[themed.segmentBtn, ulezCompliant === opt.id && themed.segmentBtnActive]}
                    onPress={() => setUlezCompliant(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, ulezCompliant === opt.id && themed.segmentBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[themed.toggleRow, { marginTop: 18 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={themed.toggleLabel}>DELIVERY AVAILABLE ONLY</Text>
                  <Text style={themed.toggleHint}>Only show listings where seller offers delivery</Text>
                </View>
                <Switch
                  value={deliveryAvailable}
                  onValueChange={setDeliveryAvailable}
                  trackColor={{ false: Colors.darkBlue_2a2a35, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              </View>
              {/* Import status — was a plain "Imported only" toggle with no
                  way to explicitly exclude imports. Segmented control matches
                  the Vehicle Type / Listing Type pattern already used above. */}
              <Text style={[themed.toggleLabel, { marginTop: 18, marginBottom: 10 }]}>IMPORT STATUS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: '' as const, label: 'Any' },
                  { id: 'yes' as const, label: 'Imported only' },
                  { id: 'no' as const, label: 'Hide imported' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[themed.segmentBtn, isImported === opt.id && themed.segmentBtnActive]}
                    onPress={() => setIsImported(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[themed.segmentBtnText, isImported === opt.id && themed.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

        {/* Sticky apply button */}
        <View style={themed.modalFooter}>
          <PrimaryCTA
            label="VIEW RESULTS"
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
            style={[themed.sortOption, maxDistanceMi == null && themed.sortOptionActive]}
            onPress={() => { setMaxDistanceMi(null); setDistancePickerVisible(false); }}
            activeOpacity={0.7}
          >
            <Text style={[themed.sortOptionText, maxDistanceMi == null && { color: Colors.accent }]}>Any distance</Text>
            {maxDistanceMi == null && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
          </TouchableOpacity>
          {DISTANCE_CHIPS.map(mi => (
            <TouchableOpacity
              key={mi}
              style={[themed.sortOption, maxDistanceMi === mi && themed.sortOptionActive]}
              onPress={() => { setMaxDistanceMi(mi); setDistancePickerVisible(false); }}
              activeOpacity={0.7}
            >
              <Text style={[themed.sortOptionText, maxDistanceMi === mi && { color: Colors.accent }]}>{mi} mi</Text>
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

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  headerSub: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.accent, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize.size22, color: Colors.white },
  headerResults: { color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 12, marginTop: 7 },
  auctionBrowseBanner: { marginHorizontal: 24, marginBottom: 13, flexDirection: 'row',
    alignItems: 'center', gap: 11, padding: 12, minHeight: 60, backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 13 },
  auctionBrowseTitle: { fontFamily: FontFamily.bold, color: Colors.textPrimary, fontSize: 13 },
  auctionBrowseDesc: { fontFamily: FontFamily.medium, color: Colors.textMuted, fontSize: 11 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: Colors.whiteAlpha08, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { paddingHorizontal: 24, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16, height: 52, gap: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.white },

  // A horizontal ScrollView's cross-axis size is NOT auto-grown by its
  // scrollable content the way a plain View would be — Yoga never measures
  // back from contentContainerStyle into the outer scroll viewport for the
  // cross axis, only the scroll (horizontal) axis reflows freely. Removing
  // the height entirely (tried previously) doesn't let it size to content —
  // confirmed on-device it collapses the viewport smaller than 48 ever was,
  // clipping the pills even harder. So this needs an explicit height, just a
  // generously large one: pill content is ~36-40px tall in the worst case
  // (18px padding + up to ~20px line height at a large accessibility font
  // scale + 2px border), so 64 leaves real headroom instead of the 48 that
  // was already marginal at default scale.
  quickScroll: { height: 64, marginBottom: 4 },
  quickRow: { paddingHorizontal: 24, gap: 10, alignItems: 'center', flexDirection: 'row' },
  quickChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.card, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  quickChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  quickChipText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, lineHeight: 16, color: Colors.paleGrey_cccccc },
  quickChipTextActive: { color: Colors.white },

  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8, marginTop: 4, position: 'relative', zIndex: 10 },
  resultsCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.textSecondary },
  clearBelowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 7, minHeight: 32 },
  clearBelowText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.accent },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  sortBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha08 },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  filterClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: 'transparent', borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha10 },
  filterClearBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.textSecondary },
  sortDropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: Colors.bgTertiary, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 4, zIndex: 99, minWidth: 160, shadowColor: Colors.black, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  sortOption: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 },
  sortOptionActive: { backgroundColor: Colors.accentAlpha08 },
  sortOptionText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },

  listContent: { paddingHorizontal: 24 },
  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  endText: { textAlign: 'center', fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.borderMuted, paddingVertical: 20 },
  skeletonList: { paddingHorizontal: 24, gap: 14 },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 14 },
  skeletonInfo: { flex: 1, gap: 6 },

  // Filter modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha06 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.whiteAlpha06, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.white },
  modalReset: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.accent },
  modalBody: { paddingHorizontal: 22, paddingTop: 20 },
  filterIntro: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  moreFiltersToggle: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.borderHi, borderRadius: Radius.inline },
  moreFiltersTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  moreFiltersSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginTop: 4 },
  modalFooter: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha06, backgroundColor: Colors.deepBlue_0f0f14 },

  filterLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size10, color: Colors.iconMuted, letterSpacing: 1.5, marginBottom: 14 },
  divider: { height: 1, backgroundColor: Colors.whiteAlpha05, marginVertical: 20 },
  makeSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.inline,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  makeSearchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size14,
    color: Colors.white,
    padding: 0,
  },
  makeEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.size12,
    color: Colors.iconMuted,
    paddingVertical: 6,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.size12, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontFamily: FontFamily.bold },
  bodyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  bodyChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  twoCol: { flexDirection: 'row', gap: 10 },
  inputBox: { flex: 1, backgroundColor: Colors.whiteAlpha03, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.whiteAlpha06, padding: 12 },
  inputBoxLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size8, color: Colors.iconMuted, letterSpacing: 1, marginBottom: 6 },
  inputBoxValue: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },
  miniChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.whiteAlpha04, borderWidth: 1, borderColor: Colors.whiteAlpha06 },
  miniChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textSecondary },
  postcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postcodeRowText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.white },
  postcodeChangeLink: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.accent },

  // AI search button
  aiSearchWrap: { paddingHorizontal: 24, marginBottom: 6 },
  aiSearchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.card, backgroundColor: Colors.warningAlpha10, borderWidth: 1, borderColor: Colors.warningAlpha25 },
  aiSearchBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.warning },

  // AI explanation banner
  aiExplanationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 24, marginBottom: 6, backgroundColor: Colors.warningAlpha08, borderWidth: 1, borderColor: Colors.warningAlpha20, borderRadius: Radius.inline, paddingHorizontal: 12, paddingVertical: 9 },
  aiExplanationText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.size12, color: Colors.lightYellow, lineHeight: 18 },

  // AI modal
  aiModalSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.iconMuted, lineHeight: 19 },
  aiPrivacyHint: { fontFamily: FontFamily.regular, fontSize: FontSize.size10, color: Colors.textMuted, lineHeight: 16 },
  aiModalInput: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.white, minHeight: 80, textAlignVertical: 'top' },
  aiModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: Radius.inline, backgroundColor: Colors.warning },
  aiModalBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.white },

  // Segmented controls (listing type / seller type)
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.inline, backgroundColor: Colors.whiteAlpha03, borderWidth: 1, borderColor: Colors.whiteAlpha06, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  segmentBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  segmentBtnTextActive: { color: Colors.white, fontFamily: FontFamily.bold },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.size12, color: Colors.white, marginBottom: 3 },
  toggleHint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.iconMuted, lineHeight: 15 },
});

function useSearchDiscoveryStyles() {
  const { palette } = useNativeAppearance();
  return React.useMemo(() => ({
    ...s,
    container: [s.container, { backgroundColor: palette.bgBody }],
    headerTitle: [s.headerTitle, { color: palette.textPrimary }],
    headerResults: [s.headerResults, { color: palette.textMuted }],
    auctionBrowseBanner: [s.auctionBrowseBanner, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    auctionBrowseTitle: [s.auctionBrowseTitle, { color: palette.textPrimary }],
    auctionBrowseDesc: [s.auctionBrowseDesc, { color: palette.textSecondary }],
    searchBar: [s.searchBar, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    searchInput: [s.searchInput, { color: palette.textPrimary }],
    quickChip: [s.quickChip, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    quickChipText: [s.quickChipText, { color: palette.textSecondary }],
    resultsCount: [s.resultsCount, { color: palette.textSecondary }],
    sortBtn: [s.sortBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    sortBtnText: [s.sortBtnText, { color: palette.textSecondary }],
    filterBtn: [s.filterBtn, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    filterBtnText: [s.filterBtnText, { color: palette.textSecondary }],
    sortOptionText: [s.sortOptionText, { color: palette.textPrimary }],
    skeletonCard: [s.skeletonCard, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    endText: [s.endText, { color: palette.textMuted }],
    modalHeader: [s.modalHeader, { borderBottomColor: palette.borderDefault }],
    modalTitle: [s.modalTitle, { color: palette.textPrimary }],
    modalClose: [s.modalClose, { backgroundColor: palette.bgInput }],
    filterIntro: [s.filterIntro, { color: palette.textSecondary }],
    moreFiltersToggle: [s.moreFiltersToggle, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }],
    moreFiltersTitle: [s.moreFiltersTitle, { color: palette.textPrimary }],
    moreFiltersSubtitle: [s.moreFiltersSubtitle, { color: palette.textSecondary }],
    modalFooter: [s.modalFooter, { backgroundColor: palette.bgDropdown, borderTopColor: palette.borderDefault }],
    filterLabel: [s.filterLabel, { color: palette.textMuted }],
    divider: [s.divider, { backgroundColor: palette.borderDefault }],
    makeSearchBox: [s.makeSearchBox, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    makeSearchInput: [s.makeSearchInput, { color: palette.textPrimary }],
    makeEmptyText: [s.makeEmptyText, { color: palette.textMuted }],
    filterChip: [s.filterChip, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    filterChipText: [s.filterChipText, { color: palette.textSecondary }],
    bodyChip: [s.bodyChip, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    inputBox: [s.inputBox, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    inputBoxLabel: [s.inputBoxLabel, { color: palette.textMuted }],
    inputBoxValue: [s.inputBoxValue, { color: palette.textPrimary }],
    miniChip: [s.miniChip, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    miniChipText: [s.miniChipText, { color: palette.textSecondary }],
    postcodeRowText: [s.postcodeRowText, { color: palette.textPrimary }],
    aiModalSubtitle: [s.aiModalSubtitle, { color: palette.textSecondary }],
    aiPrivacyHint: [s.aiPrivacyHint, { color: palette.textMuted }],
    aiModalInput: [s.aiModalInput, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault, color: palette.textPrimary }],
    segmentBtn: [s.segmentBtn, { backgroundColor: palette.bgInput, borderColor: palette.borderDefault }],
    segmentBtnText: [s.segmentBtnText, { color: palette.textSecondary }],
    toggleLabel: [s.toggleLabel, { color: palette.textPrimary }],
    toggleHint: [s.toggleHint, { color: palette.textMuted }],
  }), [palette]);
}
