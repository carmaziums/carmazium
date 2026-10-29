"use client"

import * as React from "react"
import Link from "next/link"
import type { ComponentType } from "react"
import { CheckCircle2, ChevronRight, Gavel, Handshake, MessageSquare, Receipt, Tag } from "lucide-react"
import { useDealerAccess } from "@/context/DealerAccessContext"
import { useChat } from "@/context/ChatContext"
import { getPendingOffersCount } from "@/lib/listingApi"
import { getMyAuctions, getWonAuctions, type Auction } from "@/lib/auctionApi"
import { buildAttentionItems, type AttentionAuction, type AttentionKind } from "@/lib/dealerAttention"

const ICONS: Record<AttentionKind, ComponentType<{ size?: number; className?: string }>> = {
    provisional: Gavel,
    fee: Receipt,
    offers: Tag,
    handovers: Handshake,
    messages: MessageSquare,
}

/**
 * "Needs your attention" list for the top of the dealer home page.
 * It only links to existing pages; nothing is removed or replaced.
 */
export function DealerAttentionPanel() {
    const { loading: accessLoading, hasPermission } = useDealerAccess()
    const { unreadCount } = useChat()
    const [data, setData] = React.useState<{ pendingOffers: number; won: Auction[]; mine: Auction[] } | null>(null)
    const [failed, setFailed] = React.useState(false)
    const [checkedAt, setCheckedAt] = React.useState(0)

    const canManageOffers = hasPermission("MANAGE_OFFERS")
    const canViewPurchases = hasPermission("VIEW_PURCHASES")
    const canManageInventory = hasPermission("MANAGE_INVENTORY")

    React.useEffect(() => {
        if (accessLoading) return
        let cancelled = false
        // Each source fails independently, so one slow API never hides the rest.
        Promise.allSettled([
            canManageOffers ? getPendingOffersCount() : Promise.resolve(0),
            canViewPurchases ? getWonAuctions(1, 50) : Promise.resolve([] as Auction[]),
            canManageInventory ? getMyAuctions() : Promise.resolve([] as Auction[]),
        ]).then(([offers, won, mine]) => {
            if (cancelled) return
            setCheckedAt(Date.now())
            setFailed([offers, won, mine].every(r => r.status === "rejected"))
            setData({
                pendingOffers: offers.status === "fulfilled" ? offers.value : 0,
                won: won.status === "fulfilled" ? won.value : [],
                mine: mine.status === "fulfilled" ? mine.value : [],
            })
        })
        return () => { cancelled = true }
    }, [accessLoading, canManageOffers, canViewPurchases, canManageInventory])

    const items = data
        ? buildAttentionItems({
            now: checkedAt,
            pendingOffers: data.pendingOffers,
            unreadMessages: unreadCount,
            wonAuctions: data.won as unknown as AttentionAuction[],
            myAuctions: data.mine as unknown as AttentionAuction[],
            canManageOffers,
            canViewPurchases,
            canManageInventory,
        })
        : []

    return (
        <section aria-labelledby="dealer-attention-title" className="dealer-glass-card p-5 md:p-6 space-y-4">
            <div>
                <h2 id="dealer-attention-title" className="text-lg font-black font-heading uppercase tracking-tight">
                    Needs your attention
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">Your to-do list, most urgent first.</p>
            </div>

            {!data ? (
                <div className="space-y-2" aria-busy="true">
                    {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}
                </div>
            ) : failed ? (
                <p className="text-sm text-amber-500 font-semibold">
                    We couldn&apos;t check your to-do list just now. Your offers, auctions and messages are still available from the menu.
                </p>
            ) : items.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">You&apos;re all caught up. Nothing needs your attention right now.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {items.map(item => {
                        const Icon = ICONS[item.kind]
                        return (
                            <li key={item.key}>
                                <Link
                                    href={item.href}
                                    className={`group flex items-center gap-4 rounded-xl border p-4 transition-colors ${item.urgent
                                        ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
                                        : "border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary/30"}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.urgent ? "bg-amber-500/20" : "bg-primary/10"}`}>
                                        <Icon size={18} className={item.urgent ? "text-amber-500" : "text-primary"} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-[var(--text-primary)]">{item.title}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{item.detail}</p>
                                    </div>
                                    <span className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary shrink-0">
                                        {item.action} <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                    </span>
                                    <ChevronRight size={18} className="sm:hidden text-[var(--text-muted)] shrink-0" />
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}
