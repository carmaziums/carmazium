"use client"

import * as React from "react"
import { notFound, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { createJob } from "@/lib/servicesApi"
import { inspectionServiceEnabled } from "@/lib/featureFlags"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm outline-none focus:border-primary"
const labelCls = "block text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2"

export default function NewInspectionPage() {
    const router = useRouter()
    const { user, loading } = useAuth()
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [form, setForm] = React.useState({
        registration: "", make: "", model: "", year: "", postcode: "", address: "",
        requestedFor: "", notes: "", title: "Pre-purchase vehicle inspection",
    })

    if (!inspectionServiceEnabled) notFound()

    const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            router.push(`/auth/login?redirect=${encodeURIComponent('/services/inspection/new')}`)
            return
        }
        if (!form.postcode.trim()) return setError("Enter the postcode where the vehicle can be inspected.")
        if (!form.registration.trim() && !(form.make.trim() && form.model.trim())) {
            return setError("Enter the registration or the vehicle make and model.")
        }
        setBusy(true); setError(null)
        try {
            const job = await createJob({
                serviceType: "INSPECTION",
                title: form.title.trim() || "Vehicle inspection",
                description: form.notes.trim() || undefined,
                servicePostcode: form.postcode.trim(),
                serviceAddress: form.address.trim() || undefined,
                requestedFor: form.requestedFor ? new Date(form.requestedFor).toISOString() : undefined,
                vehicles: [{
                    registration: form.registration.trim().toUpperCase().replace(/\s+/g, '') || undefined,
                    make: form.make.trim() || undefined,
                    model: form.model.trim() || undefined,
                    year: form.year ? Number(form.year) : undefined,
                    notes: form.notes.trim() || undefined,
                }],
            })
            router.push(`/services/jobs/${job.id}`)
        } catch (err: any) {
            setError(err?.message || "Could not post the inspection request.")
        } finally { setBusy(false) }
    }

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-3xl">
                <Link href="/services/inspection" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Vehicle Inspections</Link>
                <h1 className="text-3xl md:text-4xl font-black font-heading mb-2">Request a vehicle inspection</h1>
                <p className="text-[var(--text-muted)] mb-8">One request, one vehicle. Approved inspection providers can quote for the work.</p>

                {!loading && !user && (
                    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Sign in before submitting. You can complete the form first.</div>
                )}
                {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

                <form onSubmit={submit} className="space-y-6">
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <h2 className="font-heading font-bold text-lg mb-5">Vehicle</h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div><label className={labelCls}>Registration</label><input className={inputCls} value={form.registration} onChange={e => set('registration', e.target.value)} placeholder="AB12 CDE" maxLength={10} /></div>
                            <div><label className={labelCls}>Year</label><input className={inputCls} type="number" min="1900" max="2100" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2021" /></div>
                            <div><label className={labelCls}>Make</label><input className={inputCls} value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" /></div>
                            <div><label className={labelCls}>Model</label><input className={inputCls} value={form.model} onChange={e => set('model', e.target.value)} placeholder="Yaris" /></div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <h2 className="font-heading font-bold text-lg mb-5">Where and when</h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div><label className={labelCls}>Inspection postcode *</label><input required className={inputCls} value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="B19 1ES" maxLength={10} /></div>
                            <div><label className={labelCls}>Preferred date / time</label><input className={inputCls} type="datetime-local" value={form.requestedFor} onChange={e => set('requestedFor', e.target.value)} /></div>
                            <div className="sm:col-span-2"><label className={labelCls}>Address / location details</label><input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Dealer name, street or collection point" maxLength={300} /></div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <label className={labelCls}>What do you want checked?</label>
                        <textarea className={`${inputCls} min-h-32`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any known faults, areas of concern, diagnostic scan, underside check, road test requirements..." maxLength={2000} />
                    </section>

                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 flex gap-3 text-sm">
                        <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                        <p>The provider quotes a fixed price. If you accept it, payment is made through CarMazium and their 91% share is released after completion.</p>
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={busy || loading}>
                        {busy ? <Loader2 size={18} className="animate-spin" /> : user ? "Post inspection request" : "Sign in and continue"}
                    </Button>
                </form>
            </main>
        </div>
    )
}
