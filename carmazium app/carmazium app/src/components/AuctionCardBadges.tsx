import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

// Auction-card ↔ Buy-Cars-card chip/badge parity (Prompt 7.1). All fields are
// already returned on auction.listing — no API changes, just wiring what was
// previously only shown on retail cards onto auction cards too.

interface ChipsProps {
  year?: number | null;
  mileage?: number | null;
  fuelType?: string | null;
  bodyType?: string | null;
  location?: string | null;
  deliveryAvailable?: boolean | null;
}

const Chip: React.FC<{ icon: any; label: string; accent?: boolean }> = ({ icon, label, accent }) => (
  <View style={[styles.chip, accent && styles.chipAccent]}>
    <Ionicons name={icon} size={9} color={accent ? Colors.accentGreen : Colors.textMuted} />
    <Text style={[styles.chipText, accent && styles.chipTextAccent]} numberOfLines={1}>{label}</Text>
  </View>
);

// Meta chip row — year / mileage / fuel / body type / location / delivery.
export const AuctionCardChips: React.FC<ChipsProps> = ({
  year, mileage, fuelType, bodyType, location, deliveryAvailable,
}) => (
  <View style={styles.row}>
    {year != null && <Chip icon="calendar-outline" label={String(year)} />}
    {mileage != null && <Chip icon="speedometer-outline" label={`${Number(mileage).toLocaleString('en-GB')} mi`} />}
    {!!fuelType && <Chip icon="flash-outline" label={String(fuelType).replace(/_/g, ' ')} />}
    {!!bodyType && <Chip icon="car-outline" label={String(bodyType)} />}
    {!!location && <Chip icon="location-outline" label={String(location).split(',')[0]} />}
    {!!deliveryAvailable && <Chip icon="car-sport-outline" label="Delivery" accent />}
  </View>
);

interface TrustBadgesProps {
  badgeTier?: string | null;
  isFeatured?: boolean | null;
  isDepartedSale?: boolean | null;
}

// Top-overlay badge stack — featured / verified+VIN report (tier-gated) /
// tier pill / estate pill. Meant to sit under the existing LIVE/UPCOMING
// pill each auction card already renders.
export const AuctionCardTrustBadges: React.FC<TrustBadgesProps> = ({
  badgeTier, isFeatured, isDepartedSale,
}) => {
  const trustEligible = badgeTier === 'STANDARD' || badgeTier === 'PREMIUM';
  if (!isFeatured && !trustEligible && !isDepartedSale) return null;
  return (
    <View style={styles.overlayRow}>
      {!!isFeatured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>⭐ FEATURED</Text>
        </View>
      )}
      {trustEligible && (
        <>
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={9} color={Colors.infoBlueLight} />
            <Text style={styles.verifiedText}>VERIFIED</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons name="document-text-outline" size={9} color={Colors.infoBlueLight} />
            <Text style={styles.verifiedText}>VIN REPORT</Text>
          </View>
        </>
      )}
      {!!isDepartedSale && (
        <View style={styles.estateBadge}>
          <Text style={styles.estateText}>ESTATE</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    maxWidth: 110,
  },
  chipAccent: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
  },
  chipTextAccent: {
    color: Colors.accentGreen,
  },
  overlayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  featuredBadge: {
    backgroundColor: 'rgba(220, 31, 38, 0.90)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  featuredText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.infoBlueAlpha14,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.infoBlueLight,
    letterSpacing: 0.4,
  },
  estateBadge: {
    backgroundColor: Colors.textSecondaryAlpha20,
    borderWidth: 1,
    borderColor: 'rgba(160, 160, 171, 0.30)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  estateText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size8,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
});
