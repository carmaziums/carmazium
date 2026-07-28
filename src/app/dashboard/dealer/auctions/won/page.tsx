"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
    Loader2, Trophy, Car, MessageSquare, CreditCard, CheckCircle2, XCircle,
    Clock, FileSearch, ChevronRight, AlertTriangle, Gavel,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { useAuth } from "@/context/AuthContext"
import { getWonAuctions, type Auction } from "@/lib/auctionApi"

// ─── Status derivation ────────────────────────────────────────────────────────
//
// Each stage below maps 1:1 to backend state on the Auction row so a buyer can
// always see exactly where they are in the flow they started when they won.

type HandoverStage =
    | "fee_due"           // won but hasn't paid the £125 buyer fee yet
    | "awaiting_seller"   // fee paid, seller hasn't uploaded handover proof
    | "under_review"      // proof uploaded, admin hasn't reviewed
    | "complete"          // admin approved, sellerBonusReleased = true
    | "denied"            // admin denied — refund on the way (or errored, admin alerted)

function stageFor(a: Auction): HandoverStage {
    if (!a.buyerFeePaid) return "fee_due"
    if (a.sellerBonusReleased) return "complete"
    // Denial clears handoverProofUrl AND handoverSubmittedAt. If those are null
    // but the buyer fee was paid, we're back in "awaiting seller" or "denied".
    // The two are only distinguishable by whether a stripeRefundError was set
    // (kept on the record for admin visibility). Absent that, treat missing
    // proof-after-fee as awaiting seller — same practical UX for the buyer.
    if (a.handoverSubmittedAt) return "under_review"
    return "awaiting_seller"
}

