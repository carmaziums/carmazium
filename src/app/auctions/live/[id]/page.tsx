"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    ArrowLeft, Share2, Gavel, Users, AlertCircle, CheckCircle,
    ShieldCheck, Info, Zap, Trophy, Clock, WifiOff,
    MessageSquare, Timer, Flame, TrendingUp, RefreshCw,
    Ban, CalendarClock, CreditCard, Handshake,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { useAuth } from "@/context/AuthContext"
import { getAuction, type Auction, type BidBroadcastPayload, type AuctionEndPayload } from "@/lib/auctionApi"
import { placeBid } from "@/lib/listingApi"
import { getWebSocketUrl, createChatRoom } from "@/lib/chatApi"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BidEntry {
    initials: string
    amount: number
    time: string
    isNew?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSellerInitials(auction: Auction): string {
    const s = auction.listing.seller
    if (!s) return "??"
    if (s.dealerProfile?.companyName) return s.dealerProfile.companyName.slice(0, 2).toUpperCase()
    return `${s.firstName?.[0] ?? "?"}${s.lastName?.[0] ?? ""}`.toUpperCase()
}

function getSellerName(auction: Auction): string {
    const s = auction.listing.seller
    if (!s) return "Private Seller"
    if (s.dealerProfile?.companyName) return s.dealerProfile.companyName
    return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Private Seller"
}

function triggerNotificationRefresh() {
    window.dispatchEvent(new CustomEvent("auction:refresh-notifications"))
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LiveAuctionPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = React.use(paramsPromise)
    const { user } = useAuth()

    const [auction, setAuction] = React.useState<Auction | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [loadError, setLoadError] = React.useState<string | null>(null)

    const [currentBid, setCurrentBid] = React.useState(0)
    const [bidAmount, setBidAmount] = React.useState("")
    const [bidHistory, setBidHistory] = React.useState<BidEntry[]>([])
    const [isWinning, setIsWinning] = React.useState(false)
    const [bidError, setBidError] = React.useState<string | null>(null)
    const [bidLoading, setBidLoading] = React.useState(false)

    const [endedPayload, setEndedPayload] = React.useState<AuctionEndPayload | null>(null)
    const [watchers, setWatchers] = React.useState(0)
    const [activeTab, setActiveTab] = React.useState<"details" | "bids" | "seller">("details")
    const [connected, setConnected] = React.useState(false)
    const [antiSnipeActive, setAntiSnipeActive] = React.useState(false)
    const [antiSnipeToast, setAntiSnipeToast] = React.useState(false)
    const [endTime, setEndTime] = React.useState<Date | null>(null)
    const [startTime, setStartTime] = React.useState<Date | null>(null)
    const [copied, setCopied] = React.useState(false)
    const [connectingChat, setConnectingChat] = React.useState(false)

    const feedRef = React.useRef<HTMLDivElement>(null)
    const socketRef = React.useRef<Socket | null>(null)

    // ── Load ──────────────────────────────────────────────────────────────────
    const loadAuction = React.useCallback(() => {
        setLoadError(null)
        setLoading(true)
        getAuction(params.id)
            .then(data => {
                setAuction(data)
                setEndTime(new Date(data.endTime))
                setStartTime(new Date(data.startTime))
                const bids = data.listing.bids ?? []
                const top = bids[0] ? Number(bids[0].amount) : Number(data.startingBid)
                setCurrentBid(top)
                setIsWinning(!!user && bids[0]?.bidderId === user.id)
                setBidHistory(bids.map(b => ({
                    initials: `${b.bidder?.firstName?.[0] ?? "?"}${b.bidder?.lastName?.[0] ?? ""}`.toUpperCase(),
                    amount: Number(b.amount),
                    time: new Date(b.timestamp).toLocaleTimeString("en-GB"),
                })))
                setAntiSnipeActive(new Date(data.endTime).getTime() - Date.now() <= 3 * 60 * 1000)
                // If auction already ended, synthesize endedPayload from DB data so banner renders on page load
                if (data.status === "ENDED") {
                    const winningBid = bids[0] ? Number(bids[0].amount) : null
                    setEndedPayload({
                        auctionId: data.id,
                        winnerId: data.winnerId,
                        winningBidAmount: data.winningBidAmount ? Number(data.winningBidAmount) : winningBid,
                        reserveMet: winningBid !== null && winningBid >= Number(data.reservePrice),
                    })
                }
            })
            .catch(() => setLoadError("Failed to load auction. Please refresh."))
            .finally(() => setLoading(false))
    }, [params.id, user])

    React.useEffect(() => { loadAuction() }, [loadAuction])

    // ── Socket ────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!auction) return
        const socket = io(`${getWebSocketUrl()}/auctions`, {
            withCredentials: true,
            transports: ["websocket"],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        })
        socketRef.current = socket

        socket.on("connect", () => {
            setConnected(true)
            socket.emit("auction:join", { auctionId: auction.id })
        })
        socket.on("disconnect", () => setConnected(false))
        socket.on("reconnect", () => {
            socket.emit("auction:join", { auctionId: auction.id })
        })
        socket.on("auction:viewers", ({ count }: { count: number }) => setWatchers(count))

        socket.on("bid:new", (payload: BidBroadcastPayload) => {
            const wasWinning = user && payload.bidderId !== user.id
            setCurrentBid(payload.amount)
            setIsWinning(!!user && payload.bidderId === user.id)
            setBidHistory(prev => [
                { initials: payload.bidderInitials, amount: payload.amount, time: new Date(payload.timestamp).toLocaleTimeString("en-GB"), isNew: true },
                ...prev.map(b => ({ ...b, isNew: false })),
            ])
            if (payload.newEndTime) {
                setEndTime(new Date(payload.newEndTime))
                setAuction(p => p ? { ...p, endTime: payload.newEndTime! } : p)
                setAntiSnipeActive(true)
                setAntiSnipeToast(true)
                setTimeout(() => setAntiSnipeToast(false), 5000)
            }
            setBidError(null)
            // If user was winning and got outbid, refresh notification bell
            if (wasWinning) triggerNotificationRefresh()
        })

        socket.on("auction:ended", (payload: AuctionEndPayload) => {
            setEndedPayload(payload)
            setAuction(p => p ? { ...p, status: "ENDED", winnerId: payload.winnerId, winningBidAmount: payload.winningBidAmount } : p)
            // Refresh notifications — backend creates AUCTION_WON / AUCTION_ENDED notifications
            triggerNotificationRefresh()
        })

        socket.on("auction:started", () => {
            setAuction(p => p ? { ...p, status: "ACTIVE" } : p)
            triggerNotificationRefresh()
        })

        return () => { socket.disconnect() }
    }, [auction?.id, user])

    // ── Anti-snipe interval ───────────────────────────────────────────────────
    React.useEffect(() => {
        if (!endTime || auction?.status !== "ACTIVE") return
        const iv = setInterval(() => {
            const left = endTime.getTime() - Date.now()
            setAntiSnipeActive(left > 0 && left <= 3 * 60 * 1000)
        }, 10_000)
        return () => clearInterval(iv)
    }, [endTime, auction?.status])

    // ── Auto-scroll bid feed ──────────────────────────────────────────────────
    React.useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = 0
    }, [bidHistory])

    // ── Handle bid ────────────────────────────────────────────────────────────
    const handleBid = React.useCallback(async (amount: number) => {
        if (!auction || !user) return

        // Validate
        const parsed = Number(amount)
        if (isNaN(parsed) || parsed <= 0) {
            setBidError("Please enter a valid bid amount.")
            return
        }
        if (parsed <= currentBid) {
            setBidError(`Bid must exceed the current bid of £${currentBid.toLocaleString()}.`)
            return
        }
        const startingBid = Number(auction.startingBid)
        if (parsed < startingBid) {
            setBidError(`Bid must be at least the starting bid of £${startingBid.toLocaleString()}.`)
            return
        }

        setBidLoading(true)
        setBidError(null)
        try {
            await placeBid(auction.listingId, parsed)
            setBidAmount("")
        } catch (err: any) {
            setBidError(err.message ?? "Failed to place bid. Please try again.")
        } finally {
            setBidLoading(false)
        }
    }, [auction, user, currentBid])

    // ── Share ─────────────────────────────────────────────────────────────────
    const handleShare = React.useCallback(() => {
        navigator.clipboard.writeText(window.location.href).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [])

    const minIncrement = auction ? Number(auction.minIncrement) : 100
    const quickBids = [minIncrement, minIncrement * 2, minIncrement * 5, minIncrement * 10]

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading auction…</p>
            </div>
        </div>
    )

    if (loadError || !auction) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-body)' }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center">
                <Gavel size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">{loadError ?? "Auction not found."}</p>
            <div className="flex items-center gap-3">
                <button
                    onClick={loadAuction}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors"
                >
                    <RefreshCw size={13} /> Try Again
                </button>
                <Link href="/auctions" className="text-slate-500 text-xs font-bold hover:text-white transition-colors flex items-center gap-1">
                    <ArrowLeft size={13} /> All Auctions
                </Link>
            </div>
        </div>
    )

    const isScheduled = auction.status === "SCHEDULED"
    const isLive = auction.status === "ACTIVE"
    const isEnded = auction.status === "ENDED"
    const isCancelled = auction.status === "CANCELLED"
    const isSeller = !!user && auction.listing.sellerId === user.id
    // userWon: check both socket payload (real-time) and auction.winnerId (page load for ended auctions)
    const userWon = isEnded && !!(endedPayload?.winnerId === user?.id || (auction.winnerId && auction.winnerId === user?.id))
    const reserveMet = !!(auction.listing.bids?.[0] && Number(auction.listing.bids[0].amount) >= Number(auction.reservePrice))
    const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"
    const bidCount = bidHistory.length

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen text-white flex flex-col" style={{ background: 'var(--bg-body)' }}>

            {/* ── Anti-Snipe Toast ──────────────────────────────────────────── */}
            <AnimatePresence>
                {antiSnipeToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -40, scale: 0.95 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-500 text-black text-sm font-black px-6 py-3 rounded-full shadow-2xl"
                    >
                        <Zap size={14} /> Anti-Snipe — Auction extended 3 min!
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sub-header ────────────────────────────────────────────────── */}
            <div className="sticky top-[80px] z-30 backdrop-blur-xl border-b" style={{ background: 'var(--bg-header)', borderColor: 'var(--border-default)' }}>
                <div className="container mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/auctions" className="text-slate-500 hover:text-white transition-colors shrink-0">
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="w-px h-4 bg-white/10 shrink-0" />
                        <div className="flex items-center gap-2 min-w-0">
                            {isLive && (
                                <span className="flex items-center gap-1.5 bg-primary text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-widest shadow-[0_0_10px_rgba(237,28,36,0.4)] shrink-0">
                                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                                </span>
                            )}
                            {isScheduled && (
                                <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 text-[9px] font-black px-2.5 py-1 rounded-full shrink-0">
                                    <CalendarClock size={9} /> Scheduled
                                </span>
                            )}
                            {isEnded && (
                                <span className="bg-slate-700 text-slate-400 text-[9px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase shrink-0">Ended</span>
                            )}
                            {isCancelled && (
                                <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[9px] font-black px-2.5 py-1 rounded-full shrink-0">
                                    <Ban size={9} /> Cancelled
                                </span>
                            )}
                            {antiSnipeActive && isLive && (
                                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse shrink-0">
                                    <Zap size={8} /> Anti-Snipe
                                </span>
                            )}
                            <h1 className="text-white font-bold text-sm truncate">
                                {auction.listing.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {isLive && endTime && (
                            <div className="hidden sm:flex flex-col items-end">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Ends In</p>
                                <CountdownTimer targetDate={endTime} minimal />
                            </div>
                        )}
                        {isScheduled && startTime && (
                            <div className="hidden sm:flex flex-col items-end">
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Starts In</p>
                                <CountdownTimer targetDate={startTime} minimal />
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-white/10 px-3 py-1.5 rounded-full">
                            <Users size={11} className="text-primary" />
                            <span className="text-xs font-bold">{watchers}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
                            <span className="text-[9px] text-slate-500 hidden sm:inline">{connected ? "Live" : "Offline"}</span>
                        </div>
                        <button
                            onClick={handleShare}
                            className="text-slate-500 hover:text-white transition-colors relative"
                            title="Copy link"
                        >
                            <Share2 size={15} />
                            {copied && (
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-slate-700 text-white px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                    Copied!
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Cancelled Banner ──────────────────────────────────────────── */}
            {isCancelled && (
                <div className="bg-red-500/10 border-b border-red-500/20">
                    <div className="container mx-auto px-6 py-4 flex items-center gap-3">
                        <Ban size={16} className="text-red-400 shrink-0" />
                        <div>
                            <p className="text-red-400 font-bold text-sm">This auction has been cancelled</p>
                            <p className="text-slate-500 text-xs">The seller has cancelled this auction before it started.</p>
                        </div>
                        <Link href="/auctions" className="ml-auto text-xs font-bold text-primary hover:text-red-400 transition-colors shrink-0">
                            Browse Auctions →
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Seller Banner ─────────────────────────────────────────────── */}
            {isSeller && !isCancelled && (
                <div className="bg-blue-500/10 border-b border-blue-500/20">
                    <div className="container mx-auto px-6 py-3 flex items-center gap-3">
                        <Info size={15} className="text-blue-400 shrink-0" />
                        <p className="text-blue-300 text-sm">
                            <strong>This is your auction.</strong>{" "}
                            {isLive ? "Your auction is live — bids appear in real time." : isScheduled ? "Your auction is scheduled and will start automatically." : "Your auction has ended."}
                        </p>
                        <Link href="/dashboard/seller/auctions" className="ml-auto text-xs font-bold text-blue-400 hover:text-blue-300 shrink-0 transition-colors">
                            Manage →
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Scheduled Banner ──────────────────────────────────────────── */}
            {isScheduled && !isSeller && (
                <div className="bg-blue-500/10 border-b border-blue-500/20">
                    <div className="container mx-auto px-6 py-3 flex items-center gap-3">
                        <CalendarClock size={15} className="text-blue-400 shrink-0" />
                        <p className="text-blue-300 text-sm">
                            This auction hasn't started yet — it opens automatically at{" "}
                            <strong>{startTime ? startTime.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Winner / End Banner ───────────────────────────────────────── */}
            <AnimatePresence>
                {isEnded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className={`border-b ${userWon ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/40 border-white/5"}`}
                    >
                        <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            {userWon ? (
                                <>
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Trophy size={18} className="text-emerald-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-emerald-400 font-black text-sm uppercase tracking-wider">You won this auction!</p>
                                            <p className="text-slate-400 text-xs">Winning bid: <span className="text-white font-bold">£{Number(endedPayload?.winningBidAmount).toLocaleString()}</span></p>
                                        </div>
                                    </div>
                                    {/* Buyer fee + chat actions */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs">
                                            <p className="text-amber-400 font-black text-[10px] uppercase tracking-widest mb-0.5">Buyer Fee Due</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-white font-black text-base">£125</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Link href={`/checkout?listing_id=${auction.listingId}&mode=auction_fee`}>
                                                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs h-9 flex items-center gap-1.5">
                                                    <CreditCard size={13} /> Pay £125 Fee
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="outline"
                                                className="w-full border-white/10 text-slate-400 font-bold text-xs h-9 flex items-center gap-1.5"
                                                disabled={connectingChat}
                                                onClick={async () => {
                                                    const sellerId = auction.listing.sellerId
                                                    if (!sellerId) return
                                                    setConnectingChat(true)
                                                    try {
                                                        const room = await createChatRoom(sellerId, auction.listingId)
                                                        window.location.href = `/dashboard/buyer/messages?room=${room.id}`
                                                    } catch {
                                                        window.location.href = "/dashboard/buyer/messages"
                                                    } finally {
                                                        setConnectingChat(false)
                                                    }
                                                }}
                                            >
                                                <MessageSquare size={13} /> Message Seller
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : endedPayload?.reserveMet === false ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <AlertCircle size={15} className="text-amber-400 shrink-0" />
                                    <p>Auction ended — reserve price was not met. <span className="text-slate-500 text-xs">No sale was completed.</span></p>
                                </div>
                            ) : endedPayload?.winnerId ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Gavel size={15} className="shrink-0" />
                                    <p>Auction ended. Winning bid: <span className="text-white font-bold">£{Number(endedPayload?.winningBidAmount ?? 0).toLocaleString()}</span></p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Gavel size={15} className="shrink-0" />
                                    <p>Auction ended with no bids placed.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Offline Reconnect Banner ──────────────────────────────────── */}
            <AnimatePresence>
                {!connected && isLive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-amber-500/10 border-b border-amber-500/20"
                    >
                        <div className="container mx-auto px-6 py-2 flex items-center gap-2 text-amber-400 text-xs font-bold">
                            <WifiOff size={13} className="shrink-0" />
                            Connection lost — attempting to reconnect. Bids may not update in real time.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main Layout ───────────────────────────────────────────────── */}
            <div className="flex-1 container mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* ── Left Column ───────────────────────────────────────────── */}
                <div className="space-y-5 min-w-0">

                    {/* Vehicle image */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-800 border border-white/5 shadow-xl">
                        <Image src={image} alt={auction.listing.title} fill className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

                        {isLive && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(237,28,36,0.5)] tracking-widest z-10">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                            </div>
                        )}
                        {isScheduled && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-blue-600/90 text-white text-[10px] font-black px-3 py-1.5 rounded-full z-10">
                                <CalendarClock size={11} /> Upcoming
                            </div>
                        )}
                        {isCancelled && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-slate-700 text-slate-300 text-[10px] font-black px-3 py-1.5 rounded-full z-10">
                                <Ban size={11} /> Cancelled
                            </div>
                        )}

                        {/* Bottom overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between z-10">
                            <div>
                                <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">
                                    {isEnded ? "Final Bid" : isScheduled ? "Starting Bid" : "Current Bid"}
                                </p>
                                <p className="text-4xl md:text-5xl font-black text-white font-mono leading-none drop-shadow-2xl">
                                    £{currentBid.toLocaleString()}
                                </p>
                                {reserveMet && (
                                    <div className="flex items-center gap-1 mt-2 text-emerald-400 text-[10px] font-bold">
                                        <ShieldCheck size={11} /> Reserve Met
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {isLive && isWinning && !isSeller && (
                                    <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-full backdrop-blur">
                                        <CheckCircle size={10} /> Winning
                                    </div>
                                )}
                                {isLive && !isWinning && user && !isSeller && bidCount > 0 && (
                                    <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black px-3 py-1.5 rounded-full backdrop-blur">
                                        <AlertCircle size={10} /> Outbid
                                    </div>
                                )}
                                {isLive && endTime && (
                                    <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-xl px-3 py-2 text-center">
                                        <p className="text-[8px] text-white/40 uppercase tracking-widest font-bold mb-0.5">Ends In</p>
                                        <div className="text-white font-mono font-black text-lg leading-none">
                                            <CountdownTimer targetDate={endTime} minimal />
                                        </div>
                                    </div>
                                )}
                                {isScheduled && startTime && (
                                    <div className="bg-blue-900/60 backdrop-blur border border-blue-500/20 rounded-xl px-3 py-2 text-center">
                                        <p className="text-[8px] text-blue-300/60 uppercase tracking-widest font-bold mb-0.5">Starts In</p>
                                        <div className="text-blue-300 font-mono font-black text-lg leading-none">
                                            <CountdownTimer targetDate={startTime} minimal />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Anti-snipe alert */}
                    <AnimatePresence>
                        {antiSnipeActive && isLive && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-amber-400 text-xs font-bold"
                            >
                                <Zap size={14} className="animate-pulse shrink-0" />
                                Anti-Snipe Active — any bid in the final 3 minutes extends the auction by 3 minutes
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tabs */}
                    <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="flex border-b border-white/5">
                            {[
                                { id: "details", label: "Details", icon: Info },
                                { id: "bids", label: `Bids (${bidCount})`, icon: Timer },
                                { id: "seller", label: "Seller", icon: Users },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`relative flex-1 sm:flex-none px-5 py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 transition-colors ${activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    <tab.icon size={11} /> {tab.label}
                                    {activeTab === tab.id && (
                                        <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="p-5">
                            <AnimatePresence mode="wait">
                                {activeTab === "details" && (
                                    <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { label: "Year", value: auction.listing.year ?? "—" },
                                                { label: "Make", value: auction.listing.make ?? "—" },
                                                { label: "Model", value: auction.listing.model ?? "—" },
                                                { label: "Min Increment", value: `£${Number(auction.minIncrement).toLocaleString()}` },
                                            ].map(s => (
                                                <div key={s.label} className="bg-slate-900/60 border border-white/5 rounded-xl p-3 text-center">
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                                    <p className="text-sm font-black text-white">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2.5">
                                            {[
                                                ["Starting Bid", `£${Number(auction.startingBid).toLocaleString()}`],
                                                ["Reserve Price", `£${Number(auction.reservePrice).toLocaleString()}`],
                                                ["Starts", startTime ? startTime.toLocaleString("en-GB") : "—"],
                                                ["Ends", endTime ? endTime.toLocaleString("en-GB") : "—"],
                                            ].map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">{k}</span>
                                                    <span className="text-white font-bold font-mono">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-start gap-2.5 p-3.5 bg-slate-900/30 border border-white/5 rounded-xl text-slate-500 text-xs leading-relaxed">
                                            <Info size={12} className="shrink-0 mt-0.5" />
                                            <p>All transactions are arranged directly between buyer and seller. A chat opens automatically when the auction ends with the winner.</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === "bids" && (
                                    <motion.div key="bids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                        {bidHistory.length === 0 ? (
                                            <div className="py-12 text-center">
                                                <Gavel size={24} className="text-slate-600 mx-auto mb-2" />
                                                <p className="text-slate-500 text-xs">No bids yet — be the first.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-[9px] text-slate-600 uppercase tracking-widest px-2 pb-2">
                                                    <span>Bidder</span><span>Amount</span>
                                                </div>
                                                {bidHistory.map((bid, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={bid.isNew ? { opacity: 0, x: -8 } : false}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className={`flex justify-between items-center px-3 py-2.5 rounded-xl transition-colors ${i === 0 ? "bg-primary/5 border border-primary/20" : "hover:bg-white/5"}`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-black text-slate-400">
                                                                {bid.initials}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-400">{bid.initials}</span>
                                                            {i === 0 && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black uppercase">Leader</span>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-mono font-black text-white text-sm">£{bid.amount.toLocaleString()}</p>
                                                            <p className="text-[9px] text-slate-600">{bid.time}</p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                                {activeTab === "seller" && (
                                    <motion.div key="seller" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="flex items-center gap-4 p-4 bg-slate-900/40 border border-white/5 rounded-xl">
                                            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shrink-0">
                                                {getSellerInitials(auction)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{getSellerName(auction)}</h3>
                                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mt-0.5">
                                                    <ShieldCheck size={11} /> Verified Seller
                                                </div>
                                                <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                                    Win the auction and a direct chat with this seller opens automatically to arrange the deal.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* ── Right Column ──────────────────────────────────────────── */}
                <aside className="flex flex-col gap-4">

                    {/* Live feed */}
                    <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ height: 380 }}>
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/30 shrink-0">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                <Flame size={12} className="text-primary" /> Live Feed
                                {bidCount > 0 && (
                                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black">{bidCount}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {connected
                                    ? <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[9px] text-slate-500">Live</span></>
                                    : <><WifiOff size={10} className="text-red-500" /><span className="text-[9px] text-red-500">Offline</span></>
                                }
                            </div>
                        </div>

                        <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                            {bidHistory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-600">
                                    <Gavel size={20} />
                                    <p className="text-xs text-center leading-relaxed">
                                        {isScheduled ? "Bidding opens when the auction starts." : "Waiting for first bid…"}
                                    </p>
                                </div>
                            ) : (
                                bidHistory.map((bid, i) => (
                                    <motion.div
                                        key={i}
                                        initial={bid.isNew ? { opacity: 0, y: -8 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${i === 0 ? "bg-primary/5 border border-primary/15" : "hover:bg-white/5"}`}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                            <span className="text-[9px] font-black text-slate-400">{bid.initials}</span>
                                        </div>
                                        <span className="text-slate-500 text-[10px]">bid</span>
                                        <span className="font-mono font-black text-white text-xs">£{bid.amount.toLocaleString()}</span>
                                        {i === 0 && <TrendingUp size={10} className="text-emerald-400 shrink-0" />}
                                        <span className="ml-auto text-[9px] text-slate-600 shrink-0">{bid.time}</span>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bid controls */}
                    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 space-y-4">
                        {isCancelled ? (
                            <div className="text-center py-4 space-y-2">
                                <Ban size={20} className="text-slate-500 mx-auto" />
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Auction Cancelled</p>
                            </div>
                        ) : isEnded ? (
                            <div className="text-center py-4 space-y-2">
                                <Gavel size={20} className="text-slate-500 mx-auto" />
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    {userWon ? "You won! 🏆" : "Auction Ended"}
                                </p>
                                {userWon && (
                                    <Link href="/dashboard/buyer/messages">
                                        <Button className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 flex items-center gap-2">
                                            <MessageSquare size={13} /> Message Seller
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        ) : isScheduled ? (
                            <div className="text-center py-4 space-y-2">
                                <CalendarClock size={20} className="text-blue-400 mx-auto" />
                                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Bidding Opens Soon</p>
                                {startTime && (
                                    <p className="text-slate-500 text-xs">
                                        {startTime.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                )}
                            </div>
                        ) : isSeller ? (
                            <div className="text-center py-4 space-y-2">
                                <Info size={20} className="text-blue-400 mx-auto" />
                                <p className="text-blue-300 text-xs font-bold">This is your auction</p>
                                <p className="text-slate-500 text-xs leading-relaxed">You cannot bid on your own listing. Watchers and bids appear in real time.</p>
                                <Link href="/dashboard/seller/auctions">
                                    <Button variant="outline" className="w-full mt-2 text-xs h-9 border-white/10 text-slate-400">
                                        Manage Auction
                                    </Button>
                                </Link>
                            </div>
                        ) : !user ? (
                            <div className="space-y-3">
                                <p className="text-slate-400 text-xs text-center leading-relaxed">
                                    Sign in to place bids and participate in live auctions.
                                </p>
                                <Link href={`/auth/login?redirect=/auctions/live/${params.id}`}>
                                    <Button className="w-full bg-gradient-to-br from-primary to-red-700 hover:from-red-500 hover:to-primary text-white font-black text-sm h-11 shadow-neon">
                                        Sign In to Bid
                                    </Button>
                                </Link>
                                <Link href="/auth/signup" className="block text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                    Don't have an account? <span className="text-primary underline">Sign up free</span>
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Status */}
                                <div className="text-center pb-3 border-b border-white/5">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Current Bid</p>
                                    <p className="text-2xl font-black text-white font-mono">£{currentBid.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Min next bid: <span className="text-white font-bold">£{(currentBid + minIncrement).toLocaleString()}</span>
                                    </p>
                                </div>

                                {/* Quick bids */}
                                <div className="grid grid-cols-2 gap-2">
                                    {quickBids.map(inc => (
                                        <button
                                            key={inc}
                                            onClick={() => handleBid(currentBid + inc)}
                                            disabled={bidLoading}
                                            className="bg-slate-900/60 hover:bg-primary/10 hover:border-primary/30 border border-white/10 rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all active:scale-95 disabled:opacity-40 group"
                                        >
                                            <span className="text-[9px] text-slate-500 group-hover:text-slate-400 font-bold transition-colors">
                                                +£{inc >= 1000 ? `${inc / 1000}k` : inc}
                                            </span>
                                            <span className="text-sm text-white font-black font-mono">£{(currentBid + inc).toLocaleString()}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Custom bid */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-black">£</span>
                                        <Input
                                            type="number"
                                            placeholder="Custom amount"
                                            className="bg-slate-900/60 border-white/10 focus:border-primary/50 text-white pl-6 h-11 text-sm font-mono"
                                            value={bidAmount}
                                            onChange={e => { setBidAmount(e.target.value); setBidError(null) }}
                                            onKeyDown={e => { if (e.key === "Enter" && bidAmount) handleBid(Number(bidAmount)) }}
                                            min={currentBid + minIncrement}
                                        />
                                    </div>
                                    <Button
                                        onClick={() => handleBid(Number(bidAmount) || currentBid + minIncrement)}
                                        disabled={bidLoading}
                                        className="h-11 px-5 bg-gradient-to-br from-primary to-red-700 hover:from-red-500 hover:to-primary disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest shadow-neon transition-all"
                                    >
                                        {bidLoading ? (
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            </span>
                                        ) : (
                                            <><Gavel size={14} /> Bid</>
                                        )}
                                    </Button>
                                </div>

                                {bidError && (
                                    <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-red-400 text-xs leading-relaxed">{bidError}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Trust note */}
                    {!isCancelled && !isSeller && (
                        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-slate-800/40 border border-white/5 rounded-xl text-xs text-slate-500">
                            <ShieldCheck size={13} className="shrink-0 mt-0.5 text-emerald-500" />
                            All deals are arranged directly between buyer and seller via Carmazium secure chat.
                        </div>
                    )}

                    {/* Buyer fee notice */}
                    {!isCancelled && !isSeller && isLive && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                <CreditCard size={11} /> Buyer Fee
                            </p>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Fee on winning</span>
                                <span className="text-white font-black text-base">£125</span>
                            </div>
                            <p className="text-[10px] text-slate-500">One-time fee payable after the auction closes if you win.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}
