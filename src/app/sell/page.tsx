"use client"

import * as React from "react"
import { Suspense } from "react"
import { ListingWizard } from "@/components/listing/ListingWizard"
import { useAuth } from "@/context/AuthContext"
import { Lock, ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

function SellContent() {
    const { profile, loading } = useAuth()
    const router = useRouter()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        )
    }

    if (profile?.role === 'DEALER') {
        const isStaffMember = !!((profile as any)?.dealerStaffMemberships?.length)
        const isVerified = !!profile?.dealerProfile?.isVerified || isStaffMember

        if (!isVerified) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                        <Lock size={36} className="text-amber-400" />
                    </div>
                    <h1 className="text-3xl font-black font-heading mb-3 tracking-tight">
                        Dealer Verification Required
                    </h1>
                    <p className="text-[var(--text-muted)] max-w-md mb-10 leading-relaxed">
                        As a dealer account, you must complete KYC verification before listing vehicles.
                        Head to your dealer dashboard to get verified.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard/dealer')}
                        className="flex items-center gap-2 px-10 py-4 bg-primary hover:bg-red-600 text-white font-bold rounded-2xl text-lg shadow-[0_4px_20px_rgba(237,28,36,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        Go to Dealer Dashboard <ArrowRight size={20} />
                    </button>
                </div>
            )
        }
    }

    return <ListingWizard isDashboard={false} />
}

export default function SellPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <SellContent />
        </Suspense>
    )
}
