/**
 * Kept for source compatibility with older code/tests.
 * HPI was previously mandatory for listings created from this date, but the
 * current CarMazium policy makes vehicle-history reports optional for every
 * Retail and Auction listing.
 */
export const HPI_REQUIRED_FROM = new Date('2026-09-19T00:00:00.000Z');

export interface ListingReadinessOptions {
    /**
     * Retained for backwards compatibility. HPI no longer participates in
     * submission readiness.
     */
    hasRequiredHpi?: boolean;
    /**
     * Retained for backwards compatibility. HPI can no longer be forced as a
     * submission requirement, including for linked/derived auction listings.
     */
    forceHpi?: boolean;
}

export interface ListingSubmissionReadiness {
    ready: boolean;
    missingFields: string[];
    /**
     * Always false. HPI is an optional paid add-on in both Retail and Auction.
     */
    missingHpi: boolean;
}

export function listingRequiresHpi(
    _createdAt: Date | string | null | undefined,
    _forceHpi = false,
): boolean {
    return false;
}

export function getListingSubmissionMissingFields(listing: any): string[] {
    const missing: string[] = [];

    if (!Array.isArray(listing?.images) || listing.images.length < 10) {
        missing.push('at least 10 photos');
    }
    if (!listing?.vrm?.trim?.()) missing.push('VRM');
    if (!listing?.make?.trim?.()) missing.push('make');
    if (!listing?.model?.trim?.()) missing.push('model');
    if (!listing?.year) missing.push('year');
    if (listing?.mileage === null || listing?.mileage === undefined) missing.push('mileage');
    if (!listing?.fuelType) missing.push('fuel type');
    if (!listing?.transmission) missing.push('transmission');
    if (!listing?.bodyType) missing.push('body type');
    if (!listing?.title || listing.title.trim().length < 5) missing.push('title');
    if (!listing?.location?.trim?.()) missing.push('location');
    if (!listing?.owners?.trim?.()) missing.push('previous keepers');
    if (!listing?.description?.trim?.()) missing.push('description');
    if (!listing?.condition) missing.push('condition');

    // These declarations are intentionally explicit booleans: false is a valid
    // answer and must never be treated as "missing".
    if (listing?.stolenRecovered === null || listing?.stolenRecovered === undefined) {
        missing.push('stolen/recovered declaration');
    }
    if (listing?.hasOutstandingFinance === null || listing?.hasOutstandingFinance === undefined) {
        missing.push('outstanding finance declaration');
    }
    if (listing?.isLegalRegisteredKeeper === null || listing?.isLegalRegisteredKeeper === undefined) {
        missing.push('registered keeper declaration');
    }
    if (
        listing?.isLegalRegisteredKeeper === false
        && !listing?.notOwnerRelationship?.trim?.()
    ) {
        missing.push('relationship/authority to sell');
    }
    if (
        listing?.isDepartedSale === true
        && !listing?.departedRelationship?.trim?.()
    ) {
        missing.push('estate/departed-sale relationship');
    }

    return missing;
}

export function getListingSubmissionReadiness(
    listing: any,
    _options: ListingReadinessOptions = {},
): ListingSubmissionReadiness {
    const missingFields = getListingSubmissionMissingFields(listing);

    return {
        ready: missingFields.length === 0,
        missingFields,
        missingHpi: false,
    };
}
