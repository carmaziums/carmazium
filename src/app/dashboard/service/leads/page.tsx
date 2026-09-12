"use client"

import * as React from "react"
import { Loader2, Send } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { formatPence, getLeadInbox, respondToServiceLead, SERVICE_LABELS, type ServiceLead } from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-primary"

export default function ProviderLeadInboxPage() {
    const { user, profile } = useAuth()
    const [type, setType] = React.useState<"" | "FINANCE" | "WARRANTY">("")
    const [leads, setLeads] = React.useState<ServiceLead[]>([])
    const [error, setError] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [openId, setOpenId] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [reply, setReply] = React.useState({ headline: "", message: "", productName: "", price: "", apr: "", term: "" })

    const load = React.useCallback(() => {
        setLoading(true); setError(null)
        getLeadInbox(type || undefined).then(setLeads).catch(e => setError(e?.message || "Could not load matched enquiries")).finally(() => setLoading(false))
    }, [type])
    React.useEffect(() => { if (user) load() }, [user, load])

    const open = (lead: ServiceLead) => {
        setOpenId(lead.id)
        setReply({
            headline: lead.headline || "",
            message: lead.message || "",
            productName: lead.productName || "",
            price: lead.indicativePricePence != null ? String(lead.indicativePricePence / 100) : "",
            apr: lead.representativeApr != null ? String(lead.representativeApr) : "",
            term: lead.responseTermMonths != null ? String(lead.responseTermMonths) : "",
        })
    }

    const send = async (lead: ServiceLead) => {
        if (!reply.headline.trim() || !reply.message.trim()) return setError("Add a headline and message before responding.")
        setBusy(true); setError(null)
        try {
            await respondToServiceLead(lead.id, {
                headline: reply.headline.trim(), message: reply.message.trim(), productName: reply.productName.trim() || undefined,
                indicativePricePence: reply.price ? Math.round(Number(reply.price) * 100) : undefined,
                representativeApr: lead.serviceType === "FINANCE" && reply.apr ? Number(reply.apr) : undefined,
                termMonths: lead.serviceType === "FINANCE" && reply.term ? Number(reply.term) : undefined,
            })
            setOpenId(null); load()
        } catch (e: any) { setError(e?.message || "Could not send response") }
        finally { setBusy(false) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 max-w-4xl">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                        <div><p className="text-primary text-xs font-black uppercase tracking-widest mb-2">Provider inbox</p><h1 className="text-3xl font-black font-heading">Finance & warranty enquiries</h1><p className="text-sm text-[var(--text-muted)] mt-2">Only enquiries matching your approved capabilities are shown here.</p></div>
                        <select className={`${inputCls} sm:w-48`} value={type} onChange={e => setType(e.target.value as any)}><option value="">All lead services</option><option value="FINANCE">Vehicle Finance</option><option value="WARRANTY">Warranty Providers</option></select>
                    </div>
                    {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}
                    {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}
                    {!loading && leads.length === 0 && <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center text-[var(--text-muted)]">No open matched enquiries right now.</div>}

                    <div className="space-y-4">
                        {leads.map(lead => <article key={lead.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{SERVICE_LABELS[lead.serviceType]}</p><h2 className="font-heading font-bold text-lg">{[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}</h2><p className="text-sm text-[var(--text-muted)] mt-2">{lead.postcode || "Postcode not supplied"}{lead.vehicleValuePence != null ? ` · Vehicle value ${formatPence(lead.vehicleValuePence)}` : ""}</p>{lead.summary && <p className="text-sm mt-3 line-clamp-3">{lead.summary}</p>}</div>
                                <div className="shrink-0 text-right"><span className="inline-block text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] px-2.5 py-1 rounded-full mb-3">{lead.recipientStatus || "NEW"}</span><br/><Button size="sm" variant="outline" onClick={() => open(lead)}>{lead.recipientStatus === "RESPONDED" ? "Update response" : "Respond"}</Button></div>
                            </div>
                            {openId === lead.id && <div className="mt-5 pt-5 border-t border-[var(--border-default)] space-y-3">
                                <div className="grid sm:grid-cols-2 gap-3"><input className={inputCls} value={reply.headline} onChange={e => setReply(r => ({...r, headline:e.target.value}))} placeholder="Headline" maxLength={120}/><input className={inputCls} value={reply.productName} onChange={e => setReply(r => ({...r, productName:e.target.value}))} placeholder="Product / plan name" maxLength={120}/></div>
                                <textarea className={`${inputCls} min-h-28`} value={reply.message} onChange={e => setReply(r => ({...r, message:e.target.value}))} placeholder="Explain your option, eligibility and next steps..." maxLength={2000}/>
                                <div className="grid sm:grid-cols-3 gap-3"><div className="relative"><span className="absolute left-3 top-2.5 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-7`} type="number" min="0" step="0.01" value={reply.price} onChange={e => setReply(r => ({...r, price:e.target.value}))} placeholder={lead.serviceType === "FINANCE" ? "Indicative payment/cost" : "Indicative price"}/></div>{lead.serviceType === "FINANCE" && <><input className={inputCls} type="number" min="0" max="100" step="0.001" value={reply.apr} onChange={e => setReply(r => ({...r, apr:e.target.value}))} placeholder="Representative APR %"/><input className={inputCls} type="number" min="1" max="120" value={reply.term} onChange={e => setReply(r => ({...r, term:e.target.value}))} placeholder="Term months"/></>}</div>
                                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpenId(null)} disabled={busy}>Cancel</Button><Button onClick={() => send(lead)} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={15}/> : <><Send size={15} className="mr-2"/>Send response</>}</Button></div>
                            </div>}
                        </article>)}
                    </div>
                </main>
            </div>
        </div>
    )
}
