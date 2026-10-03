/** Seller auction inputs that must survive page refresh and HPI checkout. */
export interface SellerAuctionDraft {
    startTime: string
    reservePrice: string
    startingBid: string
    minIncrement: string
    buyItNowPrice: string
}

export const EMPTY_SELLER_AUCTION_DRAFT: SellerAuctionDraft = {
    startTime: "",
    reservePrice: "",
    startingBid: "",
    minIncrement: "100",
    buyItNowPrice: "",
}

export function parseSellerAuctionDraft(raw: string | null): SellerAuctionDraft | null {
    if (!raw || raw.length > 1400) return null
    try {
        const value = JSON.parse(raw)
        const keys: (keyof SellerAuctionDraft)[] = [
            "startTime", "reservePrice", "startingBid", "minIncrement", "buyItNowPrice",
        ]
        if (!value || keys.some(k => typeof value[k] !== "string" || value[k].length > 64)) return null
        return Object.fromEntries(keys.map(k => [k, value[k]])) as unknown as SellerAuctionDraft
    } catch {
        return null
    }
}

export function sellerAuctionDraftReady(draft: SellerAuctionDraft | null, now = Date.now()): boolean {
    if (!draft) return false
    if (draft.startTime !== "NOW") {
        const startMs = new Date(draft.startTime).getTime()
        if (!Number.isFinite(startMs) || startMs < now + 60_000) return false
    }
    for (const key of ["reservePrice", "startingBid", "minIncrement"] as const) {
        const amount = Number(draft[key])
        if (!draft[key].trim() || !Number.isFinite(amount) || amount <= 0) return false
    }
    if (draft.buyItNowPrice && (!Number.isFinite(Number(draft.buyItNowPrice))
        || Number(draft.buyItNowPrice) <= 0)) return false
    return true
}
