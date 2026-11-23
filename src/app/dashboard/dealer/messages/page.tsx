"use client"

import * as React from "react"
import { Activity } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { RoleMessagesInbox } from "@/components/chat/RoleMessagesInbox"
import { useAuth } from "@/context/AuthContext"
import { getDealerRoute } from "@/config/dealerRouteConfig"

function MessagesContent() {
    const { user, profile, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full border-t-2 border-primary animate-spin opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="text-primary animate-pulse" size={24} />
                    </div>
                </div>
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")
    const route = getDealerRoute("/dashboard/dealer/messages")

    return (
        <div className="min-h-screen pt-3 pb-24 lg:pt-3 lg:pb-4">
            <div className="w-full max-w-none px-2 sm:px-4 flex flex-col lg:flex-row gap-3 lg:gap-4">
                <div className="lg:hidden">
                    <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />
                </div>
                <div className="flex-1 min-w-0">
                    <RoleMessagesInbox
                        title={route.title}
                        subtitle={route.subHeader}
                        className="dealer-glass-card"
                        backHref="/dashboard/dealer"
                    />
                </div>
            </div>
        </div>
    )
}

export default function DealerMessagesPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        }>
            <MessagesContent />
        </React.Suspense>
    )
}
