"use client"

import * as React from "react"
import Link from "next/link"
import type { ComponentType } from "react"
import { CheckCircle2, ChevronRight, Gavel, Handshake, MessageSquare, Repeat, Tag, Truck } from "lucide-react"
import { getMyAuctions, type Auction } from "@/lib/auctionApi"
import { getReceivedDeliveryRequests } from "@/lib/deliveryApi"
import type { UnifiedDashboardData } from "@/lib/listingApi"
import type { AttentionAuction } from "@/lib/dealerAttention"
import { buildUserAttentionItems, type UserAttentionKind } from "@/lib/userAttention"

const ICONS: Record<UserAttentionKind, ComponentType<{ size?: number; className?: string }>> = {
    provisional: Gavel,
    handover: Handshake,
    incomingOffers: Tag,
    counterOffers: Repeat,
    deliveryRequests: Truck,
    messages: MessageSquare,
}

/**
 * "Needs your attention" list for the buyer/seller dashboard home.
 * Counts for offers and messages come from the dashboard summary that the
 * page already loads; auctions and delivery requests are fetched here and
 * fail independently, so one slow API never hides the rest.
 */
export function UserAttentionPanel({ data, loading }: { data: UnifiedDashboardData | null; loading: boolean }) {
    const [extra, setExtra] = React.useState<{ auctions: Auction[]; deliveryPending: number } | null>(null)

    React.useEffect(() => {
        let cancelled = false
        Promise.allSettled([getMyAuctions(), getReceivedDeliveryRequests()]).then(([auctions, deliveries]) => {
            if (cancelled) return
            setExtra({
                auctions: auctions.status === "fulfilled" ? auctions.value : [],
                deliveryPending: deliveries.status === "fulfilled"
                    ? deliveries.value.filter(request => request.status === "PENDING").length
                    : 0,
            })
        })
        return () => { cancelled = true }
    }, [])

    const ready = !loading && extra !== null
    const items = ready
        ? buildUserAttentionItems({
            now: Date.now(),
            myAuctions: extra.auctions as unknown as AttentionAuction[],
            incomingOffers: data?.seller?.incomingOffers ?? 0,
            counterOffersAwaitingMe: data?.buyer?.counteredOffersPending ?? 0,
            pendingDeliveryRequests: extra.deliveryPending,
            unreadMessages: data?.unreadMessages ?? 0,
        })
        : []

    return (
        <section aria-labelledby="user-attention-title" className="glass-card p-5 md:p-6 border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl space-y-4">
            <div>
                <h3 id="user-attention-title" className="text-lg font-black font-heading uppercase tracking-tight">
                    Needs your attention
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Your to-do list, most urgent first.</p>
            </div>

            {!ready ? (
                <div className="space-y-2" aria-busy="true">
                    {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}
                </div>
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
