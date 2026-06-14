import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
// expo-image (not react-native's Image): gives disk+memory caching, recycling
// and progressive loading for free — these cards render in long scrollable
// lists across Home/Search/Saved/Live, where plain Image re-fetches on every
// re-render and causes visible jank, especially on mid-range Android.
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { CarListing, formatPrice, formatMileage } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { SpecBadge } from './SpecBadge';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface VehicleCardProps {
  listing: CarListing;
  onPress: () => void;
  width?: number;
  compact?: boolean;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  listing,
  onPress,
  width = CARD_WIDTH,
  compact = false,
}) => {
  const { isSaved, toggle } = useWatchlistStore();
  const saved = isSaved(listing.id);
  const scale = useSharedValue(1);

  const handleToggle = () => {
    toggle(listing);
    // Note: Toasts are best mounted globally in App.tsx or RootNavigator
    // We update state here, App root handles toast rendering
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const imageHeight = compact ? 140 : 180;

  return (
    <AnimatedTouchable
      style={[styles.card, { width }, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={{ uri: listing.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {/* Gradient overlay on image */}
        <View style={styles.imageGradient} />

        {/* Top badges */}
        <View style={styles.imageBadgeRow}>
          {listing.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>⭐ FEATURED</Text>
            </View>
          )}
          {listing.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleToggle}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={saved ? Colors.accent : Colors.white}
          />
        </TouchableOpacity>

        {/* Price tag */}
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(listing.price)}</Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.body}>
        {/* Make + Model */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.make} numberOfLines={1}>
              {listing.make}
            </Text>
            <Text style={styles.model} numberOfLines={1}>
              {listing.model} {listing.variant}
            </Text>
          </View>
          {/* Rating */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>{listing.rating}</Text>
          </View>
        </View>

        {/* Spec row */}
        <View style={styles.specRow}>
          <SpecBadge icon="speedometer-outline" value={formatMileage(listing.mileage)} />
          <SpecBadge icon="calendar-outline" value={String(listing.year)} />
          <SpecBadge icon="flash-outline" value={`${listing.bhp} bhp`} variant="accent" />
        </View>

        {!compact && (
          <View style={styles.footer}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {listing.location}
              </Text>
            </View>
            <View style={styles.fuelRow}>
              <Text style={styles.fuelText}>{listing.fuelType}</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.fuelText}>{listing.transmission}</Text>
            </View>
          </View>
        )}
      </View>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: 'rgba(18, 18, 24, 0.85)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.bgTertiary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'transparent',
    // Simulate gradient with black-to-transparent overlay
  },
  imageBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  featuredBadge: {
    backgroundColor: 'rgba(220, 31, 38, 0.90)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.8,
  },
  newBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.8,
  },
  saveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  priceText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.base,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  body: {
    padding: 14,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleLeft: {
    flex: 1,
    marginRight: 8,
  },
  make: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  model: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  ratingText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#F59E0B',
  },
  specRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  locationText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  fuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fuelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  separator: {
    color: Colors.textDisabled,
    fontSize: FontSize.xs,
  },
});
