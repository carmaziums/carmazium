"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { formatPence, getLeadInboxPage, SERVICE_LABELS, type ServiceLead } from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-primary"

function requirementSummary(lead: ServiceLead) {
    if (lead.serviceType === "FINANCE") {
        return [
            lead.depositPence != null ? `Deposit ${formatPence(lead.depositPence)}` : null,
            lead.termMonths != null ? `${lead.termMonths} months` : null,
            lead.monthlyBudgetPence != null ? `Budget ${formatPence(lead.monthlyBudgetPence)}/month` : null,
        ].filter(Boolean).join(" · ")
    }
    return [
        lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : null,
        lead.warrantyLevel || null,
    ].filter(Boolean).join(" · ")
}

export default function ProviderLeadInboxPage() {
    const { user, profile } = useAuth()
    const [type, setType] = React.useState<"" | "FINANCE" | "WARRANTY">("")
    const [leads, setLeads] = React.useState<ServiceLead[]>([])
    const [error, setError] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [nextCursor, setNextCursor] = React.useState<string | null>(null)
    const [loadingMore, setLoadingMore] = React.useState(false)

    const load = React.useCallback(() => {
        setLoading(true)
        setError(null)
        getLeadInboxPage(type || undefined)
            .then(page => { setLeads(page.items); setNextCursor(page.nextCursor) })
            .catch(e => setError(e?.message || "Could not load matched enquiries"))
            .finally(() => setLoading(false))
    }, [type])

    React.useEffect(() => {
        if (user) load()
    }, [user, load])

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return
        setLoadingMore(true)
        try {
            const page = await getLeadInboxPage(type || undefined, nextCursor)
            setLeads(current => [...current, ...page.items])
            setNextCursor(page.nextCursor)
        } catch (e: any) {
            setError(e?.message || "Could not load more matched enquiries")
        } finally {
            setLoadingMore(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : user?.email || "Provider"

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 max-w-5xl">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                        <div>
                            <p className="text-primary text-xs font-black uppercase tracking-widest mb-2">Provider inbox</p>
                            <h1 className="text-3xl font-black font-heading">Finance & warranty enquiries</h1>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                Open a matched enquiry to review the customer, vehicle and requested terms before responding.
                            </p>
                        </div>
                        <select
                            className={`${inputCls} sm:w-48`}
                            value={type}
                            onChange={e => setType(e.target.value as "" | "FINANCE" | "WARRANTY")}
                        >
                            <option value="">All lead services</option>
                            <option value="FINANCE">Vehicle Finance</option>
                            <option value="WARRANTY">Warranty Providers</option>
                        </select>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="flex justify-center py-16">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && leads.length === 0 && (
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center text-[var(--text-muted)]">
                            No open matched enquiries right now.
                        </div>
                    )}

                    <div className="space-y-4">
                        {leads.map(lead => {
                            const vehicle = [lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel]
                                .filter(Boolean)
                                .join(" · ") || "Vehicle enquiry"
                            const requirements = requirementSummary(lead)

                            return (
                                <article
                                    key={lead.id}
                                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5"
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                                        <div className="min-w-0 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                                                {SERVICE_LABELS[lead.serviceType]}
                                            </p>
                                            <h2 className="font-heading font-bold text-lg">{vehicle}</h2>
                                            <p className="text-sm text-[var(--text-muted)]">
                                                {lead.postcode ? `Postcode area ${lead.postcode}` : "Nationwide / postcode not supplied"}
                                                {lead.vehicleValuePence != null ? ` · Vehicle value ${formatPence(lead.vehicleValuePence)}` : ""}
                                            </p>
                                            {requirements && (
                                                <p className="text-sm font-semibold">{requirements}</p>
                                            )}
                                            <p className="text-xs text-[var(--text-muted)]">Open this matched enquiry to reveal the consented customer contact and full eligibility detail.</p>
                                        </div>

                                        <div className="shrink-0 flex md:flex-col md:items-end items-center justify-between gap-3">
                                            <span className="inline-block text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] px-2.5 py-1 rounded-full">
                                                {lead.recipientStatus || "NEW"}
                                            </span>
                                            <Link
                                                href={`/dashboard/service/leads/${lead.id}`}
                                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm font-bold hover:border-primary hover:text-primary transition-colors"
                                            >
                                                View enquiry <ArrowRight size={15} />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                    {nextCursor && <div className="flex justify-center mt-8">
                        <button type="button" onClick={loadMore} disabled={loadingMore}
                            className="rounded-xl border border-[var(--border-default)] px-5 py-2.5 text-sm font-bold hover:border-primary disabled:opacity-50">
                            {loadingMore ? "Loading…" : "Load more enquiries"}
                        </button>
                    </div>}
                </main>
            </div>
        </div>
    )
}
