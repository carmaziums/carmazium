"use client"

import React from "react"
import { useAuth } from "@/context/AuthContext"
import { KycOverlayForm } from "@/components/dashboard/KycOverlayForm"
import { Loader2 } from "lucide-react"

/**
 * Dealer Dashboard Layout
 * Wraps all /dashboard/dealer/* pages and blocks access if unverified.
 */
export default function DealerDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, profile, loading } = useAuth()

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
    // Staff members have dealerStaff records — they bypass KYC (their employer already verified)
    const isStaffMember = !!((profile as any)?.dealerStaff?.length)
    const isVerifiedDealer = !!profile?.dealerProfile?.isVerified || isStaffMember

    // Block dashboard access with KYC overlay ONLY after they verify their email
    if (isEmailVerified && !isVerifiedDealer) {
        return <KycOverlayForm />
    }

    return (
        <>
            {children}
        </>
    )
}
