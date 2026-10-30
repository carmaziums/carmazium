"use client"

import Link from "next/link"
import type { ComponentType } from "react"
import { usePathname } from "next/navigation"
import { Flame, Gavel, ShoppingBag, Star, Tag, Trophy } from "lucide-react"
import type { DealerPermission } from "@/lib/dealerAccess"
import { useDealerAccess } from "@/context/DealerAccessContext"
import { bidsOffersTabHref } from "@/lib/dealerBidsOffersNavigation"

type BuyAndBidTab = {
    href: string
    label: string
    icon: ComponentType<{ size?: number; className?: string }>
    permission?: DealerPermission
    /** Other pages that belong to this tab (kept highlighted there). */
    activePaths?: string[]
}

/**
 * One tab bar for every page in the Buy & Bid area, so a dealer can move
 * between their auctions, live stock, bids and purchases without going back
 * to the menu. Previously only two of these pages had the bar, and it
 * disappeared as soon as the dealer opened My Bids or Purchases.
 *
 * Tabs a dealer's team role cannot open are hidden, matching the route
 * permission gates in app/dashboard/dealer/layout.tsx.
 */
export const BUY_AND_BID_TABS: BuyAndBidTab[] = [
    { href: "/dashboard/dealer/auctions", label: "My Auctions", icon: Gavel, permission: "VIEW_TRADE" },
    { href: "/auctions/browse", label: "Live Auctions", icon: Flame, permission: "VIEW_TRADE" },
    { href: "/dashboard/dealer/auctions/shortlisted", label: "Shortlisted", icon: Star, permission: "VIEW_TRADE" },
    { href: "/dashboard/dealer/bids", label: "Bids & offers", icon: Tag, permission: "VIEW_TRADE", activePaths: ["/dashboard/dealer/my-offers"] },
    { href: "/dashboard/dealer/auctions/won", label: "Auction Wins", icon: Trophy, permission: "VIEW_PURCHASES" },
    { href: "/dashboard/dealer/purchases", label: "All Purchases", icon: ShoppingBag, permission: "VIEW_PURCHASES" },
]

export function BuyAndBidTabs({ className = "" }: { className?: string }) {
    const pathname = usePathname()
    const { loading, hasPermission } = useDealerAccess()
    // The shared tab must stay reachable to MANAGE_OFFERS-only staff, without
    // linking them to the VIEW_TRADE-gated auction bids page.
    const bidsOffersHref = bidsOffersTabHref(
        loading || hasPermission("VIEW_TRADE"),
        loading || hasPermission("MANAGE_OFFERS"),
    )
    const tabs = BUY_AND_BID_TABS
        .filter(tab => tab.href === "/dashboard/dealer/bids"
            ? bidsOffersHref !== null
            : !tab.permission || loading || hasPermission(tab.permission))
        .map(tab => tab.href === "/dashboard/dealer/bids" && bidsOffersHref
            ? { ...tab, href: bidsOffersHref }
            : tab)

    return (
        <nav
            aria-label="Auction and buying navigation"
            className={`grid w-full grid-cols-3 gap-1 sm:flex sm:items-center sm:overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${className}`}
        >
            {tabs.map(tab => {
                const Icon = tab.icon
                const active = pathname === tab.href || !!tab.activePaths?.includes(pathname)
                return active ? (
                    <span
                        key={tab.href}
                        aria-current="page"
                        className="flex min-h-[52px] sm:min-h-[44px] shrink-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl bg-primary px-1.5 sm:px-4 py-2 sm:py-2.5 text-[11px] leading-tight sm:text-sm text-center font-black text-white shadow-sm"
                    >
                        <Icon size={16} /> {tab.label}
                    </span>
                ) : (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className="group flex min-h-[52px] sm:min-h-[44px] shrink-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-1.5 sm:px-4 py-2 sm:py-2.5 text-[11px] leading-tight sm:text-sm text-center font-black text-[var(--text-muted)] transition-all hover:bg-red-500/10 hover:text-primary"
                    >
                        <Icon size={16} className="transition-transform group-hover:scale-110" /> {tab.label}
                    </Link>
                )
            })}
        </nav>
    )
}
