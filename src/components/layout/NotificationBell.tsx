"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Loader2, Check } from "lucide-react"
import {
    getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead,
    type AppNotification,
} from "@/lib/notificationsApi"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { getPendingOffersCount } from "@/lib/listingApi"
import {
    notificationIconFor as getIcon,
    notificationTimeLabel as timeAgo,
    resolveNotificationHref,
} from "@/components/notifications/notificationDisplay"

// ─── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
    const { user, profile } = useAuth()
    const { unreadCount: chatUnread } = useChat()
    const router = useRouter()

    const [open, setOpen] = React.useState(false)
    const [notifications, setNotifications] = React.useState<AppNotification[]>([])
    const [loading, setLoading] = React.useState(false)
    const [pendingOffers, setPendingOffers] = React.useState(0)
    // Server-side count: the panel only loads the newest 12, so counting
    // those alone under-reported unread notifications for busy accounts.
    const [serverUnread, setServerUnread] = React.useState(0)
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
            getUnreadNotificationCount().then(setServerUnread).catch(() => {})
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

    // Load notifications on mount so the badge count is visible immediately
    React.useEffect(() => {
        if (!user) return
        getNotifications(12).then(setNotifications).catch(() => {})
        getUnreadNotificationCount().then(setServerUnread).catch(() => {})
    }, [user])

    // Refresh list when panel opens (gets latest reads/new items)
    React.useEffect(() => {
        if (!open || !user) return
        setLoading(true)
        getNotifications(12).then(setNotifications).finally(() => setLoading(false))
        getUnreadNotificationCount().then(setServerUnread).catch(() => {})
    }, [open, user])

    const unreadNotifs = Math.max(serverUnread, notifications.filter(n => !n.isRead).length)
    const totalUnread = unreadNotifs + chatUnread

    async function handleMarkAll() {
        await markAllNotificationsRead()
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setServerUnread(0)
    }

    async function handleClickNotif(n: AppNotification) {
        if (!n.isRead) {
            markNotificationRead(n.id).catch(() => {})
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
            setServerUnread(count => Math.max(0, count - 1))
        }
        setOpen(false)
        router.push(resolveNotificationHref(n, profile?.role))
    }

    if (!user) return null

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all"
                aria-label="Notifications"
            >
                <Bell size={18} className="text-[var(--text-secondary)]" />
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-900 shadow-sm animate-pulse">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed sm:absolute top-20 sm:top-full left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                        <div className="flex items-center gap-2">
                            <Bell size={14} className="text-primary" />
                            <span className="font-bold text-[var(--text-primary)] text-sm">Notifications</span>
                            {unreadNotifs > 0 && (
                                <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {unreadNotifs} new
                                </span>
                            )}
                        </div>
                        {unreadNotifs > 0 && (
                            <button
                                onClick={handleMarkAll}
                                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-bold uppercase tracking-widest"
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
                                <p className="text-[var(--text-muted)] text-xs font-semibold">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const isAuction = n.type.startsWith("AUCTION_")
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleClickNotif(n)}
                                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-default)] last:border-0 ${!n.isRead ? 'bg-primary/5' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                            !n.isRead
                                                ? isAuction ? 'bg-orange-500/10' : 'bg-primary/10'
                                                : 'bg-[var(--bg-card)]'
                                        }`}>
                                            {getIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold mb-0.5 ${!n.isRead ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed line-clamp-2">{n.body ?? n.message}</p>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">{timeAgo(n.createdAt)}</p>
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
                    <div className="px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-input)]">
                        <Link
                            href="/dashboard/notifications"
                            onClick={() => setOpen(false)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-bold uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                            See all notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
