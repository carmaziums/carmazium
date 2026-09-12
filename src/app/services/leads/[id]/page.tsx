"use client"

import * as React from "react"
import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { ArrowLeft, Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { financeServiceEnabled, warrantyServiceEnabled } from "@/lib/featureFlags"
import { closeServiceLead, formatPence, getServiceLead, SERVICE_LABELS, type ServiceLead } from "@/lib/servicesApi"

export default function ServiceLeadDetailPage() {
    const params = useParams<{ id: string }>()
    const [lead, setLead] = React.useState<ServiceLead | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState(true)
    const [closing, setClosing] = React.useState(false)

    if (!financeServiceEnabled && !warrantyServiceEnabled) notFound()

    const load = React.useCallback(() => {
        setBusy(true)
        getServiceLead(params.id).then(setLead).catch(e => setError(e?.message || "Could not load enquiry")).finally(() => setBusy(false))
    }, [params.id])
    React.useEffect(() => { load() }, [load])

    const close = async () => {
        setClosing(true); setError(null)
        try { await closeServiceLead(params.id); load() }
        catch (e: any) { setError(e?.message || "Could not close enquiry") }
        finally { setClosing(false) }
    }

    if (busy) return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
    if (!lead) return <div className="min-h-screen pt-28 container mx-auto px-5"><p className="text-red-500">{error || "Enquiry not found"}</p></div>

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-4xl">
                <Link href="/services/leads" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> My enquiries</Link>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                    <div><p className="text-xs font-black uppercase tracking-widest text-primary mb-2">{SERVICE_LABELS[lead.serviceType]}</p><h1 className="text-3xl font-black font-heading">{[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}</h1><p className="text-sm text-[var(--text-muted)] mt-2">Status: {lead.status} · {lead.responseCount ?? lead.responses?.length ?? 0} provider responses</p></div>
                    {lead.status === "OPEN" && <Button variant="outline" onClick={close} disabled={closing}>{closing ? <Loader2 size={15} className="animate-spin" /> : "Close enquiry"}</Button>}
                </div>
                {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-500">{error}</div>}

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 mb-8">
                    <h2 className="font-heading font-bold text-lg mb-4">Your request</h2>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        {lead.vehicleMileage != null && <Info label="Mileage" value={`${lead.vehicleMileage.toLocaleString()} miles`} />}
                        {lead.vehicleValuePence != null && <Info label="Vehicle value" value={formatPence(lead.vehicleValuePence)} />}
                        {lead.depositPence != null && <Info label="Deposit" value={formatPence(lead.depositPence)} />}
                        {lead.monthlyBudgetPence != null && <Info label="Monthly budget" value={formatPence(lead.monthlyBudgetPence)} />}
                        {lead.termMonths != null && <Info label="Finance term" value={`${lead.termMonths} months`} />}
                        {lead.warrantyMonths != null && <Info label="Warranty term" value={`${lead.warrantyMonths} months`} />}
                        {lead.warrantyLevel && <Info label="Warranty level" value={lead.warrantyLevel} />}
                    </div>
                    {lead.summary && <p className="mt-5 text-sm text-[var(--text-muted)] whitespace-pre-wrap">{lead.summary}</p>}
                </section>

                <h2 className="text-xl font-black font-heading mb-4">Provider responses</h2>
                {!lead.responses?.length ? (
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-7 text-sm text-[var(--text-muted)]">No provider has replied yet. Approved matching providers can see this enquiry while it remains open.</div>
                ) : (
                    <div className="space-y-4">
                        {lead.responses.map((r, i) => (
                            <article key={r.id || i} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div><h3 className="font-heading font-bold text-lg">{r.businessName || "Approved provider"}</h3>{r.rating != null && <p className="text-xs text-[var(--text-muted)] mt-1 inline-flex items-center gap-1"><Star size={12} /> {r.rating.toFixed(1)} ({r.totalReviews ?? 0})</p>}</div>
                                    {r.indicativePricePence != null && <span className="text-lg font-black text-primary">{formatPence(r.indicativePricePence)}</span>}
                                </div>
                                {r.headline && <p className="font-bold mb-2">{r.headline}</p>}
                                {r.productName && <p className="text-sm mb-2"><b>Product:</b> {r.productName}</p>}
                                <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap">{r.message}</p>
                                <div className="flex flex-wrap gap-3 mt-4 text-xs text-[var(--text-muted)]">
                                    {r.representativeApr != null && <span>Representative APR: {r.representativeApr}%</span>}
                                    {r.termMonths != null && <span>Term: {r.termMonths} months</span>}
                                    {r.serviceArea && <span>Area: {r.serviceArea}</span>}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                <p className="text-xs text-[var(--text-muted)] mt-8 leading-relaxed">Provider responses are supplied by the provider. For finance, any eligibility assessment, credit check and regulated disclosure is the provider's responsibility. For warranty, read the provider's full policy wording, exclusions and claim limits before buying.</p>
            </main>
        </div>
    )
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="flex justify-between gap-4 border-b border-[var(--border-default)] pb-2"><span className="text-[var(--text-muted)]">{label}</span><span className="font-semibold text-right">{value}</span></div>
}
