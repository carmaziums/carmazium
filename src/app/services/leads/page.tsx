"use client"

import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { financeServiceEnabled, warrantyServiceEnabled } from "@/lib/featureFlags"
import { getMyServiceLeads, type ServiceLead, SERVICE_LABELS } from "@/lib/servicesApi"

export default function MyServiceLeadsPage() {
    const { user, loading } = useAuth()
    const [leads, setLeads] = React.useState<ServiceLead[]>([])
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState(true)

    if (!financeServiceEnabled && !warrantyServiceEnabled) notFound()

    React.useEffect(() => {
        if (loading) return
        if (!user) { setBusy(false); return }
        getMyServiceLeads().then(setLeads).catch(e => setError(e?.message || "Could not load enquiries")).finally(() => setBusy(false))
    }, [user, loading])

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-4xl">
                <div className="flex items-end justify-between gap-4 mb-8">
                    <div><p className="text-primary text-xs font-black uppercase tracking-widest mb-2">My services</p><h1 className="text-3xl font-black font-heading">Finance & warranty enquiries</h1></div>
                    <Link href="/services" className="text-sm font-bold text-primary">Service Hub</Link>
                </div>

                {!loading && !user && <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center"><p className="mb-4">Sign in to see your enquiries.</p><Link href="/auth/login?redirect=%2Fservices%2Fleads" className="text-primary font-bold">Sign in</Link></div>}
                {busy && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}
                {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-500">{error}</div>}
                {!busy && user && !error && leads.length === 0 && <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center text-[var(--text-muted)]">You have not submitted a finance or warranty enquiry yet.</div>}

                <div className="space-y-4">
                    {leads.map((lead) => (
                        <Link key={lead.id} href={`/services/leads/${lead.id}`} className="block rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 hover:border-primary/40 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{SERVICE_LABELS[lead.serviceType]}</p>
                                    <h2 className="font-heading font-bold text-lg">{[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}</h2>
                                    <p className="text-sm text-[var(--text-muted)] mt-2">{lead.responseCount ?? 0} provider response{(lead.responseCount ?? 0) === 1 ? "" : "s"} · Submitted {new Date(lead.createdAt).toLocaleDateString("en-GB")}</p>
                                </div>
                                <div className="flex items-center gap-3"><span className="text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] px-2.5 py-1 rounded-full">{lead.status}</span><ArrowRight size={17} className="text-primary" /></div>
                            </div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    )
}
