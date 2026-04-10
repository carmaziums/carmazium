"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { DealerQuickList } from "@/components/dealer/DealerQuickList"

export default function DashboardAddListingPage() {
    return (
        <div className="min-h-screen pt-20 bg-slate-900 relative">
             {/* Background gradient for dashboard consistency */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8 pb-24 lg:pb-12">
                <DashboardSidebar role="dealer" />
                <main className="flex-1 bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden">
                    <DealerQuickList />
                </main>
            </div>
        </div>
    )
}
