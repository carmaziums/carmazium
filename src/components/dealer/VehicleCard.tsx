"use client"

import * as React from "react"
import { Sparkles, Clock, ArrowUp, ArrowDown, Gavel, Eye, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/Button"

export interface VehicleCardData {
    id: string
    title: string // e.g. "2023 BMW M4 Competition"
    subtitle?: string // e.g. "3.0L Twin-Turbo • 12,450 mi"
    imageUrl?: string
    currentBid: number
    aiEstimate: number
    myMaxBid?: number
    finalSalePrice?: number // only for Didn't Win tab
    bidCount?: number
    watchers?: number
    auctionEndsAt?: string // ISO timestamp for countdown
    proxyBidEnabled?: boolean
    proxyBidAmount?: number
    status: "active" | "under_offer" | "didnt_win" | "won"
}

interface VehicleCardProps {
    vehicle: VehicleCardData
    onPlaceBid?: (id: string, amount: number) => void
    onSetProxyBid?: (id: string, amount: number) => void
    variant?: "active" | "under_offer" | "didnt_win"
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
    const [timeLeft, setTimeLeft] = React.useState("")
    const [isUrgent, setIsUrgent] = React.useState(false)

    React.useEffect(() => {
        function tick() {
            const now = Date.now()
            const end = new Date(endsAt).getTime()
            const diff = end - now

            if (diff <= 0) {
                setTimeLeft("ENDED")
                setIsUrgent(false)
                return
            }

            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)

            setIsUrgent(h === 0 && m < 30)

            if (h > 0) {
                setTimeLeft(`${h}h ${m}m ${s}s`)
            } else {
                setTimeLeft(`${m}m ${s}s`)
            }
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [endsAt])

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider tabular-nums ${
            isUrgent
                ? "bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
        }`}>
            <Clock size={12} className={isUrgent ? "animate-bounce" : ""} />
            {timeLeft}
        </div>
    )
}

function AIPriceBadge({ estimate, currentBid }: { estimate: number; currentBid: number }) {
    const diff = currentBid - estimate
    const diffPct = ((diff / estimate) * 100).toFixed(1)
    const isOver = diff > 0
    const isUnder = diff < 0

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/8 border border-violet-500/15 rounded-xl">
            <div className="flex items-center gap-1">
                <Sparkles size={13} className="text-violet-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400/80">AI Est.</span>
            </div>
            <span className="text-sm font-black text-violet-300 tabular-nums">£{estimate.toLocaleString()}</span>
            <span className={`text-xs font-bold tabular-nums flex items-center gap-0.5 ${
                isOver ? "text-red-400" : isUnder ? "text-emerald-400" : "text-[var(--text-muted)]"
            }`}>
                {isOver ? <ArrowUp size={10} /> : isUnder ? <ArrowDown size={10} /> : null}
                {isOver ? "+" : ""}{diffPct}%
            </span>
        </div>
    )
}

export function VehicleCard({ vehicle, onPlaceBid, onSetProxyBid, variant = "active" }: VehicleCardProps) {
    const [bidInput, setBidInput] = React.useState("")
    const [proxyInput, setProxyInput] = React.useState(vehicle.proxyBidAmount?.toString() || "")
    const [showProxy, setShowProxy] = React.useState(false)

    const gapToWin = vehicle.finalSalePrice && vehicle.myMaxBid
        ? vehicle.finalSalePrice - vehicle.myMaxBid
        : null

    return (
        <div className="dealer-glass-card group hover:border-[var(--border-default)] transition-all duration-500">
            {/* Vehicle Image Header */}
            <div className="relative h-44 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                {vehicle.imageUrl ? (
                    <img
                        src={vehicle.imageUrl}
                        alt={vehicle.title}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Gavel size={32} className="text-gray-700" />
                    </div>
                )}

                {/* Overlay Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest backdrop-blur-md ${
                        variant === "active"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : variant === "under_offer"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                    }`}>
                        {variant === "active" ? "Live" : variant === "under_offer" ? "Under Offer" : "Didn't Win"}
                    </span>

                    {/* Countdown */}
                    {vehicle.auctionEndsAt && variant === "active" && (
                        <CountdownTimer endsAt={vehicle.auctionEndsAt} />
                    )}
                </div>

                {/* Meta stats */}
                <div className="absolute bottom-3 left-3 flex items-center gap-3">
                    {vehicle.bidCount !== undefined && (
                        <span className="flex items-center gap-1 text-xs font-bold text-white/70 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
                            <Gavel size={10} /> {vehicle.bidCount} bids
                        </span>
                    )}
                    {vehicle.watchers !== undefined && (
                        <span className="flex items-center gap-1 text-xs font-bold text-white/70 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
                            <Eye size={10} /> {vehicle.watchers}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
                {/* Title & Subtitle */}
                <div>
                    <h3 className="text-base font-black tracking-tight leading-tight group-hover:text-primary transition-colors" style={{ color: 'var(--text-primary)' }}>
                        {vehicle.title}
                    </h3>
                    {vehicle.subtitle && (
                        <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1">{vehicle.subtitle}</p>
                    )}
                </div>

                {/* Current Bid + AI Estimate Side by Side */}
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">
                            {variant === "didnt_win" ? "Your Max Bid" : "Current Bid"}
                        </span>
                        <span className="text-2xl font-black tabular-nums metallic-foil">
                            £{vehicle.currentBid.toLocaleString()}
                        </span>
                    </div>
                    <AIPriceBadge estimate={vehicle.aiEstimate} currentBid={vehicle.currentBid} />
                </div>

                {/* Didn't Win: Final Sale Price Comparison */}
                {variant === "didnt_win" && vehicle.finalSalePrice && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Final Sale Price</span>
                                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>£{vehicle.finalSalePrice.toLocaleString()}</span>
                            </div>
                            {gapToWin !== null && (
                                <div className="text-right">
                                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Gap</span>
                                    <span className="text-lg font-black text-red-400 tabular-nums flex items-center gap-1">
                                        <AlertTriangle size={14} />
                                        £{gapToWin.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Active: Bid Input & Proxy */}
                {variant === "active" && (
                    <div className="space-y-3 pt-1">
                        {/* Quick Bid */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm font-bold">£</span>
                                <input
                                    type="number"
                                    value={bidInput}
                                    onChange={(e) => setBidInput(e.target.value)}
                                    placeholder={`${(vehicle.currentBid + 100).toLocaleString()}`}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg pl-7 pr-3 py-2.5 text-sm font-bold placeholder:text-[var(--text-muted)] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all tabular-nums"
                                />
                            </div>
                            <Button
                                size="sm"
                                shape="square"
                                onClick={() => {
                                    const amt = Number(bidInput)
                                    if (amt > 0) onPlaceBid?.(vehicle.id, amt)
                                }}
                                className="px-5 h-[42px] text-xs"
                                disabled={!bidInput}
                            >
                                Bid
                            </Button>
                        </div>

                        {/* Proxy Bid Toggle */}
                        <button
                            onClick={() => setShowProxy(!showProxy)}
                            className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                            <span className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center ${
                                showProxy ? "bg-primary border-primary" : "border-white/20"
                            }`}>
                                {showProxy && <span className="text-[8px]">✓</span>}
                            </span>
                            Set Proxy Bid (Auto-bid up to max)
                        </button>

                        {showProxy && (
                            <div className="flex gap-2 pl-5">
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm font-bold">£</span>
                                    <input
                                        type="number"
                                        value={proxyInput}
                                        onChange={(e) => setProxyInput(e.target.value)}
                                        placeholder="Max proxy amount"
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg pl-7 pr-3 py-2.5 text-sm font-bold placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all tabular-nums"
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    shape="square"
                                    variant="dark"
                                    onClick={() => {
                                        const amt = Number(proxyInput)
                                        if (amt > 0) onSetProxyBid?.(vehicle.id, amt)
                                    }}
                                    className="px-4 h-[42px] text-xs border-violet-500/20 hover:border-violet-500/40"
                                    disabled={!proxyInput}
                                >
                                    Set
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Under Offer: Status indicator */}
                {variant === "under_offer" && (
                    <div className="flex items-center gap-2 py-2 px-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[11px] font-bold text-amber-400/80">Awaiting seller response</span>
                    </div>
                )}
            </div>
        </div>
    )
}
