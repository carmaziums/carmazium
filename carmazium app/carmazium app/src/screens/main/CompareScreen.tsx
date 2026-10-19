import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { CarListing } from '../../data/listings';
import { searchListings } from '../../lib/listingsApi';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles, mergeAppearanceStyles, appearancePalette, lightReadableText } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { HamburgerButton } from '../../components/HamburgerButton';
import { useAppearance } from '../../theme/useAppearance';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

const getMileageText = (car: CarListing) => `${(car.mileage / 1000).toFixed(1)}k`;

// ─── Comparison rows — mirrors the web app's compare page field set
// (src/app/compare/page.tsx: Key Details / Engine & Performance / Style
// sections). Engine size/CO2/doors/seats are confirmed-present fields on
// the backend response (ApiListing/CarListing now carry them) rather than
// guessed (CLAUDE.md: never ship a field the backend hasn't confirmed).
// A single data-driven row list (rather than one hand-written JSX block
// per field) is used deliberately so every row renders identically. ──

type BestMode = 'lowest' | 'highest';

interface SpecRow {
  label: string;
  getValue: (car: CarListing) => string;
  best?: { getValue: (car: CarListing) => number | null | undefined; mode: BestMode };
}

const SPEC_ROWS: SpecRow[] = [
  { label: 'Make', getValue: (c) => c.make || '—' },
  { label: 'Model', getValue: (c) => c.model || '—' },
  { label: 'Year', getValue: (c) => `${c.year}`, best: { getValue: (c) => c.year, mode: 'highest' } },
  { label: 'Mileage', getValue: (c) => `${getMileageText(c)} mi`, best: { getValue: (c) => c.mileage, mode: 'lowest' } },
  { label: 'Price', getValue: (c) => `£${c.price.toLocaleString('en-GB')}`, best: { getValue: (c) => c.price, mode: 'lowest' } },
  { label: 'Condition', getValue: (c) => (c.condition ? String(c.condition).replace(/_/g, ' ') : '—') },
  { label: 'Fuel', getValue: (c) => c.fuelType || '—' },
  { label: 'Gearbox', getValue: (c) => (c.transmission === 'Automatic' ? 'Auto' : c.transmission) || '—' },
  { label: 'Power', getValue: (c) => (c.bhp ? `${c.bhp} bhp` : '—'), best: { getValue: (c) => c.bhp, mode: 'highest' } },
  { label: 'Engine Size', getValue: (c) => (c.engineSize ? `${c.engineSize} cc` : '—'), best: { getValue: (c) => c.engineSize, mode: 'highest' } },
  { label: 'CO₂ Emissions', getValue: (c) => (c.co2Emissions != null ? `${c.co2Emissions} g/km` : '—'), best: { getValue: (c) => c.co2Emissions, mode: 'lowest' } },
  { label: 'Body', getValue: (c) => c.category || '—' },
  { label: 'Colour', getValue: (c) => c.colour || '—' },
  { label: 'Doors', getValue: (c) => (c.doors != null ? `${c.doors}` : '—') },
  { label: 'Seats', getValue: (c) => (c.seats != null ? `${c.seats}` : '—'), best: { getValue: (c) => c.seats, mode: 'highest' } },
];

const getBestIndex = (
  cars: (CarListing | null)[],
  getValue: (c: CarListing) => number | null | undefined,
  mode: BestMode,
): number | null => {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  cars.forEach((car, idx) => {
    if (!car) return;
    const v = getValue(car);
    if (v == null) return;
    if (bestVal === null || (mode === 'lowest' ? v < bestVal : v > bestVal)) {
      bestVal = v;
      bestIdx = idx;
    }
  });
  return bestIdx;
};

const getCapsuleTitle = (car: CarListing) => {
  const title = `${car.make} ${car.model}`;
  return title.length > 12 ? `${title.substring(0, 12)}...` : title;
};

