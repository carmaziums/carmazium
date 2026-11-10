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
    numberOfKeys: 2,
    serviceHistory: 'Partial',
    mechanicalIssues: 'No known faults',
    electricalIssues: 'No known faults',
    description: 'Well presented vehicle with full details.',
    condition: 'GOOD',
    vehicleType: 'CAR',
    stolenRecovered: false,
    hasOutstandingFinance: false,
    isLegalRegisteredKeeper: true,
    isDepartedSale: false,
    ...overrides,
});

describe('listing readiness', () => {
    it.each(['CLASSIFIED', 'AUCTION'])('accepts explicitly declared no keys/no history for %s', (type) => {
        expect(getListingSubmissionMissingFields(readyListing({
            type, numberOfKeys: 0, serviceHistory: 'None',
        }))).toEqual([]);
        expect(getListingSubmissionReadiness(readyListing({
            type, numberOfKeys: null, serviceHistory: null,
        }))).toMatchObject({ ready: false, missingFields: ['number of keys', 'service history'] });
    });

    it.each(['CLASSIFIED', 'AUCTION'])('accepts explicit no faults and described faults for %s', (type) => {
        for (const answers of [
            { mechanicalIssues: 'No known faults', electricalIssues: 'No known faults' },
            { mechanicalIssues: 'Clutch judders when cold', electricalIssues: 'Rear window switch does not work' },
            { mechanicalIssues: 'No known faults', electricalIssues: 'Battery warning light on' },
        ]) expect(getListingSubmissionReadiness(readyListing({ type, ...answers })).ready).toBe(true);
    });

    it('treats explicit false legal declarations as completed answers', () => {
        expect(getListingSubmissionMissingFields(readyListing())).toEqual([]);
    });

    it.each([
        [{ images: [] }, 'at least 10 photos'],
        [{ mechanicalIssues: undefined }, 'mechanical fault declaration'],
        [{ mechanicalIssues: '   ' }, 'mechanical fault declaration'],
        [{ mechanicalIssues: 'Yes' }, 'mechanical fault declaration'],
        [{ mechanicalIssues: 'Not declared by seller' }, 'mechanical fault declaration'],
        [{ electricalIssues: 'Not declared by seller' }, 'electrical fault declaration'],
        [{ electricalIssues: null }, 'electrical fault declaration'],
        [{ electricalIssues: '' }, 'electrical fault declaration'],
        [{ electricalIssues: 'YES' }, 'electrical fault declaration'],
        [{ numberOfKeys: undefined }, 'number of keys'],
        [{ numberOfKeys: null }, 'number of keys'],
        [{ numberOfKeys: -1 }, 'number of keys'],
        [{ numberOfKeys: 1.5 }, 'number of keys'],
        [{ serviceHistory: undefined }, 'service history'],
        [{ serviceHistory: '   ' }, 'service history'],
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

    it('does not require a hidden body type from motorcycle sellers', () => {
        expect(getListingSubmissionMissingFields(readyListing({
            vehicleType: 'MOTORCYCLE',
            bodyType: null,
        }))).not.toContain('body type');
    });

    it('still requires body type for cars and HGVs', () => {
        expect(getListingSubmissionMissingFields(readyListing({
            vehicleType: 'CAR',
            bodyType: null,
        }))).toContain('body type');

        expect(getListingSubmissionMissingFields(readyListing({
            vehicleType: 'HGV',
            bodyType: null,
        }))).toContain('body type');
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
