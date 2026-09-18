export const HPI_REQUIRED_FROM = new Date('2026-09-19T00:00:00.000Z');

export function listingRequiresHpi(createdAt: Date | string | null | undefined): boolean {
    if (!createdAt) return true;
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return !Number.isNaN(created.getTime()) && created >= HPI_REQUIRED_FROM;
}

export function getListingSubmissionMissingFields(listing: any): string[] {
    const missing: string[] = [];

    if (!Array.isArray(listing?.images) || listing.images.length < 10) missing.push('at least 10 photos');
    if (!listing?.vrm) missing.push('VRM');
    if (!listing?.make) missing.push('make');
    if (!listing?.model) missing.push('model');
    if (!listing?.year) missing.push('year');
    if (listing?.mileage === null || listing?.mileage === undefined) missing.push('mileage');
    if (!listing?.fuelType) missing.push('fuel type');
    if (!listing?.transmission) missing.push('transmission');
    if (!listing?.bodyType) missing.push('body type');
    if (!listing?.title || listing.title.trim().length < 5) missing.push('title');
    if (!listing?.location?.trim()) missing.push('location');
    if (!listing?.owners?.trim()) missing.push('previous keepers');
    if (!listing?.description?.trim()) missing.push('description');
    if (!listing?.condition) missing.push('condition');

    if (listing?.stolenRecovered === null || listing?.stolenRecovered === undefined) {
        missing.push('stolen/recovered declaration');
    }
    if (listing?.hasOutstandingFinance === null || listing?.hasOutstandingFinance === undefined) {
        missing.push('outstanding finance declaration');
    }
    if (listing?.isLegalRegisteredKeeper === null || listing?.isLegalRegisteredKeeper === undefined) {
        missing.push('registered keeper declaration');
    }
    if (listing?.isLegalRegisteredKeeper === false && !listing?.notOwnerRelationship?.trim()) {
        missing.push('relationship/authority to sell');
    }
    if (listing?.isDepartedSale && !listing?.departedRelationship?.trim()) {
        missing.push('estate/departed-sale relationship');
    }

    return missing;
}
