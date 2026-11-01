/** Moderation-only price semantics: don't confuse retail asking prices with auction terms. */
export type ModerationChannel = 'ALL' | 'AUCTION' | 'CLASSIFIED'
type Money = number | string | null | undefined

export interface ModerationListing {
    type?: string | null
    price?: Money
    slug?: string | null
    id?: string
    auction?: {
        id?: string
        status?: string
        startingBid?: Money
        reservePrice?: Money
        buyItNowPrice?: Money
    } | null
    bids?: Array<{ amount: Money }> | null
}

const validMoney = (value: Money): number | null => {
    if (value == null || value === '') return null
    const amount = Number(value)
    return Number.isFinite(amount) && amount > 0 ? amount : null
}
const gbp = (value: number) => '£' + value.toLocaleString('en-GB', { maximumFractionDigits: 2 })

export function getModerationChannel(listing: ModerationListing): 'Auction' | 'Retail' | 'Unknown' {
    if (listing.type === 'AUCTION') return 'Auction'
    if (listing.type === 'CLASSIFIED') return 'Retail'
    return 'Unknown'
}

export function getModerationPrice(listing: ModerationListing): {
    value: string
    label: string
    detail: string | null
    buyNow: string | null
} {
    if (listing.type === 'AUCTION') {
        const startingBid = validMoney(listing.auction?.startingBid)
        const highestBid = validMoney(listing.bids?.[0]?.amount)
        const price = highestBid ?? startingBid
        const reserve = validMoney(listing.auction?.reservePrice)
        const bin = validMoney(listing.auction?.buyItNowPrice)
        return {
            value: price == null ? 'Auction terms unavailable' : gbp(price),
            label: highestBid == null ? 'Starting bid' : 'Current bid',
            detail: reserve == null ? null : 'Reserve ' + gbp(reserve),
            buyNow: bin == null ? null : 'Buy It Now ' + gbp(bin),
        }
    }
    const retail = validMoney(listing.price)
    return {
        value: retail == null ? 'Price not set' : gbp(retail),
        label: listing.type === 'CLASSIFIED' ? 'Retail asking price' : 'Price (unclassified)',
        detail: null,
        buyNow: null,
    }
}

/** Details open their actual sales channel; old auction links must not look retail. */
export function getModerationListingHref(listing: ModerationListing): string {
    if (listing.type === 'AUCTION' && listing.auction?.id) {
        return '/auctions/live/' + encodeURIComponent(listing.auction.id)
    }
    return (listing.type === 'AUCTION' ? '/vehicle/' : '/buy-cars/') +
        encodeURIComponent(listing.slug || listing.id || '')
}


/** The original record date is immutable. Historic public go-live time is
 * not universally persisted, so do not misrepresent an updatedAt timestamp
 * or an auction startTime as a verified first publication or relist. */
export function getModerationListingDates(listing: {
    firstListingRecordAt?: string | Date | null
    createdAt?: string | Date | null
    lastRelistedAt?: string | Date | null
}): { firstListed: string | null; lastRelisted: string | null } {
    const format = (value: string | Date | null | undefined): string | null => {
        if (!value) return null
        const date = value instanceof Date ? value : new Date(value)
        if (!Number.isFinite(date.getTime())) return null
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Europe/London',
        }).format(date)
    }
    return {
        firstListed: format(listing.firstListingRecordAt ?? listing.createdAt),
        lastRelisted: format(listing.lastRelistedAt),
    }
}
