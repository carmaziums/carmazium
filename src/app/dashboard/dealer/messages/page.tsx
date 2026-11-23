"use client"

import * as React from "react"
import { Activity } from "lucide-react"
import Link from "next/link"
import { RoleMessagesInbox } from "@/components/chat/RoleMessagesInbox"
import { useAuth } from "@/context/AuthContext"
import { getDealerRoute } from "@/config/dealerRouteConfig"

function MessagesContent() {
    const { loading } = useAuth()

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

    const route = getDealerRoute("/dashboard/dealer/messages")

    return (
        <div className="w-full min-w-0 px-2 sm:px-4 py-3">
            <Link href="/dashboard/dealer" className="mb-2 inline-flex min-h-11 items-center font-semibold underline">Back to dealer dashboard</Link>
            <RoleMessagesInbox title={route.title} subtitle={route.subHeader} spacious className="bg-[var(--bg-card)]" />
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
