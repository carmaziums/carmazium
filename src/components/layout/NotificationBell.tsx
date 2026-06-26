"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    Bell, Tag, CheckCircle, XCircle, RefreshCw,
    MessageSquare, BadgeCheck, CreditCard, MinusCircle,
    Loader2, Check, Gavel, Trophy, Timer, Zap,
    TrendingDown, ShieldCheck, AlertCircle,
} from "lucide-react"
import {
    getNotifications, markAllNotificationsRead, markNotificationRead,
    type AppNotification,
} from "@/lib/notificationsApi"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { getPendingOffersCount } from "@/lib/listingApi"

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
    // Offers
    OFFER_RECEIVED:        <Tag size={14} className="text-amber-400" />,
    OFFER_ACCEPTED:        <CheckCircle size={14} className="text-emerald-400" />,
    OFFER_REJECTED:        <XCircle size={14} className="text-red-400" />,
    OFFER_COUNTERED:       <RefreshCw size={14} className="text-blue-400" />,
    OFFER_WITHDRAWN:       <MinusCircle size={14} className="text-gray-400" />,
    // Messages
    NEW_MESSAGE:           <MessageSquare size={14} className="text-blue-400" />,
    MESSAGE_RECEIVED:      <MessageSquare size={14} className="text-blue-400" />,
    // Deals / listings
    DEAL_CLOSED:           <CheckCircle size={14} className="text-emerald-400" />,
    LISTING_SOLD:          <BadgeCheck size={14} className="text-emerald-400" />,
    FINANCE_UPDATE:        <CreditCard size={14} className="text-purple-400" />,
    // Auctions
    AUCTION_BID:           <Gavel size={14} className="text-orange-400" />,
    AUCTION_BID_PLACED:    <Gavel size={14} className="text-orange-400" />,
    AUCTION_OUTBID:        <TrendingDown size={14} className="text-red-400" />,
    AUCTION_WON:           <Trophy size={14} className="text-amber-400" />,
    AUCTION_ENDED:         <Gavel size={14} className="text-slate-400" />,
    AUCTION_ENDED_NO_SALE: <AlertCircle size={14} className="text-slate-400" />,
    AUCTION_STARTED:       <Zap size={14} className="text-emerald-400" />,
    AUCTION_ENDING_SOON:   <Timer size={14} className="text-amber-400" />,
    AUCTION_CANCELLED:     <XCircle size={14} className="text-red-400" />,
    AUCTION_RESERVE_MET:   <ShieldCheck size={14} className="text-emerald-400" />,
}

function getIcon(type: string) {
    return ICON_MAP[type] ?? <Bell size={14} className="text-gray-400" />
}

