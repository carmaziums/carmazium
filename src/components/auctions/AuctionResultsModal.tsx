"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
    X, BarChart2, Trophy, XCircle, Eye, MessageSquare, Gavel, Loader2,
    Lightbulb, Gauge, Fuel, Cog,
} from "lucide-react"
import { getBidCount, getCurrentBid, type Auction } from "@/lib/auctionApi"

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    })
}

// Contextual, data-driven advice instead of generic filler — tells the seller
// something they couldn't already see from the stats grid above it.
function getResultTips(auction: Auction): string[] {
    if (auction.winnerId) {
        return [
            "Reach out to the buyer within 24 hours to keep the sale on track and arrange handover.",
            "Have the logbook (V5C) and service history ready to hand over with the vehicle.",
        ]
    }
    const bidCount = getBidCount(auction)
    const topBid = getCurrentBid(auction)
    const reserve = Number(auction.reservePrice)

    if (bidCount === 0) {
        return [
            "No bids were placed — a lower starting bid or reserve price tends to spark early interest.",
            "Listings with more photos and a full service history typically attract more bidders.",
        ]
    }
    const gap = reserve - topBid
    if (gap > 0) {
        return [
            `Bidding reached £${topBid.toLocaleString()} — £${gap.toLocaleString()} short of your £${reserve.toLocaleString()} reserve.`,
            "Consider lowering your reserve closer to the highest bid, or add a Buy It Now price next time to close faster.",
        ]
    }
    return ["Reserve was met but the sale didn't complete — re-auction to give it another run."]
}

interface AuctionResultsModalProps {
    auction: Auction
    onClose: () => void
    onReauction: (auction: Auction) => void
    onConnectWithWinner: (auction: Auction) => void
    connectingChat: boolean
}

export function AuctionResultsModal({
    auction, onClose, onReauction, onConnectWithWinner, connectingChat,
}: AuctionResultsModalProps) {
    const listing = auction.listing
    const tips = getResultTips(auction)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] sticky top-0 bg-[var(--bg-dropdown)] z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <BarChart2 size={16} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold">Auction Results</h2>
                            <p className="text-xs text-[var(--text-muted)] truncate max-w-[260px]">{listing.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Vehicle summary */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)]">
                        {listing.images?.[0] ? (
                            <Image src={listing.images[0]} alt="" width={72} height={54} className="w-[72px] h-[54px] rounded-lg object-cover shrink-0" />
                        ) : (
                            <div className="w-[72px] h-[54px] rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                                <Gavel size={18} className="text-[var(--text-muted)]" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm truncate">{listing.year} {listing.make} {listing.model}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--text-muted)]">
                                {listing.mileage != null && (
                                    <span className="inline-flex items-center gap-1"><Gauge size={11} /> {listing.mileage.toLocaleString()} mi</span>
                                )}
                                {listing.fuelType && (
                                    <span className="inline-flex items-center gap-1"><Fuel size={11} /> {listing.fuelType}</span>
                                )}
                                {listing.transmission && (
                                    <span className="inline-flex items-center gap-1"><Cog size={11} /> {listing.transmission}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status banner */}
                    {auction.winnerId ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <Trophy size={20} className="text-amber-400 shrink-0" />
                            <div>
                                <p className="font-bold text-amber-300 text-sm">Auction Sold</p>
                                <p className="text-xs text-[var(--text-muted)]">Winner: <span className="font-semibold">
                                    {auction.winner
                                        ? `${auction.winner.firstName || ""} ${auction.winner.lastName || ""}`.trim() || "Anonymous Bidder"
                                        : "Anonymous Bidder"}
                                </span></p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
                            <XCircle size={20} className="text-[var(--text-muted)] shrink-0" />
                            <div>
                                <p className="font-bold text-[var(--text-secondary)] text-sm">No Winner</p>
                                <p className="text-xs text-[var(--text-muted)]">Reserve price not met or no bids placed</p>
                            </div>
                        </div>
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3 text-center">
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Winning Bid</p>
                            <p className="text-lg font-black font-mono">
                                {auction.winningBidAmount
                                    ? `£${Number(auction.winningBidAmount).toLocaleString()}`
                                    : "—"}
                            </p>
                        </div>
                        <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3 text-center">
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Total Bids</p>
                            <p className="text-lg font-black">
                                {getBidCount(auction)}
                            </p>
                        </div>
                        <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3 text-center">
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">Reserve</p>
                            <p className="text-lg font-black font-mono">
                                £{Number(auction.reservePrice).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2 text-xs text-[var(--text-muted)]">
                        <div className="flex justify-between">
                            <span>Started</span>
                            <span>{formatDate(auction.startTime)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Ended</span>
                            <span>{formatDate(auction.endTime)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Starting Bid</span>
                            <span className="font-mono">£{Number(auction.startingBid).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Tips */}
                    {tips.length > 0 && (
                        <div className="space-y-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
                                <Lightbulb size={12} /> Tips
                            </p>
                            <ul className="space-y-1.5">
                                {tips.map((tip, i) => (
                                    <li key={i} className="text-xs text-[var(--text-secondary)] leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-blue-400">
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                        <Link
                            href={`/auctions/live/${auction.id}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-bold hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                            <Eye size={14} /> View Auction
                        </Link>
                        {auction.winnerId ? (
                            <button
                                onClick={() => onConnectWithWinner(auction)}
                                disabled={connectingChat}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                {connectingChat
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <MessageSquare size={14} />
                                }
                                Connect with Winner
                            </button>
                        ) : (
                            <button
                                onClick={() => onReauction(auction)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white text-sm font-bold transition-colors"
                            >
                                <Gavel size={14} /> Re-auction
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
