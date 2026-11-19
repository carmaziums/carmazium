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

    it.each(['BASIC', 'STANDARD', 'PREMIUM', null])('reveals active retail contact without an account (%s)', badgeTier => {
        expect(canRevealListingContact({
            viewerAuthenticated: false,
            listingType: 'CLASSIFIED',
            listingStatus: 'ACTIVE',
            badgeTier,
        })).toBe(true);
    });

    it.each([
        ['CLASSIFIED', 'DRAFT', 'PREMIUM'],
        ['CLASSIFIED', 'SOLD', 'PREMIUM'],
        ['AUCTION', 'ACTIVE', 'PREMIUM'],
        [undefined, undefined, undefined],
    ])('withholds anonymous contact outside active retail (%s / %s / %s)', (listingType, listingStatus, badgeTier) => {
        expect(canRevealListingContact({
            viewerAuthenticated: false,
            listingType,
            listingStatus,
            badgeTier,
        })).toBe(false);
    });
});
