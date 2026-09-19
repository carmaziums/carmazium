"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Mail, Phone, Send } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import {
    formatPence,
    getProviderServiceLead,
    respondToServiceLead,
    SERVICE_LABELS,
    type ServiceLead,
} from "@/lib/servicesApi"

const inputCls = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-primary"
const labelCls = "block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5"

export default function ProviderLeadDetailPage() {
    const params = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [lead, setLead] = React.useState<ServiceLead | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState<string | null>(null)
    const [reply, setReply] = React.useState({
        headline: "",
        message: "",
        productName: "",
        price: "",
        apr: "",
        term: "",
    })

    const load = React.useCallback(() => {
        setLoading(true)
        setError(null)
        getProviderServiceLead(params.id)
            .then(value => {
                setLead(value)
                setReply({
                    headline: value.headline || "",
                    message: value.message || "",
                    productName: value.productName || "",
                    price: value.indicativePricePence != null ? String(value.indicativePricePence / 100) : "",
                    apr: value.representativeApr != null ? String(value.representativeApr) : "",
                    term: value.responseTermMonths != null ? String(value.responseTermMonths) : "",
                })
            })
            .catch(e => setError(e?.message || "Could not load this matched enquiry"))
            .finally(() => setLoading(false))
    }, [params.id])

    React.useEffect(() => {
        if (user) load()
    }, [user, load])

    const send = async () => {
        if (!lead) return
        const headline = reply.headline.trim()
        const message = reply.message.trim()
        const productName = reply.productName.trim() || undefined

        if (!headline || !message) {
            setError("Add a headline and message before responding.")
            return
        }

        let indicativePricePence: number | undefined
        if (reply.price.trim()) {
            const price = Number(reply.price)
            if (!Number.isFinite(price) || price < 0) {
                setError("Enter a valid non-negative indicative price.")
                return
            }
            indicativePricePence = Math.round(price * 100)
        }

        setBusy(true)
        setError(null)
        setSuccess(null)
        try {
            if (lead.serviceType === "FINANCE") {
                let representativeApr: number | undefined
                let termMonths: number | undefined

                if (reply.apr.trim()) {
                    representativeApr = Number(reply.apr)
                    if (!Number.isFinite(representativeApr) || representativeApr < 0 || representativeApr > 100) {
                        throw new Error("Representative APR must be between 0 and 100.")
                    }
                }

                if (reply.term.trim()) {
                    termMonths = Number(reply.term)
                    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) {
                        throw new Error("Finance term must be a whole number between 1 and 120 months.")
                    }
                }

                await respondToServiceLead(lead.id, {
                    headline,
                    message,
                    productName,
                    indicativePricePence,
                    representativeApr,
                    termMonths,
                })
            } else {
                await respondToServiceLead(lead.id, {
                    headline,
                    message,
                    productName,
                    indicativePricePence,
                })
            }

            setSuccess(lead.recipientStatus === "RESPONDED" ? "Response updated." : "Response sent.")
            load()
        } catch (e: any) {
            setError(e?.message || "Could not send response")
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
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 max-w-5xl">
                    <Link
                        href="/dashboard/service/leads"
                        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"
                    >
                        <ArrowLeft size={15} /> Provider inbox
                    </Link>

                    {loading && (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && error && !lead && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {lead && (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                                <div>
                                    <p className="text-primary text-xs font-black uppercase tracking-widest mb-2">
                                        {SERVICE_LABELS[lead.serviceType]}
                                    </p>
                                    <h1 className="text-3xl font-black font-heading">
                                        {[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}
                                    </h1>
                                    <p className="text-sm text-[var(--text-muted)] mt-2">
                                        Received {new Date(lead.createdAt).toLocaleString("en-GB")} · expires {new Date(lead.expiresAt).toLocaleString("en-GB")}
                                    </p>
                                </div>
                                <span className="inline-block self-start text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] px-2.5 py-1 rounded-full">
                                    {lead.recipientStatus || "VIEWED"}
                                </span>
                            </div>

                            {error && (
                                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
                                    {success}
                                </div>
                            )}

                            <div className="grid xl:grid-cols-2 gap-6 mb-6">
                                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                    <h2 className="font-heading font-bold text-lg mb-5">Customer contact</h2>
                                    <div className="space-y-3 text-sm">
                                        <Info label="Name" value={lead.fullName} />
                                        <Info
                                            label="Email"
                                            value={
                                                <a className="text-primary hover:underline inline-flex items-center gap-1.5" href={`mailto:${lead.email}`}>
                                                    <Mail size={13} /> {lead.email}
                                                </a>
                                            }
                                        />
                                        <Info
                                            label="Phone"
                                            value={lead.phone ? (
                                                <a className="text-primary hover:underline inline-flex items-center gap-1.5" href={`tel:${lead.phone}`}>
                                                    <Phone size={13} /> {lead.phone}
                                                </a>
                                            ) : "Not supplied"}
                                        />
                                        <Info label="Postcode" value={lead.postcode || "Not supplied"} />
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
                                        These contact details are shown because the customer consented to sharing this enquiry with matched approved providers.
                                    </p>
                                </section>

                                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                    <h2 className="font-heading font-bold text-lg mb-5">Vehicle</h2>
                                    <div className="space-y-3 text-sm">
                                        <Info label="Registration" value={lead.vehicleRegistration || "Not supplied"} />
                                        <Info label="Make" value={lead.vehicleMake || "Not supplied"} />
                                        <Info label="Model" value={lead.vehicleModel || "Not supplied"} />
                                        <Info label="Year" value={lead.vehicleYear != null ? String(lead.vehicleYear) : "Not supplied"} />
                                        <Info label="Mileage" value={lead.vehicleMileage != null ? `${lead.vehicleMileage.toLocaleString()} miles` : "Not supplied"} />
                                        <Info label="Approx. value" value={lead.vehicleValuePence != null ? formatPence(lead.vehicleValuePence) : "Not supplied"} />
                                    </div>
                                </section>
                            </div>

                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 mb-6">
                                <h2 className="font-heading font-bold text-lg mb-5">
                                    {lead.serviceType === "FINANCE" ? "Finance requirements" : "Warranty requirements"}
                                </h2>
                                {lead.serviceType === "FINANCE" ? (
                                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                        <Info label="Deposit" value={lead.depositPence != null ? formatPence(lead.depositPence) : "Not supplied"} />
                                        <Info label="Preferred term" value={lead.termMonths != null ? `${lead.termMonths} months` : "Not supplied"} />
                                        <Info label="Monthly budget" value={lead.monthlyBudgetPence != null ? formatPence(lead.monthlyBudgetPence) : "Not supplied"} />
                                        <Info label="Employment status" value={lead.employmentStatus || "Not supplied"} />
                                        <Info label="Annual income" value={lead.annualIncomePence != null ? formatPence(lead.annualIncomePence) : "Not supplied"} />
                                    </div>
                                ) : (
                                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                        <Info label="Requested duration" value={lead.warrantyMonths != null ? `${lead.warrantyMonths} months` : "Not supplied"} />
                                        <Info label="Cover level" value={lead.warrantyLevel || "Not supplied"} />
                                    </div>
                                )}
                                <div className="mt-5 pt-5 border-t border-[var(--border-default)]">
                                    <p className={labelCls}>Customer notes</p>
                                    <p className="text-sm whitespace-pre-wrap text-[var(--text-muted)]">
                                        {lead.summary || "No additional notes supplied."}
                                    </p>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div>
                                        <h2 className="font-heading font-bold text-lg">
                                            {lead.recipientStatus === "RESPONDED" ? "Update your response" : "Respond to customer"}
                                        </h2>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">
                                            Your response is shown to the customer inside their CarMazium enquiry.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Headline</label>
                                            <input
                                                className={inputCls}
                                                value={reply.headline}
                                                onChange={e => setReply(r => ({ ...r, headline: e.target.value }))}
                                                maxLength={120}
                                                placeholder="Clear summary of your option"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Product / plan name</label>
                                            <input
                                                className={inputCls}
                                                value={reply.productName}
                                                onChange={e => setReply(r => ({ ...r, productName: e.target.value }))}
                                                maxLength={120}
                                                placeholder={lead.serviceType === "FINANCE" ? "e.g. Hire Purchase" : "e.g. Comprehensive 24"}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelCls}>Message</label>
                                        <textarea
                                            className={`${inputCls} min-h-32`}
                                            value={reply.message}
                                            onChange={e => setReply(r => ({ ...r, message: e.target.value }))}
                                            maxLength={2000}
                                            placeholder="Explain the option, eligibility, important limitations and next steps."
                                        />
                                    </div>

                                    <div className={`grid gap-4 ${lead.serviceType === "FINANCE" ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
                                        <div>
                                            <label className={labelCls}>
                                                {lead.serviceType === "FINANCE" ? "Indicative monthly payment / cost" : "Indicative warranty price"}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">£</span>
                                                <input
                                                    className={`${inputCls} pl-7`}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={reply.price}
                                                    onChange={e => setReply(r => ({ ...r, price: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        {lead.serviceType === "FINANCE" && (
                                            <>
                                                <div>
                                                    <label className={labelCls}>Representative APR %</label>
                                                    <input
                                                        className={inputCls}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.001"
                                                        value={reply.apr}
                                                        onChange={e => setReply(r => ({ ...r, apr: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Finance term months</label>
                                                    <input
                                                        className={inputCls}
                                                        type="number"
                                                        min="1"
                                                        max="120"
                                                        step="1"
                                                        value={reply.term}
                                                        onChange={e => setReply(r => ({ ...r, term: e.target.value }))}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <Button onClick={send} disabled={busy}>
                                            {busy ? (
                                                <Loader2 className="animate-spin" size={15} />
                                            ) : (
                                                <>
                                                    <Send size={15} className="mr-2" />
                                                    {lead.recipientStatus === "RESPONDED" ? "Update response" : "Send response"}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4 border-b border-[var(--border-default)] pb-2">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-semibold text-right break-words">{value}</span>
        </div>
    )
}
