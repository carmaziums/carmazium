"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Users,
    Car,
    DollarSign,
    Activity,
    ShieldAlert,
    CheckCircle2,
    Loader2,
    RefreshCw,
    Gavel,
    Handshake,
    Receipt,
    TrendingUp,
    AlertTriangle,
    Plus,
    Gift,
    ShieldCheck,
    Shield,
    Building2,
    Briefcase,
    MessageSquare,
    Megaphone,
    Newspaper,
    ChevronRight,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminStats, getPendingHandovers, type AdminStats } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

type ToolLink = {
    href: string
    title: string
    description: string
    icon: React.ComponentType<{ size?: number; className?: string }>
}

type ToolGroup = {
    title: string
    description: string
    tools: ToolLink[]
}

const toolGroups: ToolGroup[] = [
    {
        title: "Marketplace",
        description: "Create, review and complete vehicle sales.",
        tools: [
            { href: "/sell", title: "Create Listing", description: "Add a CarMazium vehicle listing.", icon: Plus },
            { href: "/dashboard/admin/listings", title: "Listings", description: "Review and manage every listing.", icon: Car },
            { href: "/dashboard/admin/auctions", title: "Auctions", description: "Monitor scheduled, live and ended auctions.", icon: Gavel },
            { href: "/dashboard/admin/handovers", title: "Handovers", description: "Review seller handover proof and payouts.", icon: Handshake },
        ],
    },
    {
        title: "Payments & reports",
        description: "Handle money, HPI reports and listing grants.",
        tools: [
            { href: "/dashboard/admin/transactions", title: "Transactions", description: "View the complete payment ledger.", icon: Receipt },
            { href: "/dashboard/admin/hpi", title: "HPI Reports", description: "Prepare, upload and replace HPI reports.", icon: ShieldCheck },
            { href: "/dashboard/admin/free-listings", title: "Free Listing Grants", description: "Give eligible users a free BASIC listing.", icon: Gift },
        ],
    },
    {
        title: "Accounts & partners",
        description: "Manage users, dealers and service partners.",
        tools: [
            { href: "/dashboard/admin/users", title: "Accounts", description: "View account details, access and roles.", icon: Users },
            { href: "/dashboard/admin/dealers", title: "All Dealers", description: "View dealer records and business details.", icon: Building2 },
            { href: "/dashboard/admin/dealer-verification", title: "Dealer KYC", description: "Review dealer verification submissions.", icon: Shield },
            { href: "/dashboard/admin/services", title: "Trade Services", description: "Manage service providers, jobs and leads.", icon: Briefcase },
            { href: "/dashboard/admin/messages", title: "Messages", description: "Open admin conversations and support messages.", icon: MessageSquare },
        ],
    },
    {
        title: "Content & insights",
        description: "See performance and manage site content.",
        tools: [
            { href: "/dashboard/admin/analytics", title: "Analytics", description: "Review platform and traffic performance.", icon: TrendingUp },
            { href: "/dashboard/admin/marketing-popup", title: "Marketing Popup", description: "Control the website marketing popup.", icon: Megaphone },
            { href: "/dashboard/admin/blog", title: "Blog", description: "Create and manage CarMazium articles.", icon: Newspaper },
        ],
    },
]

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
        { label: "Users", value: stats?.totalUsers?.toLocaleString() ?? "0", icon: Users },
        { label: "Listings", value: stats?.totalListings?.toLocaleString() ?? "0", icon: Car },
        { label: "Sold", value: stats?.soldListings?.toLocaleString() ?? "0", icon: CheckCircle2 },
        { label: "Auctions", value: stats?.totalAuctions?.toLocaleString() ?? "0", icon: Gavel },
        { label: "Bids", value: stats?.totalBids?.toLocaleString() ?? "0", icon: Activity },
        { label: "Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: DollarSign },
    ]

    const quickActions: ToolLink[] = [
        { href: "/dashboard/admin/listings", title: "Review listings", description: "Open listing management", icon: Car },
        { href: "/dashboard/admin/hpi", title: "HPI reports", description: "Upload or prepare reports", icon: ShieldCheck },
        { href: "/dashboard/admin/transactions", title: "Transactions", description: "Check payments and refunds", icon: Receipt },
        { href: "/dashboard/admin/users", title: "Accounts", description: "Manage users and access", icon: Users },
    ]

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-6 min-w-0">
                    <section className="bg-[var(--bg-input)] p-5 sm:p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-[0.18em] mb-1">
                                    <ShieldAlert size={16} /> Admin
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-black font-heading text-[var(--text-primary)] tracking-tight">
                                    Admin Home
                                </h1>
                                <p className="text-[var(--text-muted)] mt-1 text-sm">Common tasks first. Everything else is grouped below.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={fetchStats}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border-[var(--border-default)] text-[var(--text-primary)]"
                                    variant="outline"
                                >
                                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                                </Button>
                                <Link href="/sell">
                                    <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold">
                                        <Plus size={16} /> Create Listing
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/40 rounded-xl text-red-700 dark:text-red-200">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {pendingHandovers > 0 && (
                        <Link href="/dashboard/admin/handovers" className="block">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3 hover:bg-amber-500/15 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <AlertTriangle size={20} className="text-amber-600 dark:text-amber-300 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-bold">{pendingHandovers} handover{pendingHandovers > 1 ? 's' : ''} need review</p>
                                        <p className="text-xs text-amber-700/80 dark:text-amber-200/80">Approve or deny the submitted proof.</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="shrink-0" />
                            </div>
                        </Link>
                    )}

                    <section>
                        <div className="flex items-end justify-between gap-4 mb-3">
                            <div>
                                <h2 className="font-black text-lg text-[var(--text-primary)]">At a glance</h2>
                                <p className="text-xs text-[var(--text-muted)]">Platform totals</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                            {kpiCards.map((card) => {
                                const Icon = card.icon
                                return (
                                    <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 min-w-0">
                                        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                                            <Icon size={15} />
                                            <span className="text-[11px] uppercase tracking-wider font-bold truncate">{card.label}</span>
                                        </div>
                                        <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] truncate">
                                            {loading ? "..." : card.value}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section>
                        <div className="mb-3">
                            <h2 className="font-black text-lg text-[var(--text-primary)]">Quick actions</h2>
                            <p className="text-xs text-[var(--text-muted)]">The admin tools used most often</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {quickActions.map((item) => {
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="group flex items-center gap-3 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:border-primary/40 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                            <Icon size={19} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm text-[var(--text-primary)]">{item.title}</p>
                                            <p className="text-xs text-[var(--text-muted)] truncate">{item.description}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-primary shrink-0" />
                                    </Link>
                                )
                            })}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h2 className="font-black text-lg text-[var(--text-primary)]">All admin tools</h2>
                            <p className="text-xs text-[var(--text-muted)]">Every existing admin function, organised by job</p>
                        </div>

                        {toolGroups.map((group) => (
                            <div key={group.title} className="border border-[var(--border-default)] rounded-2xl bg-[var(--bg-card)] overflow-hidden">
                                <div className="px-4 sm:px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-input)]">
                                    <h3 className="font-black text-sm text-[var(--text-primary)]">{group.title}</h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{group.description}</p>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2">
                                    {group.tools.map((tool) => {
                                        const Icon = tool.icon
                                        return (
                                            <Link
                                                key={tool.href}
                                                href={tool.href}
                                                className="group flex items-center gap-3 px-4 sm:px-5 py-4 border-b lg:border-r border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                                            >
                                                <div className="w-9 h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-center text-primary shrink-0">
                                                    <Icon size={17} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-sm text-[var(--text-primary)]">{tool.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{tool.description}</p>
                                                </div>
                                                <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-primary shrink-0" />
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </section>
                </main>
            </div>
        </div>
    )
}
