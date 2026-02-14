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

        // If we have a user but no profile (maybe fetch failed), redirect to a default or show error
        if (profile) {
            const role = (profile.role || 'BUYER').toUpperCase()
            if (role === 'BUYER' || role === 'SELLER') {
                router.push('/dashboard/seller')
            } else if (role === 'DEALER') {
                router.push('/dashboard/seller')
            } else if (role === 'CONTRACTOR') {
                router.push('/dashboard/service')
            } else {
                router.push('/dashboard/seller')
            }
        } else {
            // Profile fetch failed (e.g. backend session not ready); redirect to default
            router.push('/dashboard/seller')
        }
    }, [user, profile, loading, router])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-400 font-medium">Loading your dashboard...</p>
        </div>
    )
}
