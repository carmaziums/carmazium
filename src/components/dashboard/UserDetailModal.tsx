"use client"

import * as React from "react"
import Link from "next/link"
import {
    X, Loader2, Mail, ShieldCheck, Ban, LockKeyhole,
    LockKeyholeOpen, Building2, FileText, ExternalLink, Star, Car, Receipt, CreditCard, BadgeCheck,
    AlertTriangle,
} from "lucide-react"
import { getAdminUserDetail, banUser, unbanUser, lockUser, unlockUser } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

function fmtDate(d: string | null | undefined) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(d: string | null | undefined) {
    if (!d) return "—"
    return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
    return (
        <div className="border-t border-[var(--border-default)] pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Icon size={13} /> {title}
            </h4>
            {children}
        </div>
    )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null
    return (
        <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</p>
            <p className="text-sm font-medium break-words">{value}</p>
        </div>
    )
}

const KYC_DOC_FIELDS: { key: string; label: string }[] = [
    { key: "vatProof", label: "VAT Proof" },
    { key: "companyRegistrationProof", label: "Company Registration Cert" },
    { key: "directorIdProof", label: "Director ID / Passport" },
    { key: "paymentScreenshot", label: "Payment Screenshot" },
]

export function UserDetailModal({ userId, onClose, onChanged }: { userId: string | null; onClose: () => void; onChanged?: () => void }) {
    const [detail, setDetail] = React.useState<any | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [acting, setActing] = React.useState(false)

    const load = React.useCallback(() => {
        if (!userId) return
        setLoading(true)
        setError(null)
        getAdminUserDetail(userId)
            .then(setDetail)
            .catch(err => setError(err.message || "Failed to load user details"))
            .finally(() => setLoading(false))
    }, [userId])

    React.useEffect(() => { load() }, [load])

    if (!userId) return null

    const handleAction = async (action: "ban" | "unban" | "lock" | "unlock") => {
        setActing(true)
        try {
            if (action === "ban") await banUser(userId)
            else if (action === "unban") await unbanUser(userId)
            else if (action === "lock") await lockUser(userId)
            else await unlockUser(userId)
            load()
            onChanged?.()
        } catch (err: any) {
            alert(err.message || `Failed to ${action} user`)
        } finally {
            setActing(false)
        }
    }

    const kyc = detail?.dealerProfile?.kyc
    const documentStatuses: Record<string, { status: string; note?: string }> = kyc?.documentStatuses || {}
    const name = [detail?.firstName, detail?.lastName].filter(Boolean).join(" ") || detail?.email || "User"

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-lg h-full bg-[var(--bg-card)] border-l border-[var(--border-default)] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                    <h3 className="text-lg font-black uppercase tracking-tight">User Details</h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5">
                    {loading && !detail && (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
                    )}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm mb-4">{error}</div>
                    )}

                    {detail && (
                        <>
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                    <h2 className="text-xl font-bold">{name}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{detail.role}</span>
                                        {detail.deletedAt && <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">BANNED</span>}
                                        {detail.lockoutUntil && new Date(detail.lockoutUntil) > new Date() && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">LOCKED</span>
                                        )}
                                        {detail.isEmailVerified && <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1"><BadgeCheck size={11} /> Verified</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Admin actions */}
                            <div className="flex gap-2 mb-4">
                                {detail.deletedAt ? (
                                    <button disabled={acting} onClick={() => handleAction("unban")} className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer">Unban</button>
                                ) : (
                                    <button disabled={acting} onClick={() => handleAction("ban")} className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"><Ban size={13} /> Ban</button>
                                )}
                                {detail.lockoutUntil && new Date(detail.lockoutUntil) > new Date() ? (
                                    <button disabled={acting} onClick={() => handleAction("unlock")} className="flex-1 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-widest hover:bg-blue-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"><LockKeyholeOpen size={13} /> Unlock</button>
                                ) : (
                                    <button disabled={acting} onClick={() => handleAction("lock")} className="flex-1 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-widest hover:bg-yellow-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"><LockKeyhole size={13} /> Lock</button>
                                )}
                            </div>

                            {/* Contact & Account */}
                            <Section title="Contact & Account" icon={Mail}>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Email" value={<a href={`mailto:${detail.email}`} className="hover:text-primary transition-colors">{detail.email}</a>} />
                                    <Field label="Phone" value={detail.phone ? <a href={`tel:${detail.phone}`} className="hover:text-primary transition-colors">{detail.phone}</a> : "Not on file"} />
                                    <Field label="Location" value={[detail.location, detail.postcode].filter(Boolean).join(", ") || "—"} />
                                    <Field label="Joined" value={fmtDate(detail.createdAt)} />
                                    <Field label="Last Updated" value={fmtDateTime(detail.updatedAt)} />
                                    <Field label="Login Attempts" value={detail.loginAttempts} />
                                </div>
                            </Section>

                            {/* Payout */}
                            {(detail.bankAccountNumber || detail.stripeConnectAccountId) && (
                                <Section title="Payout Info" icon={CreditCard}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Payout Method" value={detail.payoutPreference} />
                                        <Field label="Stripe Connect" value={detail.stripeConnectOnboardingComplete ? "Onboarded" : "Not complete"} />
                                        <Field label="Bank Account Name" value={detail.bankAccountName} />
                                        <Field label="Sort Code" value={detail.bankSortCode} />
                                        <Field label="Account Number" value={detail.bankAccountNumber} />
                                    </div>
                                </Section>
                            )}

                            {/* Dealer profile */}
                            {detail.dealerProfile && (
                                <Section title="Dealer Profile" icon={Building2}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Company Name" value={detail.dealerProfile.companyName} />
                                        <Field label="Verified" value={detail.dealerProfile.isVerified ? "Yes" : "No"} />
                                        <Field label="VAT Number" value={detail.dealerProfile.vatNumber} />
                                        <Field label="Registration No." value={detail.dealerProfile.registrationNumber} />
                                        <Field label="Business Address" value={detail.dealerProfile.businessAddress} />
                                        <Field label="Business Phone" value={detail.dealerProfile.phone} />
                                        <Field label="Website" value={detail.dealerProfile.website ? <a href={detail.dealerProfile.website} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Visit <ExternalLink size={11} /></a> : null} />
                                    </div>
                                </Section>
                            )}

                            {/* KYC */}
                            {kyc && (
                                <Section title="KYC Record" icon={ShieldCheck}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                            kyc.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            kyc.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        }`}>{kyc.status}</span>
                                        <span className="text-xs text-[var(--text-muted)]">Submitted {fmtDateTime(kyc.submittedAt)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <Field label="Company House Name" value={kyc.companyHouseName} />
                                        <Field label="Company Reg. No." value={kyc.companyRegistrationNumber} />
                                        <Field label="Representative" value={kyc.representativeName} />
                                        <Field label="Representative Role" value={kyc.representativePosition} />
                                        <Field label="Director" value={kyc.directorName} />
                                        <Field label="Person of Significant Control" value={kyc.personOfSignificantControl} />
                                        <Field label="Business Website" value={kyc.businessWebsite} />
                                        <Field label="Registered Address" value={kyc.businessRegisteredAddress} />
                                        <Field label="Trading Address" value={kyc.tradingAddress} />
                                        <Field label="£1 Fee Charged" value={kyc.stripeChargedAt ? fmtDateTime(kyc.stripeChargedAt) : "Not paid"} />
                                        <Field label="Reviewed" value={kyc.reviewedAt ? fmtDateTime(kyc.reviewedAt) : "Not yet reviewed"} />
                                    </div>

                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-2">Submitted Documents</p>
                                    <div className="space-y-1.5 mb-3">
                                        {KYC_DOC_FIELDS.map(({ key, label }) => {
                                            const url = kyc[key]
                                            const fieldStatus = documentStatuses[key]
                                            return (
                                                <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs">
                                                    <span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><FileText size={12} /> {label}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {fieldStatus && (
                                                            <span className={`font-bold ${fieldStatus.status === 'APPROVED' ? 'text-emerald-400' : fieldStatus.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}`}>{fieldStatus.status}</span>
                                                        )}
                                                        {url ? (
                                                            <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">View <ExternalLink size={11} /></a>
                                                        ) : (
                                                            <span className="text-[var(--text-faint)]">Not provided</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {Object.entries(documentStatuses).some(([, v]) => v.status === 'REJECTED' && v.note) && (
                                        <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-xs space-y-1">
                                            <p className="font-bold text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> Rejection notes</p>
                                            {Object.entries(documentStatuses).filter(([, v]) => v.status === 'REJECTED' && v.note).map(([field, v]) => (
                                                <p key={field} className="text-[var(--text-muted)]"><span className="font-bold">{field}:</span> {v.note}</p>
                                            ))}
                                        </div>
                                    )}
                                </Section>
                            )}

                            {/* Seller profile */}
                            {detail.sellerProfile && (
                                <Section title="Seller Profile" icon={Star}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Reliability Score" value={`${detail.sellerProfile.reliabilityScore.toFixed(1)} / 5.0`} />
                                        <Field label="Total Sales" value={detail.sellerProfile.totalSales} />
                                        <Field label="Total Listings" value={detail.sellerProfile.totalListings} />
                                        <Field label="Response Rate" value={`${detail.sellerProfile.responseRate}%`} />
                                    </div>
                                </Section>
                            )}

                            {/* Activity counts */}
                            <Section title="Activity" icon={Car}>
                                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                                    <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)]">
                                        <p className="text-lg font-bold">{detail._count?.listings ?? 0}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Listings</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)]">
                                        <p className="text-lg font-bold">{detail._count?.transactions ?? 0}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Transactions</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)]">
                                        <p className="text-lg font-bold">{detail._count?.wonAuctions ?? 0}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Auctions Won</p>
                                    </div>
                                </div>

                                {detail.recentListings?.length > 0 && (
                                    <div className="space-y-1.5 mb-3">
                                        {detail.recentListings.map((l: any) => (
                                            <Link key={l.id} href={`/buy-cars/${l.slug}`} target="_blank" className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs hover:border-primary/40 transition-colors">
                                                <span className="truncate max-w-[180px]">{l.title}</span>
                                                <span className="text-[var(--text-muted)] shrink-0">{formatPrice(l.price)} · {l.status}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {detail.recentTransactions?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold flex items-center gap-1"><Receipt size={11} /> Recent Transactions</p>
                                        {detail.recentTransactions.map((t: any) => (
                                            <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs">
                                                <span>{t.type} <span className="text-[var(--text-muted)]">· {t.status}</span></span>
                                                <span className="font-bold">{formatPrice(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Section>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
