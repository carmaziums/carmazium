import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
// expo-image over react-native's Image: caching/recycling for cards rendered
// repeatedly in horizontal scroll lists (see VehicleCard.tsx for rationale).
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
import { useNativeAppearance } from '../theme/NativeAppearanceProvider';
import { FontFamily, FontSize } from '../constants/typography';
import { useLocation } from '../context/LocationContext';
import { haversineDistanceMiles } from '../lib/distance';
import { ImageCarousel } from './ImageCarousel';
import { ImageLightbox } from './ImageLightbox';
import { GradeChip } from './GradeChip';

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
  // Selector-subscribed rather than destructuring the whole store — see the
  // note in VehicleCard.tsx. Re-renders only when this row's own saved state
  // changes, not when any listing anywhere is saved.
  const { palette } = useNativeAppearance();
  const saved = useWatchlistStore((s) => s.savedIds.has(listing.id));
  const toggle = useWatchlistStore((s) => s.toggle);
  const scale = useSharedValue(1);
  const { width: screenWidth } = useWindowDimensions();
  // Search uses 24px page gutters and a 1px border on either side.
  // Native sizing keeps each photo as wide as the web-style result card.
  const imageWidth = Math.max(200, Math.round(screenWidth - 50));

  // Tapping the thumbnail opens a full-screen lightbox instead of
  // navigating — matches web's CarCard.tsx (lightboxOnTap). Navigation
  // still happens via the rest of the row.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

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
    <>
    <AnimatedTouchable
      entering={FadeIn.duration(220)}
      style={[styles.card, { backgroundColor: palette.bgCard, borderColor: palette.borderDefault }, animatedStyle]}
      onPress={() => onPress(listing.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Full-width photo first: mirrors the readable website listing cards. */}
      <View style={styles.imageContainer}>
        <ImageCarousel
          images={listing.images}
          width={imageWidth}
          height={196}
          onPress={openLightbox}
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
        <View style={styles.saveButtonOverlay}>
          <IconButton style={styles.bookmarkBtn} icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? Colors.accent : Colors.white} />} onPress={handleToggle} accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'} />
        </View>
      </View>

      {/* Full-width details, with a clear hierarchy and no tiny cramped column. */}
      <View style={styles.infoContainer}>
        {/* Specs Row: Colour & Distance */}
        <Text style={[styles.specsText, { color: palette.textMuted }]} numberOfLines={1}>
          {getSpecsTopText(listing)}
        </Text>

        {/* Title: Make & Model */}
        <Text style={[styles.titleText, { color: palette.textPrimary }]} numberOfLines={2}>
          {listing.make} {listing.model}
        </Text>

        {/* Vehicle details are visible without opening each listing. */}
        <Text style={[styles.subSpecsText, { color: palette.textSecondary }]} numberOfLines={2}>
          {[`Gearbox: ${listing.transmission || 'Not specified'}`, formatMileage(listing.mileage), listing.fuelType, listing.category].filter(Boolean).join('  ·  ')}
        </Text>

        {/* Bottom: Price, Grade & Heart Bookmark */}
        <View style={styles.bottomRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <View style={styles.priceWrapper}>
              <Text style={[styles.priceText, { color: palette.textPrimary }]}>{formatPrice(listing.price)}</Text>
            </View>
            <GradeChip grade={listing.exteriorGrade} />
          </View>

          <View style={styles.viewDetails}>
            <Text style={styles.viewDetailsText}>View details</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
          </View>
        </View>
      </View>
    </AnimatedTouchable>
    <ImageLightbox
      visible={lightboxOpen}
      images={listing.images}
      initialIndex={lightboxIndex}
      onClose={() => setLightboxOpen(false)}
    />
    </>
  );
};

export const HorizontalVehicleCard = React.memo(HorizontalVehicleCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCardSolid,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 196,
    overflow: 'hidden',
    backgroundColor: Colors.bgTertiary,
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
    maxWidth: 180,
    backgroundColor: 'rgba(59,130,246,0.90)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
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
  saveButtonOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.overlay60,
    borderRadius: 24,
  },
  infoContainer: {
    padding: 16,
    gap: 8,
  },
  specsText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  titleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
    lineHeight: 24,
    marginVertical: 2,
  },
  subSpecsText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
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
    fontSize: FontSize['2xl'],
    color: Colors.white,
  },
  bookmarkBtn: {
    width: 44,
    height: 44,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});
