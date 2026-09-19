"use client"

import * as React from "react"
import { Loader2, RefreshCw, Save, ShieldCheck, Truck, Wrench } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { apiClient } from "@/lib/apiClient"

type TeamPerson = {
    id: string
    email?: string
    user?: { email?: string; firstName?: string; lastName?: string }
}

type Permission = {
    id: string
    email: string
    deliveryEnabled: boolean
    inspectionEnabled: boolean
    canView: boolean
    canChat: boolean
    canQuote: boolean
    canManage: boolean
    canComplete: boolean
}

type Capability = {
    id: string
    serviceType: "DELIVERY" | "INSPECTION"
    status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
    reviewNote?: string | null
}

type TeamStatus = {
    companyName: string
    stripeConnect: { connected: boolean; complete: boolean }
    capabilities: Capability[]
    permissions: Permission[]
    payoutPolicy: string
}

type Draft = Omit<Permission, "id">

const blankDraft = (email: string): Draft => ({
    email: email.trim().toLowerCase(),
    deliveryEnabled: false,
    inspectionEnabled: false,
    canView: false,
    canChat: false,
    canQuote: false,
    canManage: false,
    canComplete: false,
})

function statusClass(status?: string) {
    if (status === "APPROVED") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    if (status === "PENDING") return "text-amber-400 border-amber-500/30 bg-amber-500/10"
    if (status === "SUSPENDED" || status === "REJECTED") return "text-red-400 border-red-500/30 bg-red-500/10"
    return "text-[var(--text-muted)] border-[var(--border-default)] bg-[var(--bg-input)]"
}

