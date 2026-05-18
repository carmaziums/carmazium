"use client"

import * as React from "react"
import {
    BarChart3,
    Users,
    Mail,
    Activity,
    MousePointerClick,
    Search,
    Eye,
    SlidersHorizontal,
    ShieldAlert,
    MessageCircle,
    RefreshCw,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Summary {
    totalEvents: number
    uniqueSessions: number
    totalEmails: number
    eventsByType: { type: string; count: number }[]
}

interface AnalyticsEvent {
    id: string
    type: string
    payload: Record<string, unknown>
    sessionId: string | null
    userId: string | null
    createdAt: string
}

interface EmailLead {
    id: string
    email: string
    source: string
    createdAt: string
}

const EVENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    page_view: Eye,
    search: Search,
    listing_view: MousePointerClick,
    filter_apply: SlidersHorizontal,
    login_wall_hit: ShieldAlert,
    enquiry: MessageCircle,
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function AdminAnalyticsPage() {
    const [summary, setSummary] = React.useState<Summary | null>(null)
    const [events, setEvents] = React.useState<AnalyticsEvent[]>([])
    const [emails, setEmails] = React.useState<EmailLead[]>([])
    const [eventsTotal, setEventsTotal] = React.useState(0)
    const [emailsTotal, setEmailsTotal] = React.useState(0)
    const [loading, setLoading] = React.useState(true)
    const [activeTab, setActiveTab] = React.useState<"events" | "emails">("events")

    const fetchData = React.useCallback(async () => {
        setLoading(true)
        try {
            const [sumRes, evtRes, emlRes] = await Promise.all([
                fetch(`${API_URL}/analytics/summary`).then((r) => r.ok ? r.json() : null).catch(() => null),
                fetch(`${API_URL}/analytics/events?limit=30`).then((r) => r.ok ? r.json() : { events: [], total: 0 }).catch(() => ({ events: [], total: 0 })),
                fetch(`${API_URL}/analytics/emails?limit=30`).then((r) => r.ok ? r.json() : { emails: [], total: 0 }).catch(() => ({ emails: [], total: 0 })),
            ])
            setSummary(sumRes)
            setEvents(evtRes?.events ?? [])
            setEventsTotal(evtRes?.total ?? 0)
            setEmails(emlRes?.emails ?? [])
            setEmailsTotal(emlRes?.total ?? 0)
        } catch (err) {
            console.error("Failed to load analytics:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        fetchData()
    }, [fetchData])

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            <div className="container mx-auto px-5 max-w-7xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <BarChart3 className="text-primary" size={32} />
                            Analytics Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">Internal data — track user behavior and leads</p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    {[
                        {
                            label: "Total Events",
                            value: summary?.totalEvents ?? "—",
                            icon: Activity,
                            color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
                            text: "text-blue-400",
                        },
                        {
                            label: "Unique Sessions",
                            value: summary?.uniqueSessions ?? "—",
                            icon: Users,
                            color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
                            text: "text-emerald-400",
                        },
                        {
                            label: "Email Leads",
                            value: summary?.totalEmails ?? "—",
                            icon: Mail,
                            color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
                            text: "text-amber-400",
                        },
                    ].map((card) => (
                        <div
                            key={card.label}
                            className={`bg-gradient-to-br ${card.color} border rounded-xl p-6`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-gray-400 text-sm">{card.label}</span>
                                <card.icon size={20} className={card.text} />
                            </div>
                            <div className={`text-3xl font-bold ${card.text}`}>
                                {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Events by Type */}
                {summary && Array.isArray(summary.eventsByType) && summary.eventsByType.length > 0 && (
                    <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6 mb-8">
                        <h3 className="text-white font-semibold mb-4">Events by Type</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            {summary.eventsByType.map((e) => {
                                const Icon = EVENT_ICONS[e.type] || Activity
                                return (
                                    <div
                                        key={e.type}
                                        className="bg-white/5 rounded-lg p-3 text-center"
                                    >
                                        <Icon size={18} className="mx-auto text-primary mb-1" />
                                        <div className="text-white font-bold text-lg">{e.count}</div>
                                        <div className="text-gray-400 text-xs truncate">
                                            {e.type.replace(/_/g, " ")}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit border border-white/10">
                    {(["events", "emails"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab
                                ? "bg-primary text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {tab === "events"
                                ? `Events (${eventsTotal})`
                                : `Email Leads (${emailsTotal})`}
                        </button>
                    ))}
                </div>

                {/* Events Table */}
                {activeTab === "events" && (
                    <div className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-left">
                                        <th className="px-4 py-3 text-gray-400 font-medium">Type</th>
                                        <th className="px-4 py-3 text-gray-400 font-medium">Payload</th>
                                        <th className="px-4 py-3 text-gray-400 font-medium">Session</th>
                                        <th className="px-4 py-3 text-gray-400 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                {loading ? "Loading..." : "No events recorded yet"}
                                            </td>
                                        </tr>
                                    ) : (
                                        events.map((evt) => {
                                            const Icon = EVENT_ICONS[evt.type] || Activity
                                            return (
                                                <tr key={evt.id} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="px-4 py-3">
                                                        <span className="flex items-center gap-2 text-white">
                                                            <Icon size={14} className="text-primary" />
                                                            {evt.type.replace(/_/g, " ")}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate font-mono text-xs">
                                                        {JSON.stringify(evt.payload)}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                                                        {evt.sessionId?.slice(0, 8) ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                                                        {formatDate(evt.createdAt)}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Emails Table */}
                {activeTab === "emails" && (
                    <div className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-left">
                                        <th className="px-4 py-3 text-gray-400 font-medium">Email</th>
                                        <th className="px-4 py-3 text-gray-400 font-medium">Source</th>
                                        <th className="px-4 py-3 text-gray-400 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emails.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                                {loading ? "Loading..." : "No email leads captured yet"}
                                            </td>
                                        </tr>
                                    ) : (
                                        emails.map((lead) => (
                                            <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="px-4 py-3 text-white">{lead.email}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                                                        {lead.source.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                                                    {formatDate(lead.createdAt)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
