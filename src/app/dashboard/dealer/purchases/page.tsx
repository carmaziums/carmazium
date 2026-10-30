"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    Loader2, Package, Clock, FileSearch, CheckCircle2, Truck, LayoutList, Columns3, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"
import {
    PipelineRow,
    ModalOverlay,
} from "@/components/dealer/PipelineRow"
import type { PurchaseItem, PurchaseStatus } from "@/components/dealer/PipelineRow"
import { apiClient } from "@/lib/apiClient"
import { getMyOffers, type Offer } from "@/lib/listingApi"
import { pendingRetailPurchases } from "@/lib/pendingRetailPurchases"
import { SaleCancellationModal } from "@/components/sales/SaleCancellationModal"

const DB_STATUS_MAP: Record<string, PurchaseStatus> = {
    AWAITING_CONFIRMATION: "awaiting_confirmation",
    REVIEWING_DOCS: "reviewing_docs",
    CHECKS_COMPLETE: "checks_complete",
    DELIVERY_REQUESTED: "delivery_requested",
}

const STATUS_ORDER: PurchaseStatus[] = [
    "awaiting_confirmation",
    "sale_confirmed",
    "sold",
    "reviewing_docs",
    "checks_complete",
    "delivery_requested",
]

const STATUS_LABELS: Record<PurchaseStatus, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
    awaiting_confirmation: { label: "Awaiting Confirmation", icon: Clock, color: "text-amber-400" },
    sale_confirmed: { label: "Sale Confirmed", icon: CheckCircle2, color: "text-emerald-400" },
    sold: { label: "Purchased", icon: CheckCircle2, color: "text-emerald-400" },
    reviewing_docs: { label: "Reviewing Docs", icon: FileSearch, color: "text-blue-400" },
    checks_complete: { label: "Checks Complete", icon: CheckCircle2, color: "text-emerald-400" },
    delivery_requested: { label: "Delivery Requested", icon: Truck, color: "text-violet-400" },
}

type RawPurchaseItem = Omit<PurchaseItem, "status"> & { status: string }

type ViewMode = "list" | "kanban"

