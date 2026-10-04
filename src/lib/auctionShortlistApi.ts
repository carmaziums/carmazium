import { apiClient } from "./apiClient"

export interface ShortlistedAuction {
    id: string
    listingId: string
    createdAt: string
    listing: {
        id: string
        title: string
        images: string[]
        make: string | null
        model: string | null
        year: number | null
        mileage: number | null
        status: string
        bids: Array<{ amount: string | number }>
        _count: { bids: number }
        auction: {
            id: string
            status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED"
            startTime: string
            endTime: string
            startingBid: string | number
            minIncrement: string | number
        } | null
    }
}

export interface AuctionShortlistResponse {
    success: boolean
    data: ShortlistedAuction[]
    pagination: { total: number; page: number; limit: number; totalPages: number }
}

/** Requires an authenticated, verified dealer (or administrator) account. */
export async function getAuctionShortlist(
    page = 1,
    limit = 12,
    view: "live" | "all" = "live",
): Promise<AuctionShortlistResponse> {
    return apiClient<AuctionShortlistResponse>(
        "/watchlist/auctions?page=" + page + "&limit=" + limit + "&view=" + view,
        { cache: "no-store" },
    )
}
