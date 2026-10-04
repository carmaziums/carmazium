import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { CarListing } from '../data/listings';
import { useAuctionShortlistStore } from '../store/auctionShortlistStore';
import { Colors } from '../constants/colors';
import { IconButton } from './IconButton';

interface WishlistHeartProps {
  listing: CarListing;
  style?: ViewStyle;
}

// Top-right wishlist toggle for auction cards — retail cards (VehicleCard,
// HorizontalVehicleCard) already have their own inline heart button, this is
// the auction-card equivalent so the two card families match (Prompt 4).
// Trade hearts deliberately use a separate verified-dealer shortlist store,
// never the generic retail /watchlist. The API checks current KYC and role.
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
  const saved = useAuctionShortlistStore((s) => s.savedIds.has(listing.id));
  const pending = useAuctionShortlistStore((s) => s.busyIds.has(listing.id));
  const toggle = useAuctionShortlistStore((s) => s.toggle);

  return (
    <IconButton
      style={[styles.btn, style]}
      icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? Colors.accent : Colors.white} />}
      onPress={() => { void toggle(listing.id); }}
      disabled={pending}
      accessibilityLabel={saved ? 'Remove from auction shortlist' : 'Save to auction shortlist'}
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
