import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
// expo-image over react-native's Image: caching/recycling for cards rendered
// repeatedly in horizontal scroll lists (see VehicleCard.tsx for rationale).
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { CarListing, formatPrice, formatMileage } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { useLocation } from '../context/LocationContext';
import { haversineDistanceMiles } from '../lib/distance';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface HorizontalVehicleCardProps {
  listing: CarListing;
  onPress: () => void;
}

export const HorizontalVehicleCard: React.FC<HorizontalVehicleCardProps> = ({
  listing,
  onPress,
}) => {
  const { isSaved, toggle } = useWatchlistStore();
  const saved = isSaved(listing.id);
  const scale = useSharedValue(1);

  const handleToggle = () => {
    toggle(listing);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  // Specific visual highlight from mockup (e.g. Porsche 911 GT3 has outline box around price)
  const isOutlinePrice = listing.id === 'l3';

  // Real haversine distance when both sides have coords. Fallback to just
  // the year — the previous per-id mock distances ("2.1 M", "4.8 M" etc.)
  // were leftover from the design-mockup era and shipped fake numbers to
  // every real listing.
  const { latitude: userLat, longitude: userLng } = useLocation();
  const distanceMiles: number | null =
    userLat != null &&
    userLng != null &&
    listing.latitude != null &&
    listing.longitude != null
      ? Math.round(haversineDistanceMiles(userLat, userLng, listing.latitude, listing.longitude))
      : null;

  const getSpecsTopText = (l: CarListing) => {
    return distanceMiles != null ? `${l.year} · ${distanceMiles} mi away` : `${l.year}`;
  };

  return (
    <AnimatedTouchable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Left: Image container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: listing.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        {/* Yellow Premium/Featured Tag */}
        {listing.isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>• PREMIUM</Text>
          </View>
        )}
        {listing.isDepartedSale && (
          <View style={styles.estateBadge}>
            <Text style={styles.estateText}>ESTATE</Text>
          </View>
        )}
      </View>

      {/* Right: Info container */}
      <View style={styles.infoContainer}>
        {/* Specs Row: Colour & Distance */}
        <Text style={styles.specsText} numberOfLines={1}>
          {getSpecsTopText(listing)}
        </Text>

        {/* Title: Make & Model */}
        <Text style={styles.titleText} numberOfLines={1}>
          {listing.make} {listing.model}
        </Text>

        {/* Sub-specs: Year, Odometer, Fuel */}
        <Text style={styles.subSpecsText} numberOfLines={1}>
          {listing.year} · {formatMileage(listing.mileage)} · {listing.fuelType}
        </Text>

        {/* Bottom: Price & Heart Bookmark */}
        <View style={styles.bottomRow}>
          <View style={styles.priceWrapper}>
            <Text style={styles.priceText}>{formatPrice(listing.price)}</Text>
          </View>

          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={handleToggle}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? Colors.accent : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.bgTertiary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  premiumBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#F59E0B', // Gold/Yellow
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  premiumText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: '#000000',
    letterSpacing: 0.5,
  },
  estateBadge: {
    backgroundColor: 'rgba(160, 160, 171, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(160, 160, 171, 0.30)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  estateText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
    height: 90,
  },
  specsText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs - 2,
    color: '#8A8A93',
    letterSpacing: 0.8,
  },
  titleText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
    marginVertical: 2,
  },
  subSpecsText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#A0A0AB',
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  priceWrapperOutline: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  bookmarkBtn: {
    padding: 4,
  },
});
