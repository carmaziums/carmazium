export const AUCTION_OPENING_BID_RATIO = 0.70;
export const AUCTION_RESERVE_GUIDE_LOW_RATIO = 0.90;
export const AUCTION_RESERVE_GUIDE_HIGH_RATIO = 1.00;
export const AUCTION_FIRST_OFFER_RATIO = 0.70;
export const AUCTION_DURATION_HOURS = 24;
export const AUCTION_DURATION_MS = AUCTION_DURATION_HOURS * 60 * 60 * 1000;

export function calculatePlatformOpeningBid(marketValue: number): number {
    if (!Number.isFinite(marketValue) || marketValue <= 0) {
        throw new Error('Market value must be a positive number');
    }
    return Math.round(marketValue * AUCTION_OPENING_BID_RATIO * 100) / 100;
}

export function calculateReserveGuide(marketValue: number): { low: number; high: number } {
    if (!Number.isFinite(marketValue) || marketValue <= 0) {
        throw new Error('Market value must be a positive number');
    }
    return {
        low: Math.round(marketValue * AUCTION_RESERVE_GUIDE_LOW_RATIO * 100) / 100,
        high: Math.round(marketValue * AUCTION_RESERVE_GUIDE_HIGH_RATIO * 100) / 100,
    };
}


export function calculateFirstOfferFloor(startingBid: number, reservePrice: number): number {
    if (!Number.isFinite(startingBid) || startingBid <= 0) {
        throw new Error('Starting bid must be a positive number');
    }
    if (!Number.isFinite(reservePrice) || reservePrice <= 0) {
        throw new Error('Reserve price must be a positive number');
    }

    // Starting bid is a platform guide, not a real dealer bid.
    // When there are no active dealer bids, use whichever seller/platform
    // threshold is lower, then allow an opening offer up to 30% below it.
    const referencePrice = Math.min(startingBid, reservePrice);
    return Math.round(referencePrice * AUCTION_FIRST_OFFER_RATIO * 100) / 100;
}

export function calculateMinimumAuctionBid(params: {
    startingBid: number;
    reservePrice: number;
    minIncrement: number;
    highestActiveBid?: number | null;
}): number {
    const { startingBid, reservePrice, minIncrement, highestActiveBid } = params;

    if (highestActiveBid != null) {
        if (!Number.isFinite(highestActiveBid) || highestActiveBid <= 0) {
            throw new Error('Highest active bid must be a positive number');
        }
        if (!Number.isFinite(minIncrement) || minIncrement <= 0) {
            throw new Error('Minimum increment must be a positive number');
        }
        return Math.round((highestActiveBid + minIncrement) * 100) / 100;
    }

    return calculateFirstOfferFloor(startingBid, reservePrice);
}
