"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { useSessionDraft } from "@/hooks/useSessionDraft"
import { checkWarrantyAvailability, createServiceLead, getWarrantyListing, type WarrantyListing } from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm outline-none focus:border-primary read-only:opacity-75"
const labelCls = "block text-sm font-semibold mb-2"
const sectionCls = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-6"

export function WarrantyEnquiryForm() {
    const params = useSearchParams()
    const listingId = params.get("listingId") || ""
    const [source, setSource] = React.useState<{ id: string; listing?: WarrantyListing; error?: string } | null>(null)

    React.useEffect(() => {
        if (!listingId) return
        let cancelled = false
        getWarrantyListing(listingId).then(
            listing => { if (!cancelled) setSource({ id: listingId, listing }) },
            error => { if (!cancelled) setSource({ id: listingId, error: error?.message || "Could not load this vehicle. Please return to the listing and try again." }) },
        )
        return () => { cancelled = true }
    }, [listingId])

    if (listingId && source?.id !== listingId) return <p role="status" className={sectionCls}>Loading vehicle details…</p>
    if (listingId && source?.error) return <div role="alert" className={sectionCls}><p>{source.error}</p><Link href="/search" className="mt-4 inline-block text-primary underline">Back to retail cars</Link></div>
    return <WarrantyForm key={listingId || "general"} listing={listingId ? source?.listing : undefined} />
}

