"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { createServiceLead } from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm outline-none focus:border-primary"
const labelCls = "block text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2"

export function ServiceLeadForm({ type }: { type: "FINANCE" | "WARRANTY" }) {
    const router = useRouter()
    const { user, loading } = useAuth()
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [consent, setConsent] = React.useState(false)
    const [form, setForm] = React.useState({
        registration: "", make: "", model: "", year: "", mileage: "", value: "",
        postcode: "", phone: "", summary: "", deposit: "", term: "48", monthlyBudget: "",
        employmentStatus: "", annualIncome: "", warrantyMonths: "12", warrantyLevel: "Comprehensive",
    })

    const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
    const money = (v: string) => v.trim() === "" ? undefined : Math.round(Number(v) * 100)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            router.push(`/auth/login?redirect=${encodeURIComponent(type === "FINANCE" ? "/services/finance" : "/services/warranty")}`)
            return
        }
        if (!consent) return setError("Please confirm that approved providers may contact you about this enquiry.")
        if (type === "WARRANTY" && !form.registration.trim() && !(form.make.trim() && form.model.trim())) {
            return setError("Enter the registration or vehicle make and model.")
        }
        setBusy(true); setError(null)
        try {
            const lead = await createServiceLead({
                serviceType: type,
                vehicleRegistration: form.registration.trim() || undefined,
                vehicleMake: form.make.trim() || undefined,
                vehicleModel: form.model.trim() || undefined,
                vehicleYear: form.year ? Number(form.year) : undefined,
                vehicleMileage: form.mileage ? Number(form.mileage) : undefined,
                vehicleValuePence: money(form.value),
                postcode: form.postcode.trim() || undefined,
                phone: form.phone.trim() || undefined,
                summary: form.summary.trim() || undefined,
                ...(type === "FINANCE" ? {
                    depositPence: money(form.deposit),
                    termMonths: form.term ? Number(form.term) : undefined,
                    monthlyBudgetPence: money(form.monthlyBudget),
                    employmentStatus: form.employmentStatus || undefined,
                    annualIncomePence: money(form.annualIncome),
                } : {
                    warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
                    warrantyLevel: form.warrantyLevel || undefined,
                }),
                consentToProviderContact: true,
            })
            router.push(`/services/leads/${lead.id}`)
        } catch (err: any) {
            setError(err?.message || "Could not submit your enquiry.")
        } finally { setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="space-y-6">
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <h2 className="font-heading font-bold text-lg mb-5">Vehicle</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Registration</label><input className={inputCls} value={form.registration} onChange={e => set("registration", e.target.value)} placeholder="AB12 CDE" maxLength={10} /></div>
                    <div><label className={labelCls}>Year</label><input className={inputCls} type="number" min="1900" max="2100" value={form.year} onChange={e => set("year", e.target.value)} /></div>
                    <div><label className={labelCls}>Make</label><input className={inputCls} value={form.make} onChange={e => set("make", e.target.value)} placeholder="Toyota" /></div>
                    <div><label className={labelCls}>Model</label><input className={inputCls} value={form.model} onChange={e => set("model", e.target.value)} placeholder="Yaris" /></div>
                    <div><label className={labelCls}>Mileage</label><input className={inputCls} type="number" min="0" value={form.mileage} onChange={e => set("mileage", e.target.value)} placeholder="45000" /></div>
                    <div><label className={labelCls}>Approx. vehicle value</label><div className="relative"><span className="absolute left-4 top-3 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-8`} type="number" min="0" step="1" value={form.value} onChange={e => set("value", e.target.value)} placeholder="12000" /></div></div>
                </div>
            </section>

            {type === "FINANCE" ? (
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <h2 className="font-heading font-bold text-lg mb-5">What finance are you looking for?</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className={labelCls}>Deposit</label><div className="relative"><span className="absolute left-4 top-3 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-8`} type="number" min="0" value={form.deposit} onChange={e => set("deposit", e.target.value)} /></div></div>
                        <div><label className={labelCls}>Preferred term</label><select className={inputCls} value={form.term} onChange={e => set("term", e.target.value)}><option value="24">24 months</option><option value="36">36 months</option><option value="48">48 months</option><option value="60">60 months</option><option value="72">72 months</option></select></div>
                        <div><label className={labelCls}>Monthly budget</label><div className="relative"><span className="absolute left-4 top-3 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-8`} type="number" min="0" value={form.monthlyBudget} onChange={e => set("monthlyBudget", e.target.value)} /></div></div>
                        <div><label className={labelCls}>Employment status</label><select className={inputCls} value={form.employmentStatus} onChange={e => set("employmentStatus", e.target.value)}><option value="">Select</option><option>Employed</option><option>Self-employed</option><option>Retired</option><option>Other</option></select></div>
                        <div className="sm:col-span-2"><label className={labelCls}>Annual income</label><div className="relative"><span className="absolute left-4 top-3 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-8`} type="number" min="0" value={form.annualIncome} onChange={e => set("annualIncome", e.target.value)} /></div></div>
                    </div>
                </section>
            ) : (
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <h2 className="font-heading font-bold text-lg mb-5">Cover preference</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className={labelCls}>Warranty length</label><select className={inputCls} value={form.warrantyMonths} onChange={e => set("warrantyMonths", e.target.value)}><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option><option value="36">36 months</option></select></div>
                        <div><label className={labelCls}>Cover level</label><select className={inputCls} value={form.warrantyLevel} onChange={e => set("warrantyLevel", e.target.value)}><option>Essential</option><option>Comprehensive</option><option>Premium</option><option>Not sure</option></select></div>
                    </div>
                </section>
            )}

            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                <h2 className="font-heading font-bold text-lg mb-5">Contact & notes</h2>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Optional — account phone used if available" /></div>
                    <div><label className={labelCls}>Postcode</label><input className={inputCls} value={form.postcode} onChange={e => set("postcode", e.target.value)} placeholder="B19 1ES" maxLength={10} /></div>
                </div>
                <label className={labelCls}>Anything providers should know?</label>
                <textarea className={`${inputCls} min-h-28`} value={form.summary} onChange={e => set("summary", e.target.value)} maxLength={2000} />
            </section>

            <label className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 flex gap-3 items-start cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
                <span className="text-sm leading-relaxed">
                    I agree that CarMazium may share this enquiry and my contact details with approved {type === "FINANCE" ? "vehicle finance" : "warranty"} providers so they can respond to me.
                </span>
            </label>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 flex gap-3 text-sm">
                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <p>{type === "FINANCE" ? "CarMazium is introducing you to providers, not making a lending decision. Any eligibility, credit checks, APR and regulated disclosures come from the provider." : "Warranty contracts, exclusions, claim limits and eligibility are supplied by the provider. Compare the provider's terms before purchasing."}</p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={busy || loading}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : user ? "Send enquiry to approved providers" : "Sign in and continue"}
            </Button>
        </form>
    )
}
