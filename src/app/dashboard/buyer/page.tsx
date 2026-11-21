"use client"

import * as React from "react"
import { LegacyDashboardRedirect } from "@/components/dashboard/LegacyDashboardRedirect"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { DashboardCards } from "@/components/dashboard/DashboardCards"
import { useAuth } from "@/context/AuthContext"
import { Loader2 } from "lucide-react"

function BuyerDashboard() {
    const { user, profile, loading } = useAuth()
    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")
    return <div className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
            <DashboardSidebar role="buyer" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Buyer Account"} />
            <div className="flex-1 min-w-0 space-y-8"><h2 className="text-2xl font-black font-heading">My Dashboard</h2><DashboardCards mode="personal" /></div>
        </div>
    </div>
}

/** Private dashboard canonicalisation; ?legacy=1 preserves specialist actions. */
export default function CanonicalBuyerDashboard() {
    return (
        <React.Suspense fallback={<div className="min-h-[40vh]" />}>
            <LegacyDashboardRedirect target="/dashboard/user?tab=overview">
                <BuyerDashboard />
            </LegacyDashboardRedirect>
        </React.Suspense>
    )
}
