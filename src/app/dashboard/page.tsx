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

        // The database still keeps the legacy DEALER / CONTRACTOR values for
        // compatibility with existing marketplace rules. Both are now surfaced
        // to the customer as one Partner Account, where business capabilities
        // are additive rather than mutually-exclusive account types.
        const role = (
            profile?.role ||
            (user as any)?.user_metadata?.role ||
            'BUYER'
        ).toUpperCase()

        if (role === 'BUYER' || role === 'SELLER') {
            router.push('/dashboard/user')
        } else if (role === 'DEALER' || role === 'CONTRACTOR') {
            router.push('/dashboard/partner')
        } else if (role === 'FINANCE_PARTNER') {
            router.push('/dashboard/finance')
        } else if (role === 'INSURANCE_PARTNER') {
            router.push('/dashboard/insurance')
        } else if (role === 'ADMIN') {
            router.push('/dashboard/admin')
        } else {
            router.push('/dashboard/user')
        }
    }, [user, profile, loading, router])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-[var(--text-muted)] font-medium">Loading your dashboard...</p>
        </div>
    )
}
