"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
    Loader2, Gavel, Clock, CheckCircle, XCircle, RefreshCw,
    Trophy, Tag, Car, ArrowUpRight, Search
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { useAuth } from "@/context/AuthContext"
import {
    getMyOffers,
    withdrawOffer,
    respondToCounterOffer,
    formatPrice,
    type Offer,
} from "@/lib/listingApi"

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Pending" },
    ACCEPTED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Accepted" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "Declined" },
    WITHDRAWN: { bg: "bg-slate-500/10", text: "text-[var(--text-muted)]", border: "border-[var(--border-default)]", label: "Withdrawn" },
    COUNTERED: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Countered" },
}

export default function DealerMyOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<Offer[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})
    const [searchTerm, setSearchTerm] = React.useState("")

    const fetchOffers = React.useCallback(async () => {
        setLoading(true)
        try {
            const data = await getMyOffers()
            setOffers(data || [])
        } catch (err) {
            console.error("Failed to fetch outgoing offers:", err)
            setOffers([])
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (!authLoading && user) fetchOffers()
    }, [authLoading, user, fetchOffers])

    const handleWithdraw = async (offerId: string) => {
        if (!confirm("Withdraw this offer? You'll be able to submit a new one afterwards.")) return
        setActionLoading(prev => ({ ...prev, [offerId]: true }))
        try {
            await withdrawOffer(offerId)
            await fetchOffers()
        } catch (err: any) {
            alert(err?.message || "Failed to withdraw offer")
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    const handleCounterResponse = async (offerId: string, status: 'ACCEPTED' | 'REJECTED') => {
        setActionLoading(prev => ({ ...prev, [offerId]: true }))
        try {
            await respondToCounterOffer(offerId, status)
            await fetchOffers()
        } catch (err: any) {
            alert(err?.message || "Failed to respond")
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const pendingCount = offers.filter(o => o.status === "PENDING").length
    const acceptedCount = offers.filter(o => o.status === "ACCEPTED").length
    const counteredCount = offers.filter(o => o.status === "COUNTERED").length

    const filtered = offers.filter(o => {
        if (!searchTerm) return true
        const needle = searchTerm.toLowerCase()
        return (
            o.listing?.title?.toLowerCase().includes(needle) ||
            o.listing?.make?.toLowerCase().includes(needle) ||
            o.listing?.model?.toLowerCase().includes(needle)
        )
    })

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title="My Offers"
                        subHeader="Track outgoing bids you've placed on other dealers' inventory"
                    />

                    {/* Summary metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard
                            label="Awaiting Response"
                            value={pendingCount}
                            icon={Clock}
                            color="text-amber-400"
                            bg="bg-amber-500/10"
                            border="border-amber-500/20"
                            statusLabel="Pending"
                            loading={loading}
                        />
                        <MetricCard
                            label="Accepted Bids"
                            value={acceptedCount}
                            icon={Trophy}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Closed"
                            loading={loading}
                        />
                        <MetricCard
                            label="Counter Offers"
                            value={counteredCount}
                            icon={RefreshCw}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            statusLabel="Action Required"
                            loading={loading}
                        />
                    </div>

                    <div className="dealer-glass-card overflow-hidden">
                        {/* Sticky so search stays reachable without scrolling back up
                            from deep inside a long offers list */}
                        <div className="sticky top-20 z-20 p-6 border-b border-[var(--border-default)] bg-[var(--bg-card)]/95 backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Outgoing Bids</h3>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search vehicle..."
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-2 pl-9 pr-3 text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-16 text-center">
                                <Gavel className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                <p className="text-[var(--text-muted)] font-bold">
                                    {searchTerm ? "No outgoing offers match your search." : "No outgoing offers yet"}
                                </p>
                                <p className="text-gray-600 text-sm mt-1">
                                    Offers you place on other dealers' inventory will appear here.
                                </p>
                                {!searchTerm && (
                                    <div className="mt-6">
                                        <Link href="/search">
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <ArrowUpRight size={14} /> Browse marketplace
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                            {/* ── Mobile cards (< sm) ── */}
                            <div className="sm:hidden divide-y divide-white/[0.03]">
                                {filtered.map(offer => {
                                    const isActioning = !!actionLoading[offer.id]
                                    const style = STATUS_STYLES[offer.status] ?? STATUS_STYLES.PENDING
                                    const image = offer.listing?.images?.[0]
                                    const slug = offer.listing?.slug || offer.listingId
                                    return (
                                        <div key={offer.id} className="p-4 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-14 h-10 rounded-lg overflow-hidden border border-[var(--border-default)] shrink-0 bg-[var(--bg-input)]">
                                                    {image ? <Image src={image} alt={offer.listing?.title || ''} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600"><Car size={16} /></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <Link href={`/vehicle/${slug}`} className="font-black text-[var(--text-primary)] text-sm truncate block hover:text-primary transition-colors">{offer.listing?.title || 'Listing'}</Link>
                                                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase truncate">{offer.listing?.year} {offer.listing?.make} {offer.listing?.model}</p>
                                                </div>
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black tracking-widest uppercase border shrink-0 ${style.bg} ${style.text} ${style.border}`}>{style.label}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-base font-black text-[var(--text-primary)] tabular-nums">
                                                        {formatPrice(offer.status === 'ACCEPTED' ? (offer.finalAmount ?? offer.counterAmount ?? offer.amount) : offer.amount)}
                                                    </p>
                                                    {offer.status === 'ACCEPTED' && <p className="text-xs font-black text-emerald-400">Agreed price</p>}
                                                    {offer.status === 'COUNTERED' && offer.counterAmount && <p className="text-xs font-black text-blue-400">Counter: {formatPrice(offer.counterAmount)}</p>}
                                                    <p className="text-xs text-[var(--text-muted)]">{new Date(offer.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                    {offer.status === 'PENDING' && <button onClick={() => handleWithdraw(offer.id)} disabled={isActioning} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl disabled:opacity-50">{isActioning ? <Loader2 size={12} className="animate-spin" /> : 'Withdraw'}</button>}
                                                    {offer.status === 'COUNTERED' && <>
                                                        <button onClick={() => handleCounterResponse(offer.id, 'ACCEPTED')} disabled={isActioning} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">{isActioning ? <Loader2 size={12} className="animate-spin" /> : 'Accept'}</button>
                                                        <button onClick={() => handleCounterResponse(offer.id, 'REJECTED')} disabled={isActioning} className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">Reject</button>
                                                    </>}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ── Desktop table (≥ sm) ── */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="vip-table-header text-xs uppercase font-black tracking-widest text-[var(--text-muted)] border-b border-[var(--border-default)]">
                                        <tr>
                                            <th className="px-6 py-5">Vehicle</th>
                                            <th className="px-6 py-5 text-right">My Offer</th>
                                            <th className="px-6 py-5 text-right">Counter</th>
                                            <th className="px-6 py-5 text-center">Status</th>
                                            <th className="px-6 py-5 text-center">Placed</th>
                                            <th className="px-6 py-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {filtered.map(offer => {
                                            const isActioning = !!actionLoading[offer.id]
                                            const style = STATUS_STYLES[offer.status] ?? STATUS_STYLES.PENDING
                                            const image = offer.listing?.images?.[0]
                                            const slug = offer.listing?.slug || offer.listingId
                                            return (
                                                <tr key={offer.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-5">
                                                        <Link href={`/vehicle/${slug}`} className="flex items-center gap-3 group/link">
                                                            <div className="relative w-14 h-10 rounded-lg overflow-hidden border border-[var(--border-default)] shrink-0 bg-[var(--bg-input)]">
                                                                {image ? (
                                                                    <Image src={image} alt={offer.listing?.title || ''} fill className="object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                                        <Car size={18} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-black text-[var(--text-primary)] truncate group-hover/link:text-primary transition-colors text-sm">
                                                                    {offer.listing?.title || 'Listing'}
                                                                </p>
                                                                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
                                                                    {offer.listing?.year ? `${offer.listing.year} ` : ''}
                                                                    {offer.listing?.make || ''} {offer.listing?.model || ''}
                                                                </p>
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="text-base font-black text-[var(--text-primary)] tabular-nums">
                                                            {formatPrice(offer.status === 'ACCEPTED' ? (offer.finalAmount ?? offer.counterAmount ?? offer.amount) : offer.amount)}
                                                        </span>
                                                        {offer.status === 'ACCEPTED' && (
                                                            <div className="text-xs text-emerald-400 font-black uppercase tracking-widest mt-0.5">Agreed</div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        {offer.status !== 'ACCEPTED' && offer.counterAmount ? (
                                                            <span className="text-sm font-black text-blue-400 tabular-nums">
                                                                {formatPrice(offer.counterAmount)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-600 font-bold uppercase tracking-widest">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase border ${style.bg} ${style.text} ${style.border}`}>
                                                            {style.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <p className="text-xs font-bold text-[var(--text-secondary)]">
                                                            {new Date(offer.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                        <p className="text-xs text-[var(--text-muted)]">
                                                            {new Date(offer.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {offer.status === 'PENDING' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    disabled={isActioning}
                                                                    onClick={() => handleWithdraw(offer.id)}
                                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-red-500/20 rounded-xl"
                                                                >
                                                                    {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'Withdraw'}
                                                                </Button>
                                                            )}
                                                            {offer.status === 'COUNTERED' && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={isActioning}
                                                                        onClick={() => handleCounterResponse(offer.id, 'ACCEPTED')}
                                                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-emerald-500/20 rounded-xl"
                                                                    >
                                                                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'Accept Counter'}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={isActioning}
                                                                        onClick={() => handleCounterResponse(offer.id, 'REJECTED')}
                                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-xs uppercase tracking-widest h-9 px-4 border border-red-500/20 rounded-xl"
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {offer.status === 'ACCEPTED' && (
                                                                <span className="inline-flex items-center gap-1 text-emerald-400 font-black text-xs uppercase tracking-widest">
                                                                    <CheckCircle size={12} /> Closed
                                                                </span>
                                                            )}
                                                            {offer.status === 'REJECTED' && (
                                                                <span className="inline-flex items-center gap-1 text-red-400/80 font-black text-xs uppercase tracking-widest">
                                                                    <XCircle size={12} /> Declined
                                                                </span>
                                                            )}
                                                            {offer.status === 'WITHDRAWN' && (
                                                                <span className="text-gray-600 font-black text-xs uppercase tracking-widest italic">
                                                                    Withdrawn
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
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
