"use client"

import Link from "next/link"
import { ArrowRight, ClipboardList, ShieldCheck } from "lucide-react"
import { deliveryServiceEnabled, inspectionServiceEnabled } from "@/lib/featureFlags"
import { useAuth } from "@/context/AuthContext"

const linkClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

// Never infer service approval from a dealer role, a toggle or an old profile.
// The existing Partner workspace and backend remain the authority on approvals,
// assigned work, staff permissions and eligibility to quote.
export function TradeXchangeAccountActions({ paidJobsEnabled }: { paidJobsEnabled: boolean }) {
    const { user, profile, loading } = useAuth()
    if (loading || !user || profile?.id !== user.id) return null
    return <aside aria-labelledby="tx-account-heading" className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 id="tx-account-heading" className="text-xl font-heading font-bold">Your TradeXchange account</h2>
                <p className="mt-1 text-base leading-7 text-[var(--text-secondary)]">View your service requests, quotes, completed work and warranty orders.</p></div>
            <div className="flex flex-wrap gap-2">
                <Link href="/services/jobs" className={linkClass}><ClipboardList size={19} aria-hidden="true" /> My service requests</Link>
                <Link href="/dashboard/warranties" className={linkClass}><ShieldCheck size={19} aria-hidden="true" /> My warranties</Link>
                {["DEALER", "CONTRACTOR"].includes(profile.role) && (!profile.dealerStaffMemberships?.length || !!profile.dealerProfile || profile.role === "CONTRACTOR") && <Link href="/dashboard/service" className={linkClass}>Provider Dashboard <ArrowRight size={17} aria-hidden="true" /></Link>}
                {paidJobsEnabled && deliveryServiceEnabled && <Link href="/services/delivery/new" className={linkClass}>Request transport <ArrowRight size={17} aria-hidden="true" /></Link>}
                {paidJobsEnabled && inspectionServiceEnabled && <Link href="/services/inspection/new" className={linkClass}>Request inspection <ArrowRight size={17} aria-hidden="true" /></Link>}
            </div>
        </div>
    </aside>
}

export function TradeXchangePartnerAction() {
    const { user, profile, loading } = useAuth()
    const current = !!user && profile?.id === user.id
    const staffOnly = current && !!profile.dealerStaffMemberships?.length && !profile.dealerProfile && profile.role !== "CONTRACTOR"
    const specialist = current && ["FINANCE_PARTNER", "INSURANCE_PARTNER", "ADMIN"].includes(profile.role)
    // Existing businesses use their original account. An authorised staff member
    // uses their existing dashboard; never initiate a second business setup.
    const href = current && !specialist && !staffOnly ? "/dashboard/partner" : staffOnly ? "/dashboard/dealer" : "/become-a-partner"
    const label = current && !specialist && !staffOnly
        ? ["DEALER", "CONTRACTOR"].includes(profile.role) ? "Manage Partner Account" : "Explore Partner Account setup"
        : staffOnly ? "Open dealer dashboard" : "Explore Partner Accounts"
    if (user && (loading || !current)) return null
    return <Link href={href} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)]">{label}<ArrowRight size={18} aria-hidden="true" /></Link>
}
