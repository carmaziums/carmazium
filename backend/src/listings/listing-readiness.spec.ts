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

    it('never requires HPI for retail or auction listing readiness', () => {
        expect(listingRequiresHpi(new Date(HPI_REQUIRED_FROM.getTime() + 1))).toBe(false);
        expect(listingRequiresHpi(new Date(HPI_REQUIRED_FROM.getTime() - 1))).toBe(false);
        expect(listingRequiresHpi(undefined)).toBe(false);
    });

    it('does not allow legacy forceHpi options to make HPI mandatory', () => {
        expect(listingRequiresHpi(new Date(), true)).toBe(false);
        expect(getListingSubmissionReadiness(
            readyListing(),
            { hasRequiredHpi: false, forceHpi: true },
        )).toEqual({
            ready: true,
            missingFields: [],
            missingHpi: false,
        });
    });

    it('bases readiness only on listing completeness, not HPI purchase state', () => {
        expect(getListingSubmissionReadiness(
            readyListing(),
            { hasRequiredHpi: false },
        )).toEqual({
            ready: true,
            missingFields: [],
            missingHpi: false,
        });

        expect(getListingSubmissionReadiness(
            readyListing({ images: [] }),
            { hasRequiredHpi: true },
        )).toEqual({
            ready: false,
            missingFields: ['at least 10 photos'],
            missingHpi: false,
        });
    });
});
