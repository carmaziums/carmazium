"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, Loader2, Mail } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import {
    getNotificationPage, markAllNotificationsRead, markNotificationRead,
    type AppNotification,
} from "@/lib/notificationsApi"
import {
    notificationIconFor, notificationTimeLabel, resolveNotificationHref,
} from "@/components/notifications/notificationDisplay"

const PAGE_SIZE = 30

/**
 * Full notification history. The header bell shows only the newest few;
 * nothing is deleted, so every older notification is reachable here.
 */
export default function NotificationsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [items, setItems] = React.useState<AppNotification[]>([])
    const [page, setPage] = React.useState(0)
    const [totalPages, setTotalPages] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [unreadOnly, setUnreadOnly] = React.useState(false)

    const [emailOn, setEmailOn] = React.useState<boolean | null>(null)
    const [savingEmail, setSavingEmail] = React.useState(false)
    const [emailError, setEmailError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading && !user) router.replace("/auth/login")
    }, [authLoading, user, router])

    const loadPage = React.useCallback(async (next: number) => {
        setLoading(true)
        setError(null)
        try {
            const result = await getNotificationPage(next, PAGE_SIZE)
            setItems(prev => {
                const merged = next === 1 ? result.data : [...prev, ...result.data]
                // A notification arriving between pages shifts the list; drop repeats.
                const seen = new Set<string>()
                return merged.filter(n => (seen.has(n.id) ? false : (seen.add(n.id), true)))
            })
            setPage(result.page)
            setTotalPages(result.totalPages)
            setTotal(result.total)
        } catch {
            setError("Could not load notifications. Please try again.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (user) void loadPage(1)
    }, [user, loadPage])

    // Email preference lives in preferences.notifications, shared with the app.
    React.useEffect(() => {
        if (!user) return
        apiClient<{ data?: { preferences?: { notifications?: Record<string, unknown> } } }>("/users/me")
            .then(res => setEmailOn(res?.data?.preferences?.notifications?.email !== false))
            .catch(() => setEmailOn(null))
    }, [user])

    async function toggleEmail() {
        if (emailOn === null || savingEmail) return
        setSavingEmail(true)
        setEmailError(null)
        try {
            // The profile endpoint replaces the whole notifications object, so
            // read the current settings and change only the email switch.
            const res = await apiClient<{ data?: { preferences?: { notifications?: Record<string, unknown> } } }>("/users/me")
            const current = res?.data?.preferences?.notifications ?? {}
            await apiClient("/users/me", {
                method: "PATCH",
                body: JSON.stringify({ preferences: { notifications: { ...current, email: !emailOn } } }),
            })
            setEmailOn(!emailOn)
        } catch {
            setEmailError("Could not save your email setting. Please try again.")
        } finally {
            setSavingEmail(false)
        }
    }

    async function markAll() {
        try {
            await markAllNotificationsRead()
            setItems(prev => prev.map(n => ({ ...n, isRead: true })))
        } catch {
            setError("Could not mark notifications as read. Please try again.")
        }
    }

    function open(n: AppNotification) {
        if (!n.isRead) {
            markNotificationRead(n.id).catch(() => {})
            setItems(prev => prev.map(x => (x.id === n.id ? { ...x, isRead: true } : x)))
        }
        router.push(resolveNotificationHref(n, profile?.role))
    }

    if (authLoading || !user) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const visible = unreadOnly ? items.filter(n => !n.isRead) : items
    const hasUnread = items.some(n => !n.isRead)

    return (
        <main className="container mx-auto max-w-3xl px-4 py-6 md:py-10">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-primary)]">Notifications</h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        {total > 0 ? `${total} in total, newest first` : "Your account activity"}
                    </p>
                </div>
                {hasUnread && (
                    <button
                        type="button"
                        onClick={() => void markAll()}
                        className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <Check size={12} /> Mark all read
                    </button>
                )}
            </header>

            <section
                aria-label="Email notifications"
                className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3"
            >
                <div className="flex items-center gap-3">
                    <Mail size={18} className="text-primary shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">Email me about notifications</p>
                        <p className="text-xs text-[var(--text-muted)]">
                            {user.email ? `Sent to ${user.email}. ` : ""}Chat messages are emailed only if unread after a few minutes.
                        </p>
                        {emailError && <p role="alert" className="mt-1 text-xs text-red-500">{emailError}</p>}
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={emailOn === true}
                    aria-label="Email notifications"
                    disabled={emailOn === null || savingEmail}
                    onClick={() => void toggleEmail()}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${emailOn ? "bg-primary" : "bg-[var(--border-default)]"}`}
                >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${emailOn ? "left-[22px]" : "left-0.5"}`} />
                </button>
            </section>

            <div className="mb-3 flex gap-2" role="tablist" aria-label="Filter notifications">
                {[{ key: false, label: "All" }, { key: true, label: "Unread" }].map(tab => (
                    <button
                        key={tab.label}
                        type="button"
                        role="tab"
                        aria-selected={unreadOnly === tab.key}
                        onClick={() => setUnreadOnly(tab.key)}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold ${unreadOnly === tab.key
                            ? "bg-primary text-white"
                            : "border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                {visible.length === 0 && !loading ? (
                    <div className="py-16 text-center">
                        <Bell size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
                        <p className="text-sm font-semibold text-[var(--text-muted)]">
                            {error ?? (unreadOnly ? "No unread notifications loaded" : "No notifications yet")}
                        </p>
                    </div>
                ) : (
                    <ul>
                        {visible.map(n => (
                            <li key={n.id} className="border-b border-[var(--border-default)] last:border-0">
                                <button
                                    type="button"
                                    onClick={() => open(n)}
                                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${!n.isRead ? "bg-primary/5" : ""}`}
                                >
                                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-input)]">
                                        {notificationIconFor(n.type)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={`block text-sm font-bold ${!n.isRead ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                                            {n.title}
                                        </span>
                                        <span className="mt-0.5 block text-sm leading-relaxed text-[var(--text-muted)]">{n.body ?? n.message}</span>
                                        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{notificationTimeLabel(n.createdAt)}</span>
                                    </span>
                                    {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {error && visible.length > 0 && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-4 flex justify-center">
                {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : page < totalPages ? (
                    <button
                        type="button"
                        onClick={() => void loadPage(page + 1)}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                    >
                        Load older notifications
                    </button>
                ) : items.length > 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">You have reached your oldest notification.</p>
                ) : null}
            </div>
        </main>
    )
}
