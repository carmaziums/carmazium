import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
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
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

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
    if (index === 0) return '#DC1F26';
    if (index === 1) return '#1E40AF';
    return '#A21CAF'; // Magenta
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background glow gradient */}
      <LinearGradient
        colors={['rgba(220, 31, 38, 0.03)', 'rgba(59, 130, 246, 0.03)', '#0A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Dynamic Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
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

        <TouchableOpacity 
          style={styles.shareBtn}
          onPress={() => Alert.alert('Share', 'Sharing comparison report...')}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
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
              <Ionicons name="flash" size={15} color="#DC1F26" style={{ marginRight: 8 }} />
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
                  <TouchableOpacity 
                    style={styles.removeBtn}
                    onPress={() => handleRemoveCar(0)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={16} color="#A0A0AB" />
                  </TouchableOpacity>

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
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color="#5C5C6B" />
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
                  <TouchableOpacity 
                    style={styles.removeBtn}
                    onPress={() => handleRemoveCar(1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={16} color="#A0A0AB" />
                  </TouchableOpacity>

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
                  <Ionicons name={loadingListings ? 'hourglass-outline' : 'add'} size={24} color="#5C5C6B" />
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
          {/* Header Row */}
          {!isThreeCars && (
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHeaderLabel}></Text>
              <Text style={[styles.tableHeaderCol, styles.textRed]}>A</Text>
              <Text style={[styles.tableHeaderCol, styles.textBlue]}>B</Text>
            </View>
          )}

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
        </View>

        {/* 2-Car Verdict Card (Hidden in 3-car view) */}
        {!isThreeCars && carA && carB && (
          <View style={styles.verdictCard}>
            <View style={styles.verdictHeader}>
              <View style={styles.verdictIconBg}>
                <Ionicons name="document-text" size={16} color="#FFFFFF" />
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
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
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
      <Modal
        visible={selectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setSelectModalVisible(false)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

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
                      <Ionicons name="chevron-forward" size={16} color="#5C5C6B" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTag: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#8A8A93',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg - 1,
    color: '#FFFFFF',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Toggle Switch Container
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#FFFFFF',
  },
  toggleSwitch: {
    width: 38,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#DC1F26',
  },
  toggleSwitchInactive: {
    backgroundColor: '#2A2A32',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
  },
  carCardA: {
    borderColor: 'rgba(220, 31, 38, 0.3)',
  },
  carCardB: {
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  carImg: {
    width: '100%',
    height: 96,
    backgroundColor: 'rgba(255,255,255,0.02)',
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
    backgroundColor: '#DC1F26',
  },
  badgeB: {
    backgroundColor: '#1E40AF',
  },
  badgeIndicatorText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
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
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  carPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs + 1,
    color: '#A0A0AB',
    marginBottom: 2,
  },
  carSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs - 2,
    color: '#5C5C6B',
  },
  emptyCard: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  emptyCardText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#5C5C6B',
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
    backgroundColor: '#111115',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    height: 80,
  },
  capsuleImg: {
    width: '100%',
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  capsuleBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  capsuleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  capsuleMeta: {
    backgroundColor: '#15151B',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
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
    backgroundColor: '#111115',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  highBoxA: {
    borderColor: 'rgba(220, 31, 38, 0.12)',
  },
  highBoxB: {
    borderColor: 'rgba(59, 130, 246, 0.10)',
  },
  highBadgeA: {
    backgroundColor: 'rgba(220, 31, 38, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  highBadgeB: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  highBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 3,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  highTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 1,
    color: '#8A8A93',
    marginBottom: 4,
  },
  highValueA: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#DC1F26',
  },
  highValueB: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0084FF',
  },
  // Specs Table Grid
  specsTable: {
    marginHorizontal: 24,
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tableHeaderLabel: {
    flex: 1.2,
  },
  tableHeaderCol: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rowLabel: {
    flex: 1.2,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#A0A0AB',
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
    borderColor: '#5C1D24',
    backgroundColor: '#221217',
  },
  rowVal: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  rowValWinner: {
    color: '#FFFFFF',
  },
  textRed: {
    color: '#DC1F26',
  },
  textBlue: {
    color: '#0084FF',
  },
  textMagenta: {
    color: '#A21CAF',
  },
  textGreen: {
    color: '#10B981',
  },
  // Verdict Card
  verdictCard: {
    marginHorizontal: 24,
    backgroundColor: '#161118',
    borderWidth: 1,
    borderColor: '#3B1E2B',
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
    backgroundColor: '#DC1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  verdictTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#DC1F26',
    letterSpacing: 1.2,
  },
  verdictBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs + 1,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  // Add third car button
  addThirdBtn: {
    marginHorizontal: 24,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addThirdText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base - 1,
    color: '#FFFFFF',
  },
  // Sticky Bottom footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: '#1C1D26',
    borderWidth: 1,
    borderColor: '#2A2E3D',
  },
  footerBtnRed: {
    backgroundColor: '#DC1F26',
  },
  footerBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Modal selection styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111115',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  carSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
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
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginRight: 12,
  },
  selectCarMeta: {
    flex: 1,
  },
  selectCarName: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  selectCarDetails: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs - 1,
    color: '#A0A0AB',
  },
  selectedLabelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 2,
    color: '#DC1F26',
  },
});
