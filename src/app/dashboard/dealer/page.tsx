"use client"

import { DashboardCards } from "@/components/dashboard/DashboardCards"

import { DealerServicesNotice } from "@/components/dealer/DealerServicesNotice"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Kanban, Gavel,
    PlusCircle, Loader2, Building2, CheckCircle,
    Mail, ShieldCheck, BarChart3, ChevronRight, X, ShoppingBag
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { apiClient } from "@/lib/apiClient"
import { getDealerRoute } from "@/config/dealerRouteConfig"
import { useDealerAccess } from "@/context/DealerAccessContext"
import { getNotifications, markNotificationRead, type AppNotification } from "@/lib/notificationsApi"
import { DealerAttentionPanel } from "@/components/dealer/DealerAttentionPanel"

export default function DealerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    const [stats, setStats] = React.useState<any>(null)
    const [resending, setResending] = React.useState(false)
    const [resendSuccess, setResendSuccess] = React.useState(false)
    const [unsoldAuctionNotice, setUnsoldAuctionNotice] = React.useState<AppNotification | null>(null)
    const { loading: accessLoading, hasPermission } = useDealerAccess()

    const canManageInventory = hasPermission('MANAGE_INVENTORY')

    const isEmailVerified = !!user?.email_confirmed_at

    React.useEffect(() => {
        if (!authLoading && !accessLoading && user) {
            fetchDashboardData()
        }
    }, [user, authLoading, accessLoading])

    React.useEffect(() => {
        if (!user) return

        const refreshUnsoldNotice = () => {
            getNotifications(20)
                .then((recentNotifications) => {
                    setUnsoldAuctionNotice(
                        recentNotifications.find(
                            notification => notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead,
                        ) ?? null,
                    )
                })
                .catch(() => {})
        }

        const intervalId = window.setInterval(refreshUnsoldNotice, 30_000)
        return () => window.clearInterval(intervalId)
    }, [user])

    async function fetchDashboardData() {
        try {
            const [statsRes, recentNotifications] = await Promise.all([
                apiClient<{ data: { isVerified?: boolean } }>('/dashboard/dealer'),
                getNotifications(20),
            ])
            setStats(statsRes?.data ?? null)
            setUnsoldAuctionNotice(recentNotifications.find(
                notification => notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead,
            ) ?? null)
        } catch (err) {
            console.error('Failed to load dashboard identity:', err)
            setStats(null)
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

                <div className="flex-1 space-y-8 min-w-0">
                    <DealerServicesNotice />

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
                                                {getDealerRoute('/dashboard/dealer')?.title}
                                            </h1>
                                            <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mt-1 opacity-70">
                                                {getDealerRoute('/dashboard/dealer')?.subHeader}, {userName}
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

                    <Link href="/dashboard/service" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 font-bold text-primary hover:bg-primary/10">
                        Provider Dashboard <ChevronRight size={18} aria-hidden="true" />
                    </Link>

                    {/* ── What needs doing today, most urgent first ── */}
                    {isEmailVerified && <DealerAttentionPanel />}
                    <DashboardCards mode="dealer" />

                </div>
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
