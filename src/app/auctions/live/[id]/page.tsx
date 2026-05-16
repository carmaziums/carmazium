"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    ArrowLeft,
    MessageSquare,
    Share2,
    Timer,
    Gavel,
    Users,
    AlertCircle,
    CheckCircle,
    Flame,
    ShieldCheck,
    Info,
    Send,
    Zap,
    Trophy,
    Clock,
    WifiOff,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { useAuth } from "@/context/AuthContext"
import { getAuction, type Auction, type BidBroadcastPayload, type AuctionEndPayload } from "@/lib/auctionApi"
import { placeBid } from "@/lib/listingApi"
import { getWebSocketUrl } from "@/lib/chatApi"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BidHistoryEntry {
    initials: string
    amount: number
    time: string
    isNew?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSellerInitials(auction: Auction): string {
    const seller = auction.listing.seller
    if (!seller) return "??"
    if (seller.dealerProfile?.companyName) return seller.dealerProfile.companyName.slice(0, 2).toUpperCase()
    return `${seller.firstName?.[0] ?? "?"}${seller.lastName?.[0] ?? ""}`.toUpperCase()
}

function getSellerName(auction: Auction): string {
    const seller = auction.listing.seller
    if (!seller) return "Private Seller"
    if (seller.dealerProfile?.companyName) return seller.dealerProfile.companyName
    return `${seller.firstName ?? ""} ${seller.lastName ?? ""}`.trim() || "Private Seller"
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LiveAuctionPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = React.use(paramsPromise)
    const { user } = useAuth()

    // ── Data ────────────────────────────────────────────────────────────────
    const [auction, setAuction] = React.useState<Auction | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [loadError, setLoadError] = React.useState<string | null>(null)

    // ── Bid state ───────────────────────────────────────────────────────────
    const [currentBid, setCurrentBid] = React.useState(0)
    const [bidAmount, setBidAmount] = React.useState("")
    const [bidHistory, setBidHistory] = React.useState<BidHistoryEntry[]>([])
    const [isWinning, setIsWinning] = React.useState(false)
    const [bidError, setBidError] = React.useState<string | null>(null)
    const [bidLoading, setBidLoading] = React.useState(false)

    // ── Auction end state ────────────────────────────────────────────────────
    const [endedPayload, setEndedPayload] = React.useState<AuctionEndPayload | null>(null)

    // ── UI state ─────────────────────────────────────────────────────────────
    const [watchers, setWatchers] = React.useState(0)
    const [activeTab, setActiveTab] = React.useState<"details" | "history" | "seller">("details")
    const [connected, setConnected] = React.useState(false)
    const [antiSnipeActive, setAntiSnipeActive] = React.useState(false)
    const [antiSnipeToast, setAntiSnipeToast] = React.useState(false)
    const [endTime, setEndTime] = React.useState<Date | null>(null)

    const chatRef = React.useRef<HTMLDivElement>(null)
    const socketRef = React.useRef<Socket | null>(null)

    // ── Load auction data ─────────────────────────────────────────────────────
    React.useEffect(() => {
        getAuction(params.id)
            .then(data => {
                setAuction(data)
                setEndTime(new Date(data.endTime))

                const bids = data.listing.bids ?? []
                const startingBid = Number(data.startingBid)
                const top = bids[0] ? Number(bids[0].amount) : startingBid
                setCurrentBid(top)
                setIsWinning(!!user && bids[0]?.bidderId === user.id)
                setBidHistory(
                    bids.map(b => ({
                        initials: `${b.bidder?.firstName?.[0] ?? "?"}${b.bidder?.lastName?.[0] ?? ""}`.toUpperCase(),
                        amount: Number(b.amount),
                        time: new Date(b.timestamp).toLocaleTimeString("en-GB"),
                    }))
                )

                const antiSnipeWindow = 3 * 60 * 1000
                setAntiSnipeActive(new Date(data.endTime).getTime() - Date.now() <= antiSnipeWindow * (10 / 3))
            })
            .catch(() => setLoadError("Failed to load auction. Please refresh."))
            .finally(() => setLoading(false))
    }, [params.id, user])

    // ── WebSocket ─────────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!auction) return

        const socket = io(`${getWebSocketUrl()}/auctions`, {
            withCredentials: true,
            transports: ["websocket"],
        })
        socketRef.current = socket

        socket.on("connect", () => {
            setConnected(true)
            socket.emit("auction:join", { auctionId: auction.id })
        })

        socket.on("disconnect", () => setConnected(false))

        socket.on("auction:viewers", ({ count }: { count: number }) => {
            setWatchers(count)
        })

        socket.on("bid:new", (payload: BidBroadcastPayload) => {
            setCurrentBid(payload.amount)
            setIsWinning(!!user && payload.bidderId === user.id)
            setBidHistory(prev => [
                { initials: payload.bidderInitials, amount: payload.amount, time: new Date(payload.timestamp).toLocaleTimeString("en-GB"), isNew: true },
                ...prev.map(b => ({ ...b, isNew: false })),
            ])
            if (payload.newEndTime) {
                const newEnd = new Date(payload.newEndTime)
                setEndTime(newEnd)
                setAuction(prev => prev ? { ...prev, endTime: payload.newEndTime! } : prev)
                setAntiSnipeActive(true)
                setAntiSnipeToast(true)
                setTimeout(() => setAntiSnipeToast(false), 5000)
            }
            setBidError(null)
        })

        socket.on("auction:ended", (payload: AuctionEndPayload) => {
            setEndedPayload(payload)
            setAuction(prev => prev
                ? { ...prev, status: "ENDED", winnerId: payload.winnerId, winningBidAmount: payload.winningBidAmount }
                : prev
            )
        })

        socket.on("auction:started", () => {
            setAuction(prev => prev ? { ...prev, status: "ACTIVE" } : prev)
        })

        return () => { socket.disconnect() }
    }, [auction?.id, user])

    // ── Anti-snipe countdown watch ────────────────────────────────────────────
    React.useEffect(() => {
        if (!endTime || auction?.status !== "ACTIVE") return
        const interval = setInterval(() => {
            const left = endTime.getTime() - Date.now()
            setAntiSnipeActive(left > 0 && left <= 3 * 60 * 1000)
        }, 10_000)
        return () => clearInterval(interval)
    }, [endTime, auction?.status])

    // ── Scroll chat to bottom ─────────────────────────────────────────────────
    React.useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
    }, [bidHistory])

    // ── Bid handler ───────────────────────────────────────────────────────────
    const handleBid = React.useCallback(async (amount: number) => {
        if (!auction || !user) return
        if (amount <= currentBid) {
            setBidError(`Bid must be higher than the current bid of £${currentBid.toLocaleString()}`)
            return
        }
        setBidLoading(true)
        setBidError(null)
        try {
            await placeBid(auction.listingId, amount)
            setBidAmount("")
        } catch (err: any) {
            setBidError(err.message ?? "Failed to place bid. Please try again.")
        } finally {
            setBidLoading(false)
        }
    }, [auction, user, currentBid])

    const minIncrement = auction ? Number(auction.minIncrement) : 100
    const quickBids = [minIncrement, minIncrement * 2, minIncrement * 5, minIncrement * 10]

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="bg-slate-950 min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-500">
                    <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Loading auction…</p>
                </div>
            </div>
        )
    }

    if (loadError || !auction) {
        return (
            <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">{loadError ?? "Auction not found."}</p>
                <Link href="/auctions" className="text-red-500 underline text-sm">Back to Auctions</Link>
            </div>
        )
    }

    const isLive = auction.status === "ACTIVE"
    const isEnded = auction.status === "ENDED"
    const userWon = isEnded && endedPayload?.winnerId === user?.id
    const reserveMet = !!(auction.listing.bids?.[0] && Number(auction.listing.bids[0].amount) >= Number(auction.reservePrice))

    const vehicle = `${auction.listing.year ?? ""} ${auction.listing.make ?? ""} ${auction.listing.model ?? ""}`.trim()
    const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"

    return (
        <div className="bg-slate-950 min-h-screen flex flex-col">

            {/* ── Anti-Snipe Toast ───────────────────────────────────────────── */}
            <AnimatePresence>
                {antiSnipeToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-5 py-3 rounded-full shadow-xl shadow-orange-900/40"
                    >
                        <Zap size={15} />
                        Anti-Snipe — Auction extended by 3 minutes!
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sticky Header ─────────────────────────────────────────────── */}
            <header className="sticky top-[64px] bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-4 h-16 flex justify-between items-center z-30">
                <div className="flex items-center gap-3">
                    <Link href="/auctions" className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-full">
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-white font-bold text-sm md:text-base uppercase tracking-wider truncate max-w-[200px] md:max-w-none">
                            {auction.listing.title}
                        </h1>
                        <div className="flex items-center gap-2">
                            {isLive && (
                                <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-red-600/20 text-red-500 text-[10px] font-bold tracking-wider">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
                                </span>
                            )}
                            {isEnded && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 text-[10px] font-bold tracking-wider">
                                    ENDED
                                </span>
                            )}
                            {antiSnipeActive && isLive && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold animate-pulse">
                                    <Zap size={9} /> ANTI-SNIPE
                                </span>
                            )}
                            {/* Connection indicator */}
                            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-600"}`} title={connected ? "Live" : "Disconnected"} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isLive && endTime && (
                        <div className="text-center hidden sm:block">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Ends In</p>
                            <CountdownTimer targetDate={endTime} minimal />
                        </div>
                    )}
                    <div className="h-6 w-px bg-white/10 hidden sm:block" />
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                        <Users size={12} className="text-red-500" />
                        <span className="text-xs font-bold text-white">{watchers}</span>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">Watching</span>
                    </div>
                    <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                        <Share2 size={16} />
                    </button>
                </div>
            </header>

            {/* ── Winner Banner ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {isEnded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={`border-b ${userWon ? "bg-emerald-500/10 border-emerald-500/30" : endedPayload?.reserveMet === false ? "bg-slate-800/60 border-white/5" : "bg-slate-800/60 border-white/5"}`}
                    >
                        <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            {userWon ? (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Trophy size={22} className="text-emerald-400" />
                                        <div>
                                            <p className="text-emerald-400 font-bold">You won this auction!</p>
                                            <p className="text-slate-400 text-sm">Winning bid: £{Number(endedPayload?.winningBidAmount).toLocaleString()}. Chat with the seller to arrange collection.</p>
                                        </div>
                                    </div>
                                    <Link href="/dashboard/buyer/messages">
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                            <MessageSquare size={15} />
                                            Open Chat with Seller
                                        </Button>
                                    </Link>
                                </>
                            ) : endedPayload?.reserveMet === false ? (
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Info size={18} />
                                    <p>Auction ended — reserve price was not met. No winner was declared.</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Gavel size={18} />
                                    <p>
                                        Auction ended. Winning bid:{" "}
                                        <span className="text-white font-bold">
                                            £{Number(endedPayload?.winningBidAmount ?? 0).toLocaleString()}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main Content ──────────────────────────────────────────────── */}
            <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">

                {/* ── Left: Image + Tabs ─────────────────────────────────────── */}
                <div className="flex-1 space-y-6 min-w-0">

                    {/* Vehicle Image / Video */}
                    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                        <div className="aspect-video relative">
                            <Image src={image} alt={auction.listing.title} fill className="object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            {isLive && (
                                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    LIVE
                                </div>
                            )}
                        </div>

                        {/* Bid status bar */}
                        <div className="bg-slate-900 border-t border-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="bg-slate-800 p-3 rounded-xl border border-white/5 min-w-[160px] text-center">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">
                                        {isEnded ? "Final Bid" : "Current Bid"}
                                    </p>
                                    <p className="text-2xl font-bold text-white font-mono">
                                        £{currentBid.toLocaleString()}
                                    </p>
                                </div>

                                {isLive && (
                                    <div>
                                        {isWinning ? (
                                            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2.5 rounded-xl border border-emerald-500/20">
                                                <CheckCircle size={18} />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide">Winning</p>
                                                    <p className="text-[10px] opacity-70">You hold the highest bid</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-500/20">
                                                <AlertCircle size={18} />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wide">Outbid</p>
                                                    <p className="text-[10px] opacity-70">Place a bid to reclaim the lead</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {reserveMet && (
                                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                                    <ShieldCheck size={14} /> Reserve Met
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Anti-snipe Banner */}
                    <AnimatePresence>
                        {antiSnipeActive && isLive && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 text-sm font-bold"
                            >
                                <Zap size={16} className="animate-pulse" />
                                Anti-Snipe Active — any bid now extends the auction by 3 minutes
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tabbed Info */}
                    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex border-b border-white/5">
                            {[
                                { id: "details", label: "Overview", icon: Info },
                                { id: "history", label: `Bids (${bidHistory.length})`, icon: Timer },
                                { id: "seller", label: "Seller", icon: Users },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`px-6 py-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all relative ${activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    <tab.icon size={13} /> {tab.label}
                                    {activeTab === tab.id && (
                                        <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_-2px_8px_rgba(220,38,38,0.5)]" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            <AnimatePresence mode="wait">
                                {activeTab === "details" && (
                                    <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {[
                                                { label: "Year", value: auction.listing.year ?? "—" },
                                                { label: "Make", value: auction.listing.make ?? "—" },
                                                { label: "Model", value: auction.listing.model ?? "—" },
                                                { label: "Min Increment", value: `£${Number(auction.minIncrement).toLocaleString()}` },
                                            ].map(s => (
                                                <div key={s.label} className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                                    <p className="text-lg font-bold text-white">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-800/40 border border-white/5 space-y-2 text-sm text-slate-400">
                                            <div className="flex justify-between">
                                                <span>Starting Bid</span>
                                                <span className="text-white font-mono font-bold">£{Number(auction.startingBid).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Reserve Price</span>
                                                <span className="text-white font-mono font-bold">£{Number(auction.reservePrice).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Auction End</span>
                                                <span className="text-white font-bold">{endTime ? endTime.toLocaleString("en-GB") : "—"}</span>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10 flex gap-3 text-orange-200/70 text-xs leading-relaxed">
                                            <Info size={15} className="shrink-0 mt-0.5" />
                                            <p>All transactions on Carmazium are arranged directly between buyer and seller. A chat room is created automatically when the auction ends to facilitate the deal.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === "history" && (
                                    <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                        {bidHistory.length === 0 ? (
                                            <p className="text-slate-500 text-sm text-center py-8">No bids placed yet. Be the first!</p>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest px-3 pb-2 border-b border-white/5">
                                                    <span>Bidder</span>
                                                    <span>Amount</span>
                                                </div>
                                                {bidHistory.map((bid, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={bid.isNew ? { opacity: 0, x: -10 } : false}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className={`flex justify-between items-center p-3 rounded-lg ${i === 0 ? "bg-slate-800/60 border border-white/8" : "hover:bg-white/3 border border-transparent"}`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                                                {bid.initials}
                                                            </div>
                                                            <span className={`text-xs font-bold ${i === 0 ? "text-white" : "text-slate-400"}`}>
                                                                {bid.initials}
                                                            </span>
                                                            {i === 0 && (
                                                                <span className="text-[9px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">Leading</span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-mono font-bold text-white text-sm">£{bid.amount.toLocaleString()}</div>
                                                            <div className="text-[10px] text-slate-600">{bid.time}</div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </>
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === "seller" && (
                                    <motion.div key="seller" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="flex items-center gap-5 bg-slate-900/50 p-5 rounded-xl border border-white/5">
                                            <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center text-white text-xl font-bold border border-white/10 shrink-0">
                                                {getSellerInitials(auction)}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-white">{getSellerName(auction)}</h3>
                                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mt-1">
                                                    <ShieldCheck size={12} /> Verified
                                                </div>
                                                <p className="text-slate-400 text-xs leading-relaxed mt-2">
                                                    If you win this auction, a direct chat will be opened between you and the seller to arrange collection and payment.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* ── Right: Bid Feed + Controls ─────────────────────────────── */}
                <aside className="lg:w-[380px] shrink-0 space-y-4">
                    <div className="bg-slate-900 rounded-2xl border border-white/8 shadow-2xl overflow-hidden flex flex-col" style={{ height: 600 }}>

                        {/* Feed Header */}
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/60">
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <Flame size={13} className="text-red-500" /> Live Bid Feed
                            </h3>
                            <div className="flex items-center gap-1.5">
                                {connected ? (
                                    <>
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-slate-500">Connected</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff size={11} className="text-slate-600" />
                                        <span className="text-[10px] text-slate-600">Offline</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Bid history feed */}
                        <div
                            ref={chatRef}
                            className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 bg-slate-950/40"
                        >
                            {bidHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm gap-2">
                                    <Gavel size={24} />
                                    <p>Waiting for first bid…</p>
                                </div>
                            ) : (
                                bidHistory.map((bid, i) => (
                                    <motion.div
                                        key={i}
                                        initial={bid.isNew ? { opacity: 0, y: -8 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/3 rounded-lg transition-colors"
                                    >
                                        <Flame size={12} className="text-orange-500 shrink-0" />
                                        <span className="font-bold text-orange-400 text-xs">{bid.initials}</span>
                                        <span className="text-slate-500 text-xs">bid</span>
                                        <span className="text-white font-mono font-bold text-xs">£{bid.amount.toLocaleString()}</span>
                                        <span className="ml-auto text-[10px] text-slate-600">{bid.time}</span>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Bid Controls */}
                        <div className="bg-slate-800 border-t border-white/10 p-4 space-y-3">
                            {isEnded ? (
                                <div className="text-center py-2 text-slate-500 text-sm font-bold">
                                    Auction has ended
                                </div>
                            ) : !user ? (
                                <Link href="/auth/login">
                                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                                        Sign in to Bid
                                    </Button>
                                </Link>
                            ) : !isLive ? (
                                <div className="text-center py-2 text-slate-500 text-sm font-bold">
                                    <Clock size={14} className="inline mr-2" />
                                    Auction not started yet
                                </div>
                            ) : (
                                <>
                                    {/* Quick bid buttons */}
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {quickBids.map(inc => (
                                            <button
                                                key={inc}
                                                onClick={() => handleBid(currentBid + inc)}
                                                disabled={bidLoading}
                                                className="bg-slate-700/60 hover:bg-slate-700 border border-white/5 hover:border-white/20 rounded-lg py-2.5 flex flex-col items-center transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                <span className="text-[10px] text-slate-300 font-bold">
                                                    +£{inc >= 1000 ? `${inc / 1000}k` : inc}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom bid */}
                                    <div className="flex gap-2">
                                        <div className="relative w-24 shrink-0">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">£</span>
                                            <Input
                                                type="number"
                                                placeholder="Custom"
                                                className="bg-slate-900 border-slate-600 text-white pl-6 h-10 font-mono font-bold text-sm focus:border-red-500"
                                                value={bidAmount}
                                                onChange={e => setBidAmount(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter" && bidAmount) handleBid(Number(bidAmount))
                                                }}
                                            />
                                        </div>
                                        <Button
                                            onClick={() => handleBid(Number(bidAmount) || currentBid + minIncrement)}
                                            disabled={bidLoading}
                                            className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                        >
                                            {bidLoading ? "Placing…" : "Place Bid"}
                                        </Button>
                                    </div>

                                    {bidError && (
                                        <p className="text-red-400 text-xs text-center leading-snug">{bidError}</p>
                                    )}

                                    <p className="text-[10px] text-slate-600 text-center">
                                        Min bid: £{(currentBid + minIncrement).toLocaleString()}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}
