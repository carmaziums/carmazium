import { sellerOffersEmptyState } from './sellerOffersEmptyState';

describe('Buyer/Seller received-offer empty state matches website', () => {
  test('no listings gives the website-specific no listings copy', () => {
    expect(sellerOffersEmptyState(0, 0)).toEqual({
      title: 'No listings to receive offers for.',
      description: '',
      noListings: true,
    });
  });
  test('listings with no offers show the website invitation text', () => {
    expect(sellerOffersEmptyState(3, 0)).toEqual({
      title: 'No offers yet',
      description: 'When a buyer makes an offer on one of your cars, it will appear here.',
      noListings: false,
    });
  });
  test('an unavailable listing count never falsely claims no listings exist', () => {
    expect(sellerOffersEmptyState(null, 0)?.title).toBe('No offers received');
  });
  test('existing received offers display the actual offers, not an empty state', () => {
    expect(sellerOffersEmptyState(0, 1)).toBeNull();
    expect(sellerOffersEmptyState(10, 4)).toBeNull();
  });
});