function WarrantyForm({ listing }: { listing?: WarrantyListing }) {
    const router = useRouter()
    const { user, profile, loading } = useAuth()
    const prefix = `tradexchange:warranty:${listing?.id || "general"}`
    const { value: form, setValue: setForm, clearDraft, hydrated } = useSessionDraft(`${prefix}:form`, {
        registration: listing?.vehicleRegistration || "", make: listing?.vehicleMake || "", model: listing?.vehicleModel || "",
        year: listing?.vehicleYear == null ? "" : String(listing.vehicleYear),
        mileage: listing?.vehicleMileage == null ? "" : String(listing.vehicleMileage),
        value: listing ? String(listing.vehicleValuePence / 100) : "",
        postcode: "", warrantyMonths: "12", warrantyLevel: "Not sure", phone: "", summary: "",
    })
    const [consent, setConsent] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [availability, setAvailability] = React.useState<{ key: string; count: number } | null>(null)
    const contactRef = React.useRef<HTMLElement>(null)
    const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))
    // Authoritative listing fields take precedence over an older saved draft.
    const vehicle = {
        registration: listing?.vehicleRegistration ?? form.registration,
        make: listing?.vehicleMake ?? form.make,
        model: listing?.vehicleModel ?? form.model,
        year: listing?.vehicleYear == null ? form.year : String(listing.vehicleYear),
        mileage: listing?.vehicleMileage == null ? form.mileage : String(listing.vehicleMileage),
        value: listing ? String(listing.vehicleValuePence / 100) : form.value,
    }
    const criteria = {
        listingId: listing?.id,
        vehicleRegistration: vehicle.registration.trim() || undefined,
        vehicleMake: vehicle.make.trim() || undefined,
        vehicleModel: vehicle.model.trim() || undefined,
        vehicleYear: vehicle.year ? Number(vehicle.year) : undefined,
        vehicleMileage: vehicle.mileage ? Number(vehicle.mileage) : undefined,
        vehicleValuePence: vehicle.value ? Math.round(Number(vehicle.value) * 100) : undefined,
        postcode: form.postcode.trim(),
        warrantyMonths: Number(form.warrantyMonths),
        warrantyLevel: form.warrantyLevel,
    }
    const criteriaKey = JSON.stringify(criteria)
    const checked = availability?.key === criteriaKey
    const canContact = checked && availability.count > 0
    const returnUrl = listing ? `/services/warranty?listingId=${encodeURIComponent(listing.id)}` : "/services/warranty"

    React.useEffect(() => {
        setConsent(false)
        setError(null)
    }, [criteriaKey, user?.id])

    React.useEffect(() => {
        if (canContact) contactRef.current?.focus()
    }, [canContact])

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        if (!criteria.vehicleRegistration && !(criteria.vehicleMake && criteria.vehicleModel)) {
            setError("Enter the registration or vehicle make and model.")
            return
        }
        if (!canContact) {
            setBusy(true)
            try {
                const result = await checkWarrantyAvailability(criteria)
                setAvailability({ key: criteriaKey, count: result.available ? result.providerCount : 0 })
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Could not check provider availability. Please try again.")
            } finally { setBusy(false) }
            return
        }
        if (!user) {
            router.push(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
            return
        }
        if (!consent) { setError("Please agree to share this enquiry with matching approved warranty providers."); return }
        setBusy(true)
        try {
            const lead = await createServiceLead({
                ...criteria, serviceType: "WARRANTY", requireMatchedProvider: true,
                phone: form.phone.trim() || profile?.phone || undefined,
                summary: form.summary.trim() || undefined,
                consentToProviderContact: true,
            })
            clearDraft()
            router.push(`/services/leads/${lead.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not submit your warranty enquiry. Please try again.")
            setAvailability(null)
            setConsent(false)
        } finally { setBusy(false) }
    }

    const fields = [
        ["registration", "Registration", "text", listing?.vehicleRegistration != null],
        ["make", "Make", "text", listing?.vehicleMake != null],
        ["model", "Model", "text", listing?.vehicleModel != null],
        ["year", "Year", "number", listing?.vehicleYear != null],
        ["mileage", "Mileage", "number", listing?.vehicleMileage != null],
        ["value", "Vehicle value (£)", "number", !!listing],
    ] as const

    return <form onSubmit={submit} className="space-y-5" aria-label="Request warranty quotes">
        {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div>}
        <fieldset disabled={busy || !hydrated} className="space-y-5 min-w-0">
            <section className={sectionCls}>
                <h2 className="font-heading font-bold text-lg mb-2">{listing ? "Warranty for this car" : "Your vehicle"}</h2>
                {listing && <p className="mb-5 text-sm"><Link href={`/buy-cars/${encodeURIComponent(listing.slug)}`} className="text-primary underline">{listing.title}</Link><span className="block mt-1 text-[var(--text-muted)]">Vehicle details filled from the retail listing.</span></p>}
                <div className="grid sm:grid-cols-2 gap-4">
                    {fields.map(([key, label, type, readOnly]) => <div key={key}>
                        <label htmlFor={`warranty-${key}`} className={labelCls}>{label}</label>
                        <input id={`warranty-${key}`} className={inputCls} type={type} value={vehicle[key]} readOnly={readOnly} onChange={e => set(key, e.target.value)}
                            min={key === "year" ? 1900 : type === "number" ? 0 : undefined}
                            max={key === "year" ? 2100 : key === "mileage" ? 2000000 : key === "value" ? 500000 : undefined}
                            step={key === "value" ? "0.01" : type === "number" ? "1" : undefined}
                            maxLength={key === "registration" ? 10 : type === "text" ? 60 : undefined} />
                    </div>)}
                </div>
            </section>
            <section className={sectionCls}>
                <h2 className="font-heading font-bold text-lg mb-4">What cover would you like?</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div><label htmlFor="warranty-months" className={labelCls}>Preferred duration</label><select id="warranty-months" className={inputCls} value={form.warrantyMonths} onChange={e => set("warrantyMonths", e.target.value)}>{[6, 12, 24].map(months => <option key={months} value={months}>{months} months</option>)}</select></div>
                    <div><label htmlFor="warranty-level" className={labelCls}>Cover preference</label><select id="warranty-level" className={inputCls} value={form.warrantyLevel} onChange={e => set("warrantyLevel", e.target.value)}>{["Not sure", "Essential", "Comprehensive", "Premium"].map(level => <option key={level}>{level}</option>)}</select></div>
                    <div className="sm:col-span-2"><label htmlFor="warranty-postcode" className={labelCls}>Your postcode</label><input id="warranty-postcode" className={inputCls} required maxLength={10} autoComplete="postal-code" value={form.postcode} onChange={e => set("postcode", e.target.value)} placeholder="B19 1ES" /><p className="mt-2 text-xs text-[var(--text-muted)]">Used to check which approved providers cover your area.</p></div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">These are preferences, not specific products. Providers will confirm their prices, eligibility, covered parts, exclusions and claim limits.</p>
            </section>
            {checked && !canContact && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">No approved warranty provider currently matches this vehicle, area and cover preference. You can change your preferences or try again later. No enquiry or contact details have been sent.</div>}
            {canContact && <section ref={contactRef} tabIndex={-1} className={`${sectionCls} outline-none`} aria-labelledby="warranty-contact-title">
                <p role="status" className="flex gap-2 items-center text-sm mb-4"><CheckCircle size={18} className="text-emerald-500" />{availability.count} matching approved {availability.count === 1 ? "provider" : "providers"}</p>
                <h2 id="warranty-contact-title" className="font-heading font-bold text-lg mb-4">Contact details & requirements</h2>
                {user ? <p className="text-sm mb-4 break-words">Your account name and email will be included: <strong>{[profile?.firstName, profile?.lastName].filter(Boolean).join(" ")}</strong> {profile?.email || user.email}</p> : <p className="text-sm mb-4">Sign in to send your request and receive provider replies. Your vehicle details and preferences are saved in this tab.</p>}
                <label htmlFor="warranty-phone" className={labelCls}>Phone (optional)</label><input id="warranty-phone" className={inputCls} type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder={profile?.phone || "Contact phone number"} />
                <label htmlFor="warranty-notes" className={`${labelCls} mt-4`}>Anything providers should know? (optional)</label><textarea id="warranty-notes" className={`${inputCls} min-h-28`} value={form.summary} maxLength={2000} onChange={e => set("summary", e.target.value)} />
                {user && <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>I agree that CarMazium may share this enquiry and my contact details with up to five matching, approved warranty providers so they can respond to me.</span></label>}
            </section>}
            <p className="flex gap-3 text-sm leading-relaxed text-[var(--text-muted)]"><ShieldCheck size={20} className="shrink-0 text-primary" />Cover is arranged separately with the provider. This request does not buy the car or activate a warranty, and no payment is taken by CarMazium.</p>
            <Button type="submit" size="lg" className="w-full" disabled={busy || loading || !hydrated}>
                {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : canContact ? user ? "Request warranty quotes" : "Sign in and continue" : "Check warranty availability"}
            </Button>
        </fieldset>
    </form>
}
