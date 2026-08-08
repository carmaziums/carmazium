"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (loading) return

        if (!user) {
            router.push('/auth/login')
            return
        }

        // No extra refreshProfile() round-trip here — every flow that actually
        // changes a user's role (dealer/settings, dealer/layout switch-to-buyer,
        // KycOverlayForm) already calls refreshProfile() itself before pushing
        // here, so AuthContext's profile is already current by the time this
        // effect runs.
        const role = (
            profile?.role ||
            (user as any)?.user_metadata?.role ||
            'BUYER'
        ).toUpperCase()

        if (role === 'BUYER' || role === 'SELLER') {
            router.push('/dashboard/user')
        } else if (role === 'DEALER') {
            router.push('/dashboard/dealer')
        } else if (role === 'CONTRACTOR') {
            router.push('/dashboard/service')
        } else if (role === 'FINANCE_PARTNER') {
            router.push('/dashboard/finance')
        } else if (role === 'INSURANCE_PARTNER') {
            router.push('/dashboard/insurance')
        } else {
            // Fallback — unknown role goes to seller dashboard
            router.push('/dashboard/seller')
        }
    }, [user, profile, loading, router])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-[var(--text-muted)] font-medium">Loading your dashboard...</p>
        </div>
    )
}
