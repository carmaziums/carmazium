"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()
    const hasRefreshed = useRef(false)

    useEffect(() => {
        if (loading) return

        if (!user) {
            router.push('/auth/login')
            return
        }

        // Ensure we have a fresh profile before routing — this busts stale role
        // cache that can linger after a DEALER → SELLER account switch.
        if (!hasRefreshed.current) {
            hasRefreshed.current = true
            refreshProfile().then(() => {
                // After refresh, the effect will re-run with the updated profile
            })
            return
        }

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
    }, [user, profile, loading, router, refreshProfile])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-400 font-medium">Loading your dashboard...</p>
        </div>
    )
}
