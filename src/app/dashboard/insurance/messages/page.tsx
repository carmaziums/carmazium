"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { RoleMessagesInbox } from "@/components/chat/RoleMessagesInbox"
import { useAuth } from "@/context/AuthContext"

function InsuranceMessagesContent() {
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
        <div className="min-h-screen pt-3 pb-24 lg:pt-20 lg:pb-12">
            <div className="container mx-auto px-2 sm:px-5 flex flex-col lg:flex-row gap-3 lg:gap-8">
                <DashboardSidebar role="insurance" userName={userName} userType="Insurance Partner" />
                <main className="flex-1 min-w-0">
                    <RoleMessagesInbox subtitle="Customer and insurance conversations" />
                </main>
            </div>
        </div>
    )
}

export default function InsuranceMessagesPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        }>
            <InsuranceMessagesContent />
        </React.Suspense>
    )
}
