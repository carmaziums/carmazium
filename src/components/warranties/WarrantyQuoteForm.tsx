"use client"

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/apiClient'
import { money, WarrantyOrder, warrantyHeaders, warrantyInput, warrantyPanel } from './types'

type Values = Record<string, string>
function Field({ name, label, values, change, options, optional = false, type = 'text', min, max, autoComplete }: {
    name: string; label: string; values: Values; change: (name: string, value: string) => void;
    options?: [string, string][]; optional?: boolean; type?: string; min?: number | string; max?: number | string; autoComplete?: string
}) {
    const props = { id: name, name, required: !optional, className: warrantyInput, value: values[name] || '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(name, e.target.value) }
    return <label htmlFor={name} className="block text-sm font-semibold">{label}{optional && <span className="font-normal text-[var(--text-muted)]"> (optional)</span>}
        {options ? <select {...props}><option value="">Select…</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
            : <input {...props} type={type} min={min} max={max} maxLength={type === 'email' ? 254 : 160} step={name === 'retailValue' ? '0.01' : undefined} autoComplete={autoComplete} />}
    </label>
}

const extrasOptions = [['AIRBAGS', 'Airbag protection', 2000], ['DRIVER_ASSISTANCE', 'Driver assistance', 2000], ['EMISSIONS', 'Emissions', 2000], ['MULTIMEDIA', 'Multimedia', 8000]] as const

export function WarrantyQuoteForm() {
    const params = useSearchParams()
    const [listingId, setListingId] = useState(params.get('listingId') || '')
    const [listingTitle, setListingTitle] = useState('')
    const [values, setValues] = useState<Values>({ repairLimit: '2000', labourRate: '75', requestedStartDate: new Date().toISOString().slice(0, 10) })
    const [extras, setExtras] = useState<string[]>([])
    const [quote, setQuote] = useState<WarrantyOrder | null>(null)
    const [busy, setBusy] = useState(false)
    const [lookingUp, setLookingUp] = useState(false)
    const [lookupNotice, setLookupNotice] = useState('')
    const [error, setError] = useState('')
    const [consent, setConsent] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    const quoteHeading = useRef<HTMLHeadingElement>(null)
    const request = useRef<{ key: string; id: string; token: string } | null>(null)
    const change = (name: string, value: string) => { setValues(v => ({ ...v, [name]: value })); setQuote(null); setError('') }
    const field = (name: string, label: string, opts: Partial<React.ComponentProps<typeof Field>> = {}) => <Field key={name} name={name} label={label} values={values} change={change} {...opts} />

    useEffect(() => {
        if (!listingId) return
        let active = true
        apiClient<{ data: { title: string; vrm?: string; make?: string; model?: string; engineSize?: number; fuelType?: string; price: string } }>(`/warranties/listing/${encodeURIComponent(listingId)}`)
            .then(({ data }) => { if (active) { setListingTitle(data.title); setValues(v => ({ ...v, vrm: data.vrm || '', make: data.make || '', model: data.model || '', engineCc: data.engineSize?.toString() || '', fuelType: data.fuelType || '', retailValue: String(data.price) })) } })
            .catch(e => { if (active) { setError(e.message); setListingId('') } })
        return () => { active = false }
    }, [listingId])

    async function lookup() {
        if (!/^[a-z0-9 ]{2,8}$/i.test(values.vrm || '')) { setError('Enter a valid registration first.'); return }
        setLookingUp(true); setError(''); setLookupNotice('')
        const registration = values.vrm.replace(/\s/g, '').toUpperCase()
        try {
            const data = await apiClient<{ vrm: string; make?: string; model?: string; engineSize?: number; fuelType?: string; firstUsedDate?: string; officialVehicleData?: { dvla?: { manufactureDate?: string }; mot?: { manufactureDate?: string } }; motHistoryStatus?: string; motStatus?: string; lastMotMileage?: { value: number; unit: string; recordedAt: string } }>('/dvla/lookup', { method: 'POST', body: JSON.stringify({ vrm: registration, allowAiEnrichment: false }) })
            setValues(v => {
                if (v.vrm.replace(/\s/g, '').toUpperCase() !== registration) return v
                return { ...v, vrm: registration, make: data.make || v.make || '', model: data.model || v.model || '', engineCc: data.engineSize !== undefined ? String(data.engineSize) : v.engineCc || '',
                    fuelType: data.fuelType || v.fuelType || '', manufactureDate: /^\d{4}-\d{2}-\d{2}/.test(data.officialVehicleData?.dvla?.manufactureDate || data.officialVehicleData?.mot?.manufactureDate || '') ? (data.officialVehicleData?.dvla?.manufactureDate || data.officialVehicleData?.mot?.manufactureDate)!.slice(0, 10) : v.manufactureDate || '', firstRegistrationDate: /^\d{4}-\d{2}-\d{2}/.test(data.firstUsedDate || '') ? data.firstUsedDate!.slice(0, 10) : v.firstRegistrationDate || '' }
            })
            setQuote(null)
            setLookupNotice(`DVLA details loaded. ${data.motHistoryStatus === 'AVAILABLE' ? 'MOT history loaded.' : 'MOT history is unavailable or has no tests; confirm the details below.'}${data.lastMotMileage ? ` Last MOT reading: ${data.lastMotMileage.value.toLocaleString('en-GB')} ${data.lastMotMileage.unit}, recorded ${data.lastMotMileage.recordedAt.slice(0, 10)}. This is not your current mileage.` : ''} Please fill any missing fields and confirm all details.`)
        } catch { setLookupNotice('We could not retrieve the official vehicle data just now. You can still complete the form manually using your vehicle documents.') }
        finally { setLookingUp(false) }
    }

    async function getQuote(event: React.FormEvent) {
        event.preventDefault(); if (busy) return
        setBusy(true); setError('')
        const customer = Object.fromEntries(['title', 'firstName', 'lastName', 'email', 'phone', 'addressLine1', 'addressLine2', 'town', 'county', 'postcode'].map(k => [k, (values[k] || '').trim()]))
        const vehicle = { vrm: values.vrm, make: values.make, model: values.model, mileage: Number(values.mileage), engineCc: Number(values.engineCc), fuelType: values.fuelType,
            firstRegistrationDate: values.firstRegistrationDate, ...(values.manufactureDate ? { manufactureDate: values.manufactureDate } : {}), retailValuePence: Math.round(Number(values.retailValue) * 100), origin: values.origin, serviceHistory: values.serviceHistory,
            ...(values.lastServiceDate ? { lastServiceDate: values.lastServiceDate } : {}), ...(values.lastServiceMileage ? { lastServiceMileage: Number(values.lastServiceMileage) } : {}),
            purchaseDate: values.purchaseDate, requestedStartDate: values.requestedStartDate, knownFaults: values.knownFaults, faultDetails: values.faultDetails || '', detailsConfirmed: confirmed }
        const details = { ...(listingId ? { listingId } : {}), customer, vehicle, selection: { vehicleCategory: values.vehicleCategory, months: 12, repairLimit: Number(values.repairLimit), labourRate: Number(values.labourRate), extras }, consent }
        const key = JSON.stringify(details)
        if (!request.current || request.current.key !== key) {
            const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
            request.current = { key, id: crypto.randomUUID(), token }
        }
        try {
            // Save only the random access key locally, never customer/vehicle details.
            localStorage.setItem(`warranty-order-${request.current.id}`, request.current.token)
            const { data } = await apiClient<{ data: WarrantyOrder }>('/warranties/quotes', { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ ...details, requestId: request.current.id, accessToken: request.current.token }) })
            setQuote(data)
            setTimeout(() => { quoteHeading.current?.focus(); quoteHeading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 50)
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare your quote. Please try again.') }
        finally { setBusy(false) }
    }

    async function pay() {
        if (!quote || !request.current || busy) return
        setBusy(true); setError('')
        try {
            const { data } = await apiClient<{ data: { url: string } }>(`/warranties/orders/${quote.id}/checkout`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ accessToken: request.current.token }) })
            const target = new URL(data.url)
            if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('Payment link could not be verified.')
            window.location.assign(data.url)
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not open checkout.'); setBusy(false) }
    }

    const today = new Date().toISOString().slice(0, 10)
    return <div className="space-y-6">
        {quote ? <section className={`${warrantyPanel} space-y-5`}>
            <h2 ref={quoteHeading} tabIndex={-1} className="text-2xl font-bold scroll-mt-24">Your 12-month warranty quote</h2>
            <p>{String(quote.vehicle.vrm)} · {String(quote.vehicle.make)} {String(quote.vehicle.model)} · {quote.selection.vehicleCategory === 'SUV' ? 'SUV' : 'Car'}</p>
            <dl className="space-y-3">{quote.price.lines.map(line => <div key={line.code} className="flex justify-between gap-4"><dt>{line.label}</dt><dd className="font-semibold whitespace-nowrap">{money(line.amountPence)}</dd></div>)}</dl>
            <div className="border-t border-[var(--border-default)] pt-4 flex justify-between gap-4 items-center"><span>Total, including VAT</span><strong className="text-3xl">{money(quote.totalPence)}</strong></div>
            <p className="text-sm text-[var(--text-muted)]">Quote valid until {new Date(quote.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. This payment is for a warranty order only; it does not buy or reserve the vehicle.</p>
            <div className="rounded-xl bg-[var(--bg-input)] p-4 text-sm space-y-2"><p>CarMazium collects your payment through Stripe. Our admin team then arranges the warranty separately through Pulse Cars Limited, the broker, with Warrantywise.</p><p>Your status will be <strong>Paid — awaiting warranty issue</strong>. Cover is active only once the warranty is issued and its start date is confirmed. If the selected cover cannot be arranged, we will contact you and refund your payment.</p></div>
            <button onClick={pay} disabled={busy} className="w-full bg-primary text-white rounded-xl p-4 font-bold disabled:opacity-50">{busy ? 'Opening secure checkout…' : `Pay ${money(quote.totalPence)} securely with Stripe`}</button>
            <button onClick={() => { setQuote(null); request.current = null }} disabled={busy} className="text-primary underline">Edit my details or cover options</button>
        </section> : <form onSubmit={getQuote} className="space-y-6">
            <section className={`${warrantyPanel} space-y-5`}>
                <h2 className="text-2xl font-bold">1. Your vehicle</h2>
                {listingTitle && <p className="font-semibold">{listingTitle}</p>}
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">{field('vrm', 'Vehicle registration')}<button type="button" onClick={lookup} disabled={lookingUp} className="rounded-xl border border-primary text-primary px-5 py-3 font-bold disabled:opacity-50">{lookingUp ? 'Looking up…' : 'Find vehicle — DVLA & MOT'}</button></div>
                {lookupNotice && <p role="status" className="text-sm rounded-xl bg-[var(--bg-input)] p-4">{lookupNotice}</p>}
                <p className="text-sm text-[var(--text-muted)]">Use the lookup to fill available official details. Confirm the current mileage and enter anything the APIs cannot supply.</p>
                <div className="grid sm:grid-cols-2 gap-5">
                    {field('make', 'Make')}{field('model', 'Model')}
                    {field('vehicleCategory', 'Vehicle category', { options: [['CAR', 'Car'], ['SUV', 'SUV / crossover']] })}
                    {field('mileage', 'Current mileage (miles)', { type: 'number', min: 0, max: 1000000 })}
                    {field('fuelType', 'Fuel type', { options: [['PETROL', 'Petrol'], ['DIESEL', 'Diesel'], ['HYBRID', 'Hybrid'], ['ELECTRIC', 'Electric'], ['OTHER', 'Other']] })}
                    {field('engineCc', 'Engine size (cc; enter 0 for electric)', { type: 'number', min: 0, max: 12000 })}
                    {field('firstRegistrationDate', 'First registration date', { type: 'date', max: today })}
                    {field('manufactureDate', 'Date of manufacture, if known', { optional: true, type: 'date', max: today })}
                    {field('retailValue', 'Vehicle purchase / retail value (£)', { type: 'number', min: 1, max: 1000000 })}
                    {field('origin', 'Vehicle origin', { options: [['UK', 'UK'], ['EU', 'European import'], ['JAPAN', 'Japanese import'], ['OTHER', 'Other import']] })}
                    {field('serviceHistory', 'Service history', { options: [['FULL', 'Full service history'], ['PART', 'Part service history'], ['LAST_SERVICE_ONLY', 'Last service only'], ['UNKNOWN', 'Unknown / unavailable']] })}
                    {field('lastServiceDate', 'Last service date', { optional: true, type: 'date', max: today })}
                    {field('lastServiceMileage', 'Mileage at last service', { optional: true, type: 'number', min: 0, max: Number(values.mileage) || 1000000 })}
                    {field('purchaseDate', 'Purchase / expected purchase date', { type: 'date' })}
                    {field('requestedStartDate', 'Requested warranty start date', { type: 'date', min: today })}
                    {field('knownFaults', 'Any known faults or warning lights?', { options: [['NONE', 'No known faults or warning lights'], ['KNOWN', 'Yes — provide details below']] })}
                </div>
                {values.knownFaults === 'KNOWN' && <label className="block text-sm font-semibold">Describe the faults<textarea required minLength={5} maxLength={2000} className={warrantyInput} value={values.faultDetails || ''} onChange={e => change('faultDetails', e.target.value)} /></label>}
                <label className="flex gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" /><span>I have checked the vehicle details, current mileage, category and service history and confirm they are accurate. Known or pre-existing faults are not a promise of cover.</span></label>
            </section>
            <section className={`${warrantyPanel} space-y-5`}>
                <h2 className="text-2xl font-bold">2. Choose your cover options</h2>
                <p>12 months · Standard car <strong>£360</strong> · Standard SUV <strong>£445</strong>, including VAT, with a £2,000 single repair limit and £75/hour labour.</p>
                <div className="grid sm:grid-cols-2 gap-5">
                    {field('repairLimit', 'Single repair limit', { options: [['1000', '£1,000 — £30 less than standard'], ['2000', '£2,000 — standard']] })}
                    {field('labourRate', 'Labour rate per hour', { options: [['75', '£75/hour — included'], ['100', '£100/hour — add 50% of standard price'], ['150', '£150/hour — add 75% of standard price'], ['200', '£200/hour — add 100% of standard price']] })}
                </div>
                <fieldset><legend className="font-semibold mb-3">Optional additions</legend><div className="grid sm:grid-cols-2 gap-3">{extrasOptions.map(([code, label, price]) => <label key={code} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] p-4"><input type="checkbox" checked={extras.includes(code)} onChange={e => setExtras(list => e.target.checked ? [...list, code] : list.filter(x => x !== code))} /><span>{label} <strong>+{money(price)}</strong></span></label>)}</div></fieldset>
                <p className="text-sm text-[var(--text-muted)]">Eligibility and the components covered depend on the vehicle and the issued Warrantywise plan. Repair limits and labour rates are maximum allowances, subject to its terms and exclusions. The requested start date is confirmed when the warranty is issued.</p>
            </section>
            <section className={`${warrantyPanel} space-y-5`}>
                <h2 className="text-2xl font-bold">3. Your contact and address details</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                    {field('title', 'Title', { options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Mx', 'Dr', 'Other'].map(x => [x, x]) })}
                    {field('firstName', 'First name', { autoComplete: 'given-name' })}{field('lastName', 'Last name', { autoComplete: 'family-name' })}
                    {field('email', 'Email address', { type: 'email', autoComplete: 'email' })}{field('phone', 'Telephone number', { type: 'tel', autoComplete: 'tel' })}
                    {field('addressLine1', 'Residential address line 1', { autoComplete: 'address-line1' })}{field('addressLine2', 'Address line 2', { optional: true, autoComplete: 'address-line2' })}
                    {field('town', 'Town / city', { autoComplete: 'address-level2' })}{field('county', 'County', { optional: true, autoComplete: 'address-level1' })}{field('postcode', 'Postcode', { autoComplete: 'postal-code' })}
                </div>
                <label className="flex gap-3 text-sm"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>I agree to the <Link href="/services/warranty/terms" target="_blank" className="underline">warranty order information</Link> and <Link href="/privacy-policy" target="_blank" className="underline">Privacy Policy</Link>. CarMazium may use and share these details with Pulse Cars Limited and Warrantywise to arrange this warranty and send order updates. Payment does not activate cover; issuance and the confirmed cover dates are separate.</span></label>
                <button type="submit" disabled={busy || lookingUp} className="w-full rounded-xl bg-primary text-white p-4 text-lg font-bold disabled:opacity-50">{busy ? 'Preparing your quote…' : 'Get a Quote'}</button>
                <p className="text-xs text-[var(--text-muted)]">No payment is taken when you request a quote. Review the full price before continuing to Stripe.</p>
            </section>
        </form>}
        {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-500">{error}</p>}
    </div>
}
