import { canRevealListingContact } from './listing-contact-visibility';

describe('listing contact visibility', () => {
    it('reveals contact to authenticated viewers', () => {
        expect(canRevealListingContact({
            viewerAuthenticated: true,
            listingType: 'CLASSIFIED',
            listingStatus: 'ACTIVE',
            badgeTier: 'BASIC',
        })).toBe(true);
    });

    it('reveals contact publicly for an active Premium retail listing', () => {
        expect(canRevealListingContact({
            viewerAuthenticated: false,
            listingType: 'CLASSIFIED',
            listingStatus: 'ACTIVE',
            badgeTier: 'PREMIUM',
        })).toBe(true);
    });

    it.each([
        ['CLASSIFIED', 'ACTIVE', 'BASIC'],
        ['CLASSIFIED', 'ACTIVE', 'STANDARD'],
        ['CLASSIFIED', 'DRAFT', 'PREMIUM'],
        ['CLASSIFIED', 'SOLD', 'PREMIUM'],
        ['AUCTION', 'ACTIVE', 'PREMIUM'],
        [undefined, undefined, undefined],
    ])('withholds anonymous contact outside Premium active retail (%s / %s / %s)', (listingType, listingStatus, badgeTier) => {
        expect(canRevealListingContact({
            viewerAuthenticated: false,
            listingType,
            listingStatus,
            badgeTier,
        })).toBe(false);
    });
});
