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
    Sparkles,
    Zap,
    Radio,
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
    eyebrow: string
    tools: ToolLink[]
    headerClass: string
    iconClass: string
    tileClass: string
    accentClass: string
}

const toolGroups: ToolGroup[] = [
    {
        title: "Marketplace",
        description: "Create, review and complete vehicle sales.",
        eyebrow: "Vehicle operations",
        headerClass: "from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-400/25",
        iconClass: "bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_8px_20px_rgba(6,182,212,0.30)]",
        tileClass: "hover:border-cyan-400/40 hover:shadow-[0_12px_30px_rgba(6,182,212,0.12)]",
        accentClass: "bg-cyan-400",
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
        eyebrow: "Financial control",
        headerClass: "from-violet-500/20 via-fuchsia-500/10 to-transparent border-violet-400/25",
        iconClass: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_8px_20px_rgba(139,92,246,0.30)]",
        tileClass: "hover:border-violet-400/40 hover:shadow-[0_12px_30px_rgba(139,92,246,0.12)]",
        accentClass: "bg-violet-400",
        tools: [
            { href: "/dashboard/admin/transactions", title: "Transactions", description: "View the complete payment ledger.", icon: Receipt },
            { href: "/dashboard/admin/hpi", title: "HPI Reports", description: "Prepare, upload and replace HPI reports.", icon: ShieldCheck },
            { href: "/dashboard/admin/free-listings", title: "Free Listing Grants", description: "Give eligible users a free BASIC listing.", icon: Gift },
        ],
    },
    {
        title: "Accounts & partners",
        description: "Manage users, dealers and service partners.",
        eyebrow: "Identity & network",
        headerClass: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-400/25",
        iconClass: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.30)]",
        tileClass: "hover:border-emerald-400/40 hover:shadow-[0_12px_30px_rgba(16,185,129,0.12)]",
        accentClass: "bg-emerald-400",
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
        eyebrow: "Growth intelligence",
        headerClass: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-400/25",
        iconClass: "bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-[0_8px_20px_rgba(245,158,11,0.30)]",
        tileClass: "hover:border-amber-400/40 hover:shadow-[0_12px_30px_rgba(245,158,11,0.12)]",
        accentClass: "bg-amber-400",
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
        {
            label: "Users",
            value: stats?.totalUsers?.toLocaleString() ?? "0",
            icon: Users,
            cardClass: "from-cyan-500/16 via-sky-500/8 to-transparent border-cyan-300/30 dark:border-cyan-500/20",
            iconClass: "from-cyan-400 to-blue-600 shadow-[0_8px_18px_rgba(6,182,212,0.30)]",
            glowClass: "bg-cyan-400/20",
        },
        {
            label: "Listings",
            value: stats?.totalListings?.toLocaleString() ?? "0",
            icon: Car,
            cardClass: "from-blue-500/16 via-indigo-500/8 to-transparent border-blue-300/30 dark:border-blue-500/20",
            iconClass: "from-blue-500 to-indigo-600 shadow-[0_8px_18px_rgba(59,130,246,0.30)]",
            glowClass: "bg-blue-400/20",
        },
        {
            label: "Sold",
            value: stats?.soldListings?.toLocaleString() ?? "0",
            icon: CheckCircle2,
            cardClass: "from-emerald-500/16 via-teal-500/8 to-transparent border-emerald-300/30 dark:border-emerald-500/20",
            iconClass: "from-emerald-400 to-teal-600 shadow-[0_8px_18px_rgba(16,185,129,0.30)]",
            glowClass: "bg-emerald-400/20",
        },
        {
            label: "Auctions",
            value: stats?.totalAuctions?.toLocaleString() ?? "0",
            icon: Gavel,
            cardClass: "from-violet-500/16 via-purple-500/8 to-transparent border-violet-300/30 dark:border-violet-500/20",
            iconClass: "from-violet-500 to-purple-700 shadow-[0_8px_18px_rgba(139,92,246,0.30)]",
            glowClass: "bg-violet-400/20",
        },
        {
            label: "Bids",
            value: stats?.totalBids?.toLocaleString() ?? "0",
            icon: Activity,
            cardClass: "from-fuchsia-500/16 via-pink-500/8 to-transparent border-fuchsia-300/30 dark:border-fuchsia-500/20",
            iconClass: "from-fuchsia-500 to-pink-600 shadow-[0_8px_18px_rgba(217,70,239,0.30)]",
            glowClass: "bg-fuchsia-400/20",
        },
        {
            label: "Revenue",
            value: formatPrice(stats?.totalRevenue ?? 0),
            icon: DollarSign,
            cardClass: "from-amber-500/18 via-orange-500/8 to-transparent border-amber-300/35 dark:border-amber-500/20",
            iconClass: "from-amber-400 to-orange-600 shadow-[0_8px_18px_rgba(245,158,11,0.30)]",
            glowClass: "bg-amber-400/20",
        },
    ]

    const quickActions = [
        {
            href: "/dashboard/admin/listings",
            title: "Review listings",
            description: "Open listing management",
            icon: Car,
            gradient: "from-cyan-500/18 via-blue-500/10 to-transparent",
            iconClass: "from-cyan-400 to-blue-600",
            borderClass: "border-cyan-300/35 hover:border-cyan-400/60",
            shadowClass: "hover:shadow-[0_18px_38px_rgba(6,182,212,0.18)]",
        },
        {
            href: "/dashboard/admin/hpi",
            title: "HPI reports",
            description: "Upload or prepare reports",
            icon: ShieldCheck,
            gradient: "from-violet-500/18 via-fuchsia-500/10 to-transparent",
            iconClass: "from-violet-500 to-fuchsia-600",
            borderClass: "border-violet-300/35 hover:border-violet-400/60",
            shadowClass: "hover:shadow-[0_18px_38px_rgba(139,92,246,0.18)]",
        },
        {
            href: "/dashboard/admin/transactions",
            title: "Transactions",
            description: "Check payments and refunds",
            icon: Receipt,
            gradient: "from-emerald-500/18 via-teal-500/10 to-transparent",
            iconClass: "from-emerald-400 to-teal-600",
            borderClass: "border-emerald-300/35 hover:border-emerald-400/60",
            shadowClass: "hover:shadow-[0_18px_38px_rgba(16,185,129,0.18)]",
        },
        {
            href: "/dashboard/admin/users",
            title: "Accounts",
            description: "Manage users and access",
            icon: Users,
            gradient: "from-amber-500/18 via-orange-500/10 to-transparent",
            iconClass: "from-amber-400 to-orange-600",
            borderClass: "border-amber-300/35 hover:border-amber-400/60",
            shadowClass: "hover:shadow-[0_18px_38px_rgba(245,158,11,0.18)]",
        },
    ]

    return (
        <div className="min-h-screen pt-20 pb-28 lg:pb-12 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 dark:opacity-40">
                <div className="absolute -top-24 right-[8%] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute top-[38%] -left-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
                <div className="absolute bottom-20 right-[20%] h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
            </div>

            <div className="container mx-auto px-4 sm:px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-7 min-w-0">
                    <section className="relative overflow-hidden rounded-[28px] border border-slate-700/40 bg-[linear-gradient(135deg,#08111f_0%,#121c33_45%,#281226_100%)] p-5 sm:p-7 shadow-[0_26px_70px_rgba(15,23,42,0.30)]">
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.16]"
                            style={{
                                backgroundImage: "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
                                backgroundSize: "28px 28px",
                                maskImage: "linear-gradient(to bottom right, black, transparent 72%)",
                            }}
                        />
                        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-24 right-[30%] h-60 w-60 rounded-full bg-fuchsia-500/20 blur-3xl" />
                        <div className="pointer-events-none absolute left-[14%] top-1/2 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />

                        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                            <div className="max-w-2xl">
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-cyan-100 shadow-inner">
                                        <ShieldAlert size={14} /> Admin command centre
                                    </div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] sm:text-xs font-bold text-emerald-200">
                                        <Radio size={13} className="animate-pulse" /> Live systems
                                    </div>
                                </div>
                                <h1 className="text-3xl sm:text-4xl lg:text-[44px] leading-[1.05] font-black font-heading text-white tracking-tight">
                                    Control the whole platform from one place.
                                </h1>
                                <p className="text-slate-300 mt-3 text-sm sm:text-base max-w-xl">
                                    Live platform totals, priority actions and every admin tool — organised for fast decisions.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button
                                    onClick={fetchStats}
                                    disabled={loading}
                                    variant="outline"
                                    className="flex items-center gap-2 border-white/15 bg-white/8 hover:bg-white/14 text-white backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                >
                                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh data
                                </Button>
                                <Link href="/sell">
                                    <Button className="flex items-center gap-2 border border-red-400/20 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-500 hover:to-red-500 text-white font-black shadow-[0_12px_28px_rgba(239,68,68,0.32)] hover:-translate-y-0.5 transition-all">
                                        <Plus size={16} /> Create listing
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/40 rounded-2xl text-red-700 dark:text-red-200 shadow-[0_12px_30px_rgba(239,68,68,0.10)]">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {pendingHandovers > 0 && (
                        <Link href="/dashboard/admin/handovers" className="block group">
                            <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10 border border-amber-400/35 rounded-2xl text-amber-950 dark:text-amber-100 flex items-center justify-between gap-3 shadow-[0_14px_35px_rgba(245,158,11,0.12)] group-hover:-translate-y-0.5 transition-all">
                                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-300 via-orange-400 to-rose-500" />
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-[0_8px_18px_rgba(245,158,11,0.30)]">
                                        <AlertTriangle size={21} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black">{pendingHandovers} handover{pendingHandovers > 1 ? 's' : ''} need review</p>
                                        <p className="text-xs opacity-75 mt-0.5">Approve or deny the submitted proof.</p>
                                    </div>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0 shadow-sm">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        </Link>
                    )}

                    <section>
                        <div className="flex items-end justify-between gap-4 mb-4">
                            <div>
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300 mb-1">
                                    <Activity size={14} /> Live platform data
                                </div>
                                <h2 className="font-black text-xl sm:text-2xl text-[var(--text-primary)]">At a glance</h2>
                                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">Real-time totals across the marketplace.</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-300 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" /> Online
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                            {kpiCards.map((card) => {
                                const Icon = card.icon
                                return (
                                    <div
                                        key={card.label}
                                        className={`group relative overflow-hidden rounded-[22px] border bg-gradient-to-br ${card.cardClass} bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)] hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(15,23,42,0.14)] transition-all duration-300`}
                                    >
                                        <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${card.glowClass} blur-2xl group-hover:scale-125 transition-transform duration-500`} />
                                        <div className="relative flex items-start justify-between gap-2 mb-4">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.iconClass} text-white flex items-center justify-center border border-white/30`}>
                                                <Icon size={18} />
                                            </div>
                                            <Zap size={14} className="text-[var(--text-muted)] opacity-50" />
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] font-black text-[var(--text-muted)] mb-1">{card.label}</p>
                                            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] truncate tracking-tight">
                                                {loading ? "..." : card.value}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300 mb-1">
                                <Sparkles size={14} /> Fast access
                            </div>
                            <h2 className="font-black text-xl sm:text-2xl text-[var(--text-primary)]">Quick actions</h2>
                            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">The tools used most often, one tap away.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {quickActions.map((item) => {
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group relative overflow-hidden rounded-[22px] border ${item.borderClass} bg-gradient-to-br ${item.gradient} bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_12px_28px_rgba(15,23,42,0.09)] ${item.shadowClass} hover:-translate-y-1 transition-all duration-300`}
                                    >
                                        <div className="flex items-center gap-3 relative">
                                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.iconClass} text-white flex items-center justify-center shrink-0 shadow-[0_10px_20px_rgba(15,23,42,0.18)] border border-white/30 group-hover:scale-105 group-hover:-rotate-2 transition-transform`}>
                                                <Icon size={21} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-sm sm:text-base text-[var(--text-primary)]">{item.title}</p>
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.description}</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white/65 dark:bg-white/8 border border-white/60 dark:border-white/10 flex items-center justify-center shrink-0 shadow-sm group-hover:translate-x-1 transition-transform">
                                                <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>

                    <section className="space-y-5">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-primary mb-1">
                                <ShieldCheck size={14} /> System modules
                            </div>
                            <h2 className="font-black text-xl sm:text-2xl text-[var(--text-primary)]">All admin tools</h2>
                            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">Every existing admin function, organised by job.</p>
                        </div>

                        {toolGroups.map((group) => (
                            <div
                                key={group.title}
                                className="relative overflow-hidden border border-[var(--border-default)] rounded-[26px] bg-[var(--bg-card)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
                            >
                                <div className={`relative overflow-hidden px-4 sm:px-6 py-5 border-b bg-gradient-to-r ${group.headerClass}`}>
                                    <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                                    <div className="relative flex items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`h-2.5 w-2.5 rounded-full ${group.accentClass} shadow-[0_0_14px_currentColor]`} />
                                                <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] font-black text-[var(--text-muted)]">{group.eyebrow}</span>
                                            </div>
                                            <h3 className="font-black text-base sm:text-lg text-[var(--text-primary)]">{group.title}</h3>
                                            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">{group.description}</p>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] shadow-sm">
                                            {group.tools.length} tools
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4">
                                    {group.tools.map((tool) => {
                                        const Icon = tool.icon
                                        return (
                                            <Link
                                                key={tool.href}
                                                href={tool.href}
                                                className={`group flex items-center gap-3 sm:gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)]/80 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_7px_18px_rgba(15,23,42,0.06)] ${group.tileClass} hover:-translate-y-0.5 transition-all duration-300`}
                                            >
                                                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${group.iconClass} flex items-center justify-center shrink-0 border border-white/30 group-hover:scale-105 transition-transform`}>
                                                    <Icon size={19} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-sm sm:text-[15px] text-[var(--text-primary)]">{tool.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{tool.description}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center shrink-0 shadow-sm group-hover:translate-x-1 group-hover:shadow-md transition-all">
                                                    <ChevronRight size={15} className="text-[var(--text-muted)]" />
                                                </div>
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
