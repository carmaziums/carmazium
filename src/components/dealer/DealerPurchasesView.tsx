"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    Loader2, Package, Clock, FileSearch, CheckCircle2, Truck, LayoutList, Columns3, ChevronLeft, ChevronRight, RefreshCw,
    Search, Ban,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"
import {
    PipelineRow,
} from "@/components/dealer/PipelineRow"
import type { PurchaseItem, PurchaseStatus } from "@/components/dealer/PipelineRow"
import { apiClient } from "@/lib/apiClient"
import { getMyOffers, type Offer } from "@/lib/listingApi"
import { pendingRetailPurchases } from "@/lib/pendingRetailPurchases"
import { SaleCancellationModal } from "@/components/sales/SaleCancellationModal"
import { PurchaseDestinations } from "@/components/dealer/PurchaseDestinations"
import { CompletePurchaseButton } from "@/components/purchases/CompletePurchaseButton"
import { useDealerAccess } from "@/context/DealerAccessContext"
import {
    buyerCancelledSales, isPurchaseHistoryStatus, loadAllPages, matchesPurchaseSearch,
    PURCHASE_HISTORY_STATUSES, PURCHASE_MAX_PAGES, PURCHASE_PAGE_SIZE,
} from "@/lib/purchaseDestinations"
import {
    getMySaleCancellations, SALE_CANCELLATION_REASON_LABELS, type SaleCancellationRequest,
} from "@/lib/saleCancellationApi"

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
type StatusFilter = "all" | "pending_retail" | PurchaseStatus

/**
 * Shared by two separate destinations:
 *  - mode "all"     → /dashboard/dealer/purchases (All Purchases): every
 *    purchase and agreed retail deal at its current stage, with search and a
 *    Status filter, list or kanban.
 *  - mode "history" → /dashboard/dealer/purchases/history (Purchase History):
 *    completed purchases plus cancelled sales, as a record.
 * Statuses, fees and actions are identical in both; only what is shown differs.
 */
