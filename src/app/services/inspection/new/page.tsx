"use client"

import * as React from "react"
import { jobVehicleIdentified, jobDateIssue, focusJobFormIssue } from "@/lib/serviceJobFormValidation"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { createJob } from "@/lib/servicesApi"
import { inspectionServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"
import { useSessionDraft } from "@/hooks/useSessionDraft"

const inputCls = "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm outline-none focus:border-primary"
const labelCls = "block text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2"
const EMPTY_FORM = {
    registration: "", make: "", model: "", year: "", postcode: "", address: "",
    requestedFor: "", notes: "", title: "Pre-purchase vehicle inspection",
}

export default function NewInspectionPage() {
    return <React.Suspense fallback={<p role="status" className="p-8">Loading inspection request…</p>}><InspectionForm /></React.Suspense>
}

function InspectionForm() {
    const params = useSearchParams()
    const listingId = params.get("listingId") || ""
    const initialForm = React.useMemo(() => ({ ...EMPTY_FORM,
        listingId, registration: (params.get("registration") || "").slice(0, 10),
        make: (params.get("make") || "").slice(0, 100), model: (params.get("model") || "").slice(0, 100),
        year: /^\d{4}$/.test(params.get("year") || "") ? params.get("year")! : "",
        address: (params.get("pickup") || "").slice(0, 300),
        title: params.get("vehicleTitle") ? `${params.get("vehicleTitle")!.slice(0, 150)} inspection` : EMPTY_FORM.title,
    }), [params, listingId])
    const router = useRouter()
    const { user, loading } = useAuth()
    const [busy, setBusy] = React.useState(false)
    const [invalidField, setInvalidField] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const { value: form, setValue: setForm, clearDraft, hydrated, prepareSignIn } = useSessionDraft(
        listingId ? `tradexchange:inspection:new:${listingId}` : "tradexchange:inspection:new",
        initialForm,
        user?.id ?? null,
        loading,
    )

    if (!inspectionServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Inspection" />

    const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hydrated || loading || busy) return
        if (!user) {
            prepareSignIn()
            router.push(`/auth/login?redirect=${encodeURIComponent('/services/inspection/new' + (params.size ? '?' + params.toString() : ''))}`)
            return
        }
        setError(null); setInvalidField(null)
        const fail = (field: string, message: string) => { setInvalidField(field); setError(message); focusJobFormIssue(field) }
        if (!form.postcode.trim()) return fail("inspection-postcode", "Enter the postcode where the vehicle can be inspected.")
        if (!jobVehicleIdentified(form)) return fail("inspection-registration", "Enter the registration or both the vehicle make and model.")
        const dateIssue = jobDateIssue(form.requestedFor, false)
        if (dateIssue) return fail(dateIssue.field, dateIssue.message)
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
                    ...(form.listingId ? { listingId: form.listingId } : {}),
                    registration: form.registration.trim().toUpperCase().replace(/\s+/g, '') || undefined,
                    make: form.make.trim() || undefined,
                    model: form.model.trim() || undefined,
                    year: form.year ? Number(form.year) : undefined,
                    notes: form.notes.trim() || undefined,
                }],
            })
            clearDraft()
            router.push(`/services/jobs/${job.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not post the inspection request.")
            requestAnimationFrame(() => focusJobFormIssue("job-error"))
        } finally { setBusy(false) }
    }

    return (
        <div className="min-h-screen pt-24 pb-20">
            <div className="container mx-auto px-5 max-w-3xl">
                <Link href="/services/inspection" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Vehicle Inspections</Link>
                <h1 className="text-3xl md:text-4xl font-black font-heading mb-2">Request a vehicle inspection</h1>
                <p className="text-[var(--text-muted)] mb-8">One request, one vehicle. Approved inspection providers can quote for the work.</p>

                {!loading && !user && (
                    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Sign in before submitting. Your form is saved in this tab and restored when you return.</div>
                )}
                {error && <div role="alert" id="job-error" tabIndex={-1} className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

                <form onSubmit={submit} className="space-y-6">
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <h2 className="font-heading font-bold text-lg mb-5">Vehicle</h2>
                        {listingId && <p className="mb-4 text-sm text-[var(--text-secondary)]">{initialForm.title}. Please confirm the vehicle and inspection location below.</p>}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div><label htmlFor="inspection-registration" className={labelCls}>Registration</label><input id="inspection-registration" aria-invalid={invalidField === "inspection-registration"} aria-describedby={invalidField === "inspection-registration" ? "job-error" : undefined} className={inputCls} value={form.registration} onChange={e => set('registration', e.target.value)} placeholder="AB12 CDE" maxLength={10} /></div>
                            <div><label htmlFor="inspection-year" className={labelCls}>Year</label><input id="inspection-year" aria-invalid={invalidField === "inspection-year"} aria-describedby={invalidField === "inspection-year" ? "job-error" : undefined} className={inputCls} type="number" min="1900" max="2100" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2021" /></div>
                            <div><label htmlFor="inspection-make" className={labelCls}>Make</label><input id="inspection-make" aria-invalid={invalidField === "inspection-make"} aria-describedby={invalidField === "inspection-make" ? "job-error" : undefined} className={inputCls} value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" /></div>
                            <div><label htmlFor="inspection-model" className={labelCls}>Model</label><input id="inspection-model" aria-invalid={invalidField === "inspection-model"} aria-describedby={invalidField === "inspection-model" ? "job-error" : undefined} className={inputCls} value={form.model} onChange={e => set('model', e.target.value)} placeholder="Yaris" /></div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <h2 className="font-heading font-bold text-lg mb-5">Where and when</h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div><label htmlFor="inspection-postcode" className={labelCls}>Inspection postcode *</label><input id="inspection-postcode" aria-invalid={invalidField === "inspection-postcode"} aria-describedby={invalidField === "inspection-postcode" ? "job-error" : undefined} required className={inputCls} value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="B19 1ES" maxLength={10} /></div>
                            <div><label htmlFor="job-date" className={labelCls}>Preferred date / time</label><input id="job-date" aria-invalid={invalidField === "job-date"} aria-describedby={invalidField === "job-date" ? "job-error" : undefined} className={inputCls} type="datetime-local" value={form.requestedFor} onChange={e => set('requestedFor', e.target.value)} /></div>
                            <div className="sm:col-span-2"><label htmlFor="inspection-address" className={labelCls}>Address / location details</label><input id="inspection-address" aria-invalid={invalidField === "inspection-address"} aria-describedby={invalidField === "inspection-address" ? "job-error" : undefined} className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Dealer name, street or collection point" maxLength={300} /></div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <label htmlFor="inspection-notes" className={labelCls}>What do you want checked?</label>
                        <textarea id="inspection-notes" className={`${inputCls} min-h-32`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any known faults, areas of concern, diagnostic scan, underside check, road test requirements..." maxLength={2000} />
                    </section>

                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 flex gap-3 text-sm">
                        <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                        <p>The provider quotes a fixed price. If you accept it, payment is made through CarMazium and the provider share is released after completion.</p>
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={busy || loading || !hydrated}>
                        {busy ? <Loader2 size={18} className="animate-spin" /> : user ? "Post inspection request" : "Sign in and continue"}
                    </Button>
                </form>
            </div>
        </div>
    )
}