export function TradeExchangeTeamAccess({
    staff,
    pendingInvites,
}: {
    staff: TeamPerson[]
    pendingInvites: TeamPerson[]
}) {
    const [team, setTeam] = React.useState<TeamStatus | null>(null)
    const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState<string | null>(null)
    const [applying, setApplying] = React.useState<string | null>(null)
    const [error, setError] = React.useState("")
    const [message, setMessage] = React.useState("")

    const people = React.useMemo(() => {
        const active = staff
            .map((member) => ({
                id: member.id,
                email: member.user?.email?.trim().toLowerCase() || "",
                name: [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ") || member.user?.email || "Team member",
                pending: false,
            }))
            .filter((person) => person.email)
        const pending = pendingInvites
            .map((invite) => ({
                id: invite.id,
                email: invite.email?.trim().toLowerCase() || "",
                name: invite.email || "Pending invite",
                pending: true,
            }))
            .filter((person) => person.email)
        return [...active, ...pending]
    }, [staff, pendingInvites])

    const load = React.useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const res = await apiClient<{ data: TeamStatus }>("/services/team")
            const next = res?.data
            setTeam(next)
            const byEmail = new Map((next?.permissions ?? []).map((permission) => [permission.email.toLowerCase(), permission]))
            const nextDrafts: Record<string, Draft> = {}
            for (const person of people) {
                const current = byEmail.get(person.email)
                nextDrafts[person.email] = current
                    ? {
                        email: person.email,
                        deliveryEnabled: current.deliveryEnabled,
                        inspectionEnabled: current.inspectionEnabled,
                        canView: current.canView,
                        canChat: current.canChat,
                        canQuote: current.canQuote,
                        canManage: current.canManage,
                        canComplete: current.canComplete,
                    }
                    : blankDraft(person.email)
            }
            setDrafts(nextDrafts)
        } catch (err: any) {
            setError(err?.message || "Unable to load TradeXchange team permissions.")
        } finally {
            setLoading(false)
        }
    }, [people])

    React.useEffect(() => {
        load()
    }, [load])

    function update(email: string, field: keyof Omit<Draft, "email">, value: boolean) {
        setDrafts((current) => {
            const base = current[email] ?? blankDraft(email)
            const next = { ...base, [field]: value }
            if (!next.deliveryEnabled && !next.inspectionEnabled) {
                next.canView = false
                next.canChat = false
                next.canQuote = false
                next.canManage = false
                next.canComplete = false
            }
            if (field === "canView" && !value) {
                next.canChat = false
                next.canQuote = false
                next.canManage = false
                next.canComplete = false
            }
            if (["canChat", "canQuote", "canManage", "canComplete"].includes(field) && value) {
                next.canView = true
            }
            return { ...current, [email]: next }
        })
    }

    async function save(email: string) {
        const draft = drafts[email]
        if (!draft) return
        setSaving(email)
        setError("")
        setMessage("")
        try {
            await apiClient("/services/team/permissions", {
                method: "PUT",
                body: JSON.stringify(draft),
            })
            setMessage(`TradeXchange permissions saved for ${email}.`)
            await load()
        } catch (err: any) {
            setError(err?.message || "Unable to save TradeXchange permissions.")
        } finally {
            setSaving(null)
        }
    }

    async function apply(serviceType: "DELIVERY" | "INSPECTION") {
        setApplying(serviceType)
        setError("")
        setMessage("")
        try {
            await apiClient(`/services/team/capabilities/${serviceType}`, { method: "POST" })
            setMessage(`${serviceType === "DELIVERY" ? "Delivery & Recovery" : "Vehicle Inspection"} application submitted for admin approval.`)
            await load()
        } catch (err: any) {
            setError(err?.message || "Unable to submit the business service application.")
        } finally {
            setApplying(null)
        }
    }

    const capabilityFor = (serviceType: "DELIVERY" | "INSPECTION") =>
        team?.capabilities.find((capability) => capability.serviceType === serviceType)

    if (loading && !team) {
        return (
            <div className="dealer-glass-card bg-[var(--bg-card)] border-[var(--border-default)] p-6 flex items-center justify-center min-h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <section className="dealer-glass-card bg-[var(--bg-card)] border-[var(--border-default)] p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <h2 className="font-black text-lg tracking-tight">TradeXchange Team Access</h2>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] max-w-3xl">
                        Give selected staff precise Delivery & Recovery or Vehicle Inspection rights on behalf of {team?.companyName || "your business"}. Viewing jobs, customer chat, bidding, management and completion are controlled separately. Staff can never become the payout recipient.
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-2 self-start">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                </Button>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-bold">Payment rule</p>
                <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
                    {team?.payoutPolicy || "Customers pay CarMazium. CarMazium deducts 9%; the remaining 91% is paid only to the business Stripe Connect account."}
                </p>
                <p className="text-xs mt-2 font-bold">
                    Business Stripe Connect: {team?.stripeConnect.complete ? "Ready for payouts" : team?.stripeConnect.connected ? "Onboarding incomplete" : "Not connected"}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["DELIVERY", "INSPECTION"] as const).map((serviceType) => {
                    const capability = capabilityFor(serviceType)
                    const approved = capability?.status === "APPROVED"
                    return (
                        <div key={serviceType} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)]">
                                        {serviceType === "DELIVERY" ? <Truck size={18} /> : <Wrench size={18} />}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm">{serviceType === "DELIVERY" ? "Delivery & Recovery" : "Vehicle Inspection"}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">Business-level approval required before staff can see these jobs.</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${statusClass(capability?.status)}`}>
                                    {capability?.status || "Not applied"}
                                </span>
                            </div>
                            {!approved && capability?.status !== "PENDING" && capability?.status !== "SUSPENDED" && (
                                <Button
                                    onClick={() => apply(serviceType)}
                                    disabled={applying === serviceType}
                                    className="mt-4 h-9 text-xs"
                                >
                                    {applying === serviceType && <Loader2 size={14} className="mr-2 animate-spin" />}
                                    Apply for approval
                                </Button>
                            )}
                            {capability?.reviewNote && <p className="text-xs text-[var(--text-muted)] mt-3">Admin note: {capability.reviewNote}</p>}
                        </div>
                    )
                })}
            </div>

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}

            {!people.length ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-[var(--text-muted)]">
                    Invite a team member above first. TradeXchange permissions can then be assigned here.
                </div>
            ) : (
                <div className="space-y-4">
                    {people.map((person) => {
                        const draft = drafts[person.email] ?? blankDraft(person.email)
                        const hasService = draft.deliveryEnabled || draft.inspectionEnabled
                        return (
                            <div key={`${person.pending ? "pending" : "active"}-${person.id}`} className="rounded-2xl border border-[var(--border-default)] p-5">
                                <div className="flex flex-col xl:flex-row xl:items-center gap-5">
                                    <div className="xl:w-64 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-sm truncate">{person.name}</p>
                                            {person.pending && <span className="text-[9px] uppercase tracking-wider font-black text-amber-400">Pending</span>}
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] truncate mt-1">{person.email}</p>
                                        {person.pending && <p className="text-[10px] text-[var(--text-muted)] mt-1">Permissions activate only after this invitation is accepted.</p>}
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
                                        <PermissionToggle label="Delivery" checked={draft.deliveryEnabled} onChange={(value) => update(person.email, "deliveryEnabled", value)} />
                                        <PermissionToggle label="Inspection" checked={draft.inspectionEnabled} onChange={(value) => update(person.email, "inspectionEnabled", value)} />
                                        <PermissionToggle label="View jobs" checked={draft.canView} disabled={!hasService} onChange={(value) => update(person.email, "canView", value)} />
                                        <PermissionToggle label="Job chat" checked={draft.canChat} disabled={!hasService || !draft.canView} onChange={(value) => update(person.email, "canChat", value)} />
                                        <PermissionToggle label="Can bid" checked={draft.canQuote} disabled={!hasService || !draft.canView} onChange={(value) => update(person.email, "canQuote", value)} />
                                        <PermissionToggle label="Manage job" checked={draft.canManage} disabled={!hasService || !draft.canView} onChange={(value) => update(person.email, "canManage", value)} />
                                        <PermissionToggle label="Complete job" checked={draft.canComplete} disabled={!hasService || !draft.canView} onChange={(value) => update(person.email, "canComplete", value)} />
                                    </div>

                                    <Button onClick={() => save(person.email)} disabled={saving === person.email} className="h-10 gap-2 xl:w-28">
                                        {saving === person.email ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function PermissionToggle({
    label,
    checked,
    disabled = false,
    onChange,
}: {
    label: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}) {
    return (
        <label className={`rounded-xl border p-3 flex items-center gap-2 text-xs font-bold cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : "border-[var(--border-default)] hover:border-primary/30"}`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 accent-red-600"
            />
            <span>{label}</span>
        </label>
    )
}
