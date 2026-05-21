"use client"

import * as React from "react"
import {
    Loader2, Package, Clock, FileSearch, CheckCircle2, Truck, LayoutList, Columns3,
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

const DB_STATUS_MAP: Record<string, PurchaseStatus> = {
    AWAITING_CONFIRMATION: "awaiting_confirmation",
    REVIEWING_DOCS: "reviewing_docs",
    CHECKS_COMPLETE: "checks_complete",
    DELIVERY_REQUESTED: "delivery_requested",
}

const STATUS_ORDER: PurchaseStatus[] = [
    "awaiting_confirmation",
    "reviewing_docs",
    "checks_complete",
    "delivery_requested",
]

const STATUS_LABELS: Record<PurchaseStatus, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
    awaiting_confirmation: { label: "Awaiting Confirmation", icon: Clock, color: "text-amber-400" },
    reviewing_docs: { label: "Reviewing Docs", icon: FileSearch, color: "text-blue-400" },
    checks_complete: { label: "Checks Complete", icon: CheckCircle2, color: "text-emerald-400" },
    delivery_requested: { label: "Delivery Requested", icon: Truck, color: "text-violet-400" },
}

type ViewMode = "list" | "kanban"

export default function DealerPurchasesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<ViewMode>("list")
    const [purchases, setPurchases] = React.useState<PurchaseItem[]>([])

    React.useEffect(() => {
        if (authLoading || !user) return
        setLoading(true)
        apiClient<{ data: any[]; total: number }>("/dealers/purchases?limit=100")
            .then((res) => {
                setPurchases(
                    res.data.map((item) => ({
                        ...item,
                        status: DB_STATUS_MAP[item.status] ?? "awaiting_confirmation",
                    }))
                )
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [authLoading, user])

    // Modal state
    const [summaryItem, setSummaryItem] = React.useState<PurchaseItem | null>(null)
    const [sellerItem, setSellerItem] = React.useState<PurchaseItem | null>(null)

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // Group by status
    const grouped = React.useMemo(() => {
        const groups: Record<PurchaseStatus, PurchaseItem[]> = {
            awaiting_confirmation: [],
            reviewing_docs: [],
            checks_complete: [],
            delivery_requested: [],
        }
        purchases.forEach((p) => {
            groups[p.status].push(p)
        })
        return groups
    }, [purchases])

    const totalValue = purchases.reduce((sum, p) => sum + p.purchasePrice, 0)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <PageHeader
                            title="Purchases"
                            subHeader="Post-acquisition fulfillment pipeline"
                        />

                        {/* View Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-slate-800/80 border border-white/[0.06] rounded-xl shrink-0">
                            <button
                                onClick={() => setViewMode("list")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    viewMode === "list"
                                        ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                            >
                                <LayoutList size={14} /> List
                            </button>
                            <button
                                onClick={() => setViewMode("kanban")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    viewMode === "kanban"
                                        ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                            >
                                <Columns3 size={14} /> Kanban
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Total Purchases"
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
                                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                                {config.label}
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-gray-500 tabular-nums">
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
                                                        onViewSeller={setSellerItem}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Kanban View */}
                    {!loading && viewMode === "kanban" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                            {STATUS_ORDER.map((status) => {
                                const items = grouped[status]
                                const config = STATUS_LABELS[status]
                                const Icon = config.icon

                                return (
                                    <div key={status} className="bg-slate-800/30 border border-white/[0.04] rounded-2xl p-4 min-h-[200px]">
                                        {/* Column Header */}
                                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                                            <Icon size={14} className={config.color} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex-1">
                                                {config.label}
                                            </span>
                                            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-md text-[9px] font-black tabular-nums bg-white/5 text-gray-500`}>
                                                {items.length}
                                            </span>
                                        </div>

                                        {/* Cards */}
                                        <div className="space-y-3">
                                            {items.map((item) => (
                                                <div key={item.id} className="dealer-glass-card p-4 group">
                                                    <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                                                        {item.vehicleTitle}
                                                    </h4>
                                                    {item.vehicleSubtitle && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.vehicleSubtitle}</p>
                                                    )}
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                                        <span className="text-sm font-black text-white tabular-nums">
                                                            £{item.purchasePrice.toLocaleString()}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setSummaryItem(item)}
                                                                className="text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-white/5"
                                                            >
                                                                Details
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Docs progress for reviewing */}
                                                    {item.status === "reviewing_docs" && item.documentsReceived !== undefined && item.documentsTotal !== undefined && (
                                                        <div className="mt-2.5 pt-2.5 border-t border-white/5">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Documents</span>
                                                                <span className="text-[9px] font-bold text-blue-400 tabular-nums">{item.documentsReceived}/{item.documentsTotal}</span>
                                                            </div>
                                                            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-blue-400 rounded-full transition-all"
                                                                    style={{ width: `${(item.documentsReceived / item.documentsTotal) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ETA for delivery */}
                                                    {item.status === "delivery_requested" && item.estimatedDelivery && (
                                                        <div className="mt-2.5 pt-2.5 border-t border-white/5">
                                                            <div className="flex items-center gap-1.5">
                                                                <Truck size={10} className="text-violet-400" />
                                                                <span className="text-[9px] font-bold text-violet-400">
                                                                    ETA: {new Date(item.estimatedDelivery).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {items.length === 0 && (
                                                <div className="py-8 text-center">
                                                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Empty</p>
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

            {/* Purchase Summary Modal */}
            <ModalOverlay
                open={!!summaryItem}
                onClose={() => setSummaryItem(null)}
                title="Purchase Summary"
            >
                {summaryItem && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-slate-700 border border-white/5 flex items-center justify-center shrink-0">
                                <Package size={24} className="text-gray-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">{summaryItem.vehicleTitle}</h3>
                                {summaryItem.vehicleSubtitle && (
                                    <p className="text-sm text-gray-400">{summaryItem.vehicleSubtitle}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Purchase Price</span>
                                <span className="text-xl font-black text-white tabular-nums">£{summaryItem.purchasePrice.toLocaleString()}</span>
                            </div>
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Purchase Date</span>
                                <span className="text-sm font-bold text-white">
                                    {new Date(summaryItem.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                            </div>
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Current Status</span>
                            <span className={`inline-flex items-center gap-2 text-sm font-bold ${
                                STATUS_LABELS[summaryItem.status].color
                            }`}>
                                {React.createElement(STATUS_LABELS[summaryItem.status].icon, { size: 14 })}
                                {STATUS_LABELS[summaryItem.status].label}
                            </span>
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Reference</span>
                            <span className="text-sm text-gray-300 font-mono">{summaryItem.id}</span>
                        </div>

                        {summaryItem.estimatedDelivery && (
                            <div className="bg-violet-500/5 rounded-xl p-4 border border-violet-500/10">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 block mb-1">Estimated Delivery</span>
                                <span className="text-sm font-bold text-violet-300">
                                    {new Date(summaryItem.estimatedDelivery).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </ModalOverlay>

            {/* Seller Details Modal */}
            <ModalOverlay
                open={!!sellerItem}
                onClose={() => setSellerItem(null)}
                title="Seller Details"
            >
                {sellerItem && (
                    <div className="space-y-5">
                        <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg">
                                    {sellerItem.sellerName?.charAt(0) || "S"}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">{sellerItem.sellerName}</h3>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Verified Seller</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Email</span>
                                <a href={`mailto:${sellerItem.sellerEmail}`} className="text-sm text-primary hover:text-white transition-colors font-medium">
                                    {sellerItem.sellerEmail}
                                </a>
                            </div>
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Phone</span>
                                <a href={`tel:${sellerItem.sellerPhone}`} className="text-sm text-primary hover:text-white transition-colors font-medium">
                                    {sellerItem.sellerPhone}
                                </a>
                            </div>
                        </div>

                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Vehicle</span>
                            <span className="text-sm font-bold text-white">{sellerItem.vehicleTitle}</span>
                            <span className="text-xs text-gray-400 block mt-0.5">{sellerItem.vehicleSubtitle}</span>
                        </div>
                    </div>
                )}
            </ModalOverlay>
        </div>
    )
}
