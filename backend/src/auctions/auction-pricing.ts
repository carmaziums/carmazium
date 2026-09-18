export const AUCTION_OPENING_BID_RATIO = 0.70;
export const AUCTION_RESERVE_GUIDE_LOW_RATIO = 0.85;
export const AUCTION_RESERVE_GUIDE_HIGH_RATIO = 0.92;

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
