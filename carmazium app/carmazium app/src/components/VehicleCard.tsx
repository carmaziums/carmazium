import React, { useState } from 'react';
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
import { Ionicons } from '@/components/BrandIcon';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { CarListing, formatPrice, formatMileage } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { SpecBadge } from './SpecBadge';
import { ImageCarousel } from './ImageCarousel';
import { ImageLightbox } from './ImageLightbox';
import { GradeChip } from './GradeChip';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Elevation, Radius } from '../constants/spacing';
import { useLocation } from '../context/LocationContext';
import { haversineDistanceMiles } from '../lib/distance';

import { IconButton } from './IconButton';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface VehicleCardProps {
  listing: CarListing;
  /** Receives the listing id so callers can pass a stable, id-keyed callback
   * instead of a fresh closure per row — see mobile-audit.md P4. */
  onPress: (id: string) => void;
  width?: number;
  compact?: boolean;
}

const VehicleCardBase: React.FC<VehicleCardProps> = ({
  listing,
  onPress,
  width = CARD_WIDTH,
  compact = false,
}) => {
  const { isSaved, toggle } = useWatchlistStore();
  const saved = isSaved(listing.id);
  const scale = useSharedValue(1);

  // Tapping the image opens a full-screen lightbox instead of navigating —
  // matches web's CarCard.tsx (lightboxOnTap). Navigation still happens via
  // the rest of the card (title/price/footer), same as web's separate
  // "View Details" tap target.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Distance chip — only shown when both sides have coordinates. The user's
  // postcode gets geocoded via LocationContext on first entry; the listing's
  // lat/lng is preserved from the backend by mapApiListingToCarListing.
  const { latitude: userLat, longitude: userLng } = useLocation();
  const distanceMiles: number | null =
    userLat != null &&
    userLng != null &&
    listing.latitude != null &&
    listing.longitude != null
      ? Math.round(haversineDistanceMiles(userLat, userLng, listing.latitude, listing.longitude))
      : null;

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
    <>
    <AnimatedTouchable
      entering={FadeIn.duration(220)}
      style={[styles.card, { width }, animatedStyle]}
      onPress={() => onPress(listing.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Image */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <ImageCarousel
          images={listing.images}
          width={width}
          height={imageHeight}
          onPress={openLightbox}
        />
        {/* Gradient overlay on image */}
        <View style={styles.imageGradient} />

        {/* Top badges */}
        <View style={styles.imageBadgeRow}>
          {listing.bannerLabel && (
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerText} numberOfLines={1}>{listing.bannerLabel}</Text>
            </View>
          )}
          {(listing.isFeatured || listing.badgeTier === 'PREMIUM') && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>⭐ FEATURED</Text>
            </View>
          )}
          {/* Paid-tier indicator — this is NOT a verification signal, just which
              listing package the seller bought (mobile-ui-ux-audit.md §C5). */}
          {(listing.badgeTier === 'STANDARD' || listing.badgeTier === 'PREMIUM') && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={10} color={Colors.infoBlueLight} />
              <Text style={styles.verifiedText}>{listing.badgeTier}</Text>
            </View>
          )}
          {/* Real seller-verification chip — separate from the tier badge above,
              only shown when the seller has actually been verified. */}
          {listing.isSellerVerified === true && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={10} color={Colors.success} />
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
          )}
          {listing.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          )}
          {listing.isDepartedSale && (
            <View style={styles.estateBadge}>
              <Text style={styles.estateText}>ESTATE</Text>
            </View>
          )}
        </View>

        {/* Save button */}
        <IconButton style={styles.saveBtn} icon={<Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? Colors.accent : Colors.white} />} onPress={handleToggle} accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'} />

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
          {/* Rating + Grade — badges sit alongside the model line, never
              replace it (Prompt 3: model always visible regardless of badges). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {listing.rating != null && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color={Colors.warning} />
                <Text style={styles.ratingText}>{listing.rating}</Text>
              </View>
            )}
            <GradeChip grade={listing.exteriorGrade} />
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
              {distanceMiles != null && (
                <View style={styles.distanceChip}>
                  <Text style={styles.distanceChipText}>{distanceMiles} mi away</Text>
                </View>
              )}
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
    <ImageLightbox
      visible={lightboxOpen}
      images={listing.images}
      initialIndex={lightboxIndex}
      onClose={() => setLightboxOpen(false)}
    />
    </>
  );
};

export const VehicleCard = React.memo(VehicleCardBase);

const styles = StyleSheet.create({
  card: {
    // Was a hardcoded rgba(18, 18, 24, 0.85) at radius 20 — the pre-redesign
    // near-black, bypassing the tokens. Since this is the most-rendered
    // component in the app (every grid on Home, Search and Saved), it kept the
    // single most-visible surface on the old palette. Now on the card tokens.
    borderRadius: Radius.card,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Elevation.card,
  },
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.bgTertiary,
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
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
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
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 0.8,
  },
  bannerBadge: {
    backgroundColor: 'rgba(59,130,246,0.90)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 140,
  },
  bannerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 0.4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.infoBlueAlpha14,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.infoBlueLight,
    letterSpacing: 0.6,
  },
  estateBadge: {
    backgroundColor: Colors.textSecondaryAlpha20,
    borderWidth: 1,
    borderColor: 'rgba(160, 160, 171, 0.30)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estateText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  saveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.blackAlpha50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: Colors.blackAlpha75,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha12,
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
    backgroundColor: Colors.warningAlpha12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.warningAlpha20,
  },
  ratingText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.warning,
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
    borderTopColor: Colors.whiteAlpha06,
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
    flexShrink: 1,
  },
  distanceChip: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.infoBlueAlpha10,
    borderWidth: 1,
    borderColor: Colors.infoBlueAlpha28,
    flexShrink: 0,
  },
  distanceChipText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.infoBlueLight,
    letterSpacing: 0.3,
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
