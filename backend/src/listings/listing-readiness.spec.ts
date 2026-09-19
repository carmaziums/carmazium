import {
    HPI_REQUIRED_FROM,
    getListingSubmissionMissingFields,
    getListingSubmissionReadiness,
    listingRequiresHpi,
} from './listing-readiness';

const readyListing = (overrides: Record<string, unknown> = {}) => ({
    createdAt: new Date(HPI_REQUIRED_FROM.getTime() + 60_000),
    images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
    vrm: 'AB12CDE',
    make: 'BMW',
    model: 'M3',
    year: 2020,
    mileage: 25000,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'COUPE',
    title: 'BMW M3 2020',
    location: 'Birmingham',
    owners: '1',
    description: 'Well presented vehicle with full details.',
    condition: 'GOOD',
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    isDepartedSale: false,
    ...overrides,
});

describe('listing readiness', () => {
    it('treats explicit false legal declarations as completed answers', () => {
        expect(getListingSubmissionMissingFields(readyListing())).toEqual([]);
    });

    it.each([
        [{ images: [] }, 'at least 10 photos'],
        [{ stolenRecovered: undefined }, 'stolen/recovered declaration'],
        [{ hasOutstandingFinance: undefined }, 'outstanding finance declaration'],
        [{ isLegalRegisteredKeeper: undefined }, 'registered keeper declaration'],
        [
            { isLegalRegisteredKeeper: false, notOwnerRelationship: '' },
            'relationship/authority to sell',
        ],
        [
            { isDepartedSale: true, departedRelationship: '' },
            'estate/departed-sale relationship',
        ],
    ])('reports the authoritative missing requirement %s', (overrides, expected) => {
        expect(getListingSubmissionMissingFields(readyListing(overrides)))
            .toContain(expected);
    });

    it('requires HPI for new listings but grandfathers pre-rollout drafts', () => {
        expect(listingRequiresHpi(new Date(HPI_REQUIRED_FROM.getTime() + 1))).toBe(true);
        expect(listingRequiresHpi(new Date(HPI_REQUIRED_FROM.getTime() - 1))).toBe(false);
    });

    it('can force HPI for a newly-created derivative of an old listing', () => {
        const oldDate = new Date(HPI_REQUIRED_FROM.getTime() - 24 * 60 * 60 * 1000);
        expect(listingRequiresHpi(oldDate, true)).toBe(true);
    });

    it('returns ready only when completeness and HPI both pass', () => {
        expect(getListingSubmissionReadiness(
            readyListing(),
            { hasRequiredHpi: true },
        )).toEqual({
            ready: true,
            missingFields: [],
            missingHpi: false,
        });

        expect(getListingSubmissionReadiness(
            readyListing(),
            { hasRequiredHpi: false },
        )).toEqual({
            ready: false,
            missingFields: [],
            missingHpi: true,
        });
    });
});
