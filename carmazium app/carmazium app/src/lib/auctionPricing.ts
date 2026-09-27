export const AUCTION_OPENING_BID_RATIO = 0.70;
export const AUCTION_RESERVE_GUIDE_LOW_RATIO = 0.90;
export const AUCTION_RESERVE_GUIDE_HIGH_RATIO = 1.00;
export const AUCTION_FIRST_OFFER_RATIO = 0.70;

export function getAuctionOpeningBid(marketValue: number): number {
  if (!Number.isFinite(marketValue) || marketValue <= 0) return 0;
  return Math.round(marketValue * AUCTION_OPENING_BID_RATIO * 100) / 100;
}

export function getAuctionReserveGuide(marketValue: number): { low: number; high: number } {
  if (!Number.isFinite(marketValue) || marketValue <= 0) return { low: 0, high: 0 };
  return {
    low: Math.round(marketValue * AUCTION_RESERVE_GUIDE_LOW_RATIO * 100) / 100,
    high: Math.round(marketValue * AUCTION_RESERVE_GUIDE_HIGH_RATIO * 100) / 100,
  };
}


export function getAuctionFirstOfferFloor(startingBid: number, reservePrice: number): number {
  if (!Number.isFinite(startingBid) || startingBid <= 0) return 0;
  if (!Number.isFinite(reservePrice) || reservePrice <= 0) return 0;

  const referencePrice = Math.min(startingBid, reservePrice);
  return Math.round(referencePrice * AUCTION_FIRST_OFFER_RATIO * 100) / 100;
}

export function getMinimumAuctionBid(params: {
  startingBid: number;
  reservePrice: number;
  minIncrement: number;
  highestActiveBid?: number | null;
}): number {
  const { startingBid, reservePrice, minIncrement, highestActiveBid } = params;

  if (highestActiveBid != null) {
    if (!Number.isFinite(highestActiveBid) || highestActiveBid <= 0) return 0;
    if (!Number.isFinite(minIncrement) || minIncrement <= 0) return 0;
    return Math.round((highestActiveBid + minIncrement) * 100) / 100;
  }

  return getAuctionFirstOfferFloor(startingBid, reservePrice);
}
