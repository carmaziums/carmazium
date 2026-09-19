"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import {
    getMyCapabilities,
    SERVICE_LABELS,
    updateLeadMatching,
    type ContractorCapability,
} from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
const labelCls = "block text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2"

type FormState = {
    nationwide: boolean
    postcodeAreas: string
    minValue: string
    maxValue: string
    minYear: string
    maxMileage: string
    minIncome: string
    financeTermMin: string
    financeTermMax: string
    warrantyLevels: string
    warrantyMin: string
    warrantyMax: string
}

const EMPTY: FormState = {
    nationwide: false,
    postcodeAreas: "",
    minValue: "",
    maxValue: "",
    minYear: "",
    maxMileage: "",
    minIncome: "",
    financeTermMin: "",
    financeTermMax: "",
    warrantyLevels: "",
    warrantyMin: "",
    warrantyMax: "",
}

const poundsToPence = (value: string) => value.trim() ? Math.round(Number(value) * 100) : undefined
const numberOrUndefined = (value: string) => value.trim() ? Number(value) : undefined

export default function LeadMatchingSettingsPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [capability, setCapability] = React.useState<ContractorCapability | null>(null)
    const [form, setForm] = React.useState<FormState>(EMPTY)
    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [saved, setSaved] = React.useState(false)

    const load = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const mine = await getMyCapabilities()
            const cap = mine.capabilities.find((item) => item.id === id)
            if (!cap || (cap.serviceType !== "FINANCE" && cap.serviceType !== "WARRANTY")) {
                throw new Error("Finance or Warranty capability not found on your account.")
            }
            setCapability(cap)
            setForm({
                nationwide: cap.leadNationwide,
                postcodeAreas: cap.leadPostcodeAreas.join(", "),
                minValue: cap.leadMinVehicleValuePence != null ? String(cap.leadMinVehicleValuePence / 100) : "",
                maxValue: cap.leadMaxVehicleValuePence != null ? String(cap.leadMaxVehicleValuePence / 100) : "",
                minYear: cap.leadMinVehicleYear != null ? String(cap.leadMinVehicleYear) : "",
                maxMileage: cap.leadMaxVehicleMileage != null ? String(cap.leadMaxVehicleMileage) : "",
                minIncome: cap.leadMinAnnualIncomePence != null ? String(cap.leadMinAnnualIncomePence / 100) : "",
                financeTermMin: cap.leadFinanceTermMinMonths != null ? String(cap.leadFinanceTermMinMonths) : "",
                financeTermMax: cap.leadFinanceTermMaxMonths != null ? String(cap.leadFinanceTermMaxMonths) : "",
                warrantyLevels: cap.leadWarrantyLevels.join(", "),
                warrantyMin: cap.leadWarrantyMinMonths != null ? String(cap.leadWarrantyMinMonths) : "",
                warrantyMax: cap.leadWarrantyMaxMonths != null ? String(cap.leadWarrantyMaxMonths) : "",
            })
        } catch (e: any) {
            setError(e?.message || "Could not load lead matching settings.")
        } finally {
            setLoading(false)
        }
    }, [id])

    React.useEffect(() => {
        if (user && id) load()
    }, [user, id, load])

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((current) => ({ ...current, [key]: value }))

    const save = async () => {
        if (!capability) return
        const areas = form.postcodeAreas
            .split(",")
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean)
        if (!form.nationwide && areas.length === 0) {
            setError("Choose nationwide coverage or enter at least one UK postcode area.")
            return
        }

        setBusy(true)
        setSaved(false)
        setError(null)
        try {
            const updated = await updateLeadMatching(capability.id, {
                leadNationwide: form.nationwide,
                leadPostcodeAreas: areas,
                leadMinVehicleValuePence: poundsToPence(form.minValue),
                leadMaxVehicleValuePence: poundsToPence(form.maxValue),
                leadMinVehicleYear: numberOrUndefined(form.minYear),
                leadMaxVehicleMileage: numberOrUndefined(form.maxMileage),
                ...(capability.serviceType === "FINANCE" ? {
                    leadMinAnnualIncomePence: poundsToPence(form.minIncome),
                    leadFinanceTermMinMonths: numberOrUndefined(form.financeTermMin),
                    leadFinanceTermMaxMonths: numberOrUndefined(form.financeTermMax),
                } : {
                    leadWarrantyLevels: form.warrantyLevels.split(",").map((value) => value.trim()).filter(Boolean),
                    leadWarrantyMinMonths: numberOrUndefined(form.warrantyMin),
                    leadWarrantyMaxMonths: numberOrUndefined(form.warrantyMax),
                }),
            })
            setCapability(updated)
            setSaved(true)
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not save lead matching settings.")
        } finally {
            setBusy(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : user?.email || "Provider"

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role={profile?.role === "DEALER" ? "dealer" : "provider"} userName={userName} userType="Partner Account" />
                <main className="flex-1 max-w-4xl space-y-6">
                    <div>
                        <Link href="/dashboard/service/capabilities" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5">
                            <ArrowLeft size={14} /> Service add-ons
                        </Link>
                        <h1 className="text-3xl font-bold font-heading">Lead matching settings</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-2">
                            {capability ? SERVICE_LABELS[capability.serviceType] : "Finance / Warranty"} · CarMazium only shares enquiries that match these rules.
                        </p>
                    </div>

                    {error && <div role="alert" className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm">{error}</div>}
                    {saved && <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm inline-flex items-center gap-2"><CheckCircle size={16}/> Matching settings saved.</div>}
                    {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary"/></div>}

                    {!loading && capability && <>
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-5">
                            <div>
                                <h2 className="font-heading font-bold text-lg">Service area</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Use UK postcode areas such as B, CV, M, SW or choose nationwide. A full customer postcode is not exposed in the inbox summary.</p>
                            </div>
                            <label className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] p-4 cursor-pointer">
                                <input type="checkbox" checked={form.nationwide} onChange={e => set("nationwide", e.target.checked)} className="mt-1"/>
                                <span><span className="font-bold text-sm">Nationwide</span><span className="block text-xs text-[var(--text-muted)] mt-1">Consider enquiries from any UK postcode area.</span></span>
                            </label>
                            {!form.nationwide && <div>
                                <label className={labelCls}>Postcode areas</label>
                                <input className={inputCls} value={form.postcodeAreas} onChange={e => set("postcodeAreas", e.target.value)} placeholder="B, CV, WS, DY" />
                            </div>}
                        </section>

                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="font-heading font-bold text-lg mb-5">Vehicle eligibility</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <MoneyInput label="Minimum vehicle value" value={form.minValue} onChange={v => set("minValue", v)} />
                                <MoneyInput label="Maximum vehicle value" value={form.maxValue} onChange={v => set("maxValue", v)} />
                                <NumberInput label="Minimum vehicle year" value={form.minYear} onChange={v => set("minYear", v)} min={1900} max={2100} />
                                <NumberInput label="Maximum mileage" value={form.maxMileage} onChange={v => set("maxMileage", v)} min={0} />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-4">Leave a field blank when you do not need that eligibility restriction. If you set a rule and the customer did not supply that information, the enquiry will not be matched to you.</p>
                        </section>

                        {capability.serviceType === "FINANCE" ? (
                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                <h2 className="font-heading font-bold text-lg mb-5">Finance eligibility</h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <MoneyInput label="Minimum annual income" value={form.minIncome} onChange={v => set("minIncome", v)} />
                                    <div className="hidden sm:block"/>
                                    <NumberInput label="Minimum finance term" value={form.financeTermMin} onChange={v => set("financeTermMin", v)} min={1} max={120} suffix="months" />
                                    <NumberInput label="Maximum finance term" value={form.financeTermMax} onChange={v => set("financeTermMax", v)} min={1} max={120} suffix="months" />
                                </div>
                            </section>
                        ) : (
                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                <h2 className="font-heading font-bold text-lg mb-5">Warranty eligibility</h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <NumberInput label="Minimum requested term" value={form.warrantyMin} onChange={v => set("warrantyMin", v)} min={1} max={84} suffix="months" />
                                    <NumberInput label="Maximum requested term" value={form.warrantyMax} onChange={v => set("warrantyMax", v)} min={1} max={84} suffix="months" />
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Cover levels you serve</label>
                                        <input className={inputCls} value={form.warrantyLevels} onChange={e => set("warrantyLevels", e.target.value)} placeholder="Essential, Comprehensive, Premium" />
                                        <p className="text-xs text-[var(--text-muted)] mt-2">Comma-separated. Leave blank to accept any requested cover level.</p>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 text-sm">
                            CarMazium sends each enquiry to no more than five matched approved providers. New providers do not automatically receive older enquiries; an administrator must explicitly rematch an open enquiry.
                        </section>

                        <div className="flex justify-end">
                            <Button onClick={save} disabled={busy}>
                                {busy ? <Loader2 size={16} className="animate-spin"/> : "Save matching settings"}
                            </Button>
                        </div>
                    </>}
                </main>
            </div>
        </div>
    )
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <div><label className={labelCls}>{label}</label><div className="relative"><span className="absolute left-4 top-3 text-[var(--text-muted)]">£</span><input className={`${inputCls} pl-8`} type="number" min="0" step="1" value={value} onChange={e => onChange(e.target.value)}/></div></div>
}

function NumberInput({ label, value, onChange, min, max, suffix }: { label: string; value: string; onChange: (value: string) => void; min: number; max?: number; suffix?: string }) {
    return <div><label className={labelCls}>{label}</label><div className="relative"><input className={inputCls} type="number" min={min} max={max} step="1" value={value} onChange={e => onChange(e.target.value)}/>{suffix && <span className="absolute right-4 top-3 text-xs text-[var(--text-muted)]">{suffix}</span>}</div></div>
}
