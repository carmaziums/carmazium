"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gavel, Send } from "lucide-react"
import { useDealerAccess } from "@/context/DealerAccessContext"

/**
 * "Bids & offers" is one destination with two views: live auction bids and
 * the retail offers this dealer has sent. Each view keeps its own page, data
 * and permission gate (VIEW_TRADE for bids, MANAGE_OFFERS for offers); this
 * switch only links them, so no team member sees anything new.
 */
const VIEWS = [
    { href: "/dashboard/dealer/bids", label: "Auction bids", icon: Gavel, permission: "VIEW_TRADE" },
    { href: "/dashboard/dealer/my-offers", label: "Retail offers", icon: Send, permission: "MANAGE_OFFERS" },
] as const

export function BidsOffersSwitch() {
    const pathname = usePathname()
    const { loading, hasPermission } = useDealerAccess()
    const views = VIEWS.filter(v => !loading && hasPermission(v.permission))
    if (views.length < 2) return null

    return (
        <nav aria-label="Bids and offers views" className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
            {views.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-black transition-colors ${active ? "bg-primary text-white" : "text-[var(--text-muted)] hover:text-primary"}`}
                    >
                        <Icon size={16} /> {label}
                    </Link>
                )
            })}
        </nav>
    )
}
