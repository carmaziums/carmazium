import { getSellerAuctionStage } from "@/lib/auctionSellerStage"
import { PROVISIONAL_WINDOW_MS, ukDateTime, type AttentionAuction } from "@/lib/dealerAttention"

/**
 * Rules for the buyer/seller home "Needs your attention" list
 * (/dashboard/user?tab=overview).
 *
 * Pure function (no React, no network) so it can be tested directly. Every
 * item links to the page where the existing action already lives; the list
 * never performs an action itself and replaces nothing.
 */

export type UserAttentionKind =
    | "provisional"
    | "handover"
    | "incomingOffers"
    | "counterOffers"
    | "deliveryRequests"
    | "messages"

export type UserAttentionItem = {
    key: string
    kind: UserAttentionKind
    title: string
    detail: string
    href: string
    action: string
    urgent?: boolean
}

function vehicleName(auction: AttentionAuction): string {
    const l = auction.listing
    return [l?.year, l?.make, l?.model].filter(Boolean).join(" ") || l?.title || "your car"
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)))

export function buildUserAttentionItems(input: {
    now: number
    myAuctions: AttentionAuction[]
    incomingOffers: number
    counterOffersAwaitingMe: number
    pendingDeliveryRequests: number
    unreadMessages: number
}): UserAttentionItem[] {
    const items: UserAttentionItem[] = []

    // 1. Auction ended below reserve: the seller has 72 hours to accept or decline.
    for (const a of input.myAuctions) {
        const offeredAt = a.provisionalOfferedAt ? new Date(a.provisionalOfferedAt).getTime() : NaN
        if (
            a.status === "ENDED" && !a.winnerId && a.provisionalOfferBidId
            && Number.isFinite(offeredAt) && input.now < offeredAt + PROVISIONAL_WINDOW_MS
        ) {
            items.push({
                key: `provisional-${a.id}`,
                kind: "provisional",
                title: `Decide on the offer for your ${vehicleName(a)}`,
                detail: `Your auction ended below your reserve. Accept or decline the highest offer before ${ukDateTime(new Date(offeredAt + PROVISIONAL_WINDOW_MS).toISOString())}, or it expires.`,
                href: `/auctions/live/${a.id}`,
                action: "Review offer",
                urgent: true,
            })
        }
    }

    // 2. Sold at auction: the seller has the next handover step.
    const handovers = input.myAuctions.filter(a => {
        const stage = getSellerAuctionStage(a)
        return stage === "ARRANGE_INSPECTION_PAYMENT" || stage === "READY_FOR_HANDOVER" || stage === "CORRECT_PROOF"
    })
    if (handovers.length > 0) {
        items.push({
            key: "handover",
            kind: "handover",
            title: plural(handovers.length, "Your sold car needs your next step", "{n} sold cars need your next step"),
            detail: "Confirm the buyer has paid you, hand the car over, then upload the handover photo to receive your £100 bonus.",
            href: "/dashboard/seller/auctions",
            action: "Continue",
            urgent: true,
        })
    }

    // 3. Offers on the seller's cars waiting for a reply.
    if (input.incomingOffers > 0) {
        items.push({
            key: "incomingOffers",
            kind: "incomingOffers",
            title: plural(input.incomingOffers, "1 buyer offer is waiting for your reply", "{n} buyer offers are waiting for your reply"),
            detail: "Accept, decline or make a counter-offer.",
            href: "/dashboard/user?tab=offers",
            action: "Reply",
        })
    }

    // 4. Sellers countered the buyer's offers.
    if (input.counterOffersAwaitingMe > 0) {
        items.push({
            key: "counterOffers",
            kind: "counterOffers",
            title: plural(input.counterOffersAwaitingMe, "A seller replied to your offer with a new price", "{n} sellers replied to your offers with a new price"),
            detail: "Accept the new price, decline it or change your offer.",
            href: "/dashboard/user?tab=bids",
            action: "Respond",
        })
    }

    // 5. Buyers asked the seller to arrange delivery.
    if (input.pendingDeliveryRequests > 0) {
        items.push({
            key: "deliveryRequests",
            kind: "deliveryRequests",
            title: plural(input.pendingDeliveryRequests, "1 buyer asked you about delivery", "{n} buyers asked you about delivery"),
            detail: "Accept or decline each delivery request.",
            href: "/dashboard/seller/offers",
            action: "Review",
        })
    }

    // 6. Unread messages.
    if (input.unreadMessages > 0) {
        items.push({
            key: "messages",
            kind: "messages",
            title: plural(input.unreadMessages, "1 unread message", "{n} unread messages"),
            detail: "From buyers, sellers and CarMazium support.",
            href: "/dashboard/user?tab=messages",
            action: "Open",
        })
    }

    return items
}
