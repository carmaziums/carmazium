"use client"

import * as React from "react"
import {
    MoreHorizontal,
    FileText,
    User,
    CheckCircle2,
    Clock,
    FileSearch,
    Truck,
    ChevronRight,
    X,
} from "lucide-react"

export type PurchaseStatus = "awaiting_confirmation" | "reviewing_docs" | "checks_complete" | "delivery_requested"

export interface PurchaseItem {
    id: string
    vehicleTitle: string
    vehicleSubtitle?: string
    imageUrl?: string
    purchasePrice: number
    purchaseDate: string
    sellerName?: string
    sellerEmail?: string
    sellerPhone?: string
    status: PurchaseStatus
    estimatedDelivery?: string
    documentsReceived?: number
    documentsTotal?: number
}

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; border: string }> = {
    awaiting_confirmation: {
        label: "Awaiting Confirmation",
        icon: Clock,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
    },
    reviewing_docs: {
        label: "Reviewing Docs",
        icon: FileSearch,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
    },
    checks_complete: {
        label: "Checks Complete",
        icon: CheckCircle2,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
    },
    delivery_requested: {
        label: "Delivery Requested",
        icon: Truck,
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
    },
}

interface PipelineRowProps {
    item: PurchaseItem
    onViewSummary?: (item: PurchaseItem) => void
    onViewSeller?: (item: PurchaseItem) => void
}

export function PipelineRow({ item, onViewSummary, onViewSeller }: PipelineRowProps) {
    const [menuOpen, setMenuOpen] = React.useState(false)
    const menuRef = React.useRef<HTMLDivElement>(null)

    const config = STATUS_CONFIG[item.status]
    const StatusIcon = config.icon

    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    return (
        <div className="dealer-glass-card p-0 group hover:border-white/8">
            <div className="flex items-center gap-4 p-4 md:p-5">
                {/* Vehicle Thumbnail */}
                <div className="w-16 h-16 md:w-20 md:h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-white/5">
                    {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.vehicleTitle} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FileText size={20} className="text-gray-700" />
                        </div>
                    )}
                </div>

                {/* Vehicle Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white tracking-tight truncate group-hover:text-primary transition-colors">
                        {item.vehicleTitle}
                    </h3>
                    {item.vehicleSubtitle && (
                        <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{item.vehicleSubtitle}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                        Purchased {new Date(item.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                </div>

                {/* Price */}
                <div className="hidden md:block text-right shrink-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Price</span>
                    <span className="text-lg font-black text-white tabular-nums">£{item.purchasePrice.toLocaleString()}</span>
                </div>

                {/* Document Progress (if reviewing) */}
                {item.status === "reviewing_docs" && item.documentsReceived !== undefined && item.documentsTotal !== undefined && (
                    <div className="hidden lg:flex flex-col items-center gap-1 shrink-0">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Docs</span>
                        <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${(item.documentsReceived / item.documentsTotal) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs font-bold text-blue-400 tabular-nums">
                                {item.documentsReceived}/{item.documentsTotal}
                            </span>
                        </div>
                    </div>
                )}

                {/* Estimated Delivery */}
                {item.status === "delivery_requested" && item.estimatedDelivery && (
                    <div className="hidden lg:block text-right shrink-0">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 block">ETA</span>
                        <span className="text-xs font-bold text-violet-400">
                            {new Date(item.estimatedDelivery).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                    </div>
                )}

                {/* Status Badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border shrink-0 ${config.bg} ${config.color} ${config.border}`}>
                    <StatusIcon size={12} />
                    <span className="hidden md:inline">{config.label}</span>
                </div>

                {/* Context Menu */}
                <div className="relative shrink-0" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-white"
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-slate-800/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                            <div className="py-1">
                                <button
                                    onClick={() => { onViewSummary?.(item); setMenuOpen(false) }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <FileText size={14} className="text-gray-500" />
                                    Purchase Summary
                                    <ChevronRight size={12} className="ml-auto text-gray-600" />
                                </button>
                                <button
                                    onClick={() => { onViewSeller?.(item); setMenuOpen(false) }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <User size={14} className="text-gray-500" />
                                    Seller Details
                                    <ChevronRight size={12} className="ml-auto text-gray-600" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─── Flyout Modals ──────────────────────────────────────────────────────────── */

interface ModalOverlayProps {
    open: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
}

export function ModalOverlay({ open, onClose, title, children }: ModalOverlayProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-800/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
