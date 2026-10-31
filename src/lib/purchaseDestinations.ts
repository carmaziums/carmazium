/**
 * The three Buy-side purchase destinations a dealer can move between.
 * Kept free of React so the node tests and the web/app parity guard can
 * read it directly.
 *
 *  - Auction Wins: vehicles won through dealer auctions.
 *  - All Purchases: every recorded auction and retail purchase plus agreed
 *    retail deals, at whatever stage it is, with search and a Status filter.
 *  - Purchase History: finished purchases and cancelled sales, as a record.
 *
 * All three need VIEW_PURCHASES, which the dealer layout already enforces
 * for every /dashboard/dealer/purchases/* and /auctions/won page.
 */
export const PURCHASE_DESTINATIONS = [
    { id: "wins", href: "/dashboard/dealer/auctions/won", label: "Auction Wins" },
    { id: "all", href: "/dashboard/dealer/purchases", label: "All Purchases" },
    { id: "history", href: "/dashboard/dealer/purchases/history", label: "Purchase History" },
] as const

export type PurchaseDestinationId = typeof PURCHASE_DESTINATIONS[number]["id"]

/**
 * Stages that mean the purchase itself is finished on CarMazium's side:
 * a recorded retail sale ("Purchased"), checks complete, or delivery
 * requested. Earlier stages (awaiting confirmation, sale confirmed,
 * reviewing documents) are still being worked on and stay in All Purchases
 * only. This is a view filter; it never changes a purchase's status.
 */
export const PURCHASE_HISTORY_STATUSES = ["sold", "checks_complete", "delivery_requested"] as const

export function isPurchaseHistoryStatus(status: string): boolean {
    return (PURCHASE_HISTORY_STATUSES as readonly string[]).includes(status)
}

export interface SearchablePurchase {
    id: string
    vehicleTitle: string
    vehicleSubtitle?: string
    sellerName?: string
}

/** Case-insensitive match on vehicle, registration/subtitle, seller or reference. */
export function matchesPurchaseSearch(item: SearchablePurchase, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const compact = q.replace(/\s+/g, "")
    const fields = [item.vehicleTitle, item.vehicleSubtitle, item.sellerName, item.id]
    return fields.some(field => {
        if (!field) return false
        const value = field.toLowerCase()
        return value.includes(q) || value.replace(/\s+/g, "").includes(compact)
    })
}

export interface CancellationLike {
    status: string
    buyerId?: string | null
}

/**
 * Approved cancellations where this account was the buyer. An approved
 * cancellation deletes the Sale row, so the cancellation request is the only
 * remaining record of that purchase. Requests where the dealer was the
 * seller, or that are still pending, declined or withdrawn, are excluded.
 */
export function buyerCancelledSales<T extends CancellationLike>(requests: T[], userId: string | undefined): T[] {
    if (!userId) return []
    return requests.filter(r => r.status === "APPROVED" && r.buyerId === userId)
}
