/** Align the empty received-offers state with the website's seller dashboard. */
export function sellerOffersEmptyState(
  listingCount: number | null,
  receivedOfferCount: number,
): { title: string; description: string; noListings: boolean } | null {
  if (receivedOfferCount > 0) return null;
  if (listingCount === 0) return {
    title: 'No listings to receive offers for.',
    description: '',
    noListings: true,
  };
  if (listingCount != null && listingCount > 0) return {
    title: 'No offers yet',
    description: 'When a buyer makes an offer on one of your cars, it will appear here.',
    noListings: false,
  };
  return {
    title: 'No offers received',
    description: 'Offers from buyers on your listings will appear here.',
    noListings: false,
  };
}
