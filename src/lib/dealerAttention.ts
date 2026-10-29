import { getSellerAuctionStage, type SellerAuctionProgressInput } from "@/lib/auctionSellerStage"

/**
 * Rules for the dealer home "Needs your attention" list.
 *
 * Pure function (no React, no network) so it can be tested directly. Every item
 * links to the page where the existing action already lives; the list never
 * performs an action itself and never replaces any existing page.
 */

export const PROVISIONAL_WINDOW_MS = 72 * 60 * 60 * 1000

export type AttentionKind = "provisional" | "fee" | "offers" | "handovers" | "messages"

export type AttentionItem = {
    key: string
    kind: AttentionKind
    title: string
    detail: string
    href: string
    action: string
    urgent?: boolean
}

export type AttentionAuction = SellerAuctionProgressInput & {
    id: string
    winnerId?: string | null
    provisionalOfferBidId?: string | null
    provisionalOfferedAt?: string | null
    buyerFeeDeadlineAt?: string | null
    listing?: { title?: string | null; make?: string | null; model?: string | null; year?: number | null } | null
}

function vehicleName(auction: AttentionAuction): string {
    const l = auction.listing
    return [l?.year, l?.make, l?.model].filter(Boolean).join(" ") || l?.title || "your vehicle"
}

export function ukDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function buildAttentionItems(input: {
    now: number
    pendingOffers: number
    unreadMessages: number
    wonAuctions: AttentionAuction[]
    myAuctions: AttentionAuction[]
    canManageOffers: boolean
    canViewPurchases: boolean
    canManageInventory: boolean
}): AttentionItem[] {
    const items: AttentionItem[] = []

    // 1. Provisional below-reserve offers on the dealer's own auctions (72h to decide).
    if (input.canManageInventory) {
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
                    detail: `The highest bid was below your reserve. Accept or decline before ${ukDateTime(new Date(offeredAt + PROVISIONAL_WINDOW_MS).toISOString())}, or it expires.`,
                    href: `/auctions/live/${a.id}`,
                    action: "Review offer",
                    urgent: true,
                })
            }
        }
    }

    // 2. Auction wins with the £125 buyer fee still due.
    if (input.canViewPurchases) {
        for (const a of input.wonAuctions) {
            if (a.status === "ENDED" && !a.buyerFeePaid && !a.buyerRefusedAt && a.buyerFeeDeadlineAt) {
                items.push({
                    key: `fee-${a.id}`,
                    kind: "fee",
                    title: `Pay the £125 buyer fee for the ${vehicleName(a)}`,
                    detail: `You won this auction. Pay by ${ukDateTime(a.buyerFeeDeadlineAt)} to keep the vehicle and unlock the seller's contact details.`,
                    href: "/dashboard/dealer/auctions/won",
                    action: "Pay fee",
                    urgent: true,
                })
            }
        }
    }

    // 3. Retail offers waiting for a reply.
    if (input.canManageOffers && input.pendingOffers > 0) {
        items.push({
            key: "offers",
            kind: "offers",
            title: input.pendingOffers === 1
                ? "1 buyer offer is waiting for your reply"
                : `${input.pendingOffers} buyer offers are waiting for your reply`,
            detail: "Accept, decline or counter each offer.",
            href: "/dashboard/dealer/offers",
            action: "Reply",
        })
    }

    // 4. Sold auctions where the seller (this dealer) has the next handover step.
    if (input.canManageInventory) {
        const handovers = input.myAuctions.filter(a => {
            const stage = getSellerAuctionStage(a)
            return stage === "ARRANGE_INSPECTION_PAYMENT" || stage === "READY_FOR_HANDOVER" || stage === "CORRECT_PROOF"
        })
        if (handovers.length > 0) {
            items.push({
                key: "handovers",
                kind: "handovers",
                title: handovers.length === 1
                    ? "1 sold auction needs your next step"
                    : `${handovers.length} sold auctions need your next step`,
                detail: "Confirm payment, hand the vehicle over, then upload the handover proof.",
                href: "/dashboard/dealer/auctions#handover-section",
                action: "Continue",
            })
        }
    }

    // 5. Unread messages.
    if (input.unreadMessages > 0) {
        items.push({
            key: "messages",
            kind: "messages",
            title: input.unreadMessages === 1 ? "1 unread message" : `${input.unreadMessages} unread messages`,
            detail: "Customers and CarMazium support.",
            href: "/dashboard/dealer/messages",
            action: "Open",
        })
    }

    return items
}
