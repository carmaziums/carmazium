import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Modal, ActivityIndicator, FlatList,
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
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { PrimaryCTA } from '../../components/PrimaryCTA';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

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
const BODY_TYPES = [
  { id: 'SUV', label: 'SUV', emoji: '🚙' },
  { id: 'SALOON', label: 'Saloon', emoji: '🚗' },
  { id: 'HATCHBACK', label: 'Hatchback', emoji: '🚘' },
  { id: 'ESTATE', label: 'Estate', emoji: '🚐' },
  { id: 'COUPE', label: 'Coupé', emoji: '🏎️' },
  { id: 'CONVERTIBLE', label: 'Convertible', emoji: '🌅' },
  { id: 'VAN', label: 'Van', emoji: '🚌' },
  { id: 'PICKUP', label: 'Pickup', emoji: '🛻' },
];
const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'price_asc', label: 'Price: low → high' },
  { id: 'price_desc', label: 'Price: high → low' },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export const SearchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();

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
  const [transmission, setTransmission] = useState('');
  // New filter dimensions
  const [conditions, setConditions] = useState<string[]>([]);
  const [ulezCompliant, setUlezCompliant] = useState(false);
  const [minBhp, setMinBhp] = useState('');
  const [maxBhp, setMaxBhp] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [sellerType, setSellerType] = useState<'' | 'DEALER' | 'PRIVATE'>('');
  const [listingType, setListingType] = useState<'' | 'CLASSIFIED' | 'AUCTION'>('');
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

  const debounceRef = useRef<any>(null);

  // When navigating to this screen from Home with params (e.g. pill chips), apply
  // new filters even if the tab was already mounted. The _t timestamp ensures this
  // fires on repeated taps of the same pill.
  useEffect(() => {
    const p = route.params as any;
    if (!p?._t) return;
    let hasNew = false;
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
      setTransmission('');
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
      maxPrice: maxPrice < 150000 ? maxPrice : qf?.params.maxPrice,
      minPrice: minPrice > 0 ? minPrice : undefined,
      bodyType: selectedBody || qf?.params.bodyType,
      fuelType: selectedFuels[0] || qf?.params.fuelType,
      minYear: minYear !== 'Any' ? parseInt(minYear) : qf?.params.minYear,
      maxYear: maxYear !== 'Any' ? parseInt(maxYear) : undefined,
      minMileage: parseMi(minMiles),
      maxMileage: parseMi(maxMiles),
      conditions: conditions.length ? conditions : undefined,
      ulezCompliant: ulezCompliant ? true : undefined,
      minBhp: minBhp ? parseInt(minBhp) : undefined,
      maxBhp: maxBhp ? parseInt(maxBhp) : undefined,
      deliveryAvailable: deliveryAvailable ? true : undefined,
      sellerType: sellerType || undefined,
      listingType: listingType || undefined,
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
      const { listings: items, total: t } = await searchListings(buildParams(p));
      if (reset) {
        setListings(items);
        setPage(2);
        setTotal(t);
      } else {
        setListings(prev => [...prev, ...items]);
        setPage(prev => prev + 1);
        setTotal(t);
      }
      setHasMore(items.length === 20);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmission, conditions, ulezCompliant, minBhp, maxBhp, deliveryAvailable, sellerType, listingType, page]);

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
  }, [quickFilter, sortId, selectedMakes, minPrice, maxPrice, selectedBody, selectedFuels, minYear, maxYear, minMiles, maxMiles, transmission, conditions, ulezCompliant, minBhp, maxBhp, deliveryAvailable, sellerType, listingType]);

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
    !!transmission,
    conditions.length > 0,
    ulezCompliant,
    !!minBhp || !!maxBhp,
    deliveryAvailable,
    !!sellerType,
    !!listingType,
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
    setTransmission('');
    setConditions([]);
    setUlezCompliant(false);
    setMinBhp('');
    setMaxBhp('');
    setDeliveryAvailable(false);
    setSellerType('');
    setListingType('');
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
      if (f.transmission) setTransmission(f.transmission);
      if (f.listingType)  setListingType(f.listingType as any);
      if (f.sellerType)   setSellerType(f.sellerType as any);
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
        colors={['rgba(220,31,38,0.04)', 'rgba(0,0,0,0)', '#0A0A0C']}
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
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Alerts')} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color="#606070" />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Make, model, or keyword..."
            placeholderTextColor="#404050"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#606070" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── AI Search button ── */}
      <View style={s.aiSearchWrap}>
        <TouchableOpacity style={s.aiSearchBtn} onPress={() => setAiModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={13} color="#F59E0B" />
          <Text style={s.aiSearchBtnText}>Try AI Search ✦</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI Explanation banner ── */}
      {aiExplanation && (
        <View style={s.aiExplanationBanner}>
          <Ionicons name="sparkles" size={12} color="#F59E0B" />
          <Text style={s.aiExplanationText} numberOfLines={2}>{aiExplanation}</Text>
          <TouchableOpacity onPress={() => setAiExplanation(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={14} color="#F59E0B" />
          </TouchableOpacity>
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
            <Ionicons name="chevron-down" size={12} color="#A0A0AB" />
            <Text style={s.sortBtnText}>{sortLabel}</Text>
          </TouchableOpacity>
          {/* Filter */}
          <TouchableOpacity
            style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={filterCount > 0 ? '#FFFFFF' : '#A0A0AB'} />
            <Text style={[s.filterBtnText, filterCount > 0 && { color: '#FFFFFF' }]}>
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
          renderItem={({ item }) => (
            <HorizontalVehicleCard
              listing={item}
              onPress={() => navigation.navigate('VehicleDetail', { listing: item })}
            />
          )}
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
      <Modal visible={aiModalVisible} animationType="slide" transparent onRequestClose={() => setAiModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={s.aiModalOverlay} activeOpacity={1} onPress={() => setAiModalVisible(false)}>
            <View style={[s.aiModalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]} onStartShouldSetResponder={() => true}>
              <View style={s.aiModalHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
                <Text style={s.aiModalTitle}>AI Car Search</Text>
              </View>
              <Text style={s.aiModalSubtitle}>Describe what you're looking for in plain English</Text>
              <TextInput
                style={s.aiModalInput}
                value={aiQuery}
                onChangeText={setAiQuery}
                placeholder="Describe the car you're looking for…"
                placeholderTextColor="#404050"
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
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color="#FFF" />
                    <Text style={s.aiModalBtnText}>Search with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Advanced Filters Modal ── */}
      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>

            {/* Modal header */}
            <View style={s.modalHeader}>
              <TouchableOpacity style={s.modalClose} onPress={() => setFilterOpen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
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
                    onPress={() => setSelectedMakes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
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
                    placeholderTextColor="#404050"
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
                    placeholderTextColor="#404050"
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
                    <Text style={s.bodyChipEmoji}>{bt.emoji}</Text>
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
                        <Text style={[s.miniChipText, minYear === y && { color: '#FFF' }]}>{y}</Text>
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
                          <Text style={[s.miniChipText, maxYear === y && { color: '#FFF' }]}>{y}</Text>
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
                        <Text style={[s.miniChipText, minMiles === m && { color: '#FFF' }]}>{m}</Text>
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
                          <Text style={[s.miniChipText, maxMiles === m && { color: '#FFF' }]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={s.divider} />

              {/* Transmission */}
              <Text style={s.filterLabel}>TRANSMISSION</Text>
              <View style={s.chipGrid}>
                {['AUTOMATIC', 'MANUAL', 'SEMI_AUTO'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.filterChip, transmission === t && s.filterChipActive]}
                    onPress={() => setTransmission(prev => prev === t ? '' : t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.filterChipText, transmission === t && s.filterChipTextActive]}>
                      {t.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                    placeholderTextColor="#404050"
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
                    placeholderTextColor="#404050"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

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
                  trackColor={{ false: '#2A2A35', true: '#DC1F26' }}
                  thumbColor="#FFFFFF"
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
                  trackColor={{ false: '#2A2A35', true: '#DC1F26' }}
                  thumbColor="#FFFFFF"
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
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 18 },
  headerSub: { fontFamily: FontFamily.bold, fontSize: 10, color: Colors.accent, letterSpacing: 1.5, marginBottom: 4 },
  headerTitle: { fontFamily: FontFamily.extraBold, fontSize: 22, color: '#FFFFFF' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  searchWrap: { paddingHorizontal: 24, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111115', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A32', paddingHorizontal: 16, height: 52, gap: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15, color: '#FFFFFF' },

  quickScroll: { height: 48, marginBottom: 4 },
  quickRow: { paddingHorizontal: 24, gap: 10, alignItems: 'center', flexDirection: 'row' },
  quickChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  quickChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  quickChipText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#CCCCCC' },
  quickChipTextActive: { color: '#FFFFFF' },

  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8, marginTop: 4, position: 'relative', zIndex: 10 },
  resultsCount: { fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#111115', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sortBtnText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#A0A0AB' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#111115', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterBtnText: { fontFamily: FontFamily.bold, fontSize: 11, color: '#A0A0AB' },
  sortDropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: '#18181E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A32', padding: 4, zIndex: 99, minWidth: 160, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  sortOption: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 },
  sortOptionActive: { backgroundColor: 'rgba(220,31,38,0.08)' },
  sortOptionText: { fontFamily: FontFamily.medium, fontSize: 13, color: '#FFFFFF' },

  listContent: { paddingHorizontal: 24 },
  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  endText: { textAlign: 'center', fontFamily: FontFamily.regular, fontSize: 11, color: '#404050', paddingVertical: 20 },
  skeletonList: { paddingHorizontal: 24, gap: 14 },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111115', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14 },
  skeletonInfo: { flex: 1, gap: 6 },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0F0F14', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 16, color: '#FFFFFF' },
  modalReset: { fontFamily: FontFamily.bold, fontSize: 13, color: Colors.accent },
  modalBody: { paddingHorizontal: 22, paddingTop: 20 },
  modalFooter: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0F0F14' },

  filterLabel: { fontFamily: FontFamily.bold, fontSize: 10, color: '#606070', letterSpacing: 1.5, marginBottom: 14 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 20 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { fontFamily: FontFamily.medium, fontSize: 12, color: '#A0A0AB' },
  filterChipTextActive: { color: '#FFFFFF', fontFamily: FontFamily.bold },
  bodyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bodyChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  bodyChipEmoji: { fontSize: 15 },
  twoCol: { gap: 10 },
  inputBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12 },
  inputBoxLabel: { fontFamily: FontFamily.bold, fontSize: 8, color: '#606070', letterSpacing: 1, marginBottom: 6 },
  inputBoxValue: { fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF' },
  miniChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  miniChipText: { fontFamily: FontFamily.medium, fontSize: 11, color: '#A0A0AB' },

  // AI search button
  aiSearchWrap: { paddingHorizontal: 24, marginBottom: 6 },
  aiSearchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  aiSearchBtnText: { fontFamily: FontFamily.bold, fontSize: 12, color: '#F59E0B' },

  // AI explanation banner
  aiExplanationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 24, marginBottom: 6, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.20)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  aiExplanationText: { flex: 1, fontFamily: FontFamily.regular, fontSize: 12, color: '#FCD34D', lineHeight: 18 },

  // AI modal
  aiModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  aiModalSheet: { backgroundColor: '#0F0F14', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 24, gap: 12 },
  aiModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 4 },
  aiModalTitle: { fontFamily: FontFamily.bold, fontSize: 18, color: '#FFFFFF' },
  aiModalSubtitle: { fontFamily: FontFamily.regular, fontSize: 13, color: '#606070', lineHeight: 19 },
  aiModalInput: { backgroundColor: '#111115', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A32', paddingHorizontal: 16, paddingVertical: 14, fontFamily: FontFamily.regular, fontSize: 15, color: '#FFFFFF', minHeight: 80, textAlignVertical: 'top' },
  aiModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: '#F59E0B' },
  aiModalBtnText: { fontFamily: FontFamily.bold, fontSize: 15, color: '#FFFFFF' },

  // Segmented controls (listing type / seller type)
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  segmentBtnText: { fontFamily: FontFamily.medium, fontSize: 13, color: '#A0A0AB' },
  segmentBtnTextActive: { color: '#FFFFFF', fontFamily: FontFamily.bold },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleLabel: { fontFamily: FontFamily.bold, fontSize: 12, color: '#FFFFFF', marginBottom: 3 },
  toggleHint: { fontFamily: FontFamily.regular, fontSize: 11, color: '#606070', lineHeight: 15 },
});
