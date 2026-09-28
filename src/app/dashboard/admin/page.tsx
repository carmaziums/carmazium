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
    Settings2,
    X,
    LayoutGrid,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminStats, getPendingHandovers, type AdminStats } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"
import { apiClient } from "@/lib/apiClient"

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

type AdminDashboardCardId =
    | "users"
    | "listings"
    | "activeListings"
    | "sold"
    | "auctions"
    | "activeAuctions"
    | "endedAuctions"
    | "bids"
    | "revenue"
    | "pendingHandovers"
    | "transactions"
    | "hpi"
    | "dealerKyc"
    | "messages"
    | "analytics"
    | "services"
    | "cancellations"
    | "blog"

type AdminDashboardCardDefinition = {
    id: AdminDashboardCardId
    label: string
    href: string
    description: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    cardClass: string
    iconClass: string
    glowClass: string
}

const DEFAULT_ADMIN_CARD_IDS: AdminDashboardCardId[] = [
    "users",
    "listings",
    "sold",
    "auctions",
    "bids",
    "revenue",
]

const adminDashboardCardCatalog: AdminDashboardCardDefinition[] = [
    {
        id: "users",
        label: "Users",
        href: "/dashboard/admin/users",
        description: "All platform accounts",
        icon: Users,
        cardClass: "from-cyan-500/16 via-sky-500/8 to-transparent border-cyan-300/30 dark:border-cyan-500/20",
        iconClass: "from-cyan-400 to-blue-600 shadow-[0_8px_18px_rgba(6,182,212,0.30)]",
        glowClass: "bg-cyan-400/20",
    },
    {
        id: "listings",
        label: "Listings",
        href: "/dashboard/admin/listings",
        description: "All marketplace listings",
        icon: Car,
        cardClass: "from-blue-500/16 via-indigo-500/8 to-transparent border-blue-300/30 dark:border-blue-500/20",
        iconClass: "from-blue-500 to-indigo-600 shadow-[0_8px_18px_rgba(59,130,246,0.30)]",
        glowClass: "bg-blue-400/20",
    },
    {
        id: "activeListings",
        label: "Active listings",
        href: "/dashboard/admin/listings",
        description: "Vehicles currently live",
        icon: Radio,
        cardClass: "from-sky-500/16 via-cyan-500/8 to-transparent border-sky-300/30 dark:border-sky-500/20",
        iconClass: "from-sky-400 to-cyan-600 shadow-[0_8px_18px_rgba(14,165,233,0.30)]",
        glowClass: "bg-sky-400/20",
    },
    {
        id: "sold",
        label: "Sold",
        href: "/dashboard/admin/listings",
        description: "Completed vehicle sales",
        icon: CheckCircle2,
        cardClass: "from-emerald-500/16 via-teal-500/8 to-transparent border-emerald-300/30 dark:border-emerald-500/20",
        iconClass: "from-emerald-400 to-teal-600 shadow-[0_8px_18px_rgba(16,185,129,0.30)]",
        glowClass: "bg-emerald-400/20",
    },
    {
        id: "auctions",
        label: "Auctions",
        href: "/dashboard/admin/auctions",
        description: "All auction records",
        icon: Gavel,
        cardClass: "from-violet-500/16 via-purple-500/8 to-transparent border-violet-300/30 dark:border-violet-500/20",
        iconClass: "from-violet-500 to-purple-700 shadow-[0_8px_18px_rgba(139,92,246,0.30)]",
        glowClass: "bg-violet-400/20",
    },
    {
        id: "activeAuctions",
        label: "Active auctions",
        href: "/dashboard/admin/auctions",
        description: "Auctions running now",
        icon: Activity,
        cardClass: "from-purple-500/16 via-indigo-500/8 to-transparent border-purple-300/30 dark:border-purple-500/20",
        iconClass: "from-purple-500 to-indigo-600 shadow-[0_8px_18px_rgba(168,85,247,0.30)]",
        glowClass: "bg-purple-400/20",
    },
    {
        id: "endedAuctions",
        label: "Ended auctions",
        href: "/dashboard/admin/auctions",
        description: "Completed auction runs",
        icon: Gavel,
        cardClass: "from-slate-500/16 via-gray-500/8 to-transparent border-slate-300/30 dark:border-slate-500/20",
        iconClass: "from-slate-500 to-gray-700 shadow-[0_8px_18px_rgba(100,116,139,0.28)]",
        glowClass: "bg-slate-400/20",
    },
    {
        id: "bids",
        label: "Bids",
        href: "/dashboard/admin/auctions",
        description: "All auction bid activity",
        icon: Activity,
        cardClass: "from-fuchsia-500/16 via-pink-500/8 to-transparent border-fuchsia-300/30 dark:border-fuchsia-500/20",
        iconClass: "from-fuchsia-500 to-pink-600 shadow-[0_8px_18px_rgba(217,70,239,0.30)]",
        glowClass: "bg-fuchsia-400/20",
    },
    {
        id: "revenue",
        label: "Revenue",
        href: "/dashboard/admin/transactions",
        description: "Retained platform revenue",
        icon: DollarSign,
        cardClass: "from-amber-500/18 via-orange-500/8 to-transparent border-amber-300/35 dark:border-amber-500/20",
        iconClass: "from-amber-400 to-orange-600 shadow-[0_8px_18px_rgba(245,158,11,0.30)]",
        glowClass: "bg-amber-400/20",
    },
    {
        id: "pendingHandovers",
        label: "Handovers",
        href: "/dashboard/admin/handovers",
        description: "Proofs awaiting admin review",
        icon: Handshake,
        cardClass: "from-orange-500/16 via-amber-500/8 to-transparent border-orange-300/30 dark:border-orange-500/20",
        iconClass: "from-orange-400 to-amber-600 shadow-[0_8px_18px_rgba(249,115,22,0.30)]",
        glowClass: "bg-orange-400/20",
    },
    {
        id: "transactions",
        label: "Transactions",
        href: "/dashboard/admin/transactions",
        description: "Payments, fees and refunds",
        icon: Receipt,
        cardClass: "from-emerald-500/16 via-cyan-500/8 to-transparent border-emerald-300/30 dark:border-emerald-500/20",
        iconClass: "from-emerald-500 to-cyan-600 shadow-[0_8px_18px_rgba(16,185,129,0.30)]",
        glowClass: "bg-emerald-400/20",
    },
    {
        id: "hpi",
        label: "HPI reports",
        href: "/dashboard/admin/hpi",
        description: "Prepare and upload reports",
        icon: ShieldCheck,
        cardClass: "from-violet-500/16 via-fuchsia-500/8 to-transparent border-violet-300/30 dark:border-violet-500/20",
        iconClass: "from-violet-500 to-fuchsia-600 shadow-[0_8px_18px_rgba(139,92,246,0.30)]",
        glowClass: "bg-violet-400/20",
    },
    {
        id: "dealerKyc",
        label: "Dealer KYC",
        href: "/dashboard/admin/dealer-verification",
        description: "Review dealer verification",
        icon: Shield,
        cardClass: "from-blue-500/16 via-cyan-500/8 to-transparent border-blue-300/30 dark:border-blue-500/20",
        iconClass: "from-blue-500 to-cyan-600 shadow-[0_8px_18px_rgba(59,130,246,0.30)]",
        glowClass: "bg-blue-400/20",
    },
    {
        id: "messages",
        label: "Messages",
        href: "/dashboard/admin/messages",
        description: "Admin support and conversations",
        icon: MessageSquare,
        cardClass: "from-rose-500/16 via-pink-500/8 to-transparent border-rose-300/30 dark:border-rose-500/20",
        iconClass: "from-rose-500 to-pink-600 shadow-[0_8px_18px_rgba(244,63,94,0.30)]",
        glowClass: "bg-rose-400/20",
    },
    {
        id: "analytics",
        label: "Analytics",
        href: "/dashboard/admin/analytics",
        description: "Platform and valuation insights",
        icon: TrendingUp,
        cardClass: "from-cyan-500/16 via-emerald-500/8 to-transparent border-cyan-300/30 dark:border-cyan-500/20",
        iconClass: "from-cyan-500 to-emerald-600 shadow-[0_8px_18px_rgba(6,182,212,0.30)]",
        glowClass: "bg-cyan-400/20",
    },
    {
        id: "services",
        label: "Trade services",
        href: "/dashboard/admin/services",
        description: "Providers, jobs and leads",
        icon: Briefcase,
        cardClass: "from-indigo-500/16 via-blue-500/8 to-transparent border-indigo-300/30 dark:border-indigo-500/20",
        iconClass: "from-indigo-500 to-blue-600 shadow-[0_8px_18px_rgba(99,102,241,0.30)]",
        glowClass: "bg-indigo-400/20",
    },
    {
        id: "cancellations",
        label: "Cancellations",
        href: "/dashboard/admin/cancellations",
        description: "Review sale cancellations",
        icon: AlertTriangle,
        cardClass: "from-red-500/16 via-rose-500/8 to-transparent border-red-300/30 dark:border-red-500/20",
        iconClass: "from-red-500 to-rose-600 shadow-[0_8px_18px_rgba(239,68,68,0.30)]",
        glowClass: "bg-red-400/20",
    },
    {
        id: "blog",
        label: "Blog",
        href: "/dashboard/admin/blog",
        description: "Manage CarMazium articles",
        icon: Newspaper,
        cardClass: "from-amber-500/16 via-yellow-500/8 to-transparent border-amber-300/30 dark:border-amber-500/20",
        iconClass: "from-amber-500 to-yellow-600 shadow-[0_8px_18px_rgba(245,158,11,0.30)]",
        glowClass: "bg-amber-400/20",
    },
]

