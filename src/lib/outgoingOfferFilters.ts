/** Shared offer status filtering for the private My Offers dashboard. */
export type OutgoingOfferView = "current" | "history" | "all" | "accepted" | "rejected" | "cancelled"

export const OUTGOING_OFFER_VIEWS: ReadonlyArray<{
    value: OutgoingOfferView
    label: string
    heading: string
}> = [
    { value: "current", label: "Current", heading: "Current Bids" },
    { value: "history", label: "History", heading: "Offer History" },
    { value: "all", label: "All", heading: "All Offers" },
    { value: "accepted", label: "Accepted", heading: "Accepted Offers" },
    { value: "rejected", label: "Rejected", heading: "Rejected Offers" },
    { value: "cancelled", label: "Cancelled", heading: "Cancelled / Withdrawn Offers" },
]

/**
 * "Cancelled" groups both system-cancelled offers and user-withdrawn offers.
 * Sale cancellation requests are a separate workflow, not an offer status.
 */
export function matchesOutgoingOfferView(status: string, view: OutgoingOfferView): boolean {
    switch (view) {
        case "current":
            return status === "PENDING" || status === "COUNTERED"
        case "history":
            return status !== "PENDING" && status !== "COUNTERED"
        case "accepted":
            return status === "ACCEPTED"
        case "rejected":
            return status === "REJECTED"
        case "cancelled":
            return status === "CANCELLED" || status === "WITHDRAWN"
        case "all":
            return true
    }
}

export function filterOutgoingOffers<T extends { status: string }>(
    offers: readonly T[], view: OutgoingOfferView,
): T[] {
    return offers.filter(offer => matchesOutgoingOfferView(offer.status, view))
}

export function outgoingOfferEmptyMessage(view: OutgoingOfferView): string {
    switch (view) {
        case "current": return "No current bids."
        case "history": return "No closed offer history yet."
        case "accepted": return "No accepted offers yet."
        case "rejected": return "No rejected offers."
        case "cancelled": return "No cancelled or withdrawn offers."
        case "all": return "No outgoing offers."
    }
}
