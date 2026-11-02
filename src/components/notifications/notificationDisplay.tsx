import * as React from "react"
import {
    Bell, Tag, CheckCircle, XCircle, RefreshCw,
    MessageSquare, BadgeCheck, CreditCard, MinusCircle,
    Gavel, Trophy, Timer, Zap, TrendingDown, ShieldCheck, AlertCircle,
} from "lucide-react"
import type { AppNotification } from "@/lib/notificationsApi"

// Shared by the header bell and the full notifications page, so both show
// the same icons and send a click to the same place.

const ICON_MAP: Record<string, React.ReactNode> = {
    // Offers
    OFFER_RECEIVED:        <Tag size={14} className="text-amber-400" />,
    OFFER_ACCEPTED:        <CheckCircle size={14} className="text-emerald-400" />,
    OFFER_REJECTED:        <XCircle size={14} className="text-red-400" />,
    OFFER_COUNTERED:       <RefreshCw size={14} className="text-blue-400" />,
    OFFER_WITHDRAWN:       <MinusCircle size={14} className="text-[var(--text-muted)]" />,
    // Messages
    NEW_MESSAGE:           <MessageSquare size={14} className="text-blue-400" />,
    MESSAGE_RECEIVED:      <MessageSquare size={14} className="text-blue-400" />,
    // Deals / listings
    DEAL_CLOSED:           <CheckCircle size={14} className="text-emerald-400" />,
    LISTING_SOLD:          <BadgeCheck size={14} className="text-emerald-400" />,
    FINANCE_UPDATE:        <CreditCard size={14} className="text-purple-400" />,
    // Auctions
    AUCTION_BID:           <Gavel size={14} className="text-orange-400" />,
    AUCTION_BID_PLACED:    <Gavel size={14} className="text-orange-400" />,
    AUCTION_OUTBID:        <TrendingDown size={14} className="text-red-400" />,
    AUCTION_WON:           <Trophy size={14} className="text-amber-400" />,
    AUCTION_ENDED:         <Gavel size={14} className="text-[var(--text-muted)]" />,
    AUCTION_ENDED_NO_SALE: <AlertCircle size={14} className="text-[var(--text-muted)]" />,
    AUCTION_STARTED:       <Zap size={14} className="text-emerald-400" />,
    AUCTION_ENDING_SOON:   <Timer size={14} className="text-amber-400" />,
    AUCTION_CANCELLED:     <XCircle size={14} className="text-red-400" />,
    AUCTION_RESERVE_MET:   <ShieldCheck size={14} className="text-emerald-400" />,
}

export function notificationIconFor(type: string): React.ReactNode {
    return ICON_MAP[type] ?? <Bell size={14} className="text-[var(--text-muted)]" />
}

/** Map legacy dashboard URLs to unified `/dashboard/user` tab deep-links */
export function normalizeNotificationHref(href: string): string {
    if (!href.startsWith("/")) return href
    if (href.startsWith("/dashboard/user")) return href
    if (href.startsWith("/dashboard/buyer/offers")) return "/dashboard/user?tab=bids"
    if (href.startsWith("/dashboard/seller/offers")) return "/dashboard/user?tab=offers"
    if (href.startsWith("/dashboard/buyer/messages")) {
        const m = href.match(/[?&]room=([^&]+)/)
        return m ? `/dashboard/user?tab=messages&room=${decodeURIComponent(m[1])}` : "/dashboard/user?tab=messages"
    }
    // Legacy admin KYC notifications used a route that never existed in the
    // Next.js app. Keep old notifications working after the backend link is fixed.
    if (href === "/admin/kyc") return "/dashboard/admin/dealer-verification"
    if (href === "/dashboard" || href === "/dashboard/") return "/dashboard/user?tab=overview"
    return href
}

/** "5m ago" for recent items; a date for anything older than a week. */
export function notificationTimeLabel(dateStr: string, now = Date.now()): string {
    const created = new Date(dateStr).getTime()
    const diff = now - created
    const m = Math.floor(diff / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(created).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** Where a notification click should take this user. */
export function resolveNotificationHref(n: AppNotification, role?: string | null): string {
    const dataObj = (typeof n.data === "object" && n.data) ? n.data as Record<string, unknown> : {}
    const fromDataLink = typeof dataObj.link === "string" ? dataObj.link : null
    const fromTopLink = typeof n.link === "string" ? n.link : null
    let href = fromDataLink || fromTopLink

    if (!href && typeof dataObj.roomId === "string") {
        href = `/dashboard/user?tab=messages&room=${dataObj.roomId}`
    }

    // Auction notification routing — navigate to the live auction room
    if (n.type.startsWith("AUCTION_")) {
        const auctionId = typeof dataObj.auctionId === "string" ? dataObj.auctionId : n.entityId
        if (n.type === "AUCTION_WON" && auctionId) {
            // Only bidding-eligible (DEALER) accounts can win, and the individual
            // /auctions/won/[id] page immediately bounces anyone who hasn't paid
            // the £125 fee yet back to the now-closed live auction — a dead end
            // right when a winner clicks in. The list view always has a working
            // "Pay the fee" action instead, regardless of payment state.
            return "/dashboard/dealer/auctions/won"
        }
        if (auctionId && (
            n.type === "AUCTION_BID" ||
            n.type === "AUCTION_BID_PLACED" ||
            n.type === "AUCTION_OUTBID" ||
            n.type === "AUCTION_ENDED" ||
            n.type === "AUCTION_STARTED" ||
            n.type === "AUCTION_ENDING_SOON" ||
            n.type === "AUCTION_RESERVE_MET"
        )) {
            return `/auctions/live/${auctionId}`
        }
        if (n.type === "AUCTION_ENDED_NO_SALE" || n.type === "AUCTION_CANCELLED") {
            // These go to the auction's seller, who may be a plain "seller"
            // account or a dealer selling via auction — each has its own
            // dashboard shell, so route to whichever one they actually have.
            return role === "DEALER" ? "/dashboard/dealer/auctions" : "/dashboard/seller/auctions"
        }
    }

    if (href) return normalizeNotificationHref(href)

    const eType = n.entityType ?? undefined
    const eId = n.entityId ?? undefined
    if (eType === "AUCTION" && eId) return `/auctions/live/${eId}`
    if (eType === "LISTING" && eId) return "/dashboard/user?tab=inventory"
    if (eType === "OFFER" && eId) {
        return n.type === "OFFER_COUNTERED" ? "/dashboard/user?tab=bids" : "/dashboard/user?tab=offers"
    }
    if (n.type === "DEAL_CLOSED") return "/dashboard/user?tab=offers"
    if (n.type === "MESSAGE_RECEIVED" || n.type === "NEW_MESSAGE") return "/dashboard/user?tab=messages"
    if (n.type.startsWith("OFFER_")) return "/dashboard/user?tab=offers"
    return "/dashboard/user?tab=overview"
}