export default function DealerPurchasesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<ViewMode>("list")
    const kanbanScrollRef = React.useRef<HTMLDivElement>(null)
    const scrollKanban = (direction: -1 | 1) => {
        const board = kanbanScrollRef.current
        if (!board) return
        const column = board.querySelector<HTMLElement>("[data-kanban-column]")
        const distance = (column?.getBoundingClientRect().width ?? board.clientWidth * 0.85) + 16
        board.scrollBy({ left: direction * distance, behavior: "smooth" })
    }
    const [purchases, setPurchases] = React.useState<PurchaseItem[]>([])
    const [acceptedOffers, setAcceptedOffers] = React.useState<Offer[]>([])
    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [offerLoadError, setOfferLoadError] = React.useState(false)
    const [refreshVersion, setRefreshVersion] = React.useState(0)

    React.useEffect(() => {
        if (authLoading || !user) return
        let mounted = true
        setLoading(true)
        setLoadError(null)
        setOfferLoadError(false)

        // A retail counter-offer creates an accepted Offer before the seller
        // completes the transaction and creates a Sale. Both sources are needed
        // to show pending purchases without misclassifying them as sold.
        Promise.allSettled([
            apiClient<{ data: RawPurchaseItem[]; total: number }>("/dealers/purchases?limit=100", {
                cache: "no-store",
            }),
            getMyOffers(),
        ]).then(([salesResult, offersResult]) => {
            if (!mounted) return
            if (salesResult.status === "fulfilled") {
                setPurchases(salesResult.value.data.map(item => ({
                    ...item,
                    status: item.status === "AWAITING_CONFIRMATION" && item.retailSold
                        ? "sold"
                        : item.status === "AWAITING_CONFIRMATION" && item.offerAccepted
                            ? "sale_confirmed"
                            : (DB_STATUS_MAP[item.status] ?? "awaiting_confirmation"),
                })))
            } else {
                setLoadError("Purchase records could not be loaded. Please retry.")
            }

            if (offersResult.status === "fulfilled") {
                setAcceptedOffers(offersResult.value)
            } else {
                setOfferLoadError(true)
            }
        }).finally(() => {
            if (mounted) setLoading(false)
        })

        return () => { mounted = false }
    }, [authLoading, user?.id, refreshVersion])

    // Modal state
    const [summaryItem, setSummaryItem] = React.useState<PurchaseItem | null>(null)
    const [cancelItem, setCancelItem] = React.useState<PurchaseItem | null>(null)

    const openSellerDetails = (item: PurchaseItem) => {
        router.push(`/dashboard/dealer/purchases/${encodeURIComponent(item.id)}/seller`)
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // Group by status
    const grouped = React.useMemo(() => {
        const groups: Record<PurchaseStatus, PurchaseItem[]> = {
            awaiting_confirmation: [],
            sale_confirmed: [],
            sold: [],
            reviewing_docs: [],
            checks_complete: [],
            delivery_requested: [],
        }
        purchases.forEach((p) => {
            groups[p.status].push(p)
        })
        return groups
    }, [purchases])

    const pendingRetail = React.useMemo(
        () => pendingRetailPurchases(acceptedOffers, purchases.map(p => p.listingId)),
        [acceptedOffers, purchases],
    )
    const totalValue = purchases.reduce((sum, p) => sum + p.purchasePrice, 0)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <PageHeader
                            title="Purchase History"
                            subHeader="Every vehicle you have bought, retail and auction, and its progress"
                        />

                        {/* View Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl shrink-0">
                            <button
                                onClick={() => setViewMode("list")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    viewMode === "list"
                                        ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                        : "text-[var(--text-muted)] hover:text-primary dark:hover:text-white hover:bg-white/[0.04]"
                                }`}
                            >
                                <LayoutList size={14} /> List
                            </button>
                            <button
                                onClick={() => setViewMode("kanban")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    viewMode === "kanban"
                                        ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                        : "text-[var(--text-muted)] hover:text-primary dark:hover:text-white hover:bg-white/[0.04]"
                                }`}
                            >
                                <Columns3 size={14} /> Kanban
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-[var(--text-muted)]">
                            Accepted retail offers appear below as sale pending until the seller completes the transaction.
                        </p>
                        <button
                            type="button"
                            onClick={() => setRefreshVersion(v => v + 1)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-semibold hover:border-primary/50 disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                            Refresh purchases
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link href="/dashboard/cancellations" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold hover:border-primary/50">Cancelled Sales</Link>
                    </div>


                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Recorded Purchases"
                            value={purchases.length}
                            icon={Package}
                            color="text-primary"
                            bg="bg-primary/10"
                            border="border-primary/20"
                            statusLabel="Pipeline"
                            loading={loading}
                        />
                        <MetricCard
                            label="Awaiting"
                            value={grouped.awaiting_confirmation.length}
                            icon={Clock}
                            color="text-amber-400"
                            bg="bg-amber-500/10"
                            border="border-amber-500/20"
                            loading={loading}
                        />
                        <MetricCard
                            label="In Progress"
                            value={grouped.reviewing_docs.length + grouped.checks_complete.length}
                            icon={FileSearch}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            loading={loading}
                        />
                        <MetricCard
                            label="Pipeline Value"
                            value={`£${(totalValue / 1000).toFixed(0)}k`}
                            icon={Truck}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Total"
                            foilValue
                            loading={loading}
                        />
                    </div>

                    {/* Loading skeleton */}
                    {loading && (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}

                    {(loadError || offerLoadError) && !loading && (
                        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                            {loadError || "Pending retail offers could not be loaded. Please retry."}
                        </div>
                    )}

                    {!loading && pendingRetail.length > 0 && (
                        <section aria-labelledby="pending-retail-heading" className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Clock size={17} className="text-amber-400" />
                                <h2 id="pending-retail-heading" className="text-base font-black">
                                    Retail purchases — Sale Pending
                                </h2>
                                <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                                    {pendingRetail.length}
                                </span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)]">
                                Your accepted offers appear here immediately. These are agreed deals, not completed sales.
                                Contact the seller to arrange inspection, payment and collection.
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {pendingRetail.map(offer => (
                                    <article key={offer.id} className="dealer-glass-card p-4 md:p-5 space-y-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold break-words">{offer.listing?.title || "Retail vehicle"}</h3>
                                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                                    Accepted {new Date(offer.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                                </p>
                                            </div>
                                            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                                                Sale Pending
                                            </span>
                                        </div>
                                        <p className="text-lg font-black tabular-nums">
                                            £{Number(offer.finalAmount ?? offer.counterAmount ?? offer.amount).toLocaleString("en-GB")}
                                        </p>
                                        <Link
                                            href="/dashboard/buyer/offers"
                                            className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                                        >
                                            View accepted offer and contact seller
                                        </Link>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* List View */}
                    {!loading && viewMode === "list" && (
                        <div className="space-y-8">
                            {STATUS_ORDER.map((status) => {
                                const items = grouped[status]
                                const config = STATUS_LABELS[status]
                                const Icon = config.icon

                                return (
                                    <div key={status}>
                                        {/* Section Header */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-1.5 rounded-lg ${config.color.replace("text-", "bg-").replace("400", "500/10")} border ${config.color.replace("text-", "border-").replace("400", "500/20")}`}>
                                                <Icon size={14} className={config.color} />
                                            </div>
                                            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                                                {config.label}
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] text-xs font-bold text-[var(--text-muted)] tabular-nums">
                                                {items.length}
                                            </span>
                                        </div>

                                        {/* Items */}
                                        {items.length === 0 ? (
                                            <div className="dealer-glass-card p-8 text-center">
                                                <p className="text-gray-600 text-sm">No items in this stage</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {items.map((item) => (
                                                    <PipelineRow
                                                        key={item.id}
                                                        item={item}
                                                        onViewSummary={setSummaryItem}
                                                        onViewSeller={openSellerDetails}
                                                        onRequestCancellation={setCancelItem}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Visible navigation hints on mobile, in addition to touch swiping. */}
                    {!loading && viewMode === "kanban" && (
                        <div className="flex items-center justify-between gap-3 lg:hidden" aria-label="Kanban column navigation">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Swipe left or right to see all purchase stages</span>
                            <div className="flex shrink-0 items-center gap-2">
                                <button type="button" aria-label="Previous purchase stage" onClick={() => scrollKanban(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]"><ChevronLeft size={20} /></button>
                                <button type="button" aria-label="Next purchase stage" onClick={() => scrollKanban(1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]"><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    )}
                    {/* Kanban View: swipeable status columns on mobile, grid on desktop. */}
                    {!loading && viewMode === "kanban" && (
                        <div ref={kanbanScrollRef} className="flex gap-4 items-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-4 -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:overflow-visible" role="region" aria-label="Purchase pipeline board" tabIndex={0}>
                            {STATUS_ORDER.map((status) => {
                                const items = grouped[status]
                                const config = STATUS_LABELS[status]
                                const Icon = config.icon

                                return (
                                    <div key={status} data-kanban-column className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-3 min-h-[200px] w-[min(85vw,340px)] shrink-0 snap-start lg:w-full lg:min-w-0">
                                        {/* Column Header */}
                                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-default)]">
                                            <Icon size={14} className={config.color} />
                                            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex-1">
                                                {config.label}
                                            </span>
                                            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-md text-xs font-black tabular-nums bg-[var(--bg-card)] text-[var(--text-muted)]`}>
                                                {items.length}
                                            </span>
                                        </div>

                                        {/* Cards */}
                                        <div className="space-y-3">
                                            {items.map((item) => (
                                                <PipelineRow
                                                    key={item.id}
                                                    item={item}
                                                    onViewSummary={setSummaryItem}
                                                    onViewSeller={openSellerDetails}
                                                    onRequestCancellation={setCancelItem}
                                                />
                                            ))}
                                            {items.length === 0 && (
                                                <div className="py-8 text-center">
                                                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Empty</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>

            {cancelItem && (
                <SaleCancellationModal
                    listingId={cancelItem.listingId}
                    vehicleTitle={cancelItem.vehicleTitle}
                    onClose={() => setCancelItem(null)}
                    onCreated={() => {}}
                />
            )}

            {/* Purchase Summary Modal */}
            <ModalOverlay
                open={!!summaryItem}
                onClose={() => setSummaryItem(null)}
                title="Purchase Summary"
            >
                {summaryItem && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
                                <Package size={24} className="text-gray-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black">{summaryItem.vehicleTitle}</h3>
                                {summaryItem.vehicleSubtitle && (
                                    <p className="text-sm text-[var(--text-muted)]">{summaryItem.vehicleSubtitle}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 rounded-xl p-4 border border-[var(--border-default)]">
                                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-1">Purchase Price</span>
                                <span className="text-xl font-black text-[var(--text-primary)] tabular-nums">£{summaryItem.purchasePrice.toLocaleString()}</span>
                            </div>
                            <div className="bg-black/20 rounded-xl p-4 border border-[var(--border-default)]">
                                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-1">Purchase Date</span>
                                <span className="text-sm font-bold">
                                    {new Date(summaryItem.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                            </div>
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 border border-[var(--border-default)]">
                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-1">Current Status</span>
                            <span className={`inline-flex items-center gap-2 text-sm font-bold ${
                                STATUS_LABELS[summaryItem.status].color
                            }`}>
                                {React.createElement(STATUS_LABELS[summaryItem.status].icon, { size: 14 })}
                                {STATUS_LABELS[summaryItem.status].label}
                            </span>
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 border border-[var(--border-default)]">
                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-1">Reference</span>
                            {/* Short, readable reference; the full record ID stays in the tooltip for support. */}
                            <span className="text-sm text-[var(--text-secondary)] font-mono" title={summaryItem.id}>
                                {summaryItem.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                            </span>
                        </div>

                        {summaryItem.estimatedDelivery && (
                            <div className="bg-violet-500/5 rounded-xl p-4 border border-violet-500/10">
                                <span className="text-xs font-bold uppercase tracking-widest text-violet-400 block mb-1">Estimated Delivery</span>
                                <span className="text-sm font-bold text-violet-300">
                                    {new Date(summaryItem.estimatedDelivery).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </ModalOverlay>

        </div>
    )
}
