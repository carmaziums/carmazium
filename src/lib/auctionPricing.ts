export const AUCTION_OPENING_BID_RATIO = 0.70
export const AUCTION_RESERVE_GUIDE_LOW_RATIO = 0.85
export const AUCTION_RESERVE_GUIDE_HIGH_RATIO = 0.92

export function getAuctionOpeningBid(marketValue: number): number {
    if (!Number.isFinite(marketValue) || marketValue <= 0) return 0
    return Math.round(marketValue * AUCTION_OPENING_BID_RATIO * 100) / 100
}

export function getAuctionReserveGuide(marketValue: number): { low: number; high: number } {
    if (!Number.isFinite(marketValue) || marketValue <= 0) return { low: 0, high: 0 }
    return {
        low: Math.round(marketValue * AUCTION_RESERVE_GUIDE_LOW_RATIO * 100) / 100,
        high: Math.round(marketValue * AUCTION_RESERVE_GUIDE_HIGH_RATIO * 100) / 100,
    }
}
