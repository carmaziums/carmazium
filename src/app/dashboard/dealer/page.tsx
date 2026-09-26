"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Kanban, Gavel,
    PlusCircle, Loader2, Building2, CheckCircle,
    Mail, ShieldCheck, BarChart3, ChevronRight, X, ShoppingBag
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { FlexiblePeriodControl, type DashboardRangeSelection, type DashboardRangeUnit } from "@/components/dashboard/FlexiblePeriodControl"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { apiClient } from "@/lib/apiClient"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { useDealerAccess } from "@/context/DealerAccessContext"
import { getNotifications, markNotificationRead, type AppNotification } from "@/lib/notificationsApi"

export default function DealerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const rangeAllTime = searchParams.get('range') === 'all'
    const rangeUnitParam = searchParams.get('rangeUnit')
    const rangeUnit: DashboardRangeUnit =
        rangeUnitParam === 'months' || rangeUnitParam === 'years' ? rangeUnitParam : 'days'
    const rawRangeValue = Number(searchParams.get('rangeValue') || 30)
    const rangeValue = Number.isFinite(rawRangeValue) && rawRangeValue > 0
        ? Math.min(Math.floor(rawRangeValue), 10000)
        : 30
    const compareRange = searchParams.get('compare') === '1'

    const rangeSelection: DashboardRangeSelection = {
        allTime: rangeAllTime,
        value: rangeValue,
        unit: rangeUnit,
        compare: compareRange,
    }

    function setRange(next: DashboardRangeSelection) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('period')
        if (next.allTime) {
            params.set('range', 'all')
            params.delete('rangeValue')
            params.delete('rangeUnit')
        } else {
            params.delete('range')
            params.set('rangeValue', String(next.value))
            params.set('rangeUnit', next.unit)
        }
        if (next.compare) params.set('compare', '1')
        else params.delete('compare')
        router.replace(`${pathname}?${params.toString()}`)
    }

    const fallbackRangeLabel = rangeAllTime
        ? 'All time'
        : `Last ${rangeValue} ${rangeUnit === 'days' ? 'day' : rangeUnit === 'months' ? 'month' : 'year'}${rangeValue === 1 ? '' : 's'}`

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [statsError, setStatsError] = React.useState(false)
    const [resending, setResending] = React.useState(false)
    const [resendSuccess, setResendSuccess] = React.useState(false)
    const [unsoldAuctionNotice, setUnsoldAuctionNotice] = React.useState<AppNotification | null>(null)
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
    }, [user, authLoading, accessLoading, rangeAllTime, rangeValue, rangeUnit, compareRange, canManageCrm])

    async function fetchDashboardData() {
        setLoading(true)
        setStatsError(false)
        try {
            const rangeQuery = new URLSearchParams()
            if (rangeAllTime) {
                rangeQuery.set('range', 'all')
            } else {
                rangeQuery.set('rangeValue', String(rangeValue))
                rangeQuery.set('rangeUnit', rangeUnit)
            }
            if (compareRange) rangeQuery.set('compare', '1')

            const [statsRes, leadsRes, recentNotifications] = await Promise.all([
                apiClient<{ data: any }>(`/dashboard/dealer?${rangeQuery.toString()}`),
                canManageCrm
                    ? apiClient<{ data: any[]; meta?: any }>('/dealers/leads?limit=5').catch(() => ({ data: [] }))
                    : Promise.resolve({ data: [] }),
                getNotifications(20),
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
                accountCreatedAt: s.accountCreatedAt ?? null,
                range: s.range ?? null,
                comparison: s.comparison ?? null,
                leadsCreated: s.leadsCreated ?? 0,
                recentLeads: leadsRes?.data ?? [],
            })
            setUnsoldAuctionNotice(
                recentNotifications.find(
                    notification => notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead,
                ) ?? null,
            )
        } catch (err) {
            console.error('Failed to load dashboard data:', err)
            // Do not turn an API failure into convincing-looking zeroes.
            setStats(null)
            setStatsError(true)
        } finally {
            setLoading(false)
        }
    }

    async function dismissUnsoldAuctionNotice() {
        const notice = unsoldAuctionNotice
        setUnsoldAuctionNotice(null)
        if (notice) {
            await markNotificationRead(notice.id).catch(() => {})
        }
    }

    function openRetailFromNotice() {
        const notice = unsoldAuctionNotice
        if (!notice) return

        const retailUrl =
            typeof notice.data?.retailUrl === 'string'
                ? notice.data.retailUrl
                : '/dashboard/dealer/auctions'

        setUnsoldAuctionNotice(null)
        markNotificationRead(notice.id).catch(() => {})
        router.push(retailUrl)
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

    const selectedRangeLabel = stats?.range?.label ?? fallbackRangeLabel

    const comparisonText = (metric: 'totalViews' | 'soldListings' | 'totalRevenue') => {
        const item = stats?.comparison?.available ? stats.comparison?.[metric] : null
        if (!compareRange) return undefined
        if (!item) return 'No earlier account data available'
        if (item.percentChange === null) {
            return `${item.previous.toLocaleString()} in previous period`
        }
        const sign = item.percentChange > 0 ? '+' : ''
        return `${sign}${item.percentChange}% vs previous period`
    }

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

                    {/* ── Flexible reporting range ── */}
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-black font-heading uppercase tracking-tighter">Overview</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Choose any number of days, months or years, or view everything since this dealer account was created.
                                Turn on comparison to compare with the immediately preceding period.
                            </p>
                        </div>
                        <FlexiblePeriodControl
                            value={rangeSelection}
                            accountCreatedAt={stats?.accountCreatedAt}
                            onChange={setRange}
                        />
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
                            subLabel={selectedRangeLabel}
                            showSparkline={false}
                            comparisonLabel={comparisonText('totalViews')}
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
                            subLabel={selectedRangeLabel}
                            showSparkline={false}
                            comparisonLabel={comparisonText('soldListings')}
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

            {unsoldAuctionNotice && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dealer-unsold-auction-title"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) dismissUnsoldAuctionNotice()
                    }}
                >
                    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-6">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                                    <Gavel size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Auction update</p>
                                    <h2 id="dealer-unsold-auction-title" className="mt-1 text-xl font-black">
                                        Give your vehicle a wider audience
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismissUnsoldAuctionNotice}
                                className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
                                aria-label="Close"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="space-y-5 p-6">
                            <p className="text-sm leading-7 text-[var(--text-secondary)]">
                                {unsoldAuctionNotice.message}
                            </p>

                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <ShoppingBag size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                                    <div>
                                        <p className="text-sm font-black text-[var(--text-primary)]">
                                            {unsoldAuctionNotice.data?.retailAlreadyLive
                                                ? 'Your Retail Listing is already live'
                                                : 'Retail Listing — £1 until sold'}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                            {unsoldAuctionNotice.data?.retailAlreadyLive
                                                ? 'Keep the vehicle visible to CarMazium’s wider retail audience and manage it from your dashboard.'
                                                : 'Your vehicle details are already saved. Move it into the wider retail marketplace without starting again.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" onClick={dismissUnsoldAuctionNotice}>
                                    Not now
                                </Button>
                                <Button type="button" className="gap-2" onClick={openRetailFromNotice}>
                                    <ShoppingBag size={16} />
                                    {unsoldAuctionNotice.data?.retailAlreadyLive
                                        ? 'Manage Retail Listing'
                                        : 'List in Retail for £1'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
