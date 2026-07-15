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
  FadeIn,
} from 'react-native-reanimated';
import { CarListing, formatPrice, formatMileage } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { useLocation } from '../context/LocationContext';
import { haversineDistanceMiles } from '../lib/distance';

import { IconButton } from './IconButton';
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface HorizontalVehicleCardProps {
  listing: CarListing;
  /** Receives the listing id so callers can pass a stable, id-keyed callback
   * instead of a fresh closure per row — see mobile-audit.md P4. */
  onPress: (id: string) => void;
}

const HorizontalVehicleCardBase: React.FC<HorizontalVehicleCardProps> = ({
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
      entering={FadeIn.duration(220)}
      style={[styles.card, animatedStyle]}
      onPress={() => onPress(listing.id)}
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

        {/* Banner label takes priority over the tier badge — same corner, tight space */}
        {listing.bannerLabel ? (
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerText} numberOfLines={1}>{listing.bannerLabel}</Text>
          </View>
        ) : (listing.isPremium || listing.badgeTier === 'PREMIUM') && (
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

          <IconButton style={styles.bookmarkBtn} icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? Colors.accent : Colors.white} />} onPress={handleToggle} accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'} />
        </View>
      </View>
    </AnimatedTouchable>
  );
};

export const HorizontalVehicleCard = React.memo(HorizontalVehicleCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
    backgroundColor: Colors.warning, // Gold/Yellow
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  premiumText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.black,
    letterSpacing: 0.5,
  },
  bannerBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    maxWidth: 78,
    backgroundColor: 'rgba(59,130,246,0.90)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bannerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  estateBadge: {
    backgroundColor: Colors.textSecondaryAlpha20,
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
    fontSize: FontSize.size9,
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
    color: Colors.textFaint,
    letterSpacing: 0.8,
  },
  titleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.white,
    marginVertical: 2,
  },
  subSpecsText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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
    borderColor: Colors.white,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  bookmarkBtn: {
    padding: 4,
  },
});
