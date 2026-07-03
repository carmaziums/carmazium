"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { ListingWizard } from "@/components/listing/ListingWizard"
import { Loader2 } from "lucide-react"

export default function DashboardAddListingPage() {
    return (
        <div className="min-h-screen pt-20 relative">
             {/* Background gradient for dashboard consistency */}
            <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-body)' }} />

            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8 pb-12">
                <DashboardSidebar role="seller" />
                <main className="flex-1 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)] overflow-hidden">
                    <React.Suspense fallback={
                        <div className="p-10 flex items-center justify-center">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    }>
                        <ListingWizard isDashboard={true} />
                    </React.Suspense>
                </main>
            </div>
        </div>
    )
}
