export const HPI_REQUIRED_FROM = new Date('2026-09-19T00:00:00.000Z');

export interface ListingReadinessOptions {
    /**
     * Whether this listing has an HPI request that satisfies the submission gate.
     * A linked AUCTION may satisfy this via the active linked retail source's HPI.
     */
    hasRequiredHpi?: boolean;
    /**
     * Force HPI for a newly-created derivative listing even if its source listing
     * predates the rollout. Used when cloning an old ACTIVE retail listing into a
     * brand-new linked auction.
     */
    forceHpi?: boolean;
}

export interface ListingSubmissionReadiness {
    ready: boolean;
    missingFields: string[];
    missingHpi: boolean;
}

export function listingRequiresHpi(
    createdAt: Date | string | null | undefined,
    forceHpi = false,
): boolean {
    if (forceHpi) return true;
    if (!createdAt) return true;

    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(created.getTime())) return true;

    return created >= HPI_REQUIRED_FROM;
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
    options: ListingReadinessOptions = {},
): ListingSubmissionReadiness {
    const missingFields = getListingSubmissionMissingFields(listing);
    const missingHpi = listingRequiresHpi(listing?.createdAt, options.forceHpi)
        && options.hasRequiredHpi !== true;

    return {
        ready: missingFields.length === 0 && !missingHpi,
        missingFields,
        missingHpi,
    };
}
