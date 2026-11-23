"use client"

import * as React from "react"
import { jobVehicleIdentified, jobPostcodeValid, jobYearValid, focusJobFormIssue } from "@/lib/serviceJobFormValidation"
import { parseUkServiceDateTime } from "@/lib/ukServiceDateTime"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { createJob } from "@/lib/servicesApi"
import { inspectionServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"
import { useSessionDraft } from "@/hooks/useSessionDraft"

const kinds = { prepurchase: "Pre-purchase inspection", mechanical: "Mechanical condition inspection", cosmetic: "Cosmetic and bodywork inspection", stock: "Multiple vehicle / dealer stock inspection" } as const
type Kind = keyof typeof kinds
const kindOf = (value: string | null): Kind => value && Object.prototype.hasOwnProperty.call(kinds, value) ? value as Kind : "prepurchase"
type Vehicle = { listingId: string; registration: string; make: string; model: string; year: string; notes: string }
const emptyVehicle = (): Vehicle => ({ listingId: "", registration: "", make: "", model: "", year: "", notes: "" })
const safe = (v: unknown, max: number) => typeof v === "string" ? v.slice(0, max) : ""
const MAX_VEHICLES = 12
const inputCls = "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-base outline-none focus:border-primary"
const labelCls = "block text-sm font-semibold mb-2 text-[var(--text-secondary)]"
const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-6"

// Keep the old individual draft fields as a migration fallback, not a second form.
function decodeVehicles(raw: string, fallback: Vehicle, listingId: string): Vehicle[] {
    try {
        const rows = JSON.parse(raw)
        if (Array.isArray(rows) && rows.length) return rows.slice(0, MAX_VEHICLES).map((row: unknown) => {
            const v = row && typeof row === "object" ? row as Record<string, unknown> : {}
            return { listingId: v.listingId === listingId ? listingId : "", registration: safe(v.registration,10), make: safe(v.make,60), model: safe(v.model,60), year: safe(v.year,4), notes: safe(v.notes,300) }
        })
    } catch { /* Restore old single-vehicle drafts. */ }
    return [fallback]
}

export default function NewInspectionPage() {
    return <React.Suspense fallback={<p role="status" className="p-8">Loading inspection request…</p>}><InspectionForm /></React.Suspense>
}

function InspectionForm() {
    const params = useSearchParams()
    const listingId = safe(params.get("listingId"),36)
    const entryKind = params.get("kind")
    const initialForm = React.useMemo(() => ({
        listingId, registration: safe(params.get("registration"),10), make: safe(params.get("make"),60), model: safe(params.get("model"),60),
        year: /^\d{4}$/.test(params.get("year") || "") ? params.get("year")! : "", postcode: "", address: safe(params.get("pickup"),300),
        requestedFor: "", notes: "", title: "", kind: kindOf(entryKind), entryKind: "", vehiclesJson: "",
    }), [params, listingId, entryKind])
    const router = useRouter()
    const { user, loading } = useAuth()
    const [busy, setBusy] = React.useState(false)
    const [invalidField, setInvalidField] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const { value: form, setValue: setForm, clearDraft, hydrated, prepareSignIn } = useSessionDraft(
        listingId ? "tradexchange:inspection:new:" + listingId : "tradexchange:inspection:new", initialForm, user?.id ?? null, loading,
    )
    React.useEffect(() => {
        if (hydrated && entryKind) setForm(f => f.entryKind === entryKind ? f : { ...f, kind: kindOf(entryKind), entryKind })
    }, [hydrated, entryKind, setForm])
    const vehicles = decodeVehicles(form.vehiclesJson, { ...emptyVehicle(), listingId, registration: form.registration, make: form.make, model: form.model, year: form.year }, listingId)
    const kind = kindOf(form.kind)
    const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))
    const updateVehicles = (fn: (rows: Vehicle[]) => Vehicle[]) => setForm(f => ({ ...f, vehiclesJson: JSON.stringify(fn(decodeVehicles(f.vehiclesJson, { ...emptyVehicle(), listingId, registration: f.registration, make: f.make, model: f.model, year: f.year }, listingId)).slice(0, MAX_VEHICLES)) }))
    const updateVehicle = (i: number, patch: Partial<Vehicle>) => updateVehicles(rows => rows.map((v, j) => i === j ? { ...v, ...patch } : v))
    if (!inspectionServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Inspections" />
    if (!hydrated || loading) return <div role="status" className="min-h-[50vh] grid place-items-center"><span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={20}/> Preparing your inspection request…</span></div>

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hydrated || loading || busy) return
        setError(null); setInvalidField(null)
        const fail = (field: string, message: string) => { setInvalidField(field); setError(message); focusJobFormIssue(field) }
        const missing = vehicles.findIndex(v => !jobVehicleIdentified(v))
        if (missing >= 0) return fail("inspection-registration-" + missing, "Vehicle " + (missing + 1) + " needs a registration or both make and model.")
        const invalidYear = vehicles.findIndex(v => !jobYearValid(v.year))
        if (invalidYear >= 0) return fail("inspection-year-" + invalidYear, "Enter a valid vehicle year between 1900 and 2100.")
        if (!jobPostcodeValid(form.postcode)) return fail("inspection-postcode", "Enter a valid UK postcode for the inspection location.")
        const scheduled = form.requestedFor ? parseUkServiceDateTime(form.requestedFor) : undefined
        if (form.requestedFor && !scheduled) return fail("job-date", "Choose a valid future date and time in the UK.")
        if (!user) {
            prepareSignIn()
            router.push("/auth/login?redirect=" + encodeURIComponent("/services/inspection/new" + (params.size ? "?" + params.toString() : "")))
            return
        }
        setBusy(true)
        try {
            const title = (kinds[kind] + ": " + (vehicles.length === 1 ? ([vehicles[0].make, vehicles[0].model].filter(Boolean).join(" ") || vehicles[0].registration || "Vehicle") : vehicles.length + " vehicles")).slice(0,120)
            const job = await createJob({
                serviceType: "INSPECTION",
                title: form.title.trim().slice(0,120) || title,
                description: ("Inspection requested: " + kinds[kind] + ".\n" + form.notes.trim()).trim().slice(0,2000),
                servicePostcode: form.postcode.trim().toUpperCase(), serviceAddress: form.address.trim() || undefined,
                requestedFor: scheduled || undefined,
                vehicles: vehicles.map(v => ({
                    listingId: v.listingId || undefined, registration: v.registration.trim().toUpperCase().replace(/\s+/g,"") || undefined,
                    make: v.make.trim() || undefined, model: v.model.trim() || undefined, year: v.year ? Number(v.year) : undefined,
                    notes: v.notes.trim() || undefined,
                })),
            })
            clearDraft()
            router.push("/services/jobs/" + job.id + "?posted=1")
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not post the inspection request.")
            requestAnimationFrame(() => focusJobFormIssue("job-error"))
        } finally { setBusy(false) }
    }

    return <div className="min-h-screen py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-5">
            <Link href="/services/inspection" className="mb-5 inline-flex min-h-12 items-center gap-2 font-semibold hover:underline"><ArrowLeft size={18} /> Back to Vehicle Inspections</Link>
            <h1 className="text-3xl sm:text-4xl font-heading font-black">Request a vehicle inspection</h1>
            <p className="mt-3 mb-6 text-base leading-7 text-[var(--text-secondary)]">Describe the checks you need. Compare quotes from approved providers; no payment is taken when you request quotes.</p>
            {!loading && !user && <p className="mb-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-sm">You can complete your request before signing in. This tab saves your draft.</p>}
            {error && <div role="alert" id="job-error" tabIndex={-1} className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
            <form onSubmit={submit} noValidate className="space-y-6">
                <fieldset className={panel}><legend className="px-2 font-bold">1. Inspection type</legend>
                    <div className="grid gap-2 sm:grid-cols-2">{Object.entries(kinds).map(([value,label]) => <label key={value} className={"flex min-h-12 items-center gap-3 rounded-xl border p-3 cursor-pointer " + (kind === value ? "border-primary bg-primary/5" : "border-[var(--border-default)]")}><input type="radio" name="kind" checked={kind === value} onChange={() => set("kind",value)} className="accent-primary" /><span className="font-semibold">{label}</span></label>)}</div>
                </fieldset>
                <fieldset className={panel}><legend className="px-2 font-bold">2. Vehicles ({vehicles.length}/12)</legend>
                    <p className="mb-4 text-sm leading-6 text-[var(--text-secondary)]">All vehicles must be at the same location. The quote and completion outcome cover the whole request. For separate locations or individual job outcomes, create separate requests.</p>
                    {vehicles.map((v,i) => <div key={i} className="mb-4 rounded-xl border border-[var(--border-default)] p-3 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">Vehicle {i+1}</h2>{vehicles.length > 1 && <button type="button" aria-label={"Remove vehicle " + (i+1)} onClick={() => updateVehicles(rows => rows.filter((_,j) => i !== j))} className="min-h-11 px-3 text-red-700 dark:text-red-300"><Trash2 size={19}/></button>}</div>
                        {v.listingId && <p className="mb-3 text-sm text-[var(--text-secondary)]">Linked CarMazium advert. Confirm its details and location.</p>}
                        <div className="grid gap-3 sm:grid-cols-2">{(["registration","year","make","model"] as const).map(key => {
                            const id = "inspection-" + key + "-" + i
                            return <div key={key}><label htmlFor={id} className={labelCls}>{"Vehicle " + (i+1) + " " + key}</label><input id={id} aria-invalid={invalidField === id} aria-describedby={invalidField === id ? "job-error" : undefined} className={inputCls} value={v[key]} maxLength={key === "registration" ? 10 : key === "year" ? 4 : 60} inputMode={key === "year" ? "numeric" : "text"} onChange={e => updateVehicle(i,{[key]:e.target.value})} /></div>
                        })}<div className="sm:col-span-2"><label htmlFor={"vehicle-notes-"+i} className={labelCls}>Vehicle-specific checks (optional)</label><textarea id={"vehicle-notes-"+i} className={inputCls} rows={2} maxLength={300} value={v.notes} onChange={e=>updateVehicle(i,{notes:e.target.value})}/></div></div>
                    </div>)}
                    {vehicles.length < MAX_VEHICLES && <Button type="button" variant="outline" onClick={() => updateVehicles(rows => [...rows,emptyVehicle()])}><Plus size={16}/> Add another vehicle</Button>}
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">Enter a registration or both make and model for each vehicle.</p>
                </fieldset>
                <section className={panel}><h2 className="mb-4 font-bold">3. Where and when</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div><label htmlFor="inspection-postcode" className={labelCls}>Inspection postcode *</label><input id="inspection-postcode" aria-invalid={invalidField === "inspection-postcode"} className={inputCls} value={form.postcode} onChange={e=>set("postcode",e.target.value)} maxLength={10} placeholder="B19 1ES"/></div>
                        <div><label htmlFor="job-date" className={labelCls}>Preferred date / time (UK time)</label><input id="job-date" aria-invalid={invalidField === "job-date"} type="datetime-local" className={inputCls} value={form.requestedFor} onChange={e=>set("requestedFor",e.target.value)}/><p className="mt-1 text-xs text-[var(--text-muted)]">Leave blank for as soon as possible.</p></div>
                        <div className="sm:col-span-2"><label htmlFor="inspection-address" className={labelCls}>Address (optional, shared with chosen provider after payment)</label><input id="inspection-address" className={inputCls} value={form.address} onChange={e=>set("address",e.target.value)} maxLength={300}/></div>
                    </div>
                </section>
                <section className={panel}><label htmlFor="inspection-notes" className={labelCls}>4. Requested scope and report requirements</label><textarea id="inspection-notes" className={inputCls} rows={4} value={form.notes} onChange={e=>set("notes",e.target.value)} maxLength={1900} placeholder="Checks, photographs or report format you want the provider to include. Agree scope before accepting a quote."/></section>
                <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm"><CheckCircle size={18} className="shrink-0 text-emerald-600"/><p>Inspection is a separate paid service. Pay only after accepting a quote. A general request is not an auction-linked inspection.</p></div>
                <Button type="submit" size="lg" className="w-full" disabled={busy || loading || !hydrated}>{busy ? <Loader2 size={18} className="animate-spin"/> : user ? "Request quotes" : "Sign in and continue"}</Button>
            </form>
        </div>
    </div>
}