/** Map legacy dashboard URLs to unified `/dashboard/user` tab deep-links */
function normalizeNotificationHref(href: string): string {
    if (!href.startsWith("/")) return href
    if (href.startsWith("/dashboard/user")) return href
    if (href.startsWith("/dashboard/buyer/offers")) return "/dashboard/user?tab=bids"
    if (href.startsWith("/dashboard/seller/offers")) return "/dashboard/user?tab=offers"
    if (href.startsWith("/dashboard/buyer/messages")) {
        const m = href.match(/[?&]room=([^&]+)/)
        return m ? `/dashboard/user?tab=messages&room=${decodeURIComponent(m[1])}` : "/dashboard/user?tab=messages"
    }
    if (href === "/dashboard" || href === "/dashboard/") return "/dashboard/user?tab=overview"
    return href
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
    const { user } = useAuth()
    const { unreadCount: chatUnread } = useChat()
    const router = useRouter()

    const [open, setOpen] = React.useState(false)
    const [notifications, setNotifications] = React.useState<AppNotification[]>([])
    const [loading, setLoading] = React.useState(false)
    const [pendingOffers, setPendingOffers] = React.useState(0)
    const ref = React.useRef<HTMLDivElement>(null)

    // Poll pending offers every 30s
    React.useEffect(() => {
        if (!user) { setPendingOffers(0); return }
        const fetch = () => getPendingOffersCount().then(setPendingOffers).catch(() => {})
        fetch()
        const id = setInterval(fetch, 30000)
        return () => clearInterval(id)
    }, [user])

    // Listen for auction notification refresh triggers from the live auction room
    React.useEffect(() => {
        if (!user) return
        const handler = () => {
            getNotifications(12).then(setNotifications).catch(() => {})
        }
        window.addEventListener("auction:refresh-notifications", handler)
        return () => window.removeEventListener("auction:refresh-notifications", handler)
    }, [user])

    // Click-outside close
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // Load notifications when panel opens
    React.useEffect(() => {
        if (!open || !user) return
        setLoading(true)
        getNotifications(12).then(setNotifications).finally(() => setLoading(false))
    }, [open, user])

    const totalUnread = notifications.filter(n => !n.isRead).length + chatUnread
    const unreadNotifs = notifications.filter(n => !n.isRead).length

    async function handleMarkAll() {
        await markAllNotificationsRead()
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    }

    async function handleClickNotif(n: AppNotification) {
        if (!n.isRead) {
            markNotificationRead(n.id).catch(() => {})
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
        }
        setOpen(false)

        const dataObj = (typeof n.data === "object" && n.data) ? n.data as Record<string, unknown> : {}
        const fromDataLink = typeof dataObj.link === "string" ? dataObj.link : null
        const fromTopLink = typeof n.link === "string" ? n.link : null
        let href = fromDataLink || fromTopLink

        if (!href && typeof dataObj.roomId === "string") {
            href = `/dashboard/user?tab=messages&room=${dataObj.roomId}`
        }

        // Auction notification routing — navigate to the live auction room
        if (n.type.startsWith("AUCTION_")) {
            const auctionId = typeof dataObj.auctionId === "string" ? dataObj.auctionId : n.entityId
            if (auctionId && (
                n.type === "AUCTION_BID" ||
                n.type === "AUCTION_BID_PLACED" ||
                n.type === "AUCTION_OUTBID" ||
                n.type === "AUCTION_WON" ||
                n.type === "AUCTION_ENDED" ||
                n.type === "AUCTION_STARTED" ||
                n.type === "AUCTION_ENDING_SOON" ||
                n.type === "AUCTION_RESERVE_MET"
            )) {
                router.push(`/auctions/live/${auctionId}`)
                return
            }
            if (n.type === "AUCTION_ENDED_NO_SALE" || n.type === "AUCTION_CANCELLED") {
                router.push("/dashboard/seller/auctions")
                return
            }
        }

        if (href) {
            router.push(normalizeNotificationHref(href))
            return
        }

        const eType = n.entityType ?? undefined
        const eId = n.entityId ?? undefined

        if (eType === "AUCTION" && eId) {
            router.push(`/auctions/live/${eId}`)
            return
        }

        if (eType === "LISTING" && eId) {
            router.push("/dashboard/user?tab=inventory")
            return
        }

        if (eType === "OFFER" && eId) {
            if (n.type === "OFFER_COUNTERED") {
                router.push("/dashboard/user?tab=bids")
                return
            }
            router.push("/dashboard/user?tab=offers")
            return
        }

        if (n.type === "DEAL_CLOSED") { router.push("/dashboard/user?tab=offers"); return }
        if (n.type === "MESSAGE_RECEIVED" || n.type === "NEW_MESSAGE") { router.push("/dashboard/user?tab=messages"); return }
        if (n.type.startsWith("OFFER_")) { router.push("/dashboard/user?tab=offers"); return }

        router.push("/dashboard/user?tab=overview")
    }

    if (!user) return null

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-700/80 transition-all"
                aria-label="Notifications"
            >
                <Bell size={18} className="text-gray-300" />
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-900 shadow-sm animate-pulse">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed sm:absolute top-20 sm:top-full left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <Bell size={14} className="text-primary" />
                            <span className="font-bold text-white text-sm">Notifications</span>
                            {unreadNotifs > 0 && (
                                <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {unreadNotifs} new
                                </span>
                            )}
                        </div>
                        {unreadNotifs > 0 && (
                            <button
                                onClick={handleMarkAll}
                                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors font-bold uppercase tracking-widest"
                            >
                                <Check size={10} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* Body */}
                    <div className="max-h-[360px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={20} className="animate-spin text-primary" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-12">
                                <Bell size={28} className="text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500 text-xs font-semibold">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const isAuction = n.type.startsWith("AUCTION_")
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleClickNotif(n)}
                                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${!n.isRead ? 'bg-primary/5' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                            !n.isRead
                                                ? isAuction ? 'bg-orange-500/10' : 'bg-primary/10'
                                                : 'bg-white/5'
                                        }`}>
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold mb-0.5 ${!n.isRead ? 'text-white' : 'text-gray-300'}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{n.body ?? n.message}</p>
                                            <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                        {!n.isRead && (
                                            <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${isAuction ? 'bg-orange-400' : 'bg-primary'}`} />
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-white/10 bg-slate-800/30">
                        <Link
                            href="/dashboard/user?tab=overview"
                            onClick={() => setOpen(false)}
                            className="text-[11px] text-gray-500 hover:text-white transition-colors font-bold uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                            View Dashboard →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
