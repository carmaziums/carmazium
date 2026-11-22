"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { getMyCapabilities, SERVICE_LABELS, type ContractorCapability } from "@/lib/servicesApi"
import {
    submitProviderDeclaration,
    getCapabilityVerification,
    type CapabilityVerificationDetail,
} from "@/lib/serviceOperationsApi"

const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
const labelCls = "block text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2"

function stateClass(state: string) {
    if (state === "SATISFIED" || state === "APPROVED" || state === "VERIFIED" || state === "READY") return "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
    if (state === "REJECTED") return "text-red-500 border-red-500/30 bg-red-500/5"
    return "text-amber-500 border-amber-500/30 bg-amber-500/5"
}

export default function ProviderVerificationPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [capability, setCapability] = React.useState<ContractorCapability | null>(null)
    const [detail, setDetail] = React.useState<CapabilityVerificationDetail | null>(null)
    const [business, setBusiness] = React.useState({ businessName: "", businessAddress: "", phone: "", registeredBusiness: false })
    const [accepted, setAccepted] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!id) return
        setError(null)
        try {
            const mine = await getMyCapabilities()
            const cap = mine.capabilities.find(c => c.id === id)
            if (!cap) throw new Error("This service application was not found on your account.")
            setCapability(cap)
            if (cap.serviceType === "WARRANTY" || cap.serviceType === "FINANCE") { setDetail(null); return }
            const verification = await getCapabilityVerification(id)
            setDetail(verification)
            const declaration = verification.verification.declaration
            setBusiness({ businessName: declaration?.businessName ?? mine.profile?.businessName ?? "", businessAddress: declaration?.businessAddress ?? "", phone: declaration?.phone ?? mine.profile?.phone ?? "", registeredBusiness: declaration?.registeredBusiness ?? false })
        } catch (e: any) {
            setError(e?.message || "Could not load provider verification")
        }
    }, [id])

    React.useEffect(() => { if (user) load() }, [user, load])

    const saveDeclaration = async () => {
        setBusy(true); setError(null); setNotice(null)
        try {
            const result = await submitProviderDeclaration(id, { ...business, accepted })
            setDetail(result); setAccepted(false); setNotice("Business declaration saved. Complete payout setup and any remaining checks for approval.")
        } catch (e: any) { setError(e?.message || "Could not save your declaration.") }
        finally { setBusy(false) }
    }

    if (capability?.serviceType === "WARRANTY" || capability?.serviceType === "FINANCE") return <div className="container mx-auto px-5 pt-28 pb-16"><h1 className="text-2xl font-bold mb-3">Provider administration</h1><p>Finance and warranty partnerships and applications are managed directly by the CarMazium admin team. This dashboard does not accept finance or warranty provider applications or documents.</p></div>

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
        <div className="flex-1 max-w-3xl space-y-6">
            <div>
                <Link href="/dashboard/partner" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> My services</Link>
                <h1 className="text-3xl font-bold font-heading">Provider verification</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">{capability ? SERVICE_LABELS[capability.serviceType] : "Service application"} · business details, declaration and secure payout setup. Delivery/collection/recovery requires trade insurance only; inspection requires no uploads.</p>
            </div>

            {error && <div role="alert" className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5"/>{error}</div>}
            {notice && <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm">{notice}</div>}
            {!detail && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}

            {detail && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="font-heading font-bold text-lg">Verification status</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Approval lasts for up to 12 months, or until required evidence expires sooner.</p>
                        </div>
                        <span className={"inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider " + stateClass(detail.verification.verificationStatus)}>
                            {detail.verification.verificationStatus.replaceAll("_", " ")}
                        </span>
                    </div>
                    {detail.verification.verificationExpiresAt && <p className="text-sm mt-4">Current verification expires <strong>{new Date(detail.verification.verificationExpiresAt).toLocaleDateString("en-GB")}</strong>.</p>}
                </section>

                {detail.verification.declarationRequired && <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
                    <h2 className="text-lg font-bold">Business details and declaration</h2>
                    {detail.verification.declarationCurrent && <p className="text-sm text-emerald-500">Declaration saved on {new Date(detail.verification.declaration!.acceptedAt!).toLocaleDateString("en-GB")}.</p>}
                    {([['businessName', 'Business / trading name'], ['businessAddress', 'Registered business address'], ['phone', 'Business phone']] as const).map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<input className={inputCls} maxLength={500} value={business[key]} onChange={e => setBusiness({ ...business, [key]: e.target.value })} /></label>)}
                    <label className="flex gap-3 text-sm"><input type="checkbox" checked={business.registeredBusiness} onChange={e => setBusiness({ ...business, registeredBusiness: e.target.checked })} />My business is registered (including a registered sole trader).</label>
                    <label className="flex gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I confirm these details are accurate and I am responsible for carrying out the services I accept competently and safely.</label>
                    <Button onClick={saveDeclaration} disabled={busy || !accepted || !business.registeredBusiness}>Save declaration</Button>
                    <p className="text-sm text-[var(--text-muted)]">Your approved dealer KYC and one-time £1 account verification are reused. No additional verification payment is required for services. Provide bank details through secure payout setup; do not upload bank statements here.</p>
                    <Link href="/dashboard/dealer" className="block text-primary underline">View dealer account verification</Link>
                    <Link href="/dashboard/partner" className="block text-primary underline">Set up or check business payouts</Link>
                </section>}
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-3">
                    <h2 className="text-lg font-bold">Documents & Insurance</h2>
                    <p className="text-sm text-[var(--text-muted)]">Manage current requirements, upload trade insurance and review historical evidence directly in TradeXchange. This page remains for your business declaration only.</p>
                    {detail.verification.requirements.filter(req => !req.optional).map(req => <p key={req.type} className="text-sm">{req.title}: <strong>{req.state.replaceAll("_", " ")}</strong></p>)}
                    {capability?.serviceType === "INSPECTION" && <p className="text-sm">No inspection documents are required.</p>}
                    <Link href="/dashboard/partner#provider-documents" className="inline-block font-semibold text-primary underline">Open Documents & Insurance in TradeXchange</Link>
                </section>
            </>}
        </div>
    </div></div>
}
