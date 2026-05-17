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
    ShieldCheck, Info, Zap, Trophy, Clock, WifiOff, ChevronRight,
    MessageSquare, Timer, Flame,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { useAuth } from "@/context/AuthContext"
import { getAuction, type Auction, type BidBroadcastPayload, type AuctionEndPayload } from "@/lib/auctionApi"
import { placeBid } from "@/lib/listingApi"
import { getWebSocketUrl } from "@/lib/chatApi"

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

    const feedRef = React.useRef<HTMLDivElement>(null)
    const socketRef = React.useRef<Socket | null>(null)

    // ── Load ──────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        getAuction(params.id)
            .then(data => {
                setAuction(data)
                setEndTime(new Date(data.endTime))
                const bids = data.listing.bids ?? []
                const top = bids[0] ? Number(bids[0].amount) : Number(data.startingBid)
                setCurrentBid(top)
                setIsWinning(!!user && bids[0]?.bidderId === user.id)
                setBidHistory(bids.map(b => ({
                    initials: `${b.bidder?.firstName?.[0] ?? "?"}${b.bidder?.lastName?.[0] ?? ""}`.toUpperCase(),
                    amount: Number(b.amount),
                    time: new Date(b.timestamp).toLocaleTimeString("en-GB"),
                })))
                setAntiSnipeActive(new Date(data.endTime).getTime() - Date.now() <= 10 * 60 * 1000)
            })
            .catch(() => setLoadError("Failed to load auction. Please refresh."))
            .finally(() => setLoading(false))
    }, [params.id, user])

    // ── Socket ────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!auction) return
        const socket = io(`${getWebSocketUrl()}/auctions`, { withCredentials: true, transports: ["websocket"] })
        socketRef.current = socket
        socket.on("connect", () => { setConnected(true); socket.emit("auction:join", { auctionId: auction.id }) })
        socket.on("disconnect", () => setConnected(false))
        socket.on("auction:viewers", ({ count }: { count: number }) => setWatchers(count))
        socket.on("bid:new", (payload: BidBroadcastPayload) => {
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
        })
        socket.on("auction:ended", (payload: AuctionEndPayload) => {
            setEndedPayload(payload)
            setAuction(p => p ? { ...p, status: "ENDED", winnerId: payload.winnerId, winningBidAmount: payload.winningBidAmount } : p)
        })
        socket.on("auction:started", () => setAuction(p => p ? { ...p, status: "ACTIVE" } : p))
        return () => { socket.disconnect() }
    }, [auction?.id, user])

    React.useEffect(() => {
        if (!endTime || auction?.status !== "ACTIVE") return
        const iv = setInterval(() => {
            const left = endTime.getTime() - Date.now()
            setAntiSnipeActive(left > 0 && left <= 3 * 60 * 1000)
        }, 10_000)
        return () => clearInterval(iv)
    }, [endTime, auction?.status])

    React.useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
    }, [bidHistory])

    const handleBid = React.useCallback(async (amount: number) => {
        if (!auction || !user) return
        if (amount <= currentBid) { setBidError(`Bid must exceed current bid of £${currentBid.toLocaleString()}`); return }
        setBidLoading(true); setBidError(null)
        try { await placeBid(auction.listingId, amount); setBidAmount("") }
        catch (err: any) { setBidError(err.message ?? "Failed to place bid.") }
        finally { setBidLoading(false) }
    }, [auction, user, currentBid])

    const minIncrement = auction ? Number(auction.minIncrement) : 100
    const quickBids = [minIncrement, minIncrement * 2, minIncrement * 5, minIncrement * 10]

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) return (
        <div className="bg-[#080809] min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-600">
                <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading auction…</p>
            </div>
        </div>
    )

    if (loadError || !auction) return (
        <div className="bg-[#080809] min-h-screen flex flex-col items-center justify-center gap-4">
            <Gavel size={32} className="text-slate-700" />
            <p className="text-slate-400 text-sm">{loadError ?? "Auction not found."}</p>
            <Link href="/auctions" className="text-red-500 text-xs font-bold uppercase tracking-widest hover:text-red-400 transition-colors">
                ← Back to Auctions
            </Link>
        </div>
    )

    const isLive = auction.status === "ACTIVE"
    const isEnded = auction.status === "ENDED"
    const userWon = isEnded && endedPayload?.winnerId === user?.id
    const reserveMet = !!(auction.listing.bids?.[0] && Number(auction.listing.bids[0].amount) >= Number(auction.reservePrice))
    const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"

    return (
        <div className="bg-[#080809] min-h-screen text-white flex flex-col">

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
            <div className="sticky top-[80px] z-30 bg-[#080809]/95 backdrop-blur-xl border-b border-white/[0.06] px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/auctions" className="text-slate-600 hover:text-white transition-colors">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="w-px h-4 bg-white/[0.08]" />
                    <div className="flex items-center gap-2.5">
                        {isLive && (
                            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest">
                                <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                            </span>
                        )}
                        {isEnded && (
                            <span className="bg-white/[0.08] text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Ended</span>
                        )}
                        {antiSnipeActive && isLive && (
                            <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                <Zap size={8} /> Anti-Snipe
                            </span>
                        )}
                        <h1 className="text-white font-bold text-sm truncate max-w-[180px] md:max-w-sm">
                            {auction.listing.title}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isLive && endTime && (
                        <div className="hidden sm:flex flex-col items-end">
                            <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Ends In</p>
                            <CountdownTimer targetDate={endTime} minimal />
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
                        <Users size={11} className="text-red-500" />
                        <span className="text-xs font-bold">{watchers}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-700"}`} />
                        <span className="text-[9px] text-slate-600 hidden sm:inline">{connected ? "Live" : "Offline"}</span>
                    </div>
                    <button className="text-slate-600 hover:text-white transition-colors">
                        <Share2 size={15} />
                    </button>
                </div>
            </div>

            {/* ── Winner / End Banner ───────────────────────────────────────── */}
            <AnimatePresence>
                {isEnded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className={`border-b ${userWon ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.03] border-white/[0.06]"}`}
                    >
                        <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            {userWon ? (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Trophy size={20} className="text-emerald-400" />
                                        <div>
                                            <p className="text-emerald-400 font-black text-sm uppercase tracking-wider">You won this auction</p>
                                            <p className="text-slate-400 text-xs">Winning bid: £{Number(endedPayload?.winningBidAmount).toLocaleString()} — chat the seller to arrange collection</p>
                                        </div>
                                    </div>
                                    <Link href="/dashboard/buyer/messages">
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 text-xs h-9">
                                            <MessageSquare size={13} /> Open Chat
                                        </Button>
                                    </Link>
                                </>
                            ) : endedPayload?.reserveMet === false ? (
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                    <Info size={15} />
                                    <p>Auction ended — reserve price was not met.</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Gavel size={15} />
                                    <p>Auction ended. Winning bid: <span className="text-white font-bold">£{Number(endedPayload?.winningBidAmount ?? 0).toLocaleString()}</span></p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main Layout ───────────────────────────────────────────────── */}
            <div className="flex-1 container mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* ── Left Column ───────────────────────────────────────────── */}
                <div className="space-y-5 min-w-0">

                    {/* Vehicle image */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0d0d0f] border border-white/[0.07]">
                        <Image src={image} alt={auction.listing.title} fill className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                        {isLive && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] tracking-widest">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                            </div>
                        )}

                        {/* Bottom overlay: current bid + countdown prominent */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                            <div>
                                <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">
                                    {isEnded ? "Final Bid" : "Current Bid"}
                                </p>
                                <p className="text-4xl font-black text-white font-mono leading-none">
                                    £{currentBid.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {isLive && isWinning && (
                                    <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full">
                                        <CheckCircle size={10} /> Winning
                                    </div>
                                )}
                                {isLive && !isWinning && user && (
                                    <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black px-3 py-1 rounded-full">
                                        <AlertCircle size={10} /> Outbid
                                    </div>
                                )}
                                {reserveMet && (
                                    <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                        <ShieldCheck size={10} /> Reserve Met
                                    </div>
                                )}
                                {isLive && endTime && (
                                    <div className="bg-black/60 backdrop-blur border border-white/10 rounded-xl px-3 py-2 text-center">
                                        <p className="text-[8px] text-white/40 uppercase tracking-widest font-bold mb-0.5">Ends In</p>
                                        <div className="text-white font-mono font-black text-lg leading-none">
                                            <CountdownTimer targetDate={endTime} minimal />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Anti-snipe banner */}
                    <AnimatePresence>
                        {antiSnipeActive && isLive && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-xs font-bold"
                            >
                                <Zap size={14} className="animate-pulse shrink-0" />
                                Anti-Snipe Active — any bid in the final 3 minutes extends the auction
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tabs */}
                    <div className="bg-[#0d0d0f] border border-white/[0.07] rounded-2xl overflow-hidden">
                        <div className="flex border-b border-white/[0.06]">
                            {[
                                { id: "details", label: "Details", icon: Info },
                                { id: "bids", label: `Bids (${bidHistory.length})`, icon: Timer },
                                { id: "seller", label: "Seller", icon: Users },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`relative flex-1 sm:flex-none px-5 py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 transition-colors ${activeTab === tab.id ? "text-white" : "text-slate-600 hover:text-slate-400"}`}
                                >
                                    <tab.icon size={11} /> {tab.label}
                                    {activeTab === tab.id && (
                                        <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500" />
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
                                                { label: "Min Bid", value: `£${Number(auction.minIncrement).toLocaleString()}` },
                                            ].map(s => (
                                                <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                                                    <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">{s.label}</p>
                                                    <p className="text-sm font-black text-white">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2.5 text-xs text-slate-400">
                                            {[
                                                ["Starting Bid", `£${Number(auction.startingBid).toLocaleString()}`],
                                                ["Reserve Price", `£${Number(auction.reservePrice).toLocaleString()}`],
                                                ["Auction Ends", endTime ? endTime.toLocaleString("en-GB") : "—"],
                                            ].map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-center">
                                                    <span>{k}</span>
                                                    <span className="text-white font-bold font-mono">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-start gap-2.5 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-slate-600 text-xs leading-relaxed">
                                            <Info size={12} className="shrink-0 mt-0.5" />
                                            <p>All transactions are arranged directly between buyer and seller. A chat is auto-created when the auction ends.</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === "bids" && (
                                    <motion.div key="bids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                        {bidHistory.length === 0 ? (
                                            <div className="py-12 text-center">
                                                <Gavel size={24} className="text-slate-700 mx-auto mb-2" />
                                                <p className="text-slate-600 text-xs">No bids yet — be the first.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-[9px] text-slate-700 uppercase tracking-widest px-2 pb-2">
                                                    <span>Bidder</span><span>Amount</span>
                                                </div>
                                                {bidHistory.map((bid, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={bid.isNew ? { opacity: 0, x: -8 } : false}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className={`flex justify-between items-center px-3 py-2.5 rounded-xl ${i === 0 ? "bg-white/[0.05] border border-white/[0.08]" : "hover:bg-white/[0.03]"}`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-black text-slate-400">
                                                                {bid.initials}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-400">{bid.initials}</span>
                                                            {i === 0 && <span className="text-[9px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded-full font-black uppercase">Leader</span>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-mono font-black text-white text-sm">£{bid.amount.toLocaleString()}</p>
                                                            <p className="text-[9px] text-slate-700">{bid.time}</p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                                {activeTab === "seller" && (
                                    <motion.div key="seller" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                                            <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center text-white font-black border border-white/[0.08] shrink-0">
                                                {getSellerInitials(auction)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{getSellerName(auction)}</h3>
                                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mt-0.5">
                                                    <ShieldCheck size={11} /> Verified
                                                </div>
                                                <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                                    Win the auction and a direct chat with this seller is created automatically.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Bid Panel ────────────────────────────────── */}
                <aside className="flex flex-col gap-4">

                    {/* Live feed */}
                    <div className="bg-[#0d0d0f] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col" style={{ height: 420 }}>
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                <Flame size={12} className="text-red-500" /> Live Feed
                            </div>
                            <div className="flex items-center gap-1.5">
                                {connected
                                    ? <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[9px] text-slate-600">Connected</span></>
                                    : <><WifiOff size={10} className="text-slate-700" /><span className="text-[9px] text-slate-700">Offline</span></>
                                }
                            </div>
                        </div>

                        {/* Feed */}
                        <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                            {bidHistory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-700">
                                    <Gavel size={20} />
                                    <p className="text-xs">Waiting for first bid…</p>
                                </div>
                            ) : (
                                bidHistory.map((bid, i) => (
                                    <motion.div
                                        key={i}
                                        initial={bid.isNew ? { opacity: 0, y: -6 } : false}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${i === 0 ? "bg-white/[0.05] border border-white/[0.08]" : "hover:bg-white/[0.03]"}`}
                                    >
                                        <span className="text-[10px] font-black text-slate-500 w-6 text-center">{bid.initials}</span>
                                        <span className="text-slate-600 text-[10px]">bid</span>
                                        <span className="font-mono font-black text-white text-xs">£{bid.amount.toLocaleString()}</span>
                                        <span className="ml-auto text-[9px] text-slate-700">{bid.time}</span>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bid controls */}
                    <div className="bg-[#0d0d0f] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                        {isEnded ? (
                            <p className="text-center text-slate-600 text-xs font-bold uppercase tracking-widest py-4">Auction Ended</p>
                        ) : !user ? (
                            <Link href="/auth/login">
                                <Button className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest h-11">
                                    Sign In to Bid
                                </Button>
                            </Link>
                        ) : !isLive ? (
                            <div className="text-center py-4 text-slate-600 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <Clock size={12} /> Not Started Yet
                            </div>
                        ) : (
                            <>
                                {/* Quick bids */}
                                <div className="grid grid-cols-4 gap-1.5">
                                    {quickBids.map(inc => (
                                        <button
                                            key={inc}
                                            onClick={() => handleBid(currentBid + inc)}
                                            disabled={bidLoading}
                                            className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
                                        >
                                            <span className="text-[9px] text-slate-500 font-bold">+£{inc >= 1000 ? `${inc / 1000}k` : inc}</span>
                                            <span className="text-[10px] text-white font-black">£{(currentBid + inc).toLocaleString()}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Custom bid */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-black">£</span>
                                        <Input
                                            type="number"
                                            placeholder="Custom amount"
                                            className="bg-white/[0.04] border-white/[0.08] focus:border-red-500/50 text-white pl-6 h-11 text-sm font-mono"
                                            value={bidAmount}
                                            onChange={e => setBidAmount(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter" && bidAmount) handleBid(Number(bidAmount)) }}
                                        />
                                    </div>
                                    <Button
                                        onClick={() => handleBid(Number(bidAmount) || currentBid + minIncrement)}
                                        disabled={bidLoading}
                                        className="h-11 px-5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.25)]"
                                    >
                                        {bidLoading ? "…" : <><Gavel size={14} /> Bid</>}
                                    </Button>
                                </div>

                                {bidError && (
                                    <p className="text-red-400 text-xs text-center">{bidError}</p>
                                )}

                                <p className="text-[9px] text-slate-700 text-center font-bold uppercase tracking-widest">
                                    Min next bid: £{(currentBid + minIncrement).toLocaleString()}
                                </p>
                            </>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    )
}
