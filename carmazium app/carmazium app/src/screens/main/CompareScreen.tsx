import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { CarListing } from '../../data/listings';
import { searchListings } from '../../lib/listingsApi';
import { BottomSheet } from '../../components/BottomSheet';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

const getMonthlyPayment = (listing: CarListing) => {
  if (listing.monthlyPayment) {
    return `£${parseInt(listing.monthlyPayment.replace(/[^0-9]/g, ''), 10)}`;
  }
  const monthly = Math.round((listing.price * 0.9) / 60);
  return `£${monthly}`;
};

const getMileageText = (car: CarListing) => `${(car.mileage / 1000).toFixed(1)}k`;

const getCapsuleTitle = (car: CarListing) => {
  const title = `${car.make} ${car.model}`;
  return title.length > 12 ? `${title.substring(0, 12)}...` : title;
};

export const CompareScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [listings, setListings] = useState<CarListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Default compared cars (populated once real listings load; user can add a 3rd)
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [activeSlotToReplace, setActiveSlotToReplace] = useState<number | null>(null);

  // Highlight Winners Toggle State
  const [highlightWinners, setHighlightWinners] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { listings: fetched } = await searchListings({ limit: 30, sortBy: 'newest' });
      if (!isMounted) return;
      setListings(fetched);
      setSelectedCarIds(fetched.slice(0, 2).map((l) => l.id));
      setLoadingListings(false);
    })();
    return () => { isMounted = false; };
  }, []);

  const carA = selectedCarIds[0] ? (listings.find((l) => l.id === selectedCarIds[0]) ?? null) : null;
  const carB = selectedCarIds[1] ? (listings.find((l) => l.id === selectedCarIds[1]) ?? null) : null;
  const carC = selectedCarIds[2] ? (listings.find((l) => l.id === selectedCarIds[2]) ?? null) : null;

  const activeCarsCount = selectedCarIds.filter(Boolean).length;
  const isThreeCars = activeCarsCount === 3;

  // Determine winner for a field (Lower is better unless specified)
  const getWinnerForField = (field: string) => {
    const cars = [carA, carB, carC].filter(Boolean) as CarListing[];
    if (cars.length < 2) return { a: false, b: false, c: false };

    const getVal = (car: CarListing) => {
      if (field === 'price') return car.price;
      if (field === 'year') return car.year;
      if (field === 'mileage') return car.mileage;
      if (field === 'monthly') return parseInt(getMonthlyPayment(car).replace(/[^0-9]/g, ''), 10);
      return 0;
    };

    const values = [
      carA ? getVal(carA) : null,
      carB ? getVal(carB) : null,
      carC ? getVal(carC) : null,
    ];

    const validValues = values.filter((v) => v !== null) as number[];

    if (field === 'year') {
      const maxYear = Math.max(...validValues);
      const candidates = cars.filter(c => getVal(c) === maxYear);
      if (candidates.length === 1) {
        return {
          a: carA ? getVal(carA) === maxYear : false,
          b: carB ? getVal(carB) === maxYear : false,
          c: carC ? getVal(carC) === maxYear : false,
        };
      } else {
        // Tie-breaker: lowest mileage
        const minMileage = Math.min(...candidates.map(c => c.mileage));
        const winner = candidates.find(c => c.mileage === minMileage);
        return {
          a: carA?.id === winner?.id,
          b: carB?.id === winner?.id,
          c: carC?.id === winner?.id,
        };
      }
    }

    // Lower is better for price, mileage, and monthly cost
    const targetVal = Math.min(...validValues);

    return {
      a: carA ? getVal(carA) === targetVal : false,
      b: carB ? getVal(carB) === targetVal : false,
      c: carC ? getVal(carC) === targetVal : false,
    };
  };

  const wins = {
    price: getWinnerForField('price'),
    year: getWinnerForField('year'),
    mileage: getWinnerForField('mileage'),
    monthly: getWinnerForField('monthly'),
  };

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
    setSelectModalVisible(true);
  };

  const handleSelectCar = (carId: string) => {
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

  // Render values helper with dynamic boxed highlight styling
  const renderCellValue = (car: CarListing | null, field: string, valueString: string, isA: boolean, isB: boolean, isC: boolean) => {
    if (!car) return <Text style={styles.rowVal}>-</Text>;
    
    const isWinnerColumn = (isA && wins[field as keyof typeof wins]?.a) ||
                           (isB && wins[field as keyof typeof wins]?.b) ||
                           (isC && wins[field as keyof typeof wins]?.c);

    if (isThreeCars) {
      const showBox = highlightWinners && isWinnerColumn;
      return (
        <View style={styles.cellCol}>
          <View style={[styles.cellValBox, showBox && styles.cellValBoxWinner]}>
            <Text style={[styles.rowVal, showBox && styles.rowValWinner]}>
              {valueString}
            </Text>
          </View>
        </View>
      );
    } else {
      const showGreen = isWinnerColumn;
      return (
        <Text style={[styles.rowVal, showGreen && styles.textGreen]}>
          {valueString} {showGreen ? '✔' : ''}
        </Text>
      );
    }
  };

  // Avatar backgrounds
  const getAvatarBadgeColor = (index: number) => {
    if (index === 0) return Colors.accent;
    if (index === 1) return Colors.midBlue_1e40af;
    return Colors.midPink; // Magenta
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background glow gradient */}
      <LinearGradient
        colors={[Colors.accentAlpha03, Colors.infoBlueAlpha03, Colors.bgPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Dynamic Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <IconButton style={styles.backBtn} icon={<Ionicons name="chevron-back" size={20} color={Colors.white} />} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {isThreeCars ? 'COMPARE · 3 CARS' : 'Side by side'}
          </Text>
          {!isThreeCars && (
            <Text style={styles.headerTag}>
              {activeCarsCount} OF 3 COMPARED
            </Text>
          )}
        </View>

        {/* Share was alert-only with no real implementation — removed rather
            than faking it (mobile-ui-ux-audit.md §C13). Spacer keeps the title centered. */}
        <View style={styles.shareBtn} />
      </View>

      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Highlight winners switch container (Only for 3-cars view) */}
        {isThreeCars && (
          <View style={styles.toggleContainer}>
            <View style={styles.toggleLeft}>
              <Ionicons name="flash" size={15} color={Colors.accent} style={{ marginRight: 8 }} />
              <Text style={styles.toggleLabel}>Highlight winners</Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleSwitch, highlightWinners ? styles.toggleSwitchActive : styles.toggleSwitchInactive]}
              onPress={() => setHighlightWinners(!highlightWinners)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, highlightWinners ? styles.toggleThumbActive : styles.toggleThumbInactive]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Car Previews Section */}
        {!isThreeCars ? (
          /* 2-CAR VIEW PREVIEWS */
          <View style={styles.cardsRow}>
            {/* Card A */}
            <View style={styles.cardCol}>
              {carA ? (
                <View style={[styles.carCard, styles.carCardA]}>
                  <Image source={{ uri: carA.images[0] }} style={styles.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={[styles.badgeIndicator, styles.badgeA]}>
                    <Text style={styles.badgeIndicatorText}>A</Text>
                  </View>
                  <IconButton style={styles.removeBtn} icon={<Ionicons name="close-circle" size={16} color={Colors.textSecondary} />} onPress={() => handleRemoveCar(0)} accessibilityLabel="Remove vehicle A from comparison" />

                  <View style={styles.carCardMeta}>
                    <Text style={styles.carModel} numberOfLines={2}>{carA.make} {carA.model}</Text>
                    <Text style={styles.carPrice}>£{carA.price.toLocaleString('en-GB')}</Text>
                    <Text style={styles.carSub}>{carA.year} • {getMileageText(carA)} mi</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyCard}
                  onPress={() => handleOpenSelect(0)}
                  activeOpacity={0.8}
                  disabled={loadingListings}
                >
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color={Colors.textMuted} />
                  <Text style={styles.emptyCardText}>{loadingListings ? 'Loading vehicles…' : 'Add vehicle A'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Card B */}
            <View style={styles.cardCol}>
              {carB ? (
                <View style={[styles.carCard, styles.carCardB]}>
                  <Image source={{ uri: carB.images[0] }} style={styles.carImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={[styles.badgeIndicator, styles.badgeB]}>
                    <Text style={styles.badgeIndicatorText}>B</Text>
                  </View>
                  <IconButton style={styles.removeBtn} icon={<Ionicons name="close-circle" size={16} color={Colors.textSecondary} />} onPress={() => handleRemoveCar(1)} accessibilityLabel="Remove vehicle B from comparison" />

                  <View style={styles.carCardMeta}>
                    <Text style={styles.carModel} numberOfLines={2}>{carB.make} {carB.model}</Text>
                    <Text style={styles.carPrice}>£{carB.price.toLocaleString('en-GB')}</Text>
                    <Text style={styles.carSub}>{carB.year} • {getMileageText(carB)} mi</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyCard}
                  onPress={() => handleOpenSelect(1)}
                  activeOpacity={0.8}
                  disabled={loadingListings}
                >
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color={Colors.textMuted} />
                  <Text style={styles.emptyCardText}>{loadingListings ? 'Loading vehicles…' : 'Add vehicle B'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* 3-CAR VIEW PREVIEWS (Horizontal capsule headers) */
          <View style={styles.capsuleRow}>
            {[carA, carB, carC].map((car, idx) => {
              if (!car) return null;
              const char = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
              return (
                <TouchableOpacity 
                  key={car.id} 
                  style={styles.capsuleCard}
                  onPress={() => handleOpenSelect(idx)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: car.images[0] }} style={styles.capsuleImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <View style={styles.capsuleBadge}>
                    <Text style={styles.capsuleBadgeText}>{char}</Text>
                  </View>
                  <View style={styles.capsuleMeta}>
                    <Text style={styles.capsuleTitle} numberOfLines={1}>
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
            <View style={styles.highlightsRow}>
              <View style={[styles.highBox, styles.highBoxA]}>
                <View style={priceWinner === 'A' ? styles.highBadgeA : styles.highBadgeB}>
                  <Text style={styles.highBadgeText}>{priceWinner} WINS</Text>
                </View>
                <Text style={styles.highTitle}>Lower price</Text>
                <Text style={styles.highValueA}>
                  £{(Math.abs(carA.price - carB.price) / 1000).toFixed(1)}k cheaper
                </Text>
              </View>

              <View style={[styles.highBox, styles.highBoxB]}>
                <View style={yearWinner === 'A' ? styles.highBadgeA : styles.highBadgeB}>
                  <Text style={styles.highBadgeText}>{yearWinner} WINS</Text>
                </View>
                <Text style={styles.highTitle}>Newer plate</Text>
                <Text style={styles.highValueB}>
                  {yearWinnerCar.year} • {yearWinnerCar.location || `${(yearWinnerCar.mileage / 1000).toFixed(1)}k mi`}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Specs Table container */}
        <View style={styles.specsTable}>
          {/* Header Row — always shown so column labels stay visible when scrolling */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderLabel}></Text>
            <Text style={[styles.tableHeaderCol, styles.textRed]}>A</Text>
            <Text style={[styles.tableHeaderCol, styles.textBlue]}>B</Text>
            {isThreeCars && <Text style={[styles.tableHeaderCol, styles.textMagenta]}>C</Text>}
          </View>

          {/* Price Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Price</Text>
            {renderCellValue(carA, 'price', carA ? `£${carA.price.toLocaleString('en-GB')}` : '-', true, false, false)}
            {renderCellValue(carB, 'price', carB ? `£${carB.price.toLocaleString('en-GB')}` : '-', false, true, false)}
            {isThreeCars && renderCellValue(carC, 'price', carC ? `£${carC.price.toLocaleString('en-GB')}` : '-', false, false, true)}
          </View>

          {/* Year Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Year</Text>
            {renderCellValue(carA, 'year', carA ? `${carA.year}` : '-', true, false, false)}
            {renderCellValue(carB, 'year', carB ? `${carB.year}` : '-', false, true, false)}
            {isThreeCars && renderCellValue(carC, 'year', carC ? `${carC.year}` : '-', false, false, true)}
          </View>

          {/* Mileage Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Mileage</Text>
            {renderCellValue(carA, 'mileage', carA ? `${getMileageText(carA)}` : '-', true, false, false)}
            {renderCellValue(carB, 'mileage', carB ? `${getMileageText(carB)}` : '-', false, true, false)}
            {isThreeCars && renderCellValue(carC, 'mileage', carC ? `${getMileageText(carC)}` : '-', false, false, true)}
          </View>

          {/* Fuel Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Fuel</Text>
            {isThreeCars ? (
              <>
                {renderCellValue(carA, 'fuel', carA ? carA.fuelType : '-', false, false, false)}
                {renderCellValue(carB, 'fuel', carB ? carB.fuelType : '-', false, false, false)}
                {renderCellValue(carC, 'fuel', carC ? carC.fuelType : '-', false, false, false)}
              </>
            ) : (
              <>
                <Text style={styles.rowVal}>{carA ? carA.fuelType : '-'}</Text>
                <Text style={styles.rowVal}>{carB ? carB.fuelType : '-'}</Text>
              </>
            )}
          </View>

          {/* Body Type Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Body</Text>
            {isThreeCars ? (
              <>
                {renderCellValue(carA, 'body', carA ? carA.category : '-', false, false, false)}
                {renderCellValue(carB, 'body', carB ? carB.category : '-', false, false, false)}
                {renderCellValue(carC, 'body', carC ? carC.category : '-', false, false, false)}
              </>
            ) : (
              <>
                <Text style={styles.rowVal}>{carA ? carA.category : '-'}</Text>
                <Text style={styles.rowVal}>{carB ? carB.category : '-'}</Text>
              </>
            )}
          </View>

          {/* Monthly Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Monthly</Text>
            {renderCellValue(carA, 'monthly', carA ? getMonthlyPayment(carA) : '-', true, false, false)}
            {renderCellValue(carB, 'monthly', carB ? getMonthlyPayment(carB) : '-', false, true, false)}
            {isThreeCars && renderCellValue(carC, 'monthly', carC ? getMonthlyPayment(carC) : '-', false, false, true)}
          </View>

          {/* Transmission Row */}
          <View style={styles.tableRow}>
            <Text style={styles.rowLabel}>Gearbox</Text>
            {isThreeCars ? (
              <>
                {renderCellValue(carA, 'trans', carA ? (carA.transmission === 'Automatic' ? 'Auto' : carA.transmission) : '-', false, false, false)}
                {renderCellValue(carB, 'trans', carB ? (carB.transmission === 'Automatic' ? 'Auto' : carB.transmission) : '-', false, false, false)}
                {renderCellValue(carC, 'trans', carC ? (carC.transmission === 'Automatic' ? 'Auto' : carC.transmission) : '-', false, false, false)}
              </>
            ) : (
              <>
                <Text style={styles.rowVal}>{carA ? (carA.transmission === 'Automatic' ? 'Auto' : carA.transmission) : '-'}</Text>
                <Text style={styles.rowVal}>{carB ? (carB.transmission === 'Automatic' ? 'Auto' : carB.transmission) : '-'}</Text>
              </>
            )}
          </View>

          {/* Colour Row */}
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Colour</Text>
            {isThreeCars ? (
              <>
                {renderCellValue(carA, 'colour', carA ? (carA.colour ?? '-') : '-', false, false, false)}
                {renderCellValue(carB, 'colour', carB ? (carB.colour ?? '-') : '-', false, false, false)}
                {renderCellValue(carC, 'colour', carC ? (carC.colour ?? '-') : '-', false, false, false)}
              </>
            ) : (
              <>
                <Text style={styles.rowVal}>{carA ? (carA.colour ?? '-') : '-'}</Text>
                <Text style={styles.rowVal}>{carB ? (carB.colour ?? '-') : '-'}</Text>
              </>
            )}
          </View>
        </View>

        {/* 2-Car Verdict Card (Hidden in 3-car view) */}
        {!isThreeCars && carA && carB && (
          <View style={styles.verdictCard}>
            <View style={styles.verdictHeader}>
              <View style={styles.verdictIconBg}>
                <Ionicons name="document-text" size={16} color={Colors.white} />
              </View>
              <Text style={styles.verdictTitle}>MARCUS' VERDICT</Text>
            </View>
            <Text style={styles.verdictBody}>
              {getVerdictText()}
            </Text>
          </View>
        )}

        {/* Add a third car button (Hidden when 3 cars compared) */}
        {!isThreeCars && (
          <TouchableOpacity 
            style={styles.addThirdBtn}
            onPress={() => handleOpenSelect(2)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={Colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.addThirdText}>Add a third car to compare</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom View CTAs (Only in 2-cars layout) */}
      {!isThreeCars && carA && carB && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity 
            style={[styles.footerBtn, styles.footerBtnDark]}
            onPress={() => navigation.navigate('VehicleDetail', { listing: carA })}
            activeOpacity={0.75}
          >
            <Text style={styles.footerBtnText}>VIEW A</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.footerBtn, styles.footerBtnRed]}
            onPress={() => navigation.navigate('VehicleDetail', { listing: carB })}
            activeOpacity={0.75}
          >
            <Text style={styles.footerBtnText}>VIEW B</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selective overlay modal */}
      <BottomSheet
        visible={selectModalVisible}
        onClose={() => setSelectModalVisible(false)}
        title="Select Vehicle"
        maxHeightPercent={75}
      >
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {listings.length === 0 && (
            <Text style={styles.selectCarDetails}>No listings available right now.</Text>
          )}
          {listings.map((car) => {
            const isAlreadySelected = selectedCarIds.includes(car.id);
            return (
              <TouchableOpacity
                key={car.id}
                style={[
                  styles.carSelectRow,
                  isAlreadySelected && styles.carSelectRowDisabled,
                ]}
                onPress={() => handleSelectCar(car.id)}
                disabled={isAlreadySelected}
                activeOpacity={0.7}
              >
                <Image source={{ uri: car.images[0] }} style={styles.selectCarThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                <View style={styles.selectCarMeta}>
                  <Text style={styles.selectCarName}>{car.make} {car.model}</Text>
                  <Text style={styles.selectCarDetails}>
                    £{car.price.toLocaleString('en-GB')} • {car.year} • {Math.round(car.mileage / 1000)}k mi
                  </Text>
                </View>
                {isAlreadySelected ? (
                  <Text style={styles.selectedLabelText}>Compared</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
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
    borderRadius: 12,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 12,
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
    borderRadius: 16,
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
    color: Colors.lightBlue_0084ff,
  },
  // Specs Table Grid
  specsTable: {
    marginHorizontal: 24,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    borderRadius: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellValBox: {
    paddingHorizontal: 12,
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
  rowValWinner: {
    color: Colors.white,
  },
  textRed: {
    color: Colors.accent,
  },
  textBlue: {
    color: Colors.lightBlue_0084ff,
  },
  textMagenta: {
    color: Colors.midPink,
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
    borderRadius: 16,
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
    borderRadius: 12,
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
  carSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha04,
    borderRadius: 12,
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
