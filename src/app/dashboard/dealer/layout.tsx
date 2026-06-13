"use client"

import React from "react"
import { useAuth } from "@/context/AuthContext"
import { KycOverlayForm, KYC_SKIP_KEY } from "@/components/dashboard/KycOverlayForm"
import { Loader2, Lock, ShieldCheck, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/apiClient"

/**
 * Dealer Dashboard Layout
 * Wraps all /dashboard/dealer/* pages and blocks access if unverified.
 * Unverified dealers can "Skip for now" — they get a limited-mode banner
 * and can change their account type from the Settings page.
 */
export default function DealerDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()
    const [skipped, setSkipped] = React.useState(false)
    const [switchingRole, setSwitchingRole] = React.useState(false)

    const handleSwitchToBuyer = async () => {
        setSwitchingRole(true)
        try {
            await apiClient('/users/elevate', {
                method: 'POST',
                body: JSON.stringify({ newRole: 'BUYER' }),
            })
            if (typeof window !== 'undefined') {
                localStorage.removeItem(KYC_SKIP_KEY)
            }
            await refreshProfile()
            router.push('/dashboard')
        } catch (err: any) {
            console.error('Failed to switch role:', err)
        } finally {
            setSwitchingRole(false)
        }
    }

    // Read skip flag client-side after hydration
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            setSkipped(localStorage.getItem(KYC_SKIP_KEY) === '1')
        }
    }, [])

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white">
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <p className="text-sm tracking-wider uppercase text-slate-400 font-semibold font-heading">
                    Synchronizing Dealer Portal...
                </p>
            </div>
        )
    }

    const isEmailVerified = !!user?.email_confirmed_at
    const isStaffMember = !!((profile as any)?.dealerStaffMemberships?.length)
    const isVerifiedDealer = !!profile?.dealerProfile?.isVerified || isStaffMember

    // Show KYC overlay unless: verified, staff member, or user explicitly skipped
    if (isEmailVerified && !isVerifiedDealer && !skipped) {
        return <KycOverlayForm onSkip={() => setSkipped(true)} />
    }

    // Show locked dashboard when user skipped — dealer features require KYC
    if (skipped && !isVerifiedDealer) {
        const startKyc = () => {
            if (typeof window !== 'undefined') localStorage.removeItem(KYC_SKIP_KEY)
            setSkipped(false)
            router.push('/dashboard/dealer')
        }
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-20 text-center">
                {/* Lock icon */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                        <Lock size={40} className="text-amber-400" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center">
                        <ShieldCheck size={16} className="text-gray-500" />
                    </div>
                </div>

                <h1 className="text-3xl font-black font-heading text-white mb-3 tracking-tight">
                    Dealer Features Locked
                </h1>
                <p className="text-gray-400 max-w-md mb-2 leading-relaxed">
                    Complete KYC verification to unlock your dealer dashboard and start listing vehicles, managing inventory, and accessing auction tools.
                </p>
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-10">
                    Verification typically takes less than 24 hours
                </p>

                {/* Feature list */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 max-w-lg w-full">
                    {[
                        "List Vehicles",
                        "Manage Inventory",
                        "Run Auctions",
                        "Bulk Import",
                        "Analytics",
                        "Offer Management",
                    ].map(f => (
                        <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-white/5 opacity-50">
                            <Lock size={12} className="text-amber-400 shrink-0" />
                            <span className="text-xs text-gray-400 font-semibold">{f}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={startKyc}
                    className="flex items-center gap-2 px-10 py-4 bg-primary hover:bg-red-600 text-white font-bold rounded-2xl text-lg shadow-[0_4px_20px_rgba(237,28,36,0.4)] transition-all hover:scale-105 active:scale-95"
                >
                    Start KYC Verification <ArrowRight size={20} />
                </button>

                <p className="text-xs text-gray-600 mt-6">
                    Changed your mind?{' '}
                    <button
                        onClick={handleSwitchToBuyer}
                        disabled={switchingRole}
                        className="text-gray-500 hover:text-gray-300 underline transition-colors disabled:opacity-50"
                    >
                        {switchingRole ? 'Switching...' : 'Go to buyer dashboard'}
                    </button>
                </p>
            </div>
        )
    }

    return <>{children}</>
}
