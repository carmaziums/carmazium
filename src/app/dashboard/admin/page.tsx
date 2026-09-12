"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Users, Car, DollarSign, Activity, ShieldAlert, CheckCircle2,
    Loader2, RefreshCw, Gavel, Handshake, Receipt, TrendingUp, AlertTriangle, Plus } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminStats, getPendingHandovers, type AdminStats } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

export default function AdminDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [pendingHandovers, setPendingHandovers] = React.useState(0)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchStats = async () => {
        try {
            setLoading(true)
            setError(null)
            const [data, handovers] = await Promise.all([
                getAdminStats(),
                getPendingHandovers().then(h => h.length).catch(() => 0),
            ])
            setStats(data)
            setPendingHandovers(handovers)
        } catch (err: any) {
            setError(err.message || "Failed to load system statistics.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') fetchStats()
    }, [profile])

    if (authLoading || (user && !profile) || (!stats && loading)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    const kpiCards = [
        {
            label: "Total Users",
            value: stats?.totalUsers?.toLocaleString() ?? "0",
            icon: Users,
            color: "blue",
        },
        {
            label: "Total Listings",
            value: stats?.totalListings?.toLocaleString() ?? "0",
            icon: Car,
            color: "primary",
        },
        {
            label: "Vehicles Sold",
            value: stats?.soldListings?.toLocaleString() ?? "0",
            icon: CheckCircle2,
            color: "emerald",
        },
        {
            label: "Total Auctions",
            value: stats?.totalAuctions?.toLocaleString() ?? "0",
            icon: Gavel,
            color: "purple",
        },
        {
            label: "Total Bids",
            value: stats?.totalBids?.toLocaleString() ?? "0",
            icon: Activity,
            color: "orange",
        },
        {
            label: "Platform Revenue",
            value: formatPrice(stats?.totalRevenue ?? 0),
            icon: DollarSign,
            color: "yellow",
        },
    ]

    const colorMap: Record<string, { icon: string; bg: string; value: string }> = {
        blue: {
            icon: "text-blue-700 dark:text-blue-300",
            bg: "bg-blue-500/10 dark:bg-blue-500/20",
            value: "text-blue-800 dark:text-blue-200",
        },
        primary: {
            icon: "text-primary",
            bg: "bg-primary/10 dark:bg-primary/20",
            value: "text-primary",
        },
        emerald: {
            icon: "text-emerald-700 dark:text-emerald-300",
            bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
            value: "text-emerald-800 dark:text-emerald-200",
        },
        purple: {
            icon: "text-purple-700 dark:text-purple-300",
            bg: "bg-purple-500/10 dark:bg-purple-500/20",
            value: "text-purple-800 dark:text-purple-200",
        },
        orange: {
            icon: "text-orange-700 dark:text-orange-300",
            bg: "bg-orange-500/10 dark:bg-orange-500/20",
            value: "text-orange-800 dark:text-orange-200",
        },
        yellow: {
            icon: "text-amber-700 dark:text-yellow-300",
            bg: "bg-amber-500/10 dark:bg-yellow-500/20",
            value: "text-amber-800 dark:text-yellow-200",
        },
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <div>
                            <h1 className="text-3xl font-black font-heading text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-3">
                                <ShieldAlert className="text-primary hidden sm:block" size={28} />
                                System Overview
                            </h1>
                            <p className="text-[var(--text-muted)] mt-1">Super Admin Dashboard</p>
                        </div>
                        <Button
                            onClick={fetchStats}
                            disabled={loading}
                            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border-[var(--border-default)] text-[var(--text-primary)]"
                            variant="outline"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                        </Button>
                        {/* Links to the normal /sell wizard rather than an
                            admin-only form. The wizard is the only place that
                            knows about DVLA lookup, the photo minimum, the
                            damage mapper and every tier rule — a second copy
                            for admins would need all of it duplicated and kept
                            in step. The admin-specific behaviour (no fee, no
                            review, listed as CarMazium) is already enforced
                            server-side, so nothing here needs to know about it. */}
                        <Link href="/sell">
                            <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold">
                                <Plus size={16} /> Create Listing
                            </Button>
                        </Link>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/40 rounded-xl text-red-700 dark:text-red-200">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Pending handover alert */}
                    {pendingHandovers > 0 && (
                        <Link href="/dashboard/admin/handovers">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-100 flex items-center gap-3 hover:bg-amber-500/15 transition-colors cursor-pointer">
                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-300 shrink-0" />
                                <div>
                                    <p className="font-bold">{pendingHandovers} handover proof{pendingHandovers > 1 ? 's' : ''} awaiting verification</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-200/80">Click to review and approve or deny</p>
                                </div>
                            </div>
                        </Link>
                    )}

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {kpiCards.map((card) => {
                            const Icon = card.icon
                            const colors = colorMap[card.color]
                            return (
                                <div key={card.label} className="glass-card p-5 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 text-[var(--text-faint)] opacity-15 group-hover:opacity-25 transition-opacity">
                                        <Icon size={56} />
                                    </div>
                                    <div className={`inline-flex p-2 ${colors.bg} rounded-lg mb-2`}>
                                        <Icon size={16} className={colors.icon} />
                                    </div>
                                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{card.label}</p>
                                    <h3 className={`text-3xl font-black font-heading ${colors.value} mt-1 truncate`}>
                                        {loading ? "..." : card.value}
                                    </h3>
                                </div>
                            )
                        })}
                    </div>

                    {/* Quick Access Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            {
                                href: "/dashboard/admin/users",
                                icon: Users,
                                color: "blue",
                                title: "User Management",
                                desc: "View, verify, and update roles for all registered accounts.",
                                cta: "Manage Users",
                                ctaClass: "bg-blue-600 hover:bg-blue-700",
                            },
                            {
                                href: "/dashboard/admin/listings",
                                icon: Car,
                                color: "primary",
                                title: "Listing Moderation",
                                desc: "Review inventory, investigate reports, and force-remove rule-breaking listings.",
                                cta: "Moderate Listings",
                                ctaClass: "bg-primary hover:bg-red-700",
                            },
                            {
                                href: "/dashboard/admin/auctions",
                                icon: Gavel,
                                color: "purple",
                                title: "Auction Management",
                                desc: "Monitor all auctions — scheduled, live, and ended.",
                                cta: "View Auctions",
                                ctaClass: "bg-purple-600 hover:bg-purple-700",
                            },
                            {
                                href: "/dashboard/admin/handovers",
                                icon: Handshake,
                                color: "amber",
                                title: "Handover Proofs",
                                desc: `Verify seller handover submissions and release the £100 bonus.${pendingHandovers > 0 ? ` (${pendingHandovers} pending)` : ''}`,
                                cta: "Review Handovers",
                                ctaClass: "bg-amber-600 hover:bg-amber-700",
                            },
                            {
                                href: "/dashboard/admin/transactions",
                                icon: Receipt,
                                color: "emerald",
                                title: "Transactions",
                                desc: "Full ledger of all platform payments and refunds.",
                                cta: "View Transactions",
                                ctaClass: "bg-emerald-600 hover:bg-emerald-700",
                            },
                            {
                                href: "/dashboard/admin/analytics",
                                icon: TrendingUp,
                                color: "yellow",
                                title: "Analytics",
                                desc: "Monthly revenue, user growth, and listing activity trends.",
                                cta: "View Analytics",
                                ctaClass: "bg-yellow-600 hover:bg-yellow-700",
                            },
                        ].map((item) => {
                            const Icon = item.icon
                            const iconColor: Record<string, string> = {
                                blue: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
                                primary: "bg-primary/10 dark:bg-primary/20 text-primary",
                                purple: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
                                amber: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
                                emerald: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                                yellow: "bg-yellow-500/10 dark:bg-yellow-500/20 text-amber-700 dark:text-yellow-300",
                            }
                            return (
                                <div key={item.href} className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors rounded-2xl flex flex-col">
                                    <div className={`w-14 h-14 ${iconColor[item.color]} rounded-full flex items-center justify-center mb-4 ring-1 ring-[var(--border-default)]`}>
                                        <Icon size={26} />
                                    </div>
                                    <h3 className="text-lg font-bold font-heading uppercase mb-1 text-[var(--text-primary)]">{item.title}</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-5 flex-1">{item.desc}</p>
                                    <Link href={item.href} className="mt-auto">
                                        <Button className={`w-full ${item.ctaClass} text-white`}>{item.cta}</Button>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                </main>
            </div>
        </div>
    )
}
