export const AUCTION_OPENING_BID_RATIO = 0.70
export const AUCTION_RESERVE_GUIDE_LOW_RATIO = 0.90
export const AUCTION_RESERVE_GUIDE_HIGH_RATIO = 1.00
export const AUCTION_FIRST_OFFER_RATIO = 0.70
// Block 10 release gate: this shared first-offer contract is parity-checked against backend and native CI.

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


export function getAuctionFirstOfferFloor(startingBid: number, reservePrice: number): number {
    if (!Number.isFinite(startingBid) || startingBid <= 0) return 0
    if (!Number.isFinite(reservePrice) || reservePrice <= 0) return 0

    const referencePrice = Math.min(startingBid, reservePrice)
    return Math.round(referencePrice * AUCTION_FIRST_OFFER_RATIO * 100) / 100
}

export function getMinimumAuctionBid(params: {
    startingBid: number
    reservePrice: number
    minIncrement: number
    highestActiveBid?: number | null
}): number {
    const { startingBid, reservePrice, minIncrement, highestActiveBid } = params

    if (highestActiveBid != null) {
        if (!Number.isFinite(highestActiveBid) || highestActiveBid <= 0) return 0
        if (!Number.isFinite(minIncrement) || minIncrement <= 0) return 0
        return Math.round((highestActiveBid + minIncrement) * 100) / 100
    }

    return getAuctionFirstOfferFloor(startingBid, reservePrice)
}


/** Public, source-grounded price labels. An auction is NEVER priced using
 * Listing.price (the separate retail/valuation field). */
export interface AuctionDisplayFields {
    id?: string
    status?: string
    startingBid?: number | string | null
    currentBid?: number | string | null
    hasBids?: boolean
    reserveMet?: boolean
    buyItNowPrice?: number | string | null
}
export function getListingPricePresentation(listing: {
    type?: string | null
    price: number | string
    auction?: AuctionDisplayFields | null
}): { price: string; label: string; reserveLabel: string | null; buyItNowLabel: string | null } {
    const money = (amount: number | string) => {
        if (typeof amount === 'string' && /^£[0-9,.]+$/.test(amount.trim())) return amount.trim()
        const n = Number(amount)
        return Number.isFinite(n) ? '£' + n.toLocaleString('en-GB') : 'Price on request'
    }
    if (listing.type !== 'AUCTION') {
        return { price: money(listing.price), label: 'Retail asking price', reserveLabel: null, buyItNowLabel: null }
    }
    const a = listing.auction
    const value = a?.hasBids ? a?.currentBid : a?.startingBid
    const amount = value == null ? NaN : Number(value)
    const valid = Number.isFinite(amount) && amount > 0
    const bin = a?.buyItNowPrice == null ? NaN : Number(a.buyItNowPrice)
    return {
        price: valid ? money(amount) : 'View auction',
        label: a?.hasBids ? 'Current bid' : 'Starting bid',
        reserveLabel: valid && a?.reserveMet != null ? (a.reserveMet ? 'Reserve met' : 'Reserve not met') : null,
        buyItNowLabel: a?.status === 'ACTIVE' && Number.isFinite(bin) && bin > 0 ? 'Buy It Now ' + money(bin) : null,
    }
}
