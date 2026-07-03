"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Loader2, Trophy, XCircle, Clock, Tag, Mail, CheckCircle, MapPin,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { recordSale } from "@/lib/listingApi"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"

// ─── UK postcode validation (loose — accepts formatted or unformatted) ────────
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

export default function DealerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})
    const [counteringOfferId, setCounteringOfferId] = React.useState<string | null>(null)
    const [counterAmount, setCounterAmount] = React.useState<number | undefined>(undefined)
    const [toast, setToast] = React.useState<string | null>(null)

    // Postcode capture state — set to offer ID when dealer clicks "Mark as Sold"
    const [postcodeCapture, setPostcodeCapture] = React.useState<{ offerId: string; postcode: string } | null>(null)
    const [confirmingSale, setConfirmingSale] = React.useState(false)

    React.useEffect(() => {
        if (!authLoading && user) fetchOffers()
    }, [user, authLoading])

    async function fetchOffers() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/offers/received')
            setOffers(res?.data ?? [])
        } catch {
            setOffers([])
        } finally {
            setLoading(false)
        }
    }

    async function confirmMarkSold() {
        if (!postcodeCapture) return
        const offer = offers.find(o => o.id === postcodeCapture.offerId)
        if (!offer) return

        const postcode = postcodeCapture.postcode.trim()
        if (postcode && !UK_POSTCODE_RE.test(postcode)) {
            setToast("Please enter a valid UK postcode, or leave it blank")
            return
        }

        setConfirmingSale(true)
        try {
            const soldPrice = Number(offer.finalAmount ?? offer.counterAmount ?? offer.amount)
            await recordSale(offer.listingId, {
                soldPrice,
                buyerId: offer.buyerId,
                buyerPostcode: postcode || undefined,
            })
            setToast("Sale recorded — listing marked as sold")
            setOffers(prev => prev.filter(o => o.id !== offer.id))
            setPostcodeCapture(null)
        } catch (err: any) {
            setToast(err.message || "Failed to record sale")
        } finally {
            setConfirmingSale(false)
        }
    }

    async function handleRespond(offerId: string, status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', counterAmount?: number) {
        const previousOffers = [...offers]
        setOffers(current => current.map(offer =>
            offer.id === offerId ? { ...offer, status } : offer
        ))
        setActionLoading(prev => ({ ...prev, [offerId]: true }))
        try {
            await apiClient(`/offers/${offerId}/respond`, {
                method: 'PATCH',
                body: JSON.stringify({ status, counterAmount }),
            })
            fetchOffers()
        } catch (err) {
            console.error('Failed to respond to offer:', err)
            setOffers(previousOffers)
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const pendingCount = offers.filter(o => o.status === "PENDING").length
    const acceptedCount = offers.filter(o => o.status === "ACCEPTED").length
    const totalOffers = offers.length

    React.useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3500)
        return () => clearTimeout(t)
    }, [toast])

    return (
        <div className="min-h-screen pt-20 pb-12">
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl font-bold text-sm animate-in fade-in slide-in-from-bottom-2">
                    {toast}
                </div>
            )}
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title="Direct Offers"
                        subHeader="Manage offers received from buyers on your listings"
                    />

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard label="Pending Offers" value={pendingCount} icon={Clock} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" statusLabel="Action Required" loading={loading} />
                        <MetricCard label="Accepted" value={acceptedCount} icon={Trophy} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" statusLabel="Closed" loading={loading} />
                        <MetricCard label="Total Received" value={totalOffers} icon={Tag} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" loading={loading} />
                    </div>

                    {/* Offers Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : offers.length === 0 ? (
                        <div className="dealer-glass-card p-16 text-center">
                            <Mail className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                            <p className="text-[var(--text-muted)] font-bold">No offers received yet</p>
                            <p className="text-gray-600 text-sm mt-1">Offers from buyers on your listings will appear here</p>
                        </div>
                    ) : (
                        <div className="dealer-glass-card overflow-hidden">
                            <div className="p-6 border-b border-[var(--border-default)] bg-black/20">
                                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Offers Registry</h3>
                            </div>
                            {/* ── Mobile cards (< sm) ── */}
                            <div className="sm:hidden divide-y divide-white/[0.03]">
                                {offers.map((offer: any) => {
                                    const isPending = offer.status === 'PENDING'
                                    const isCapturingPostcode = postcodeCapture?.offerId === offer.id
                                    const isCountering = counteringOfferId === offer.id
                                    return (
                                        <div key={offer.id} className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-black text-sm">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{offer.buyer?.email}</p>
                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{offer.listing?.title}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-lg font-black tabular-nums">
                                                        £{Number(offer.status === 'ACCEPTED' ? (offer.finalAmount ?? offer.counterAmount ?? offer.amount) : offer.amount).toLocaleString()}
                                                    </p>
                                                    {offer.status === 'ACCEPTED' && <p className="text-xs text-emerald-400 font-black">Agreed price</p>}
                                                    {offer.status === 'COUNTERED' && offer.counterAmount && <p className="text-xs text-blue-400 font-black">Ctr: £{offer.counterAmount.toLocaleString()}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black tracking-widest uppercase border ${
                                                    offer.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                    offer.status === "ACCEPTED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                    offer.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                    offer.status === "COUNTERED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                    "bg-slate-500/10 text-[var(--text-muted)] border-[var(--border-default)]"
                                                }`}>{offer.status}</span>
                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                    {isPending && !isCountering && (
                                                        <>
                                                            <button onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(offer.amount) }} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">Counter</button>
                                                            <button onClick={() => handleRespond(offer.id, 'ACCEPTED')} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">Accept</button>
                                                            <button onClick={() => handleRespond(offer.id, 'REJECTED')} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">Reject</button>
                                                        </>
                                                    )}
                                                    {offer.status === 'ACCEPTED' && !isCapturingPostcode && (
                                                        <button onClick={() => setPostcodeCapture({ offerId: offer.id, postcode: '' })} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-600 text-white rounded-xl">Mark Sold</button>
                                                    )}
                                                    {offer.status === 'ACCEPTED' && isCapturingPostcode && (
                                                        <div className="flex items-center gap-2 w-full mt-1">
                                                            <input type="text" placeholder="Postcode (opt.)" maxLength={8} value={postcodeCapture?.postcode ?? ''} onChange={e => setPostcodeCapture(p => p ? { ...p, postcode: e.target.value.toUpperCase() } : null)} className="flex-1 bg-black/40 border border-[var(--border-default)] text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500 uppercase" />
                                                            <button onClick={confirmMarkSold} disabled={confirmingSale} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">Confirm</button>
                                                            <button onClick={() => setPostcodeCapture(null)} className="px-2 py-1.5 text-[var(--text-muted)]"><XCircle size={16} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ── Desktop table (≥ sm) ── */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="vip-table-header text-xs uppercase font-black tracking-widest text-[var(--text-muted)] border-b border-[var(--border-default)]">
                                        <tr>
                                            <th className="px-6 py-5">Buyer Identification</th>
                                            <th className="px-6 py-5">Linked Vehicle</th>
                                            <th className="px-6 py-5 text-right">Offer Amount</th>
                                            <th className="px-6 py-5 text-center">Current Status</th>
                                            <th className="px-6 py-5 text-right">Executive Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {offers.map((offer: any) => {
                                            const isActioning = !!actionLoading[offer.id]
                                            const isPending = offer.status === 'PENDING'
                                            const isCountering = counteringOfferId === offer.id
                                            const isCapturingPostcode = postcodeCapture?.offerId === offer.id

                                            return (
                                                <tr key={offer.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-6">
                                                        <p className="font-black text-sm tracking-tight">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                        <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">{offer.buyer?.email}</p>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black group-hover:text-primary transition-colors">{offer.listing?.title}</span>
                                                            <span className="text-xs text-gray-600 font-black uppercase tracking-widest mt-0.5">VRM: {offer.listing?.vrm || 'Private'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <span className="text-xl font-black tabular-nums">
                                                            £{Number(offer.status === 'ACCEPTED' ? (offer.finalAmount ?? offer.counterAmount ?? offer.amount) : offer.amount).toLocaleString()}
                                                        </span>
                                                        {offer.status === 'ACCEPTED' && (
                                                            <div className="text-xs text-emerald-400 font-black uppercase tracking-widest mt-1">
                                                                Agreed Price
                                                            </div>
                                                        )}
                                                        {offer.status === 'COUNTERED' && offer.counterAmount && (
                                                            <div className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">
                                                                My Counter: £{offer.counterAmount.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-6 text-center">
                                                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase border ${
                                                            offer.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                            offer.status === "ACCEPTED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            offer.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                            offer.status === "COUNTERED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            "bg-slate-500/10 text-[var(--text-muted)] border-[var(--border-default)]"
                                                        }`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                                            {/* ── Pending: Accept / Counter / Reject ── */}
                                                            {isPending && !isCountering && (
                                                                <>
                                                                    <Button variant="ghost" size="sm" disabled={isActioning}
                                                                        onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(offer.amount) }}
                                                                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-blue-500/20 rounded-xl transition-all">
                                                                        COUNTER
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" disabled={isActioning}
                                                                        onClick={() => handleRespond(offer.id, 'ACCEPTED')}
                                                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-emerald-500/20 rounded-xl transition-all">
                                                                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'ACCEPT'}
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" disabled={isActioning}
                                                                        onClick={() => handleRespond(offer.id, 'REJECTED')}
                                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-red-500/20 rounded-xl transition-all">
                                                                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'REJECT'}
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {/* ── Pending: Counter input ── */}
                                                            {isPending && isCountering && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs font-black">£</span>
                                                                        <input type="number"
                                                                            className="bg-black/40 border border-[var(--border-default)] text-white rounded-lg pl-6 pr-2 py-1.5 w-24 text-xs font-black focus:outline-none focus:border-blue-500 transition-colors"
                                                                            value={counterAmount || ''}
                                                                            onChange={e => setCounterAmount(Number(e.target.value))}
                                                                            autoFocus />
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" disabled={isActioning || !counterAmount}
                                                                        onClick={() => { handleRespond(offer.id, 'COUNTERED', counterAmount); setCounteringOfferId(null); setCounterAmount(undefined) }}
                                                                        className="bg-blue-600 text-white font-black text-xs uppercase tracking-widest h-9 px-3 rounded-xl hover:bg-blue-500 transition-all">
                                                                        Send
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" disabled={isActioning}
                                                                        onClick={() => { setCounteringOfferId(null); setCounterAmount(undefined) }}
                                                                        className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white">
                                                                        <XCircle size={16} />
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {/* ── Accepted: postcode capture then confirm ── */}
                                                            {!isPending && offer.status === 'ACCEPTED' && !isCapturingPostcode && (
                                                                <Button variant="ghost" size="sm"
                                                                    onClick={() => setPostcodeCapture({ offerId: offer.id, postcode: '' })}
                                                                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-emerald-500/20 rounded-xl transition-all gap-1.5">
                                                                    <CheckCircle size={12} /> Mark as Sold
                                                                </Button>
                                                            )}

                                                            {/* ── Postcode capture inline form ── */}
                                                            {!isPending && offer.status === 'ACCEPTED' && isCapturingPostcode && (
                                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                                    <div className="relative">
                                                                        <MapPin size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Postcode (opt.)"
                                                                            maxLength={8}
                                                                            className="bg-black/40 border border-[var(--border-default)] text-white rounded-lg pl-7 pr-2 py-1.5 w-32 text-xs font-bold focus:outline-none focus:border-emerald-500 transition-colors uppercase placeholder:normal-case placeholder:text-gray-600"
                                                                            value={postcodeCapture?.postcode ?? ''}
                                                                            onChange={e => setPostcodeCapture(p => p ? { ...p, postcode: e.target.value.toUpperCase() } : null)}
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" disabled={confirmingSale}
                                                                        onClick={confirmMarkSold}
                                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest h-9 px-3 rounded-xl transition-all gap-1">
                                                                        {confirmingSale ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                                        Confirm
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" disabled={confirmingSale}
                                                                        onClick={() => setPostcodeCapture(null)}
                                                                        className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white">
                                                                        <XCircle size={16} />
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {!isPending && offer.status !== 'ACCEPTED' && (
                                                                <span className="text-xs text-gray-600 uppercase tracking-widest font-black italic">
                                                                    Decision Finalized
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>{/* end hidden sm:block */}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