export function DealerPurchasesView({ mode }: { mode: "all" | "history" }) {
    const isHistory = mode === "history"
    const { user, profile, loading: authLoading } = useAuth()
    // Staff act for the dealership owner, whose id is on every Sale.
    const { access } = useDealerAccess()
    const dealershipBuyerId = access?.ownerUserId ?? user?.id
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
    const [query, setQuery] = React.useState("")
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
    const [cancelled, setCancelled] = React.useState<SaleCancellationRequest[]>([])
    const [cancelledError, setCancelledError] = React.useState(false)
    const [truncated, setTruncated] = React.useState(false)

    React.useEffect(() => {
        if (authLoading || !user) return
        let mounted = true
        setLoading(true)
        setLoadError(null)
        setOfferLoadError(false)

        // A retail counter-offer creates an accepted Offer before the seller
        // completes the transaction and creates a Sale. Both sources are needed
        // to show pending purchases without misclassifying them as sold.
        setCancelledError(false)
        Promise.allSettled([
            // Every page, so search and Purchase History cover older purchases.
            loadAllPages(page => apiClient<{ data: RawPurchaseItem[]; pagination?: { totalPages?: number } }>(
                `/dealers/purchases?page=${page}&limit=${PURCHASE_PAGE_SIZE}`, { cache: "no-store" },
            )),
            getMyOffers(),
            // Only Purchase History lists cancelled sales; an approved
            // cancellation deletes the Sale, so this is the remaining record.
            isHistory ? getMySaleCancellations("purchase-history") : Promise.resolve([] as SaleCancellationRequest[]),
        ]).then(([salesResult, offersResult, cancelledResult]) => {
            if (!mounted) return
            if (salesResult.status === "fulfilled") {
                setTruncated(salesResult.value.truncated)
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

            if (cancelledResult.status === "fulfilled") {
                setCancelled(cancelledResult.value)
            } else {
                setCancelledError(true)
            }
        }).finally(() => {
            if (mounted) setLoading(false)
        })

        return () => { mounted = false }
    }, [authLoading, user?.id, refreshVersion, isHistory])

    // Modal state
    const [cancelItem, setCancelItem] = React.useState<PurchaseItem | null>(null)

    const openPurchaseDetail = (item: PurchaseItem) => {
        router.push(`/dashboard/dealer/purchases/${encodeURIComponent(item.id)}`)
    }
    const openSellerDetails = (item: PurchaseItem) => {
        router.push(`/dashboard/dealer/purchases/${encodeURIComponent(item.id)}/seller`)
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // What this destination shows, before grouping. History keeps completed
    // stages only; search and the Status filter narrow either view.
    const visiblePurchases = React.useMemo(() => purchases.filter(p => {
        if (isHistory && !isPurchaseHistoryStatus(p.status)) return false
        if (statusFilter !== "all" && p.status !== statusFilter) return false
        return matchesPurchaseSearch(p, query)
    }), [purchases, isHistory, statusFilter, query])
    const narrowed = query.trim() !== "" || statusFilter !== "all"
    const stageOrder: PurchaseStatus[] = isHistory
        ? STATUS_ORDER.filter(s => (PURCHASE_HISTORY_STATUSES as readonly string[]).includes(s))
        : STATUS_ORDER
    const statusOptions = stageOrder.filter(s => statusFilter === s || purchases.some(p => p.status === s))

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
        visiblePurchases.forEach((p) => {
            groups[p.status].push(p)
        })
        return groups
    }, [visiblePurchases])

    const pendingRetail = React.useMemo(
        () => pendingRetailPurchases(acceptedOffers, purchases.map(p => p.listingId)),
        [acceptedOffers, purchases],
    )
    // Agreed retail deals are current work, so they belong to All Purchases only.
    const shownPendingRetail = isHistory || (statusFilter !== "all" && statusFilter !== "pending_retail")
        ? []
        : pendingRetail.filter(offer => matchesPurchaseSearch({
            id: offer.id, vehicleTitle: offer.listing?.title || "Retail vehicle",
        }, query))
    const shownCancelled = isHistory
        ? buyerCancelledSales(cancelled, dealershipBuyerId).filter(c => matchesPurchaseSearch({
            id: c.id, vehicleTitle: c.listing?.title || "Vehicle", vehicleSubtitle: c.listing?.vrm || undefined,
        }, query))
        : []
    // The purchase-history scope returns at most 500 records.
    const cancelledCapped = isHistory && cancelled.length >= 500
    const totalValue = visiblePurchases.reduce((sum, p) => sum + p.purchasePrice, 0)
    const stagesToShow = stageOrder.filter(s => statusFilter === "all" || s === statusFilter)
        // When searching or filtering, hide empty stages so matches are not
        // buried under "No items in this stage" boxes.
        .filter(s => !narrowed || grouped[s].length > 0)
    const nothingMatches = !loading && narrowed && visiblePurchases.length === 0
        && shownPendingRetail.length === 0 && shownCancelled.length === 0

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <PageHeader
                            title={isHistory ? "Purchase History" : "All Purchases"}
                            subHeader={isHistory
                                ? "Completed purchases and cancelled sales, kept as a record"
                                : "Every vehicle you have bought or agreed to buy, retail and auction, with its current status"}
                        />

                        {/* View Toggle */}
                        {!isHistory && (
                        <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl shrink-0 self-start md:self-auto">
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
                        )}
                    </div>

                    <PurchaseDestinations active={isHistory ? "history" : "all"} />

                    {/* Search and Status: one row on phones, nothing clipped. */}
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-2">
                        <label className="relative block">
                            <span className="sr-only">Search purchases</span>
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search vehicle, reg, seller or reference"
                                className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="sr-only">Status</span>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                                className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm font-semibold focus:border-primary focus:outline-none"
                            >
                                <option value="all">{isHistory ? "All completed" : "All statuses"}</option>
                                {!isHistory && (pendingRetail.length > 0 || statusFilter === "pending_retail") && (
                                    <option value="pending_retail">Sale Pending (retail offer)</option>
                                )}
                                {statusOptions.map(s => (
                                    <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-[var(--text-muted)]">
                            {isHistory
                                ? "Shows Purchased, Checks Complete and Delivery Requested. A delivery may still be on its way; open the purchase to track it. Earlier stages are under All Purchases."
                                : "Accepted retail offers appear below as sale pending until the seller completes the transaction."}
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
                    {isHistory ? (
                        <div className="grid grid-cols-3 gap-3">
                            <MetricCard label="Completed" value={visiblePurchases.length} icon={CheckCircle2} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" loading={loading} />
                            <MetricCard label="Cancelled" value={shownCancelled.length} icon={Ban} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" loading={loading} />
                            <MetricCard label="Total Value" value={`£${(totalValue / 1000).toFixed(0)}k`} icon={Package} color="text-primary" bg="bg-primary/10" border="border-primary/20" loading={loading} />
                        </div>
                    ) : (
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
                    )}

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

                    {truncated && !loading && (
                        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[var(--text-secondary)]">
                            Showing your latest {(PURCHASE_MAX_PAGES * PURCHASE_PAGE_SIZE).toLocaleString("en-GB")} purchases. Search covers these only.
                        </p>
                    )}
                    {cancelledCapped && !loading && (
                        <p role="status" className="text-xs text-[var(--text-muted)]">
                            Showing the latest 500 cancelled sales. All of them are under Cancelled Sales.
                        </p>
                    )}

                    {nothingMatches && (
                        <div className="dealer-glass-card p-8 text-center">
                            <p className="text-sm font-semibold">No purchases match your search or status.</p>
                            <button type="button" onClick={() => { setQuery(""); setStatusFilter("all") }} className="mt-3 min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold hover:border-primary/50">
                                Clear search and filter
                            </button>
                        </div>
                    )}

                    {!loading && shownPendingRetail.length > 0 && (
                        <section aria-labelledby="pending-retail-heading" className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Clock size={17} className="text-amber-400" />
                                <h2 id="pending-retail-heading" className="text-base font-black">
                                    Retail purchases — Sale Pending
                                </h2>
                                <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                                    {shownPendingRetail.length}
                                </span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)]">
                                The seller has accepted your offer and the car is reserved for you. Arrange inspection, payment and
                                collection with the seller. Once you have paid, either you or the seller can complete the sale.
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {shownPendingRetail.map(offer => (
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
                                        <CompletePurchaseButton listingId={offer.listingId} onCompleted={() => setRefreshVersion(v => v + 1)} />
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* List View */}
                    {!loading && (isHistory || viewMode === "list") && (
                        <div className="space-y-8">
                            {stagesToShow.map((status) => {
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
                                                        onViewSummary={openPurchaseDetail}
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
                    {!loading && !isHistory && viewMode === "kanban" && (
                        <div className="flex items-center justify-between gap-3 lg:hidden" aria-label="Kanban column navigation">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Swipe left or right to see all purchase stages</span>
                            <div className="flex shrink-0 items-center gap-2">
                                <button type="button" aria-label="Previous purchase stage" onClick={() => scrollKanban(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]"><ChevronLeft size={20} /></button>
                                <button type="button" aria-label="Next purchase stage" onClick={() => scrollKanban(1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]"><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    )}
                    {/* Kanban View: swipeable status columns on mobile, grid on desktop. */}
                    {!loading && !isHistory && viewMode === "kanban" && (
                        <div ref={kanbanScrollRef} className="flex gap-4 items-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-4 -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:overflow-visible" role="region" aria-label="Purchase pipeline board" tabIndex={0}>
                            {stagesToShow.map((status) => {
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
                                                    onViewSummary={openPurchaseDetail}
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

                    {/* Cancelled sales: the Sale row is removed on approval,
                        so the cancellation request is the lasting record. */}
                    {!loading && isHistory && (shownCancelled.length > 0 || cancelledError) && (
                        <section aria-labelledby="cancelled-sales-heading" className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Ban size={14} className="text-amber-400" />
                                </div>
                                <h2 id="cancelled-sales-heading" className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                                    Cancelled sales
                                </h2>
                                <span className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] text-xs font-bold text-[var(--text-muted)] tabular-nums">
                                    {shownCancelled.length}
                                </span>
                            </div>
                            {cancelledError && (
                                <p role="alert" className="text-sm text-amber-300">Cancelled sales could not be loaded. Please refresh.</p>
                            )}
                            <div className="space-y-2">
                                {shownCancelled.map(c => (
                                    <article key={c.id} className="dealer-glass-card flex flex-wrap items-center justify-between gap-3 p-4">
                                        <div className="min-w-0">
                                            <h3 className="font-bold break-words">{c.listing?.title || "Vehicle"}</h3>
                                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                                Cancelled {new Date(c.resolvedAt || c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                                {" · "}{SALE_CANCELLATION_REASON_LABELS[c.reason] ?? "Cancelled"}
                                                {c.buyerFeeRefunded ? " · Buyer fee refunded" : ""}
                                            </p>
                                        </div>
                                        <Link href="/dashboard/cancellations" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold hover:border-primary/50">
                                            View record
                                        </Link>
                                    </article>
                                ))}
                            </div>
                        </section>
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


        </div>
    )
}
