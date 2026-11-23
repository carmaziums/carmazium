"use client"

import * as React from "react"
import { jobVehicleIdentified, jobPostcodeValid, jobYearValid, focusJobFormIssue } from "@/lib/serviceJobFormValidation"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { parseUkServiceDateTime } from "@/lib/ukServiceDateTime"
import { Truck, Plus, Trash2, Loader2, AlertCircle, ArrowRight, CheckCircle } from "lucide-react"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { useAuth } from "@/context/AuthContext"
import { useSessionDraft } from "@/hooks/useSessionDraft"
import { deliveryServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"
import { Button } from "@/components/ui/Button"
import { createJob, type JobVehicle } from "@/lib/servicesApi"

/**
 * Post a delivery / recovery job. Any signed-in account.
 *
 * Street addresses are optional here on purpose: the transporter only needs
 * postcodes to quote, and the address is revealed to the one you accept. Asking
 * for the full address up front is friction for nothing.
 */

const EMPTY_VEHICLE: JobVehicle = { registration: "", make: "", model: "", year: undefined, notes: "" }
const EMPTY_DELIVERY_DRAFT = {
    isRecovery: "false", transportKind: "", prefillKey: "", title: "", description: "", pickupPostcode: "", pickupAddress: "",
    deliveryPostcode: "", deliveryAddress: "", asap: "true", requestedFor: "",
    vehiclesJson: JSON.stringify([{ ...EMPTY_VEHICLE }]),
}
function decodeVehicles(value: string): JobVehicle[] {
    try {
        const items = JSON.parse(value)
        if (!Array.isArray(items) || !items.length) return [{ ...EMPTY_VEHICLE }]
        return items.slice(0, 12).map((v: unknown) => {
            const item = v && typeof v === "object" ? v as Record<string, unknown> : {}
            const safe = (name: string, length: number) =>
                typeof item[name] === "string" ? (item[name] as string).slice(0, length) : ""
            const year = Number(item.year)
            return {
                listingId: safe("listingId", 36) || undefined,
                registration: safe("registration", 10), make: safe("make", 60),
                model: safe("model", 60), notes: safe("notes", 300),
                year: item.year != null && Number.isFinite(year) ? year : undefined,
            }
        })
    } catch { return [{ ...EMPTY_VEHICLE }] }
}

const inputCls = "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
const labelCls = "block text-sm font-semibold text-[var(--text-muted)] mb-2"

type TransportKind = "delivery" | "collection" | "recovery"
function transportKind(value: string | null | undefined): TransportKind | null {
    return value === "delivery" || value === "collection" || value === "recovery" ? value : null
}

function NewDeliveryJobForm() {
    const router = useRouter()
    const [submitting, setSubmitting] = React.useState(false)
    const [invalidField, setInvalidField] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const params = useSearchParams()
    const listingContext = params.get("listingId")?.trim().slice(0,36) || ""
    const draftNamespace = "tradexchange:delivery:new" + (listingContext ? ":listing:" + listingContext : "")
    const intent = params.toString()

    const { user, loading: authLoading } = useAuth()
    // Reuse existing session draft storage, isolated by signed-in account.
    const { value: draft, setValue: setDraft, clearDraft, hydrated } = useSessionDraft(
        draftNamespace, EMPTY_DELIVERY_DRAFT, user?.id ?? null, authLoading,
    )
    const kind = transportKind(draft.transportKind) ?? (draft.isRecovery === "true" ? "recovery" : "delivery")
    const isRecovery = kind === "recovery"
    const title = draft.title, description = draft.description
    const pickupPostcode = draft.pickupPostcode, pickupAddress = draft.pickupAddress
    const deliveryPostcode = draft.deliveryPostcode, deliveryAddress = draft.deliveryAddress
    const asap = draft.asap === "true", requestedFor = draft.requestedFor
    const vehicles = React.useMemo(() => decodeVehicles(draft.vehiclesJson), [draft.vehiclesJson])
    const linkedListingTitle = listingContext && vehicles.some(v => v.listingId === listingContext) ? (params.get("vehicleTitle")?.slice(0,120) || "Selected vehicle") : null
    const update = (key: keyof typeof EMPTY_DELIVERY_DRAFT, value: string) =>
        setDraft(current => ({ ...current, [key]: value }))
    const setKind = (value: TransportKind) => setDraft(current => ({ ...current, transportKind: value, isRecovery: String(value === "recovery") }))
    const setTitle = (value: string) => update("title", value)
    const setDescription = (value: string) => update("description", value)
    const setPickupPostcode = (value: string) => update("pickupPostcode", value)
    const setPickupAddress = (value: string) => update("pickupAddress", value)
    const setDeliveryPostcode = (value: string) => update("deliveryPostcode", value)
    const setDeliveryAddress = (value: string) => update("deliveryAddress", value)
    const setAsap = (value: boolean) => update("asap", String(value))
    const setRequestedFor = (value: string) => update("requestedFor", value)
    const setVehicles = (next: React.SetStateAction<JobVehicle[]>) => {
        setDraft(current => {
            const existing = decodeVehicles(current.vehiclesJson)
            const updated = typeof next === "function" ? next(existing) : next
            return { ...current, vehiclesJson: JSON.stringify(updated.slice(0, 12)) }
        })
    }

    // Apply an explicit entry intent once, never overwrite edits on reload.
    React.useEffect(() => {
        if (!hydrated) return
        const q = new URLSearchParams(intent)
        const selectedKind = transportKind(q.get("kind"))
        const listingId = q.get("listingId")?.trim().slice(0, 36) || undefined
        const registration = q.get("registration")?.trim().toUpperCase().replace(/\s+/g, "").slice(0, 10) || undefined
        const make = q.get("make")?.trim().slice(0, 60) || undefined
        const model = q.get("model")?.trim().slice(0, 60) || undefined
        const yearValue = q.get("year")?.trim()
        const year = yearValue && /^\d{4}$/.test(yearValue) && jobYearValid(yearValue) ? Number(yearValue) : undefined
        const pickup = q.get("pickup")?.trim().slice(0, 300) || ""
        const hasVehicle = !!(listingId || registration || make || model)
        if (!hasVehicle && !selectedKind) return
        const key = JSON.stringify([listingId, registration, make, model, year]) + (hasVehicle ? "" : ":" + selectedKind)
        setDraft(current => {
            if (current.prefillKey === key) return current
            const next = { ...current, prefillKey: key }
            if (selectedKind) { next.transportKind = selectedKind; next.isRecovery = String(selectedKind === "recovery") }
            if (hasVehicle) {
                return { ...EMPTY_DELIVERY_DRAFT, prefillKey: key,
                    transportKind: selectedKind ?? "delivery", isRecovery: String(selectedKind === "recovery"),
                    pickupAddress: pickup, title: "",
                    vehiclesJson: JSON.stringify([{ ...EMPTY_VEHICLE, listingId, registration, make, model, year }]) }
            }
            return next
        })
    }, [hydrated, intent, setDraft])

    const setVehicle = (i: number, patch: Partial<JobVehicle>) =>
        setVehicles(vs => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hydrated || submitting) return
        setError(null)
        setInvalidField(null)
        const fail = (field: string, message: string) => {
            setInvalidField(field); setError(message); focusJobFormIssue(field)
        }
        if (!jobPostcodeValid(pickupPostcode)) return fail("pp", "Enter a valid UK pickup postcode so providers can quote the route.")
        if (!jobPostcodeValid(deliveryPostcode)) return fail("dp", "Enter a valid UK delivery postcode so providers can quote the route.")
        const missingVehicle = vehicles.findIndex(v => !jobVehicleIdentified(v))
        if (missingVehicle >= 0) return fail(`vehicle-${missingVehicle}-registration`, "Each vehicle needs either its registration or both its make and model.")
        const badYear = vehicles.findIndex(v => !jobYearValid(v.year))
        if (badYear >= 0) return fail(`vehicle-${badYear}-registration`, "Enter a valid vehicle year between 1900 and 2100.")
        const scheduled = asap ? undefined : parseUkServiceDateTime(requestedFor)
        if (!asap && !scheduled) return fail("job-date", "Choose a valid future date and time in the UK.")
        const autoTitle = (kind.charAt(0).toUpperCase() + kind.slice(1) + ": " + (vehicles.length === 1 ? ([vehicles[0].make, vehicles[0].model].filter(Boolean).join(" ") || vehicles[0].registration || "Vehicle") : vehicles.length + " vehicles") + " — " + pickupPostcode.trim().toUpperCase() + " to " + deliveryPostcode.trim().toUpperCase()).slice(0, 120)

        setSubmitting(true)
        try {
            const job = await createJob({
                serviceType: "DELIVERY",
                isRecovery,
                title: title.trim() || autoTitle,
                description: (kind === "collection" ? "Transport requested: Collection.\n" + description.trim() : description.trim()).trim().slice(0, 2000) || undefined,
                pickupPostcode: pickupPostcode.trim().toUpperCase(),
                pickupAddress: pickupAddress.trim() || undefined,
                deliveryPostcode: deliveryPostcode.trim().toUpperCase(),
                deliveryAddress: deliveryAddress.trim() || undefined,
                requestedFor: scheduled || undefined,
                vehicles: vehicles.map(v => ({
                    listingId: v.listingId || undefined,
                    registration: v.registration?.trim().replace(/\s+/g, "").toUpperCase() || undefined,
                    make: v.make?.trim() || undefined,
                    model: v.model?.trim() || undefined,
                    year: v.year || undefined,
                    notes: v.notes || undefined,
                })),
            })
            clearDraft()
            router.push(`/services/jobs/${job.id}?posted=1`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not post the job. Please try again.")
            requestAnimationFrame(() => focusJobFormIssue("job-error"))
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={submit} noValidate className="container mx-auto px-5 py-12 max-w-3xl">
            <Link href="/services/delivery" className="mb-5 inline-flex min-h-12 items-center font-semibold underline">Back to Vehicle Transport</Link>
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                    <Truck size={13} /> Vehicle Transport
                </div>
                <h1 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-2">Request vehicle transport</h1>
                <p className="text-[var(--text-muted)] text-sm">Compare quotes from approved providers. Posting a request does not book a provider or take payment.</p>
            </div>

            {linkedListingTitle && (
                <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Vehicle filled from the CarMazium advert</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{linkedListingTitle}. Add the pickup postcode and where you want the vehicle delivered.</p>
                    </div>
                </div>
            )}

            {error && (
                <div role="alert" id="job-error" tabIndex={-1} className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
                </div>
            )}

            <fieldset className="mb-8">
                <legend className={labelCls}>1. Choose transport type</legend>
                <div className="grid sm:grid-cols-3 gap-3">
                    {[
                        { v: "delivery" as const, label: "Delivery", hint: "Move a vehicle to its destination." },
                        { v: "collection" as const, label: "Collection", hint: "Collect from a seller or agreed location." },
                        { v: "recovery" as const, label: "Recovery", hint: "Non-running or immobilised vehicle; describe the condition below." },
                    ].map(opt => (
                        <label key={String(opt.v)} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${kind === opt.v ? "border-primary bg-primary/5" : "border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary/40"}`}>
                            <input type="radio" name="kind" checked={kind === opt.v} onChange={() => setKind(opt.v)} className="mt-0.5 accent-primary" />
                            <span>
                                <span className="block text-sm font-extrabold">{opt.label}</span>
                                <span className="block text-sm text-[var(--text-muted)] mt-1">{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <details className="mb-8 rounded-xl border border-[var(--border-default)] p-4">
                <summary className="cursor-pointer font-semibold mb-2">Optional request title</summary>
                <label className={labelCls} htmlFor="title">Request title (optional)</label>
                <input aria-invalid={invalidField === "title"} aria-describedby={invalidField === "title" ? "job-error" : undefined} id="title" className={inputCls} value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder='Leave blank to create a title automatically' />
            </details>

            <h2 className="mb-4 text-lg font-bold">2. Collection and delivery locations</h2>
            <div className="grid sm:grid-cols-2 gap-5 mb-8">
                <div className="space-y-3">
                    <div>
                        <label className={labelCls} htmlFor="pp">Collection postcode *</label>
                        <input aria-invalid={invalidField === "pp"} aria-describedby={invalidField === "pp" ? "job-error" : undefined} id="pp" className={`${inputCls} font-mono uppercase`} value={pickupPostcode} onChange={e => setPickupPostcode(e.target.value)} maxLength={10} placeholder="LS1 4AP" />
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="pa">Collection address <span className="normal-case font-semibold">(optional — shown only to your chosen transporter)</span></label>
                        <input id="pa" className={inputCls} value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} maxLength={300} />
                    </div>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className={labelCls} htmlFor="dp">Delivery postcode *</label>
                        <input aria-invalid={invalidField === "dp"} aria-describedby={invalidField === "dp" ? "job-error" : undefined} id="dp" className={`${inputCls} font-mono uppercase`} value={deliveryPostcode} onChange={e => setDeliveryPostcode(e.target.value)} maxLength={10} placeholder="BS1 4DJ" />
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="da">Delivery address <span className="normal-case font-semibold">(optional)</span></label>
                        <input id="da" className={inputCls} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} maxLength={300} />
                    </div>
                </div>
            </div>

            <fieldset className="mb-8">
                <legend className={labelCls}>3. When do you need transport? (UK time)</legend>
                <div className="flex flex-col sm:flex-row gap-3">
                    <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer ${asap ? "border-primary bg-primary/5" : "border-[var(--border-default)] bg-[var(--bg-input)]"}`}>
                        <input type="radio" name="when" checked={asap} onChange={() => setAsap(true)} className="accent-primary" />
                        <span className="text-sm font-bold">As soon as possible</span>
                    </label>
                    <label className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer flex-1 min-w-0 ${!asap ? "border-primary bg-primary/5" : "border-[var(--border-default)] bg-[var(--bg-input)]"}`}>
                        <input type="radio" name="when" checked={!asap} onChange={() => setAsap(false)} className="accent-primary" />
                        <span className="text-sm font-bold whitespace-nowrap">On or after</span>
                        <input id="job-date" aria-label="Preferred delivery date and time (UK time)" aria-invalid={invalidField === "job-date"} aria-describedby={invalidField === "job-date" ? "job-error" : undefined} type="datetime-local" className={`${inputCls} py-1.5 min-w-0 max-w-full basis-full sm:basis-auto`} value={requestedFor} onChange={e => { setRequestedFor(e.target.value); setAsap(false) }} />
                    </label>
                </div>
            </fieldset>

            <fieldset className="mb-8">
                <legend className={labelCls}>4. Vehicles ({vehicles.length}/12)</legend>
                <p className="mb-3 text-sm text-[var(--text-secondary)]">All vehicles must travel on the same route. Enter a registration or both make and model for each.</p>
                <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
                    {vehicles.length < 12 && (
                        <button type="button" onClick={() => setVehicles(vs => [...vs, { ...EMPTY_VEHICLE }])}
                            className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <Plus size={14} /> Add another vehicle
                        </button>
                    )}
                </div>
                <div className="space-y-3">
                    {vehicles.map((v, i) => (
                        <div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                <input id={`vehicle-${i}-registration`} aria-invalid={invalidField === `vehicle-${i}-registration`} aria-describedby={invalidField === `vehicle-${i}-registration` ? "job-error" : undefined} className={`${inputCls} font-mono uppercase`} placeholder="Registration" value={v.registration ?? ""} onChange={e => setVehicle(i, { registration: e.target.value })} maxLength={10} aria-label={"Vehicle " + (i + 1) + " registration"} />
                                <input className={inputCls} placeholder="Make" value={v.make ?? ""} onChange={e => setVehicle(i, { make: e.target.value })} maxLength={60} aria-label={"Vehicle " + (i + 1) + " make"} />
                                <input className={inputCls} placeholder="Model" value={v.model ?? ""} onChange={e => setVehicle(i, { model: e.target.value })} maxLength={60} aria-label={"Vehicle " + (i + 1) + " model"} />
                                <input className={inputCls} placeholder="Year" type="number" min={1900} max={2100} value={v.year ?? ""} onChange={e => setVehicle(i, { year: e.target.value ? Number(e.target.value) : undefined })} aria-label={"Vehicle " + (i + 1) + " year"} />
                            </div>
                            <div className="flex gap-3">
                                <input className={inputCls} placeholder='Notes — "no keys", "low clearance", "flat tyre"' value={v.notes ?? ""} onChange={e => setVehicle(i, { notes: e.target.value })} maxLength={300} aria-label={"Vehicle " + (i + 1) + " notes"} />
                                {vehicles.length > 1 && (
                                    <button type="button" onClick={() => setVehicles(vs => vs.filter((_, idx) => idx !== i))}
                                        className="shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/40" aria-label={"Vehicle " + (i + 1) + " remove vehicle"}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </fieldset>

            <div className="mb-10">
                <label className={labelCls} htmlFor="desc">5. Additional transport instructions <span className="normal-case font-semibold">(optional)</span></label>
                <textarea id="desc" className={`${inputCls} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Access restrictions, contact windows, whether the V5 travels with the car…" />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-xs text-[var(--text-muted)] max-w-sm">
                    Each vehicle needs its registration or both make and model. Your request stays open for up to 7 days. No payment is taken when you post. Approved providers see the route and vehicles and compete with quotes — not your name, phone or full address.
                </p>
                <Button type="submit" size="lg" disabled={submitting || !hydrated} className="w-full sm:w-auto">
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <>Request quotes <ArrowRight size={16} className="ml-2" /></>}
                </Button>
            </div>
        </form>
    )
}

function DeliveryRequestGate() {
    const params = useSearchParams()
    const kept = new URLSearchParams()
    for (const key of ["kind", "listingId", "registration", "make", "model", "year", "pickup", "vehicleTitle"]) {
        const value = params.get(key)
        if (value) kept.set(key, value.slice(0, 300))
    }
    const query = kept.toString()
    const returnTo = "/services/delivery/new" + (query ? "?" + query : "")
    if (!deliveryServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Transport" />

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>
            <RequireAuth
                returnTo={returnTo}
                helpHref="/services/delivery"
                helpLabel="See vehicle transport services"
                title="Sign in to request vehicle transport"
                message="Approved transporters can quote your route. Sign in to receive quotes and manage your request."
            >
                <NewDeliveryJobForm />
            </RequireAuth>
        </div>
    )
}

export default function NewDeliveryJobPage() {
    return <React.Suspense fallback={<div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>}><DeliveryRequestGate /></React.Suspense>
}
