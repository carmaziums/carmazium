"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { RoleMessagesInbox } from "@/components/chat/RoleMessagesInbox"
import { useAuth } from "@/context/AuthContext"

function ServiceMessagesContent() {
    const { user, profile, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "User")

    return (
        <div className="min-h-screen pt-3 pb-24 lg:h-[calc(100dvh-5rem)] lg:min-h-0 lg:overflow-hidden lg:p-0">
            <div className="flex w-full max-w-none flex-col gap-3 px-2 sm:px-4 lg:h-full lg:flex-row lg:gap-0 lg:p-0">
                <div className="lg:hidden">
                <DashboardSidebar
                    role="provider"
                    userName={userName}
                    userType={profile?.role ? `${profile.role} Account` : "Service Provider"}
                />
                </div>
                <div className="flex-1 min-w-0 lg:h-full">
                    <RoleMessagesInbox backHref="/dashboard/service" subtitle="Customer and provider conversations" />
                </div>
            </div>
        </div>
    )
}

export default function ServiceMessagesPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        }>
            <ServiceMessagesContent />
        </React.Suspense>
    )
}
