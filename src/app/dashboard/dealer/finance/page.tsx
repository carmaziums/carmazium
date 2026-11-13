"use client"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { FinancePreference } from "@/components/finance/FinancePreference"
import { FinanceProviderContact } from "@/components/finance/FinanceProviderContact"
import { useAuth } from "@/context/AuthContext"
export default function DealerFinancePage() {
    const { profile } = useAuth()
    return <div className="container mx-auto px-5 py-12 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="dealer" userName={profile?.firstName || "Dealer"} userType="Dealer Account" />
        <main className="flex-1 space-y-6"><h1 className="text-3xl font-bold">Listing finance calculator</h1><FinancePreference /><FinanceProviderContact /></main>
    </div>
}
