import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { CarListing } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { Colors } from '../constants/colors';
import { IconButton } from './IconButton';

interface WishlistHeartProps {
  listing: CarListing;
  style?: ViewStyle;
}

// Top-right wishlist toggle for auction cards — retail cards (VehicleCard,
// HorizontalVehicleCard) already have their own inline heart button, this is
// the auction-card equivalent so the two card families match (Prompt 4).
// useWatchlistStore.toggle() already does the optimistic-flip + revert-on-
// error dance (see store/watchlistStore.ts) — nothing extra needed here.
//
// No anonymous-tap → Login handling: RootNavigator gates the entire app
// behind isAuthenticated (CONTEXT.md §8, "guest browsing" is a known,
// deferred gap), so a signed-out user structurally cannot reach a screen
// that renders this button. Nothing to route to.
export const WishlistHeart: React.FC<WishlistHeartProps> = ({ listing, style }) => {
  // Selector-subscribed rather than destructuring the whole store — see the
  // note in VehicleCard.tsx. This one renders inside auction cards, so the
  // same whole-store subscription re-rendered every heart on the Live screen
  // whenever any listing was saved.
  const saved = useWatchlistStore((s) => s.savedIds.has(listing.id));
  const toggle = useWatchlistStore((s) => s.toggle);

  return (
    <IconButton
      style={[styles.btn, style]}
      icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? Colors.accent : Colors.white} />}
      onPress={() => toggle(listing)}
      accessibilityLabel={saved ? 'Remove from watchlist' : 'Save to watchlist'}
    />
  );
};

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.blackAlpha50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
  },
});