const ADMIN_CARD_IDS = new Set<AdminDashboardCardId>(
    adminDashboardCardCatalog.map(card => card.id),
)

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
            { href: "/dashboard/admin/free-listings", title: "Free Grants", description: "Grant free BASIC listings or fee-free auction purchases.", icon: Gift },
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
            { href: "/dashboard/admin/ai-reports", title: "AI Reports", description: "Review user-flagged MaziuM AI responses.", icon: Sparkles },
            { href: "/dashboard/admin/marketing-popup", title: "Marketing Popup", description: "Control the website marketing popup.", icon: Megaphone },
            { href: "/dashboard/admin/blog", title: "Blog", description: "Create and manage CarMazium articles.", icon: Newspaper },
        ],
    },
]

export default function AdminDashboard() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const router = useRouter()
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [pendingHandovers, setPendingHandovers] = React.useState(0)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [visibleCardIds, setVisibleCardIds] = React.useState<AdminDashboardCardId[]>(DEFAULT_ADMIN_CARD_IDS)
    const [draftCardIds, setDraftCardIds] = React.useState<AdminDashboardCardId[]>(DEFAULT_ADMIN_CARD_IDS)
    const [cardEditorOpen, setCardEditorOpen] = React.useState(false)
    const [savingCards, setSavingCards] = React.useState(false)
    const [cardSaveError, setCardSaveError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    React.useEffect(() => {
        if (profile?.role !== "ADMIN") return

        const saved = profile.preferences?.adminDashboardCardIds
        if (!Array.isArray(saved)) {
            setVisibleCardIds(DEFAULT_ADMIN_CARD_IDS)
            setDraftCardIds(DEFAULT_ADMIN_CARD_IDS)
            return
        }

        const valid = Array.from(new Set(
            saved.filter((id): id is AdminDashboardCardId =>
                typeof id === "string" && ADMIN_CARD_IDS.has(id as AdminDashboardCardId),
            ),
        ))
        setVisibleCardIds(valid)
        setDraftCardIds(valid)
    }, [profile?.id, profile?.preferences])

    const toggleDraftCard = (id: AdminDashboardCardId) => {
        setDraftCardIds(current =>
            current.includes(id)
                ? current.filter(cardId => cardId !== id)
                : [...current, id],
        )
    }

    const openCardEditor = () => {
        setDraftCardIds(visibleCardIds)
        setCardSaveError(null)
        setCardEditorOpen(true)
    }

    const saveCardPreferences = async () => {
        try {
            setSavingCards(true)
            setCardSaveError(null)
            await apiClient('/users/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    preferences: {
                        adminDashboardCardIds: draftCardIds,
                    },
                }),
            })
            setVisibleCardIds(draftCardIds)
            setCardEditorOpen(false)
            await refreshProfile()
        } catch (err: any) {
            setCardSaveError(err?.message || 'Could not save dashboard cards.')
        } finally {
            setSavingCards(false)
        }
    }

    const resetCardPreferences = () => {
        setDraftCardIds(DEFAULT_ADMIN_CARD_IDS)
        setCardSaveError(null)
    }

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

    const getCardValue = (id: AdminDashboardCardId) => {
        switch (id) {
            case "users":
                return stats?.totalUsers?.toLocaleString() ?? "0"
            case "listings":
                return stats?.totalListings?.toLocaleString() ?? "0"
            case "activeListings":
                return stats?.activeListings?.toLocaleString() ?? "0"
            case "sold":
                return stats?.soldListings?.toLocaleString() ?? "0"
            case "auctions":
                return stats?.totalAuctions?.toLocaleString() ?? "0"
            case "activeAuctions":
                return stats?.activeAuctions?.toLocaleString() ?? "0"
            case "endedAuctions":
                return stats?.endedAuctions?.toLocaleString() ?? "0"
            case "bids":
                return stats?.totalBids?.toLocaleString() ?? "0"
            case "revenue":
                return formatPrice(stats?.totalRevenue ?? 0)
            case "pendingHandovers":
                return pendingHandovers.toLocaleString()
            default:
                return "Open"
        }
    }

    const kpiCards = visibleCardIds
        .map(id => adminDashboardCardCatalog.find(card => card.id === id))
        .filter((card): card is AdminDashboardCardDefinition => Boolean(card))
        .map(card => ({
            ...card,
            value: getCardValue(card.id),
        }))

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
                                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                                    Choose the cards that are most useful to you.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openCardEditor}
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] shadow-sm transition-all hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <Settings2 size={15} />
                                Customize cards
                            </button>
                        </div>

                        {kpiCards.length === 0 ? (
                            <button
                                type="button"
                                onClick={openCardEditor}
                                className="w-full rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center transition-colors hover:border-primary/40"
                            >
                                <LayoutGrid size={24} className="mx-auto text-[var(--text-muted)]" />
                                <p className="mt-3 font-black text-[var(--text-primary)]">No cards selected</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Tap here to add the admin shortcuts and metrics you want.</p>
                            </button>
                        ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                            {kpiCards.map((card) => {
                                const Icon = card.icon
                                return (
                                    <Link
                                        key={card.label}
                                        href={card.href}
                                        aria-label={`Open ${card.label} admin page`}
                                        className={`group relative overflow-hidden rounded-[22px] border bg-gradient-to-br ${card.cardClass} bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)] hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(15,23,42,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] transition-all duration-300 cursor-pointer`}
                                    >
                                        <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${card.glowClass} blur-2xl group-hover:scale-125 transition-transform duration-500`} />
                                        <div className="relative flex items-start justify-between gap-2 mb-4">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.iconClass} text-white flex items-center justify-center border border-white/30`}>
                                                <Icon size={18} />
                                            </div>
                                            <ChevronRight size={16} className="text-[var(--text-muted)] opacity-60 group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)] transition-all" />
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] font-black text-[var(--text-muted)] mb-1">{card.label}</p>
                                            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] truncate tracking-tight">
                                                {loading ? "..." : card.value}
                                            </p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                        )}
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

            {cardEditorOpen && (
                <div
                    className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-card-editor-title"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target && !savingCards) {
                            setCardEditorOpen(false)
                        }
                    }}
                >
                    <div className="w-full max-w-3xl rounded-t-[28px] border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl sm:rounded-[28px]">
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5 sm:p-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Admin dashboard</p>
                                <h2 id="admin-card-editor-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">
                                    Customize cards
                                </h2>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">
                                    Add the metrics and shortcuts you use. Remove anything you do not need.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingCards && setCardEditorOpen(false)}
                                className="rounded-xl border border-[var(--border-default)] p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                aria-label="Close card editor"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {adminDashboardCardCatalog.map(card => {
                                    const selected = draftCardIds.includes(card.id)
                                    const Icon = card.icon
                                    return (
                                        <button
                                            key={card.id}
                                            type="button"
                                            onClick={() => toggleDraftCard(card.id)}
                                            aria-pressed={selected}
                                            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected
                                                ? "border-primary/50 bg-primary/10 shadow-[0_8px_22px_rgba(239,68,68,0.10)]"
                                                : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/25"
                                            }`}
                                        >
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.iconClass} text-white`}>
                                                <Icon size={18} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-black text-[var(--text-primary)]">{card.label}</span>
                                                <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{card.description}</span>
                                            </span>
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${selected
                                                ? "border-primary bg-primary text-white"
                                                : "border-[var(--border-default)] text-transparent"
                                            }`}>
                                                ✓
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {cardSaveError && (
                                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300">
                                    {cardSaveError}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-default)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <button
                                type="button"
                                onClick={resetCardPreferences}
                                disabled={savingCards}
                                className="rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-card)] disabled:opacity-50"
                            >
                                Reset default
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCardEditorOpen(false)}
                                    disabled={savingCards}
                                    className="flex-1 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] sm:flex-none disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={saveCardPreferences}
                                    disabled={savingCards}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(239,68,68,0.22)] sm:flex-none disabled:opacity-50"
                                >
                                    {savingCards ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
                                    Save cards
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