const STAGE_LABELS: Record<HandoverStage, { label: string; hint: string; icon: React.ComponentType<{ size?: number; className?: string }>; tint: string }> = {
    fee_due: {
        label: "£125 fee due",
        hint: "Pay to unlock messaging & handover.",
        icon: CreditCard,
        tint: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    },
    awaiting_seller: {
        label: "Awaiting seller proof",
        hint: "Seller has to submit handover proof — you can chat while you wait.",
        icon: Clock,
        tint: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    },
    under_review: {
        label: "Under review",
        hint: "Seller has submitted handover proof. Our team is reviewing it.",
        icon: FileSearch,
        tint: "bg-violet-500/10 text-violet-400 border-violet-500/25",
    },
    complete: {
        label: "Handover complete",
        hint: "Verified and closed. The seller has been paid the £100 bonus.",
        icon: CheckCircle2,
        tint: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    },
    denied: {
        label: "Denied — refund on the way",
        hint: "The submitted proof wasn't accepted. £100 of your fee is being refunded.",
        icon: XCircle,
        tint: "bg-red-500/10 text-red-400 border-red-500/25",
    },
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function WonAuctionRow({ auction }: { auction: Auction }) {
    const l = auction.listing
    const stage = stageFor(auction)
    const s = STAGE_LABELS[stage]
    const winAmount = Number(auction.winningBidAmount ?? 0)
    const image = l.images?.[0] ?? "/assets/images/hero-bg.png"
    const seller = l.seller
    const sellerName = seller?.dealerProfile?.companyName
        || `${seller?.firstName ?? ""} ${seller?.lastName ?? ""}`.trim()
        || "Seller"

    return (
        <div className="dealer-glass-card p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Image */}
                <div className="relative w-full md:w-40 h-32 md:h-24 rounded-xl overflow-hidden shrink-0 bg-black/30">
                    <Image src={image} alt={l.title} fill sizes="(max-width: 768px) 100vw, 160px" className="object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-[var(--text-primary)] truncate">{l.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] mt-1">
                        {l.year && <span className="font-bold">{l.year}</span>}
                        {l.mileage != null && <span>{Number(l.mileage).toLocaleString()} mi</span>}
                        <span className="opacity-40">·</span>
                        <span>Sold by <span className="text-[var(--text-primary)] font-bold">{sellerName}</span></span>
                    </div>

                    {/* Stage + hint */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${s.tint}`}>
                            <s.icon size={11} /> {s.label}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{s.hint}</span>
                    </div>
                </div>

                {/* Amounts + CTA */}
                <div className="flex md:flex-col items-end md:items-end justify-between md:justify-center gap-2 shrink-0 md:w-56">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Winning bid</p>
                        <p className="text-lg font-black text-amber-400">£{winAmount.toLocaleString()}</p>
                    </div>

                    {stage === "fee_due" ? (
                        <Link
                            href={`/checkout?listing_id=${auction.listingId}&mode=auction_fee`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-colors"
                        >
                            <CreditCard size={12} /> Pay £125 Fee
                        </Link>
                    ) : (
                        <Link
                            href={`/auctions/won/${auction.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-bold hover:bg-primary/5 dark:hover:bg-white/5 transition-colors"
                        >
                            <MessageSquare size={12} /> Open Handover
                            <ChevronRight size={12} />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WonAuctionsPage() {
    const { user, loading: authLoading } = useAuth()
    const [auctions, setAuctions] = React.useState<Auction[] | null>(null)
    const [loadError, setLoadError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (authLoading || !user) return
        getWonAuctions()
            .then(setAuctions)
            .catch(() => setLoadError("Couldn't load your won auctions."))
    }, [authLoading, user])

    const grouped = React.useMemo(() => {
        if (!auctions) return null
        const buckets: Record<HandoverStage, Auction[]> = {
            fee_due: [],
            awaiting_seller: [],
            under_review: [],
            complete: [],
            denied: [],
        }
        for (const a of auctions) buckets[stageFor(a)].push(a)
        return buckets
    }, [auctions])

    const isLoading = authLoading || auctions === null
    const isEmpty = !isLoading && !loadError && auctions !== null && auctions.length === 0

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" />
                <main className="flex-1 space-y-6">
                    <PageHeader
                        title="Won Auctions"
                        subHeader="Everything you've won — track your handover from fee to completion"
                    />

                    {isLoading ? (
                        <div className="dealer-glass-card p-16 flex items-center justify-center">
                            <Loader2 size={22} className="animate-spin text-primary" />
                        </div>
                    ) : loadError ? (
                        <div className="dealer-glass-card p-10 flex flex-col items-center gap-3 text-center">
                            <AlertTriangle size={28} className="text-red-400" />
                            <p className="text-sm text-[var(--text-primary)] font-bold">{loadError}</p>
                        </div>
                    ) : isEmpty ? (
                        <div className="dealer-glass-card p-14 flex flex-col items-center gap-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-input)] flex items-center justify-center border border-[var(--border-default)]">
                                <Trophy size={22} className="text-[var(--text-muted)]" />
                            </div>
                            <div>
                                <p className="text-base font-black text-[var(--text-primary)]">No wins yet</p>
                                <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">
                                    Auctions you win will show up here with your handover status —
                                    fee due, awaiting seller proof, under review, or complete.
                                </p>
                            </div>
                            <Link
                                href="/auctions"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 hover:text-primary transition-colors"
                            >
                                <Gavel size={13} /> Browse live auctions
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {(["fee_due", "under_review", "awaiting_seller", "complete", "denied"] as HandoverStage[]).map((stage) => {
                                const list = grouped?.[stage] ?? []
                                if (list.length === 0) return null
                                const s = STAGE_LABELS[stage]
                                return (
                                    <section key={stage}>
                                        <div className="flex items-baseline justify-between mb-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <s.icon size={13} className={s.tint.split(" ")[1]} />
                                                <h2 className="text-xs font-black uppercase tracking-widest">{s.label}</h2>
                                            </div>
                                            <span className="text-xs text-[var(--text-muted)] font-bold">{list.length}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {list.map(a => <WonAuctionRow key={a.id} auction={a} />)}
                                        </div>
                                    </section>
                                )
                            })}
                        </div>
                    )}

                    {/* Legend / footnote */}
                    {auctions && auctions.length > 0 && (
                        <div className="dealer-glass-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1.5"><Car size={12} /> Winning bid is paid directly to the seller, not through Carmazium.</span>
                            <span className="flex items-center gap-1.5"><CreditCard size={12} /> £125 buyer fee is Carmazium&apos;s fee — refundable up to £100 if handover is denied.</span>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
