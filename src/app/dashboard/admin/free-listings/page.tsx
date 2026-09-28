"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Gift,
    Infinity as InfinityIcon,
    Loader2,
    Search,
    ShieldCheck,
    TimerReset,
    UserRound,
    XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getAdminFreeListingUsers,
    grantAdminFreeListing,
    grantAdminFreePurchases,
    revokeAdminFreeListing,
    revokeAdminFreePurchases,
    type AdminFreeListingUser,
    type FreeListingDurationUnit,
    type FreeListingGrant,
    type FreePurchaseGrant,
} from "@/lib/adminApi"

type GrantKind = "LISTING" | "PURCHASE"

function userDisplayName(user: AdminFreeListingUser) {
    const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
    return full || user.email
}

function formatDate(value: string | null) {
    if (!value) return "No expiry"
    return new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function GrantBadge({
    grant,
}: {
    grant: Pick<FreeListingGrant | FreePurchaseGrant, "status" | "expiresAt"> | null
}) {
    if (!grant) {
        return <span className="rounded-full bg-[var(--bg-input)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">No grant</span>
    }

    const styles: Record<string, string> = {
        ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        USED: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
        EXPIRED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        REVOKED: "bg-red-500/15 text-red-700 dark:text-red-300",
    }
    const label = grant.status === "ACTIVE" && grant.expiresAt === null ? "FOREVER FREE" : grant.status

    return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles[grant.status] ?? styles.REVOKED}`}>
            {label}
        </span>
    )
}

export default function AdminFreeListingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [rows, setRows] = React.useState<AdminFreeListingUser[]>([])
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [appliedSearch, setAppliedSearch] = React.useState("")
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [selected, setSelected] = React.useState<{ row: AdminFreeListingUser; kind: GrantKind } | null>(null)
    const [durationUnit, setDurationUnit] = React.useState<FreeListingDurationUnit>("DAYS")
    const [durationValue, setDurationValue] = React.useState("1")
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace("/auth/login"); return }
            if (profile?.role !== "ADMIN") { router.replace("/dashboard"); return }
        }
    }, [user, profile, authLoading, router])

    const loadUsers = React.useCallback(async () => {
        if (profile?.role !== "ADMIN") return
        try {
            setLoading(true)
            setError(null)
            const response = await getAdminFreeListingUsers(page, 20, appliedSearch || undefined)
            setRows(response.data ?? [])
            setTotalPages(Math.max(1, response.pagination?.totalPages ?? 1))
        } catch (err: any) {
            setError(err?.message || "Failed to load registered users.")
        } finally {
            setLoading(false)
        }
    }, [page, appliedSearch, profile?.role])

    React.useEffect(() => {
        loadUsers()
    }, [loadUsers])

    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault()
        setPage(1)
        setAppliedSearch(search.trim())
    }

    const openGrant = (row: AdminFreeListingUser, kind: GrantKind) => {
        setSelected({ row, kind })
        setDurationUnit("DAYS")
        setDurationValue("1")
        setError(null)
        setSuccess(null)
    }

    const handleGrant = async () => {
        if (!selected) return
        const numericValue = durationUnit === "FOREVER" ? undefined : Number(durationValue)
        if (durationUnit !== "FOREVER" && (!Number.isInteger(numericValue) || (numericValue ?? 0) < 1)) {
            setError("Enter a whole number greater than zero.")
            return
        }

        const { row, kind } = selected
        try {
            setSaving(true)
            setError(null)

            if (kind === "LISTING") {
                const grant = await grantAdminFreeListing(row.id, durationUnit, numericValue)
                setRows(current => current.map(item =>
                    item.id === row.id ? { ...item, freeListingGrant: grant } : item
                ))
                setSuccess(
                    durationUnit === "FOREVER"
                        ? `Forever-free BASIC retail listings granted to ${userDisplayName(row)}.`
                        : `One free BASIC retail listing granted to ${userDisplayName(row)}.`
                )
            } else {
                const grant = await grantAdminFreePurchases(row.id, durationUnit, numericValue)
                setRows(current => current.map(item =>
                    item.id === row.id ? { ...item, freePurchaseGrant: grant } : item
                ))
                setSuccess(
                    durationUnit === "FOREVER"
                        ? `Fee-free auction purchases granted to ${userDisplayName(row)} until revoked.`
                        : `Fee-free auction purchases granted to ${userDisplayName(row)} for the selected period.`
                )
            }

            setSelected(null)
        } catch (err: any) {
            setError(err?.message || (kind === "LISTING"
                ? "Unable to grant the free listing."
                : "Unable to grant fee-free purchases."))
        } finally {
            setSaving(false)
        }
    }

    const handleRevoke = async (row: AdminFreeListingUser, kind: GrantKind) => {
        const grant = kind === "LISTING" ? row.freeListingGrant : row.freePurchaseGrant
        const forever = grant?.status === "ACTIVE" && grant.expiresAt === null
        const message = kind === "LISTING"
            ? (forever
                ? `Revoke forever-free BASIC retail listings for ${userDisplayName(row)}?`
                : `Revoke the unused free listing for ${userDisplayName(row)}?`)
            : `Revoke fee-free auction purchases for ${userDisplayName(row)}? New auction wins after revocation will require the normal £125 buyer fee.`

        if (!window.confirm(message)) return

        try {
            setSaving(true)
            setError(null)
            if (kind === "LISTING") {
                const updated = await revokeAdminFreeListing(row.id)
                setRows(current => current.map(item =>
                    item.id === row.id ? { ...item, freeListingGrant: updated } : item
                ))
                setSuccess(`Free listing entitlement revoked for ${userDisplayName(row)}.`)
            } else {
                const updated = await revokeAdminFreePurchases(row.id)
                setRows(current => current.map(item =>
                    item.id === row.id ? { ...item, freePurchaseGrant: updated } : item
                ))
                setSuccess(`Free purchase entitlement revoked for ${userDisplayName(row)}.`)
            }
        } catch (err: any) {
            setError(err?.message || "Unable to revoke the grant.")
        } finally {
            setSaving(false)
        }
    }

    if (authLoading || (user && !profile)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== "ADMIN") return null

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user.email?.split("@")[0] || "Admin")

    const selectedRow = selected?.row ?? null
    const isPurchaseGrant = selected?.kind === "PURCHASE"

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 min-w-0 space-y-6">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <button
                            type="button"
                            onClick={() => router.push("/dashboard/admin")}
                            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-primary"
                        >
                            <ArrowLeft size={16} /> Back to Admin Dashboard
                        </button>

                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-600 dark:text-emerald-300">
                                        <Gift size={24} />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl md:text-3xl font-black font-heading uppercase text-[var(--text-primary)]">
                                            Free Listing & Purchase Grants
                                        </h1>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            Give registered users complimentary BASIC listings or waive the £125 auction buyer fee for a chosen period.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 max-w-xl">
                                <div className="flex gap-2">
                                    <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                                    <div className="space-y-1.5">
                                        <p><strong>Listing grants:</strong> timed grants cover one BASIC retail listing; forever grants cover unlimited BASIC listings until revoked.</p>
                                        <p><strong>Purchase grants:</strong> every auction won while the grant is active gets a £0 buyer fee. The entitlement is not consumed per purchase.</p>
                                        <p><strong>Important:</strong> an eligible £100 seller handover bonus is still paid by CarMazium even when the buyer fee is waived.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-700 dark:text-red-200">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                            <CheckCircle2 size={18} /> {success}
                        </div>
                    )}

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                        <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <Input
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    placeholder="Search registered user by name or email"
                                    className="pl-10"
                                />
                            </div>
                            <Button type="submit" className="sm:w-auto">Search Users</Button>
                            {appliedSearch && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1) }}
                                >
                                    Clear
                                </Button>
                            )}
                        </form>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                        <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-[var(--text-primary)]">Registered Users</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Listing and purchase entitlements are managed independently and can each have their own duration.
                                </p>
                            </div>
                            {loading && <Loader2 className="animate-spin text-primary" size={20} />}
                        </div>

                        {!loading && rows.length === 0 ? (
                            <div className="p-10 text-center text-[var(--text-muted)]">No registered users found.</div>
                        ) : (
                            <div className="divide-y divide-[var(--border-default)]">
                                {rows.map(row => {
                                    const listingGrant = row.freeListingGrant
                                    const purchaseGrant = row.freePurchaseGrant

                                    return (
                                        <div key={row.id} className="p-5">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                                    <UserRound size={19} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-bold text-[var(--text-primary)] truncate">{userDisplayName(row)}</p>
                                                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">{row.role}</span>
                                                        {row.deletedAt && <span className="text-[10px] font-bold text-red-500">BANNED</span>}
                                                    </div>
                                                    <p className="text-sm text-[var(--text-muted)] truncate">{row.email}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                                            <Gift size={14} /> Free listing
                                                        </span>
                                                        <GrantBadge grant={listingGrant} />
                                                    </div>

                                                    {listingGrant ? (
                                                        <div className="text-xs text-[var(--text-muted)] space-y-1 min-h-10">
                                                            {listingGrant.status === "ACTIVE" && listingGrant.expiresAt === null && (
                                                                <p className="flex items-center gap-1.5"><InfinityIcon size={13} /> Unlimited BASIC retail listings — no expiry</p>
                                                            )}
                                                            {listingGrant.status === "ACTIVE" && listingGrant.expiresAt !== null && (
                                                                <p className="flex items-center gap-1.5"><CalendarClock size={13} /> One free listing expires: {formatDate(listingGrant.expiresAt)}</p>
                                                            )}
                                                            {listingGrant.status === "USED" && (
                                                                <p className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Used: {formatDate(listingGrant.usedAt)}</p>
                                                            )}
                                                            {listingGrant.status === "EXPIRED" && <p>Expired: {formatDate(listingGrant.expiresAt)}</p>}
                                                            {listingGrant.status === "REVOKED" && <p>Revoked: {formatDate(listingGrant.revokedAt)}</p>}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--text-muted)] min-h-10">No complimentary retail listing assigned.</p>
                                                    )}

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() => openGrant(row, "LISTING")}
                                                            disabled={Boolean(row.deletedAt) || saving}
                                                            className="flex-1"
                                                        >
                                                            <Gift size={15} className="mr-2" />
                                                            {listingGrant?.status === "ACTIVE" ? "Replace Listing Grant" : "Grant Free Listing"}
                                                        </Button>
                                                        {listingGrant?.status === "ACTIVE" && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleRevoke(row, "LISTING")}
                                                                disabled={saving}
                                                                className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                                                            >
                                                                <XCircle size={15} className="mr-2" /> Revoke
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                                            <CreditCard size={14} /> Free purchases
                                                        </span>
                                                        <GrantBadge grant={purchaseGrant} />
                                                    </div>

                                                    {purchaseGrant ? (
                                                        <div className="text-xs text-[var(--text-muted)] space-y-1 min-h-10">
                                                            {purchaseGrant.status === "ACTIVE" && purchaseGrant.expiresAt === null && (
                                                                <p className="flex items-center gap-1.5"><InfinityIcon size={13} /> £125 buyer fee waived on every auction win — no expiry</p>
                                                            )}
                                                            {purchaseGrant.status === "ACTIVE" && purchaseGrant.expiresAt !== null && (
                                                                <p className="flex items-center gap-1.5"><CalendarClock size={13} /> Fee-free auction wins until: {formatDate(purchaseGrant.expiresAt)}</p>
                                                            )}
                                                            {purchaseGrant.status === "EXPIRED" && <p>Expired: {formatDate(purchaseGrant.expiresAt)}</p>}
                                                            {purchaseGrant.status === "REVOKED" && <p>Revoked: {formatDate(purchaseGrant.revokedAt)}</p>}
                                                            {purchaseGrant.useCount > 0 && (
                                                                <p className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Covered {purchaseGrant.useCount} purchase{purchaseGrant.useCount === 1 ? "" : "s"}{purchaseGrant.lastUsedAt ? ` · last ${formatDate(purchaseGrant.lastUsedAt)}` : ""}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--text-muted)] min-h-10">Normal £125 auction buyer fee applies.</p>
                                                    )}

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() => openGrant(row, "PURCHASE")}
                                                            disabled={Boolean(row.deletedAt) || saving}
                                                            className="flex-1"
                                                        >
                                                            <CreditCard size={15} className="mr-2" />
                                                            {purchaseGrant?.status === "ACTIVE" ? "Replace Purchase Grant" : "Grant Free Purchases"}
                                                        </Button>
                                                        {purchaseGrant?.status === "ACTIVE" && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => handleRevoke(row, "PURCHASE")}
                                                                disabled={saving}
                                                                className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                                                            >
                                                                <XCircle size={15} className="mr-2" /> Revoke
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="p-4 border-t border-[var(--border-default)] flex items-center justify-between">
                            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</Button>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Page {page} of {totalPages}</span>
                            <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Next</Button>
                        </div>
                    </div>
                </main>
            </div>

            {selected && selectedRow && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => !saving && setSelected(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl p-6" onMouseDown={event => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <div className="flex items-center gap-2 text-primary mb-1">
                                    {isPurchaseGrant ? <CreditCard size={19} /> : <Gift size={19} />}
                                    <span className="text-xs font-black uppercase tracking-widest">
                                        {isPurchaseGrant
                                            ? (durationUnit === "FOREVER" ? "Forever Fee-Free Purchases" : "Fee-Free Auction Purchases")
                                            : (durationUnit === "FOREVER" ? "Forever Free BASIC Listings" : "One Free Listing")}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">{userDisplayName(selectedRow)}</h2>
                                <p className="text-sm text-[var(--text-muted)]">{selectedRow.email}</p>
                            </div>
                            <button type="button" onClick={() => !saving && setSelected(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><XCircle size={21} /></button>
                        </div>

                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 mb-5 text-sm text-[var(--text-muted)]">
                            {isPurchaseGrant ? (
                                <>
                                    Every auction this account <strong className="text-[var(--text-primary)]">wins while the grant is active will have the £125 CarMazium buyer fee waived</strong>. The grant is reusable and is not consumed after one purchase. Seller contact and auction chat unlock automatically. Any eligible £100 seller handover bonus remains funded by CarMazium.
                                </>
                            ) : durationUnit === "FOREVER" ? (
                                <>
                                    The user can submit <strong className="text-[var(--text-primary)]">unlimited BASIC retail vehicle listings without paying the £1 listing fee</strong>. This entitlement does not get consumed and remains active until an admin revokes it. STANDARD and PREMIUM upgrades keep their normal fee.
                                </>
                            ) : (
                                <>
                                    The user can submit <strong className="text-[var(--text-primary)]">one BASIC retail vehicle listing without paying the £1 listing fee</strong>. The entitlement is consumed when that listing is submitted for admin review.
                                </>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Valid for</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {([
                                        ["HOURS", "Hours", TimerReset],
                                        ["DAYS", "Days", CalendarClock],
                                        ["MONTHS", "Months", CalendarClock],
                                        ["FOREVER", "Forever", InfinityIcon],
                                    ] as const).map(([value, label, Icon]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setDurationUnit(value)}
                                            className={`rounded-xl border px-3 py-3 text-sm font-bold flex flex-col items-center gap-1.5 transition-colors ${durationUnit === value ? "border-primary bg-primary/10 text-primary" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                        >
                                            <Icon size={17} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {durationUnit !== "FOREVER" && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Number of {durationUnit.toLowerCase()}</label>
                                    <Input type="number" min={1} step={1} value={durationValue} onChange={event => setDurationValue(event.target.value)} />
                                </div>
                            )}

                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)} className="sm:flex-1">Cancel</Button>
                                <Button type="button" disabled={saving} onClick={handleGrant} className="sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {saving
                                        ? <Loader2 size={16} className="mr-2 animate-spin" />
                                        : isPurchaseGrant
                                            ? <CreditCard size={16} className="mr-2" />
                                            : <Gift size={16} className="mr-2" />}
                                    {isPurchaseGrant
                                        ? (durationUnit === "FOREVER" ? "Grant Until Revoked" : "Grant Free Purchases")
                                        : (durationUnit === "FOREVER" ? "Grant Forever Free" : "Grant 1 Free Listing")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
