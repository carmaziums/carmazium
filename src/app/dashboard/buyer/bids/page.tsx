"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getMyBids, formatPrice, type Bid } from "@/lib/listingApi"
import { Loader2, Gavel, MessageSquare, Radio, Trophy } from "lucide-react"
import { createChatRoom } from "@/lib/chatApi"

export default function MyBidsPage() {
    const { user, loading: authLoading } = useAuth()
    const [bids, setBids] = React.useState<Bid[]>([])
    const [loading, setLoading] = React.useState(true)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [connectingChat, setConnectingChat] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchBids() {
            if (!user) return
            try {
                setLoading(true)
                const data = await getMyBids(page, 10)
                setBids(data.data || [])
                setTotalPages(data.pagination?.totalPages || 1)
            } catch (err) {
                console.error('Failed to fetch bids:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchBids()
        }
    }, [user, authLoading, page])

    function getBidRowMeta(bid: Bid): {
        isAuction: boolean
        auctionActive: boolean
        userWon: boolean
        auctionEnded: boolean
    } {
        const auction = bid.listing.auction
        return {
            isAuction: !!auction,
            auctionActive: auction?.status === "ACTIVE",
            userWon: auction?.status === "ENDED" && auction?.winnerId === user?.id && bid.isWinning,
            auctionEnded: auction?.status === "ENDED" || auction?.status === "CANCELLED",
        }
    }

    async function handleChatWithSeller(bid: Bid) {
        const sellerId = bid.listing.sellerId
        if (!sellerId) return
        setConnectingChat(bid.id)
        try {
            const room = await createChatRoom(sellerId, bid.listing.id)
            window.location.href = `/dashboard/buyer/messages?room=${room.id}`
        } catch (err: any) {
            alert(err.message || "Failed to open chat")
        } finally {
            setConnectingChat(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold font-heading">My Bids & Offers</h1>
                            <p className="text-[var(--text-muted)] text-sm mt-1">Track your auction bids and listing offers</p>
                        </div>
                    </div>

                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Your Bid</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : bids.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                                No bids yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        bids.map((bid) => {
                                            const { isAuction, auctionActive, userWon, auctionEnded } = getBidRowMeta(bid)
                                            const auction = bid.listing.auction

                                            return (
                                                <tr
                                                    key={bid.id}
                                                    className={`hover:bg-[var(--bg-card)] transition-colors ${userWon ? "border-l-2 border-amber-400/40" : ""}`}
                                                >
                                                    {/* Vehicle */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {bid.listing.images?.[0] && (
                                                                <Image
                                                                    src={bid.listing.images[0]}
                                                                    alt=""
                                                                    width={56}
                                                                    height={40}
                                                                    className="w-14 h-10 rounded object-cover"
                                                                />
                                                            )}
                                                            <div>
                                                                <div className="font-bold flex items-center gap-2">
                                                                    {bid.listing.title}
                                                                    {isAuction && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                                                            <Gavel size={8} /> Auction
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-[var(--text-muted)]">
                                                                    {bid.listing.year} {bid.listing.make}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Bid amount */}
                                                    <td className="px-6 py-4 font-mono font-bold">{formatPrice(bid.amount)}</td>

                                                    {/* Status */}
                                                    <td className="px-6 py-4">
                                                        {userWon ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-400/10 text-amber-400 border-amber-400/20">
                                                                <Trophy size={10} /> Won
                                                            </span>
                                                        ) : isAuction && auctionActive ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bid.isWinning
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                            }`}>
                                                                {bid.isWinning ? (
                                                                    <><Radio size={10} className="animate-pulse" /> Winning</>
                                                                ) : (
                                                                    <>Outbid</>
                                                                )}
                                                            </span>
                                                        ) : isAuction && auctionEnded && !userWon ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-500/10 text-[var(--text-muted)] border-gray-500/20">
                                                                Auction Ended
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bid.isWinning
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                            }`}>
                                                                {bid.isWinning ? "Winning" : "Outbid"}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Date */}
                                                    <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                                                        {new Date(bid.createdAt).toLocaleDateString()}
                                                    </td>

                                                    {/* Action */}
                                                    <td className="px-6 py-4 text-right">
                                                        {userWon ? (
                                                            <div className="flex flex-col items-end gap-1.5">
                                                                <span className="text-xs text-amber-400 font-bold">You won!</span>
                                                                <button
                                                                    onClick={() => handleChatWithSeller(bid)}
                                                                    disabled={connectingChat === bid.id}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 text-xs font-bold hover:bg-amber-400/20 transition-colors disabled:opacity-50"
                                                                >
                                                                    {connectingChat === bid.id
                                                                        ? <Loader2 size={13} className="animate-spin" />
                                                                        : <MessageSquare size={13} />
                                                                    }
                                                                    Chat with Seller
                                                                </button>
                                                            </div>
                                                        ) : isAuction && auctionActive && auction ? (
                                                            <Link
                                                                href={`/auctions/live/${auction.id}`}
                                                                className="inline-flex items-center gap-1.5 text-emerald-400 dark:hover:text-white text-sm font-bold transition-colors"
                                                            >
                                                                <Radio size={13} className="animate-pulse" /> View Live
                                                            </Link>
                                                        ) : isAuction && auction ? (
                                                            <Link
                                                                href={`/auctions/live/${auction.id}`}
                                                                className="text-primary dark:hover:text-white text-sm font-bold transition-colors"
                                                            >
                                                                View Results
                                                            </Link>
                                                        ) : (
                                                            <Link
                                                                href={`/cars/${bid.listing.slug}`}
                                                                className="text-primary dark:hover:text-white text-sm font-bold transition-colors"
                                                            >
                                                                View
                                                            </Link>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-4 border-t border-[var(--border-default)] flex justify-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 rounded text-sm bg-[var(--bg-input)] disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-[var(--text-muted)] text-sm">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1 rounded text-sm bg-[var(--bg-input)] disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
