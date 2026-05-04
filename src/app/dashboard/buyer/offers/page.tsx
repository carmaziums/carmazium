"use client"

import * as React from "react"
import { getMyOffers, withdrawOffer, type Offer } from "@/lib/listingApi"
import { createChatRoom } from "@/lib/chatApi"
import { useRouter } from "next/navigation"
import { Loader2, AlertTriangle, Tag, Clock, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Offer['status'] }) {
    const styles: Record<string, string> = {
        PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        ACCEPTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
        WITHDRAWN: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    }
    const icons: Record<string, React.ReactNode> = {
        PENDING: <Clock size={11} />,
        ACCEPTED: <CheckCircle size={11} />,
        REJECTED: <XCircle size={11} />,
        WITHDRAWN: <XCircle size={11} />,
    }
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${styles[status] ?? ''}`}>
            {icons[status]} {status}
        </span>
    )
}

function StatusMessage({ status, amount }: { status: Offer['status'], amount: string | number }) {
    const formatted = `£${Number(amount).toLocaleString('en-GB')}`
    if (status === 'PENDING') return (
        <p className="text-xs text-amber-300 mt-1.5">
            ⏳ Awaiting seller response for your offer of {formatted}
        </p>
    )
    if (status === 'ACCEPTED') return (
        <p className="text-xs text-emerald-300 mt-1.5">
            🎉 Your offer of {formatted} was accepted! Contact the seller to complete the purchase.
        </p>
    )
    if (status === 'REJECTED') return (
        <p className="text-xs text-red-300 mt-1.5">
            Your offer of {formatted} was declined. You may visit the listing to make a new offer.
        </p>
    )
    return null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuyerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<Offer[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [startingChat, setStartingChat] = React.useState<string | null>(null)
    const [withdrawing, setWithdrawing] = React.useState<string | null>(null)
    const router = useRouter()

    React.useEffect(() => {
        const load = async () => {
            if (!user) return
            try {
                setLoading(true)
                const data = await getMyOffers()
                setOffers(data)
            } catch (err: any) {
                setError(err.message || "Failed to load offers")
            } finally {
                setLoading(false)
            }
        }
        if (!authLoading) {
            load()
        }
    }, [user, authLoading])

    const handleMessageSeller = async (sellerId: string | undefined, listingId: string) => {
        if (!sellerId) {
            alert("Seller information is currently unavailable.");
            return;
        }
        setStartingChat(listingId);
        try {
            const room = await createChatRoom(sellerId, listingId);
            router.push(`/dashboard/buyer/messages?room=${room.id}`);
        } catch (err: any) {
            console.error("Failed to start chat:", err);
            alert(err.message || "Failed to start chat.");
        } finally {
            setStartingChat(null);
        }
    }

    const handleWithdraw = async (offerId: string) => {
        if (!confirm("Are you sure you want to withdraw this offer? This action cannot be undone.")) return;
        setWithdrawing(offerId);
        try {
            await withdrawOffer(offerId);
            setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: 'WITHDRAWN' } : o));
        } catch (err: any) {
            console.error("Failed to withdraw offer:", err);
            alert(err.message || "Failed to withdraw offer.");
        } finally {
            setWithdrawing(null);
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Buyer Account"} />
                <main className="flex-1 space-y-6">

                    {/* ── Header ─────────────────────────────────── */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white flex items-center gap-3">
                            <Tag className="text-primary" size={28} /> My Offers
                        </h1>
                        <Link href="/search" className="bg-primary text-white font-bold py-2.5 px-6 rounded-lg shadow-neon hover:scale-105 transition-all flex items-center gap-2">
                            Browse Cars
                        </Link>
                    </div>

                    {/* ── Error banner ─────────────────────────────── */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-400">
                            <AlertTriangle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ── Table ────────────────────────────────────── */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/80 text-gray-400 text-xs uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-5">Vehicle</th>
                                        <th className="px-6 py-5">Status</th>
                                        <th className="px-6 py-5">Offer Amount</th>
                                        <th className="px-6 py-5">Date</th>
                                        <th className="px-6 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                                                <p className="text-gray-400 font-medium">Loading offers...</p>
                                            </td>
                                        </tr>
                                    ) : offers.length === 0 && !error ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <Tag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                                <h2 className="text-xl font-bold text-white mb-2">No Offers Yet</h2>
                                                <p className="text-gray-400 mb-6 text-sm">Browse listings with offer ranges and make your first offer.</p>
                                                <Link href="/search">
                                                    <button className="bg-white/10 text-white border border-white/20 font-bold px-6 py-2.5 rounded-lg hover:bg-white/20 transition-colors">
                                                        Browse Cars
                                                    </button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        offers.map((offer) => {
                                            const listing = offer.listing
                                            const image = listing?.images?.[0] ?? "/assets/images/featured-sports.png"
                                            const slug = listing?.slug ?? ""

                                            return (
                                                <tr
                                                    key={offer.id}
                                                    className="hover:bg-white/5 transition-colors group"
                                                >
                                                    {/* Vehicle */}
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <Link href={`/vehicle/${slug}`} className="shrink-0 relative w-16 h-12 rounded object-cover overflow-hidden bg-slate-800 border border-white/10 group-hover:border-primary/50 transition-colors">
                                                                <Image src={image} alt={listing?.title ?? ""} fill className="object-cover" />
                                                            </Link>
                                                            <div>
                                                                <Link href={`/vehicle/${slug}`} className="font-bold text-white text-[15px] hover:text-primary transition-colors block mb-1">
                                                                    {listing?.title ?? "Listing"}
                                                                </Link>
                                                                <div className="text-xs text-gray-400">
                                                                    {listing?.year} • {listing?.make} {listing?.model}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-6 py-5">
                                                        <StatusBadge status={offer.status} />
                                                    </td>

                                                    {/* Offer Amount */}
                                                    <td className="px-6 py-5">
                                                        <div className="font-mono text-lg font-bold text-white mb-1">
                                                            £{Number(offer.amount).toLocaleString('en-GB')}
                                                        </div>
                                                        {listing?.price && (
                                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                                                                ASKING: £{Number(listing.price).toLocaleString('en-GB')}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Date */}
                                                    <td className="px-6 py-5">
                                                        <div className="text-sm font-medium text-white">
                                                            {new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {new Date(offer.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {offer.status === 'PENDING' && (
                                                                <div className="flex items-center gap-2">
                                                                    <Link href={`/buy-cars/${slug}?editOffer=true`} className="inline-flex items-center justify-center h-10 px-3 text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all hover:scale-105" title="Edit Offer">
                                                                        Edit
                                                                    </Link>
                                                                    <button 
                                                                        onClick={() => handleWithdraw(offer.id)}
                                                                        disabled={withdrawing === offer.id}
                                                                        className="inline-flex items-center justify-center h-10 px-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                                                                        title="Cancel Offer"
                                                                    >
                                                                        {withdrawing === offer.id ? <Loader2 size={16} className="animate-spin" /> : "Cancel"}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <button 
                                                                onClick={() => handleMessageSeller(offer.listing?.sellerId, offer.listing?.id || "")}
                                                                disabled={startingChat === offer.listing?.id}
                                                                className="inline-flex items-center justify-center h-10 px-3 text-sm font-bold text-blue-400 hover:text-white hover:bg-white/10 rounded-xl transition-all hover:scale-105 disabled:opacity-50" 
                                                                title="Message Seller"
                                                            >
                                                                {startingChat === offer.listing?.id ? <Loader2 size={16} className="animate-spin" /> : "Message"}
                                                            </button>
                                                            <Link href={`/vehicle/${slug}`} className="inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]" title="View Listing">
                                                                <Eye size={18} />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
