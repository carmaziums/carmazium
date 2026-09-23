"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Users, Kanban, Gavel,
    PlusCircle, Loader2, Building2, CheckCircle,
    Mail, Activity, ShieldCheck, Zap, Tag, Trophy,
    Heart, DollarSign, BarChart3, Briefcase, Wrench,
    Settings, MessageSquare, ChevronRight
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PeriodToggle } from "@/components/dashboard/PeriodToggle"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { apiClient } from "@/lib/apiClient"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { useDealerAccess } from "@/context/DealerAccessContext"

export default function DealerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const period = (searchParams.get('period') as '7d' | '30d') ?? '30d'

    function setPeriod(p: '7d' | '30d') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', p)
        router.replace(`${pathname}?${params.toString()}`)
    }

    const subLabel = period === '7d' ? 'Last 7 days' : 'Last 30 days'

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [statsError, setStatsError] = React.useState(false)
    const [resending, setResending] = React.useState(false)
    const [resendSuccess, setResendSuccess] = React.useState(false)
    const { loading: accessLoading, hasPermission } = useDealerAccess()

    const canViewInventory = hasPermission('VIEW_INVENTORY')
    const canManageInventory = hasPermission('MANAGE_INVENTORY')
    const canManageCrm = hasPermission('MANAGE_CRM')
    const canManageOffers = hasPermission('MANAGE_OFFERS')
    const canViewTrade = hasPermission('VIEW_TRADE')
    const canViewPurchases = hasPermission('VIEW_PURCHASES')
    const canManageTeam = hasPermission('MANAGE_TEAM')
    const canViewAnalytics = hasPermission('VIEW_ANALYTICS')

    const isEmailVerified = !!user?.email_confirmed_at

    React.useEffect(() => {
        if (!authLoading && !accessLoading && user) {
            fetchDashboardData()
        }
    }, [user, authLoading, accessLoading, period, canManageCrm])

    async function fetchDashboardData() {
        setLoading(true)
        setStatsError(false)
        try {
            const [statsRes, leadsRes] = await Promise.all([
                apiClient<{ data: any }>(`/dashboard/dealer?period=${period}`),
                canManageCrm
                    ? apiClient<{ data: any[]; meta?: any }>('/dealers/leads?limit=5').catch(() => ({ data: [] }))
                    : Promise.resolve({ data: [] }),
            ])

            const s = statsRes?.data || {}
            setStats({
                companyName: s.companyName ?? (profile?.firstName ? `${profile.firstName}'s Dealership` : "Your Dealership"),
                isVerified: s.isVerified ?? false,
                activeListings: s.activeListings ?? 0,
                totalViews: s.totalViews ?? 0,
                soldListings: s.soldListings ?? 0,
                activeLeads: s.activeLeads ?? 0,
                totalRevenue: s.totalRevenue ?? 0,
                staffCount: s.staffCount ?? 1,
                recentLeads: leadsRes?.data ?? [],
            })
        } catch (err) {
            console.error('Failed to load dashboard data:', err)
            // Do not turn an API failure into convincing-looking zeroes.
            setStats(null)
            setStatsError(true)
        } finally {
            setLoading(false)
        }
    }

    const handleResendEmail = async () => {
        if (!user?.email) return
        setResending(true)
        setResendSuccess(false)
        try {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
                options: { emailRedirectTo: `${baseUrl}/auth/callback?redirect_to=/dashboard/dealer` }
            })
            if (error) throw error
            setResendSuccess(true)
            setTimeout(() => setResendSuccess(false), 5000)
        } catch (err: any) {
            console.error('Resend failed:', err)
        } finally {
            setResending(false)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen pt-20 pb-12 flex flex-col lg:flex-row gap-8 px-5 container mx-auto">
                <div className="w-full lg:w-64 h-[600px] shrink-0 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] animate-pulse"></div>
                <div className="flex-1 space-y-8">
                    <div className="h-36 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] relative overflow-hidden"><div className="absolute inset-0 metallic-foil opacity-5"></div></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] relative overflow-hidden"><div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/5 to-transparent"></div></div>)}
                    </div>
                    <div className="h-64 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] animate-pulse"></div>
                </div>
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const dealerToolGroups = [
        {
            title: "Sell & stock",
            description: "List cars, manage stock and turn enquiries into sales.",
            eyebrow: "Sales",
            accent: "bg-cyan-400",
            header: "from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-400/25",
            iconBox: "bg-gradient-to-br from-cyan-400 to-blue-600 text-white",
            tools: [
                { href: "/dashboard/dealer/add-listing", title: "Add vehicle", description: "Create a new listing.", icon: PlusCircle, show: canManageInventory },
                { href: "/dashboard/dealer/inventory", title: "Inventory", description: "Live, draft and sold stock.", icon: Car, show: canViewInventory },
                { href: "/dashboard/dealer/crm", title: "Leads", description: "Buyer enquiries and follow-up.", icon: Kanban, show: canManageCrm },
                { href: "/dashboard/dealer/offers", title: "Offers received", description: "Review offers on your vehicles.", icon: Tag, show: canManageOffers },
            ].filter(tool => tool.show),
        },
        {
            title: "Buy & auctions",
            description: "See every buying action without searching through menus.",
            eyebrow: "Buying",
            accent: "bg-violet-400",
            header: "from-violet-500/20 via-fuchsia-500/10 to-transparent border-violet-400/25",
            iconBox: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white",
            tools: [
                { href: "/dashboard/dealer/auctions", title: "Auctions", description: "Browse and bid on live auctions.", icon: Gavel, show: canViewTrade },
                { href: "/dashboard/dealer/bids", title: "My auction bids", description: "Auctions you are bidding on.", icon: Gavel, show: canViewTrade },
                { href: "/dashboard/dealer/my-offers", title: "My retail offers", description: "Offers made on retail cars.", icon: Tag, show: canManageOffers },
                { href: "/dashboard/dealer/auctions/won", title: "Purchases", description: "Auction wins and next steps.", icon: Trophy, show: canViewPurchases },
                { href: "/dashboard/dealer/wishlist", title: "Saved cars", description: "Vehicles saved for later.", icon: Heart, show: true },
            ].filter(tool => tool.show),
        },
        {
            title: "Business",
            description: "Communication, staff and account tools together.",
            eyebrow: "Operations",
            accent: "bg-emerald-400",
            header: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-400/25",
            iconBox: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
            tools: [
                { href: "/dashboard/dealer/messages", title: "Messages", description: "Customer and support conversations.", icon: MessageSquare, show: true },
                { href: "/dashboard/dealer/team", title: "Team", description: "Staff access and permissions.", icon: Users, show: canManageTeam },
                { href: "/dashboard/dealer/finance", title: "Finance", description: "Dealership finance tools.", icon: DollarSign, show: true },
                { href: "/dashboard/dealer/settings", title: "Settings", description: "Business profile and preferences.", icon: Settings, show: true },
            ].filter(tool => tool.show),
        },
        {
            title: "Services & performance",
            description: "Partner services and performance tools in one section.",
            eyebrow: "Growth",
            accent: "bg-amber-400",
            header: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-400/25",
            iconBox: "bg-gradient-to-br from-amber-400 to-orange-600 text-white",
            tools: [
                { href: "/dashboard/partner", title: "Partner services", description: "Business details, payouts and service status.", icon: Building2, show: true },
                { href: "/dashboard/service/capabilities", title: "Service add-ons", description: "Delivery, inspection, finance and warranty.", icon: Wrench, show: true },
                { href: "/dashboard/service/jobs", title: "Service jobs", description: "TradeXchange delivery and inspection work.", icon: Briefcase, show: true },
                { href: "/dashboard/service/leads", title: "Service enquiries", description: "Finance and warranty enquiries.", icon: Briefcase, show: true },
                { href: "/dashboard/dealer/analytics", title: "Analytics", description: "Dealership performance and insights.", icon: BarChart3, show: canViewAnalytics },
                { href: "/dashboard/dealer/earnings", title: "Earnings", description: "Revenue and sales history.", icon: DollarSign, show: canViewAnalytics },
            ].filter(tool => tool.show),
        },
    ].filter(group => group.tools.length > 0)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account">
                    {canManageInventory && (
                        <Link href="/dashboard/dealer/add-listing">
                            <Button className="w-full flex items-center gap-2 shadow-neon h-12" shape="default">
                                <PlusCircle size={18} /> Add Vehicle
                            </Button>
                        </Link>
                    )}
                </DashboardSidebar>

                <main className="flex-1 space-y-8 min-w-0">

                    {/* ── Email Verification Panel ── */}
                    {!isEmailVerified && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-slate-800/80 to-slate-900 border border-amber-500/20 rounded-2xl p-8 md:p-12">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                            <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
                                <div className="p-4 bg-amber-500/20 rounded-full mb-5">
                                    <Mail className="h-10 w-10 text-amber-400" />
                                </div>
                                <h2 className="text-2xl font-black font-heading tracking-tight mb-2 text-white">Verify Your Email</h2>
                                <p className="text-gray-300 text-sm mb-1">
                                    We&apos;ve sent a verification link to <strong className="text-white">{user?.email}</strong>
                                </p>
                                <p className="text-gray-300 text-sm mb-6">
                                    Please verify your email address to access your dealer dashboard and start managing your dealership.
                                </p>

                                {resendSuccess && (
                                    <div className="mb-4 w-full p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium flex items-center justify-center gap-2">
                                        <CheckCircle size={16} /> Verification email sent! Check your inbox.
                                    </div>
                                )}

                                <Button
                                    onClick={handleResendEmail}
                                    disabled={resending}
                                    className="gap-2 h-11 px-6 shadow-neon"
                                    shape="default"
                                >
                                    {resending ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                    ) : (
                                        <><Mail size={16} /> Resend Verification Email</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Executive Insights Banner (only when verified) ── */}
                    {isEmailVerified && (
                        <div className="dealer-glass-card p-5 md:p-8 group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)] shadow-2xl">
                                            <Building2 className="text-[var(--text-primary)]" size={24} />
                                        </div>
                                        <div>
                                            <h1 className="text-2xl md:text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">
                                                {DEALER_ROUTE_CONFIG[0].title}
                                            </h1>
                                            <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mt-1 opacity-70">
                                                {DEALER_ROUTE_CONFIG[0].subHeader}, {userName}
                                            </p>
                                            {stats?.isVerified && (
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <ShieldCheck size={14} className="text-amber-400" />
                                                    <span className="text-xs font-bold uppercase tracking-widest metallic-foil">
                                                        Verified Dealer
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Period Toggle ── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black font-heading uppercase tracking-tighter">Overview</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Stock and active leads are current. Vehicle views and completed sales follow the selected period.
                            </p>
                        </div>
                        <PeriodToggle value={period} onChange={setPeriod} />
                    </div>

                    {statsError && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500 font-semibold">
                            Live dashboard statistics are temporarily unavailable. Values are hidden rather than replaced with zeroes.
                        </div>
                    )}

                    {/* ── KPI Stats Row ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Active Stock"
                            value={statsError ? "—" : (stats?.activeListings ?? 0)}
                            icon={Car}
                            color="text-primary"
                            bg="bg-primary/10"
                            border="border-primary/20"
                            statusLabel="Current"
                            loading={loading}
                            href="/dashboard/dealer/inventory?status=ACTIVE"
                            subLabel="Live stock now"
                            showSparkline={false}
                        />
                        <MetricCard
                            label="Vehicle Views"
                            value={statsError ? "—" : (stats?.totalViews?.toLocaleString() ?? 0)}
                            icon={Eye}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            loading={loading}
                            statusLabel="Tracked"
                            subLabel={subLabel}
                            showSparkline={false}
                        />
                        {canManageCrm && (
                            <MetricCard
                                label="Active Leads"
                                value={statsError ? "—" : (stats?.activeLeads ?? 0)}
                                icon={Kanban}
                                color="text-amber-400"
                                bg="bg-amber-500/10"
                                border="border-amber-500/20"
                                loading={loading}
                                statusLabel="Current"
                                subLabel="Open pipeline"
                                showSparkline={false}
                            />
                        )}
                        <MetricCard
                            label="Vehicles Sold"
                            value={statsError ? "—" : (stats?.soldListings ?? 0)}
                            icon={TrendingUp}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Period"
                            loading={loading}
                            href="/dashboard/dealer/inventory?status=SOLD"
                            subLabel={subLabel}
                            showSparkline={false}
                        />
                    </div>

                    {/* ── Quick Actions ── */}
                    <div>
                        <h2 className="text-lg font-black font-heading uppercase tracking-tight mb-3">Quick Actions</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {canViewInventory && (
                        <Link href="/dashboard/dealer/inventory" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl"><Car size={20} className="text-primary group-hover:scale-110 transition-transform" /></div>
                                <div>
                                    <p className="font-bold text-[var(--text-primary)] text-sm relative">Inventory<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all"></span></p>
                                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Manage Stock</p>
                                </div>
                            </div>
                        </Link>
                        )}
                        {canManageCrm && (
                        <Link href="/dashboard/dealer/crm" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl"><Kanban size={20} className="text-amber-400 group-hover:scale-110 transition-transform" /></div>
                                <div>
                                     <p className="font-bold text-[var(--text-primary)] text-sm relative">Leads<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 group-hover:w-full transition-all"></span></p>
                                     <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Sales Pipeline</p>
                                </div>
                            </div>
                        </Link>
                        )}
                        {canManageInventory && (
                        <Link href="/dashboard/dealer/add-listing" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><PlusCircle size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" /></div>
                                <div>
                                    <p className="font-bold text-[var(--text-primary)] text-sm">Add Vehicle</p>
                                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Create Listing</p>
                                </div>
                            </div>
                        </Link>
                        )}
                        {canViewTrade && (
                        <Link href="/dashboard/dealer/auctions" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl"><Gavel size={20} className="text-blue-400 group-hover:scale-110 transition-transform" /></div>
                                <div>
                                    <p className="font-bold text-[var(--text-primary)] text-sm">Auctions</p>
                                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Buy & Bid</p>
                                </div>
                            </div>
                        </Link>
                        )}
                        </div>
                    </div>

                    {/* ── Dealer Command Centre Tool Map ── */}
                    <section className="space-y-5">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-primary mb-1">
                                <ShieldCheck size={14} /> Everything in one place
                            </div>
                            <h2 className="font-black text-xl sm:text-2xl text-[var(--text-primary)]">All dealer tools</h2>
                            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                                No hunting through menus — choose the job you want to do.
                            </p>
                        </div>

                        {dealerToolGroups.map(group => (
                            <div
                                key={group.title}
                                className="relative overflow-hidden border border-[var(--border-default)] rounded-[26px] bg-[var(--bg-card)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
                            >
                                <div className={`relative overflow-hidden px-4 sm:px-6 py-5 border-b bg-gradient-to-r ${group.header}`}>
                                    <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                                    <div className="relative flex items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`h-2.5 w-2.5 rounded-full ${group.accent}`} />
                                                <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] font-black text-[var(--text-muted)]">
                                                    {group.eyebrow}
                                                </span>
                                            </div>
                                            <h3 className="font-black text-base sm:text-lg text-[var(--text-primary)]">{group.title}</h3>
                                            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">{group.description}</p>
                                        </div>
                                        <div className="hidden sm:flex items-center rounded-full border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                            {group.tools.length} tools
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4">
                                    {group.tools.map(tool => {
                                        const Icon = tool.icon
                                        return (
                                            <Link
                                                key={tool.href}
                                                href={tool.href}
                                                className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)]/80 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_7px_18px_rgba(15,23,42,0.06)] hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300"
                                            >
                                                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${group.iconBox} flex items-center justify-center shrink-0 border border-white/30 shadow-sm`}>
                                                    <Icon size={19} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-sm sm:text-[15px] text-[var(--text-primary)]">{tool.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{tool.description}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-all">
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