export const CompareScreen: React.FC = () => {
  const { tc } = useAppearance();
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(adaptLegacyLightStyles(styles), lightContrastStyles) : styles;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  // "Compare" icon on VehicleDetailScreen navigates here with the car the
  // buyer was already looking at — previously there was no entry point from
  // a listing at all, and Compare always started from scratch.
  const initialListing: CarListing | undefined = route.params?.initialListing;

  const [listings, setListings] = useState<CarListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Default compared cars (populated once real listings load; user can add a 3rd)
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [activeSlotToReplace, setActiveSlotToReplace] = useState<number | null>(null);

  // Picker search — was previously just the same static 30-newest-listings
  // array with no way to actually search for a specific car (mobile-audit.md
  // finding). null = showing the default 30-newest list; non-null = a real
  // search result set.
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<CarListing[] | null>(null);
  const [pickerSearching, setPickerSearching] = useState(false);

  // Highlight Winners Toggle State
  const [highlightWinners, setHighlightWinners] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { listings: fetched } = await searchListings({ limit: 30, sortBy: 'newest' });
      if (!isMounted) return;
      const merged = initialListing && !fetched.some(l => l.id === initialListing.id)
        ? [initialListing, ...fetched]
        : fetched;
      setListings(merged);
      // Only pre-fill the slot for whatever listing the user arrived from
      // (e.g. tapping "Compare" on a listing detail screen) — every other
      // slot starts empty for the user to search/add via the picker below,
      // matching web's src/app/compare/page.tsx ([null, null, null] by
      // default, single-slot pre-fill only via a `slug` query param).
      // Previously this always filled 2 slots regardless of how the screen
      // was reached (mobile-production-readiness-plan.md F37).
      setSelectedCarIds(initialListing ? [initialListing.id] : []);
      setLoadingListings(false);
    })();
    return () => { isMounted = false; };
  }, []);

  // Debounced search within the "select vehicle" picker modal — falls back
  // to the default 30-newest list when the query is cleared.
  useEffect(() => {
    if (!selectModalVisible || !pickerQuery.trim()) {
      setPickerResults(null);
      setPickerSearching(false);
      return;
    }
    let cancelled = false;
    setPickerSearching(true);
    const timer = setTimeout(async () => {
      const { listings: results } = await searchListings({ search: pickerQuery.trim(), limit: 30 });
      if (!cancelled) {
        setPickerResults(results);
        setPickerSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pickerQuery, selectModalVisible]);

  const carA = selectedCarIds[0] ? (listings.find((l) => l.id === selectedCarIds[0]) ?? null) : null;
  const carB = selectedCarIds[1] ? (listings.find((l) => l.id === selectedCarIds[1]) ?? null) : null;
  const carC = selectedCarIds[2] ? (listings.find((l) => l.id === selectedCarIds[2]) ?? null) : null;

  const activeCarsCount = selectedCarIds.filter(Boolean).length;
  const isThreeCars = activeCarsCount === 3;

  const compareCars = isThreeCars ? [carA, carB, carC] : [carA, carB];

  // 2-car verdict paragraph, derived entirely from real listing data
  const getVerdictText = () => {
    if (!carA || !carB) return 'Select two cars to see side-by-side verdict analysis.';

    const priceDiff = Math.abs(carA.price - carB.price);
    const priceDiffStr = `£${(priceDiff / 1000).toFixed(1)}k`;
    const cheaper = carA.price < carB.price ? 'A' : carB.price < carA.price ? 'B' : null;
    const cheaperCar = cheaper === 'A' ? carA : carB;
    const otherCar = cheaper === 'A' ? carB : carA;
    const other = cheaper === 'A' ? 'B' : 'A';

    const mileageNote = carA.mileage !== carB.mileage
      ? `${carA.mileage < carB.mileage ? 'A' : 'B'} has covered fewer miles`
      : 'both have covered similar mileage';
    const yearNote = carA.year !== carB.year
      ? `${carA.year > carB.year ? 'A' : 'B'} brings the newer plate`
      : 'both share the same model year';

    if (!cheaper) {
      return `Both are priced the same at £${carA.price.toLocaleString('en-GB')}. ${mileageNote}, and ${yearNote}. Weigh those factors against your priorities to pick a winner.`;
    }

    return `${cheaper} wins on value — ${priceDiffStr} less than ${other}. ${mileageNote}, and ${yearNote}. If budget is the priority, ${cheaper} is the stronger pick.`;
  };

  const handleOpenSelect = (slotIndex: number) => {
    setActiveSlotToReplace(slotIndex);
    setPickerQuery('');
    setPickerResults(null);
    setSelectModalVisible(true);
  };

  const handleSelectCar = (car: CarListing) => {
    // A car picked from a search result may not be in the base `listings`
    // array the display rows read from — merge it in, or carA/B/C would
    // silently render as null despite selectedCarIds pointing at a real id.
    setListings(prev => (prev.some(l => l.id === car.id) ? prev : [...prev, car]));
    const carId = car.id;
    if (activeSlotToReplace === 0) {
      setSelectedCarIds([carId, selectedCarIds[1] || '', selectedCarIds[2] || ''].filter(Boolean));
    } else if (activeSlotToReplace === 1) {
      setSelectedCarIds([selectedCarIds[0] || '', carId, selectedCarIds[2] || ''].filter(Boolean));
    } else if (activeSlotToReplace === 2) {
      setSelectedCarIds([selectedCarIds[0] || '', selectedCarIds[1] || '', carId].filter(Boolean));
    }
    setSelectModalVisible(false);
  };

  const handleRemoveCar = (index: number) => {
    const updated = [...selectedCarIds];
    updated.splice(index, 1);
    setSelectedCarIds(updated);
  };

  // Avatar backgrounds
  const getAvatarBadgeColor = (index: number) => {
    if (index === 0) return Colors.accent;
    if (index === 1) return Colors.midBlue_1e40af;
    return Colors.midPink; // Magenta
  };

  return (
    <View style={ts.container}>
      <ThemedStatusBar />

      {/* Background glow gradient */}
      <LinearGradient
        colors={appearanceMode === 'light' ? ['#EEF5FB', '#F7FBFF', '#EEF5FB'] : [Colors.accentAlpha03, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Dynamic Header */}
      <View style={[ts.header, { paddingTop: insets.top + 16 }]}>
        <IconButton style={ts.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        
        <View style={ts.headerTitleContainer}>
          <Text style={ts.headerTitle}>
            {isThreeCars ? 'COMPARE · 3 CARS' : 'Side by side'}
          </Text>
          {!isThreeCars && (
            <Text style={ts.headerTag}>
              {activeCarsCount} OF 3 COMPARED
            </Text>
          )}
        </View>

        {/* Share was alert-only with no real implementation — removed rather
            than faking it (mobile-ui-ux-audit.md §C13). Hamburger keeps
            drawer access reachable from this screen instead of a dead spacer. */}
        <HamburgerButton />
      </View>

      <ScrollView 
        style={ts.scroll}
        contentContainerStyle={ts.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Highlight winners switch container (Only for 3-cars view) */}
        {isThreeCars && (
          <View style={ts.toggleContainer}>
            <View style={ts.toggleLeft}>
              <Ionicons name="flash" size={15} color={Colors.accent} style={{ marginRight: 8 }} />
              <Text style={ts.toggleLabel}>Highlight winners</Text>
            </View>
            <TouchableOpacity 
              style={[ts.toggleSwitch, highlightWinners ? ts.toggleSwitchActive : ts.toggleSwitchInactive]}
              onPress={() => setHighlightWinners(!highlightWinners)}
              activeOpacity={0.8}
            >
              <View style={[ts.toggleThumb, highlightWinners ? ts.toggleThumbActive : ts.toggleThumbInactive]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Car Previews Section */}
        {!isThreeCars ? (
          /* 2-CAR VIEW PREVIEWS */
          <View style={ts.cardsRow}>
            {/* Card A */}
            <View style={ts.cardCol}>
              {carA ? (
                <View style={[ts.carCard, ts.carCardA]}>
                  <Image source={{ uri: carA.images[0] }} style={ts.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={[ts.badgeIndicator, ts.badgeA]}>
                    <Text style={ts.badgeIndicatorText}>A</Text>
                  </View>
                  <IconButton style={ts.removeBtn} icon={<Ionicons name="close-circle" size={16} color={tc(Colors.textSecondary)} />} onPress={() => handleRemoveCar(0)} accessibilityLabel="Remove vehicle A from comparison" />

                  <View style={ts.carCardMeta}>
                    <Text style={ts.carModel} numberOfLines={2}>{carA.make} {carA.model}</Text>
                    <Text style={ts.carPrice}>£{carA.price.toLocaleString('en-GB')}</Text>
                    <Text style={ts.carSub}>{carA.year} • {getMileageText(carA)} mi</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={ts.emptyCard}
                  onPress={() => handleOpenSelect(0)}
                  activeOpacity={0.8}
                  disabled={loadingListings}
                >
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color={tc(Colors.textMuted)} />
                  <Text style={ts.emptyCardText}>{loadingListings ? 'Loading vehicles…' : 'Add vehicle A'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Card B */}
            <View style={ts.cardCol}>
              {carB ? (
                <View style={[ts.carCard, ts.carCardB]}>
                  <Image source={{ uri: carB.images[0] }} style={ts.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={[ts.badgeIndicator, ts.badgeB]}>
                    <Text style={ts.badgeIndicatorText}>B</Text>
                  </View>
                  <IconButton style={ts.removeBtn} icon={<Ionicons name="close-circle" size={16} color={tc(Colors.textSecondary)} />} onPress={() => handleRemoveCar(1)} accessibilityLabel="Remove vehicle B from comparison" />

                  <View style={ts.carCardMeta}>
                    <Text style={ts.carModel} numberOfLines={2}>{carB.make} {carB.model}</Text>
                    <Text style={ts.carPrice}>£{carB.price.toLocaleString('en-GB')}</Text>
                    <Text style={ts.carSub}>{carB.year} • {getMileageText(carB)} mi</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={ts.emptyCard}
                  onPress={() => handleOpenSelect(1)}
                  activeOpacity={0.8}
                  disabled={loadingListings}
                >
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color={tc(Colors.textMuted)} />
                  <Text style={ts.emptyCardText}>{loadingListings ? 'Loading vehicles…' : 'Add vehicle B'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* 3-CAR VIEW PREVIEWS (Horizontal capsule headers) */
          <View style={ts.capsuleRow}>
            {[carA, carB, carC].map((car, idx) => {
              if (!car) return null;
              const char = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
              return (
                <TouchableOpacity 
                  key={car.id} 
                  style={ts.capsuleCard}
                  onPress={() => handleOpenSelect(idx)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: car.images[0] }} style={ts.capsuleImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={ts.capsuleBadge}>
                    <Text style={ts.capsuleBadgeText}>{char}</Text>
                  </View>
                  <View style={ts.capsuleMeta}>
                    <Text style={ts.capsuleTitle} numberOfLines={1}>
                      {getCapsuleTitle(car)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Highlights wins summary row (Only for 2-cars) — winners derived from real listing data */}
        {!isThreeCars && carA && carB && (() => {
          const priceWinner = carA.price <= carB.price ? 'A' : 'B';
          const yearWinner = carA.year >= carB.year ? 'A' : 'B';
          const yearWinnerCar = yearWinner === 'A' ? carA : carB;
          return (
            <View style={ts.highlightsRow}>
              <View style={[ts.highBox, ts.highBoxA]}>
                <View style={priceWinner === 'A' ? ts.highBadgeA : ts.highBadgeB}>
                  <Text style={ts.highBadgeText}>{priceWinner} WINS</Text>
                </View>
                <Text style={ts.highTitle}>Lower price</Text>
                <Text style={ts.highValueA}>
                  £{(Math.abs(carA.price - carB.price) / 1000).toFixed(1)}k cheaper
                </Text>
              </View>

              <View style={[ts.highBox, ts.highBoxB]}>
                <View style={yearWinner === 'A' ? ts.highBadgeA : ts.highBadgeB}>
                  <Text style={ts.highBadgeText}>{yearWinner} WINS</Text>
                </View>
                <Text style={ts.highTitle}>Newer plate</Text>
                <Text style={ts.highValueB}>
                  {yearWinnerCar.year} • {yearWinnerCar.location || `${(yearWinnerCar.mileage / 1000).toFixed(1)}k mi`}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Specs Table container — data-driven from SPEC_ROWS so every row
            renders through the same path (see mobile-audit.md-style note
            above SPEC_ROWS for why this replaced 8 hand-duplicated blocks) */}
        <View style={ts.specsTable}>
          {/* Header Row — always shown so column labels stay visible when scrolling */}
          <View style={ts.tableHeaderRow}>
            <Text style={ts.tableHeaderLabel}></Text>
            <Text style={[ts.tableHeaderCol, ts.textRed]}>A</Text>
            <Text style={[ts.tableHeaderCol, ts.textBlue]}>B</Text>
            {isThreeCars && <Text style={[ts.tableHeaderCol, ts.textMagenta]}>C</Text>}
          </View>

          {SPEC_ROWS.map((row, rowIndex) => {
            const bestIdx = row.best ? getBestIndex(compareCars, row.best.getValue, row.best.mode) : null;
            return (
              <View
                key={row.label}
                style={[ts.tableRow, rowIndex === SPEC_ROWS.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Text style={ts.rowLabel}>{row.label}</Text>
                {compareCars.map((car, idx) => {
                  const isWinner = highlightWinners && bestIdx === idx;
                  if (!car) {
                    return isThreeCars ? (
                      <View key={idx} style={ts.cellCol}>
                        <Text style={ts.rowVal}>-</Text>
                      </View>
                    ) : (
                      <Text key={idx} style={ts.rowVal}>-</Text>
                    );
                  }
                  const value = row.getValue(car);
                  if (isThreeCars) {
                    return (
                      <View key={idx} style={ts.cellCol}>
                        <View style={[ts.cellValBox, isWinner && ts.cellValBoxWinner]}>
                          <Text style={[ts.rowValThreeCol, isWinner && ts.rowValWinner]}>{value}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <Text key={idx} style={[ts.rowVal, isWinner && ts.textGreen]}>
                      {value}{isWinner ? ' ✔' : ''}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* 2-Car Verdict Card (Hidden in 3-car view) */}
        {!isThreeCars && carA && carB && (
          <View style={ts.verdictCard}>
            <View style={ts.verdictHeader}>
              <View style={ts.verdictIconBg}>
                <Ionicons name="document-text" size={16} color={Colors.white} />
              </View>
              <Text style={ts.verdictTitle}>MARCUS' VERDICT</Text>
            </View>
            <Text style={ts.verdictBody}>
              {getVerdictText()}
            </Text>
          </View>
        )}

        {/* Add a third car button (Hidden when 3 cars compared) */}
        {!isThreeCars && (
          <TouchableOpacity 
            style={ts.addThirdBtn}
            onPress={() => handleOpenSelect(2)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={tc(Colors.white)} style={{ marginRight: 6 }} />
            <Text style={ts.addThirdText}>Add a third car to compare</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom View CTAs (Only in 2-cars layout) */}
      {!isThreeCars && carA && carB && (
        <View style={[ts.footer, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity 
            style={[ts.footerBtn, ts.footerBtnDark]}
            onPress={() => navigation.navigate('VehicleDetail', { listing: carA })}
            activeOpacity={0.75}
          >
            <Text style={ts.footerBtnText}>VIEW A</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[ts.footerBtn, ts.footerBtnRed]}
            onPress={() => navigation.navigate('VehicleDetail', { listing: carB })}
            activeOpacity={0.75}
          >
            <Text style={ts.footerBtnText}>VIEW B</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selective overlay modal */}
      <BottomSheet
        visible={selectModalVisible}
        onClose={() => setSelectModalVisible(false)}
        title="Select Vehicle"
        maxHeightPercent={75}
        avoidKeyboard
      >
        <View style={ts.pickerSearchWrap}>
          <Ionicons name="search-outline" size={16} color={tc(Colors.textMuted)} />
          <TextInput
            style={ts.pickerSearchInput}
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder="Search make, model, or keyword..."
            placeholderTextColor={tc(Colors.textMuted)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {pickerSearching && <ActivityIndicator size="small" color={Colors.accent} />}
        </View>
        <ScrollView style={ts.modalBody} showsVerticalScrollIndicator={false}>
          {(pickerResults ?? listings).length === 0 && (
            <Text style={ts.selectCarDetails}>
              {pickerQuery.trim() ? 'No matching listings found.' : 'No listings available right now.'}
            </Text>
          )}
          {(pickerResults ?? listings).map((car) => {
            const isAlreadySelected = selectedCarIds.includes(car.id);
            return (
              <TouchableOpacity
                key={car.id}
                style={[
                  ts.carSelectRow,
                  isAlreadySelected && ts.carSelectRowDisabled,
                ]}
                onPress={() => handleSelectCar(car)}
                disabled={isAlreadySelected}
                activeOpacity={0.7}
              >
                <Image source={{ uri: car.images[0] }} style={ts.selectCarThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                <View style={ts.selectCarMeta}>
                  <Text style={ts.selectCarName}>{car.make} {car.model}</Text>
                  <Text style={ts.selectCarDetails}>
                    £{car.price.toLocaleString('en-GB')} • {car.year} • {Math.round(car.mileage / 1000)}k mi
                  </Text>
                </View>
                {isAlreadySelected ? (
                  <Text style={ts.selectedLabelText}>Compared</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={tc(Colors.textMuted)} accessibilityElementsHidden importantForAccessibility="no" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTag: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textFaint,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg - 1,
    color: Colors.white,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Toggle Switch Container
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha05,
    borderRadius: Radius.inline,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  toggleSwitch: {
    width: 38,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: Colors.accent,
  },
  toggleSwitchInactive: {
    backgroundColor: Colors.borderSubtle,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  // Previews row 2-car
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  cardCol: {
    flex: 1,
  },
  carCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
  },
  carCardA: {
    borderColor: Colors.accentAlpha30,
  },
  carCardB: {
    borderColor: Colors.infoBlueAlpha25,
  },
  carImg: {
    width: '100%',
    height: 96,
    backgroundColor: Colors.whiteAlpha02,
  },
  badgeIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeA: {
    backgroundColor: Colors.accent,
  },
  badgeB: {
    backgroundColor: Colors.midBlue_1e40af,
  },
  badgeIndicatorText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  carCardMeta: {
    padding: 10,
    justifyContent: 'center',
  },
  carModel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    marginBottom: 3,
  },
  carPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  carSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs - 2,
    color: Colors.textMuted,
  },
  emptyCard: {
    height: 180,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  emptyCardText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 8,
  },
  // Capsule header row 3-car
  capsuleRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 20,
  },
  capsuleCard: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    overflow: 'hidden',
    position: 'relative',
    height: 80,
  },
  capsuleImg: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.whiteAlpha02,
  },
  capsuleBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  capsuleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
  },
  capsuleMeta: {
    backgroundColor: Colors.deepBlue_15151b,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.white,
    textAlign: 'center',
  },
  // Highlights box
  highlightsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  highBox: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 14,
    alignItems: 'center',
  },
  highBoxA: {
    borderColor: Colors.accentAlpha12,
  },
  highBoxB: {
    borderColor: Colors.infoBlueAlpha10,
  },
  highBadgeA: {
    backgroundColor: Colors.accentAlpha12,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  highBadgeB: {
    backgroundColor: Colors.infoBlueAlpha12,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  highBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 3,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  highTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 1,
    color: Colors.textFaint,
    marginBottom: 4,
  },
  highValueA: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  highValueB: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.infoLight,
  },
  // Specs Table Grid
  specsTable: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha05,
  },
  tableHeaderLabel: {
    flex: 1.2,
  },
  tableHeaderCol: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.whiteAlpha03,
  },
  rowLabel: {
    flex: 1.2,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  cellCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellValBox: {
    width: '100%',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellValBoxWinner: {
    borderColor: Colors.darkRed_5c1d24,
    backgroundColor: Colors.deepPink_221217,
  },
  rowVal: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    textAlign: 'center',
  },
  // Used instead of `rowVal` inside the 3-car cellValBox — that box is the
  // sole flex child of `cellCol` (not a row of siblings sharing space like
  // 2-car mode), so `flex: 1` there fights the box's own sizing instead of
  // just letting the text wrap within the width cellCol already gives it.
  rowValThreeCol: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
    textAlign: 'center',
    flexShrink: 1,
  },
  rowValWinner: {
    color: Colors.white,
  },
  textRed: {
    color: Colors.accent,
  },
  textBlue: {
    color: Colors.infoLight,
  },
  // Third-car column label. midPink (#9A161D) was 1.75:1 on the dark table;
  // amber keeps the three columns distinct (red / blue / amber) and readable.
  textMagenta: {
    color: Colors.warningLight,
  },
  textGreen: {
    color: Colors.accentGreen,
  },
  // Verdict Card
  verdictCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.deepPurple,
    borderWidth: 1,
    borderColor: Colors.darkPink_3b1e2b,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 20,
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  verdictIconBg: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  verdictTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size10,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  verdictBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs + 1,
    color: Colors.white,
    lineHeight: 18,
  },
  // Add third car button
  addThirdBtn: {
    marginHorizontal: 24,
    flexDirection: 'row',
    height: 48,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addThirdText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base - 1,
    color: Colors.white,
  },
  // Sticky Bottom footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.deepBlue_0d0d12,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha06,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnDark: {
    backgroundColor: Colors.deepBlue_1c1d26,
    borderWidth: 1,
    borderColor: Colors.darkBlue_2a2e3d,
  },
  footerBtnRed: {
    backgroundColor: Colors.accent,
  },
  footerBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 1,
  },
  // Modal selection styles
  modalBody: {
    padding: 20,
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 4,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: Radius.inline,
    backgroundColor: Colors.whiteAlpha04,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
  },
  pickerSearchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  carSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha04,
    borderRadius: Radius.inline,
    padding: 12,
    marginBottom: 10,
  },
  carSelectRowDisabled: {
    opacity: 0.45,
  },
  selectCarThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.whiteAlpha02,
    marginRight: 12,
  },
  selectCarMeta: {
    flex: 1,
  },
  selectCarName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size14,
    color: Colors.white,
    marginBottom: 4,
  },
  selectCarDetails: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
  },
  selectedLabelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 2,
    color: Colors.accent,
  },
});

const LIGHT_PALETTE = appearancePalette('light');

// Light-mode text colours for keys the screen's light map did not cover.
// Generated from the contrast audit (scripts/theme-audit); dark mode is untouched.
const lightContrastStyles = StyleSheet.create({
  headerTag: { color: LIGHT_PALETTE.muted },
  carModel: { color: LIGHT_PALETTE.text },
  carSub: { color: LIGHT_PALETTE.muted },
  highBadgeText: { color: LIGHT_PALETTE.text },
  highValueB: { color: lightReadableText.info },
  textRed: { color: lightReadableText.accent },
  textBlue: { color: lightReadableText.info },
  rowVal: { color: LIGHT_PALETTE.text },
  rowValThreeCol: { color: LIGHT_PALETTE.text },
  pickerSearchInput: { color: LIGHT_PALETTE.text },
  selectedLabelText: { color: lightReadableText.accent },
  rowValWinner: { color: LIGHT_PALETTE.text },
  textGreen: { color: lightReadableText.success },
});
