"use client"

import React from "react"
import { useAuth } from "@/context/AuthContext"
import { KycOverlayForm, KYC_SKIP_KEY } from "@/components/dashboard/KycOverlayForm"
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

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
    const { user, profile, loading } = useAuth()
    const router = useRouter()
    const [skipped, setSkipped] = React.useState(false)

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
        return <KycOverlayForm />
    }

    return (
        <>
            {/* Limited-mode banner shown when user skipped KYC */}
            {skipped && !isVerifiedDealer && (
                <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>
                            <strong>Limited access</strong> — KYC verification is pending.
                            Most dealer features are unavailable until you complete verification.
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            if (typeof window !== 'undefined') localStorage.removeItem(KYC_SKIP_KEY)
                            setSkipped(false)
                            router.push('/dashboard/dealer')
                        }}
                        className="flex items-center gap-1 text-amber-300 font-bold hover:text-amber-200 whitespace-nowrap transition-colors shrink-0"
                    >
                        Complete KYC <ArrowRight size={12} />
                    </button>
                </div>
            )}
            {children}
        </>
    )
}
