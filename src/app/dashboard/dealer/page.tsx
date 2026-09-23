"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Kanban, Gavel,
    PlusCircle, Loader2, Building2, CheckCircle,
    Mail, ShieldCheck, BarChart3, ChevronRight
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

    const canManageInventory = hasPermission('MANAGE_INVENTORY')
    const canManageCrm = hasPermission('MANAGE_CRM')
    const canViewTrade = hasPermission('VIEW_TRADE')
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

    const dashboardActions = [
        {
            href: "/dashboard/dealer/add-listing",
            title: "Add vehicle",
            description: "Create one new retail or auction listing.",
            icon: PlusCircle,
            show: canManageInventory,
        },
        {
            href: "/dashboard/dealer/crm",
            title: "Customers",
            description: "Enquiries, offers and follow-up in one sales workflow.",
            icon: Kanban,
            show: canManageCrm,
        },
        {
            href: "/dashboard/dealer/auctions",
            title: "Buy & bid",
            description: "Live auctions, your bids and completed purchases.",
            icon: Gavel,
            show: canViewTrade,
        },
        {
            href: "/dashboard/partner",
            title: "Partner services",
            description: "Delivery, inspections, finance and warranty services.",
            icon: Building2,
            show: true,
        },
        {
            href: "/dashboard/dealer/analytics",
            title: "Performance",
            description: "Real dealership analytics, sales and revenue.",
            icon: BarChart3,
            show: canViewAnalytics,
        },
    ].filter(action => action.show)

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

                    {/* ── Main jobs only: no duplicate route grids ── */}
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-lg font-black font-heading uppercase tracking-tight">Main actions</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                One entry point for each job. Related tools now live inside that area instead of repeating across the dashboard.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {dashboardActions.map(action => {
                                const Icon = action.icon
                                return (
                                    <Link
                                        key={action.href}
                                        href={action.href}
                                        className="dealer-glass-card group flex items-center gap-4 p-5 hover:border-primary/30 transition-all"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            <Icon size={19} className="text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-sm text-[var(--text-primary)]">{action.title}</p>
                                            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{action.description}</p>
                                        </div>
                                        <ChevronRight size={17} className="text-[var(--text-muted)] shrink-0 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                )
                            })}
                        </div>
                    </section>

                </main>
            </div>
        </div>
    )
}
