"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, Loader2, Mail, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import {
    getNotificationsPage,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
    type AppNotification,
} from "@/lib/notificationsApi"
import { resolveWebNotificationHref } from "@/lib/notificationNavigation"

const PAGE_SIZE = 50

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

export default function NotificationsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [notifications, setNotifications] = React.useState<AppNotification[]>([])
    const [total, setTotal] = React.useState(0)
    const [page, setPage] = React.useState(1)
    const [unreadTotal, setUnreadTotal] = React.useState(0)
    const [filter, setFilter] = React.useState<"all" | "unread">("all")
    const [loading, setLoading] = React.useState(true)
    const [loadingMore, setLoadingMore] = React.useState(false)
    const [markingAll, setMarkingAll] = React.useState(false)
    const [emailSaving, setEmailSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [emailEnabled, setEmailEnabled] = React.useState(true)

    React.useEffect(() => {
        const prefs = (profile as any)?.preferences as Record<string, any> | undefined
        setEmailEnabled(prefs?.notifications?.email !== false)
    }, [profile])

    const loadFirstPage = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [result, unread] = await Promise.all([
                getNotificationsPage(1, PAGE_SIZE),
                getUnreadNotificationCount(),
            ])
            setNotifications(result.notifications)
            setTotal(result.total)
            setPage(1)
            setUnreadTotal(unread)
        } catch {
            setError("Could not load your notifications. Please try again.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (authLoading) return
        if (!user) {
            router.replace("/auth/login?redirect=/notifications")
            return
        }
        void loadFirstPage()
    }, [authLoading, user, router, loadFirstPage])

    async function loadOlder() {
        if (loadingMore || notifications.length >= total) return
        setLoadingMore(true)
        setError(null)
        try {
            const nextPage = page + 1
            const result = await getNotificationsPage(nextPage, PAGE_SIZE)
            setNotifications(current => {
                const seen = new Set(current.map(item => item.id))
                return [...current, ...result.notifications.filter(item => !seen.has(item.id))]
            })
            setTotal(result.total)
            setPage(result.page)
        } catch {
            setError("Could not load older notifications. Please try again.")
        } finally {
            setLoadingMore(false)
        }
    }

    async function markAllRead() {
        if (markingAll || unreadTotal === 0) return
        setMarkingAll(true)
        try {
            await markAllNotificationsRead()
            setNotifications(current => current.map(item => ({ ...item, isRead: true })))
            setUnreadTotal(0)
        } finally {
            setMarkingAll(false)
        }
    }

    async function openNotification(notification: AppNotification) {
        if (!notification.isRead) {
            setNotifications(current => current.map(item =>
                item.id === notification.id ? { ...item, isRead: true } : item,
            ))
            setUnreadTotal(count => Math.max(0, count - 1))
            markNotificationRead(notification.id).catch(() => void loadFirstPage())
        }
        router.push(resolveWebNotificationHref(notification, (profile as any)?.role))
    }

    async function toggleEmail() {
        if (emailSaving) return
        const next = !emailEnabled
        setEmailSaving(true)
        setEmailEnabled(next)
        try {
            const currentPreferences = ((profile as any)?.preferences ?? {}) as Record<string, any>
            const currentNotifications = (currentPreferences.notifications ?? {}) as Record<string, any>
            await apiClient("/users/me", {
                method: "PATCH",
                body: JSON.stringify({
                    preferences: {
                        ...currentPreferences,
                        notifications: {
                            ...currentNotifications,
                            email: next,
                        },
                    },
                }),
            })
        } catch {
            setEmailEnabled(!next)
            setError("Could not save your email notification preference.")
        } finally {
            setEmailSaving(false)
        }
    }

    const visible = filter === "unread"
        ? notifications.filter(notification => !notification.isRead)
        : notifications

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <main className="min-h-screen px-3 pb-24 pt-20 sm:px-5 sm:pt-24">
            <div className="mx-auto w-full max-w-4xl space-y-4">
                <section className="glass-card overflow-hidden border border-[var(--border-default)]">
                    <div className="flex flex-col gap-4 border-b border-[var(--border-default)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                <Bell className="text-primary" size={20} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-black font-heading text-[var(--text-primary)] sm:text-2xl">
                                    Notifications
                                </h1>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {unreadTotal > 0 ? `${unreadTotal} unread` : "You're all caught up"}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void loadFirstPage()}
                                disabled={loading}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                Refresh
                            </button>
                            <button
                                type="button"
                                onClick={() => void markAllRead()}
                                disabled={markingAll || unreadTotal === 0}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                            >
                                {markingAll ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                Mark all read
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-b border-[var(--border-default)] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex w-fit rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-1">
                            {(["all", "unread"] as const).map(value => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFilter(value)}
                                    className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                                        filter === value
                                            ? "bg-primary text-white"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    {value === "all" ? "All" : `Unread${unreadTotal ? ` (${unreadTotal})` : ""}`}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => void toggleEmail()}
                            disabled={emailSaving}
                            className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 sm:min-w-[270px]"
                            aria-pressed={emailEnabled}
                        >
                            <span className="flex items-center gap-2 text-left">
                                <Mail size={16} className="text-primary" />
                                <span>
                                    <span className="block text-sm font-bold text-[var(--text-primary)]">Email notifications</span>
                                    <span className="block text-xs text-[var(--text-muted)]">{emailEnabled ? "On" : "Off"}</span>
                                </span>
                            </span>
                            <span className={`relative h-6 w-11 rounded-full transition-colors ${emailEnabled ? "bg-primary" : "bg-[var(--border-default)]"}`}>
                                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${emailEnabled ? "translate-x-6" : "translate-x-1"}`} />
                            </span>
                        </button>
                    </div>

                    {error && (
                        <div className="border-b border-[var(--border-default)] bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <Bell className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)] opacity-40" />
                            <p className="font-bold text-[var(--text-primary)]">
                                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                            </p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">
                                {filter === "unread" && notifications.length < total
                                    ? "Load older notifications to check earlier unread items."
                                    : "New activity will appear here."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-default)]">
                            {visible.map(notification => (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => void openNotification(notification)}
                                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-card-hover)] sm:px-6 ${
                                        !notification.isRead ? "bg-primary/5" : ""
                                    }`}
                                >
                                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? "bg-transparent" : "bg-primary"}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className={`font-bold ${notification.isRead ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
                                                {notification.title}
                                            </p>
                                            <span className="shrink-0 text-xs text-[var(--text-muted)]">
                                                {timeAgo(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                                            {notification.body ?? notification.message}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {notifications.length < total && (
                        <div className="border-t border-[var(--border-default)] p-4 text-center">
                            <button
                                type="button"
                                onClick={() => void loadOlder()}
                                disabled={loadingMore}
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 text-sm font-bold text-[var(--text-primary)] hover:border-primary/40 disabled:opacity-50"
                            >
                                {loadingMore && <Loader2 size={15} className="animate-spin" />}
                                Load older
                            </button>
                            <p className="mt-2 text-xs text-[var(--text-muted)]">
                                Showing {notifications.length.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
