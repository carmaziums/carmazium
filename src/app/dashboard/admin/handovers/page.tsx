"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    Handshake, Loader2, ArrowLeft, CheckCircle, XCircle, ExternalLink,
    Car, Clock, AlertTriangle, BadgeCheck
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getPendingHandovers, approveHandover, denyHandover } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

export default function AdminHandoversPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [handovers, setHandovers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [processing, setProcessing] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchHandovers = React.useCallback(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        getPendingHandovers()
            .then(setHandovers)
            .catch(err => setError(err.message || 'Failed to load handovers'))
            .finally(() => setLoading(false))
    }, [profile])

    React.useEffect(() => { fetchHandovers() }, [fetchHandovers])

    const handleApprove = async (auctionId: string, sellerConnected: boolean) => {
        const payoutNote = sellerConnected
            ? 'The £100 seller bonus will be transferred to their connected bank account via Stripe.'
            : '⚠️ The seller has NOT connected a bank account — the handover will be approved but NO payout will be sent. They will need to connect their account later (if supported) or be paid manually.'
        if (!confirm(`Approve this handover?\n\n${payoutNote}`)) return
        try {
            setProcessing(auctionId)
            await approveHandover(auctionId)
            setHandovers(prev => prev.filter(h => h.id !== auctionId))
        } catch (err: any) {
            alert(err.message || 'Approval failed')
        } finally {
            setProcessing(null)
        }
    }

    const handleDeny = async (auctionId: string) => {
        if (!confirm('Deny this handover? A £100 refund will be issued to the buyer (Stripe) and the seller can resubmit proof.')) return
        try {
            setProcessing(auctionId)
            await denyHandover(auctionId)
            setHandovers(prev => prev.filter(h => h.id !== auctionId))
        } catch (err: any) {
            alert(err.message || 'Denial failed')
        } finally {
            setProcessing(null)
        }
    }

    if (authLoading || (user && !profile) || (loading && handovers.length === 0)) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <Link href="/dashboard/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back to Overview
                        </Link>
                        <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                            <Handshake className="text-amber-400 hidden sm:block" size={28} />
                            Handover Verification
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm">
                            Review seller-submitted handover proofs. Approve to release the £100 seller bonus, or deny to refund the buyer.
                        </p>
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    {!loading && handovers.length === 0 ? (
                        <div className="glass-card p-12 border border-white/5 bg-white/5 rounded-2xl text-center">
                            <BadgeCheck size={48} className="text-emerald-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">All clear</h3>
                            <p className="text-gray-400 text-sm">No handover proofs are pending verification right now.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {handovers.map((h) => (
                                <div key={h.id} className="glass-card border border-amber-500/20 bg-amber-500/5 rounded-2xl overflow-hidden">
                                    {/* Header */}
                                    <div className="p-5 border-b border-white/5">
                                        <div className="flex items-start gap-4">
                                            {h.listing?.images?.[0] ? (
                                                <Image src={h.listing.images[0]} alt="" width={72} height={72} className="w-18 h-18 rounded-xl object-cover shrink-0" />
                                            ) : (
                                                <div className="w-18 h-18 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Car size={28} className="text-gray-400" /></div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="font-bold text-white text-lg leading-tight">{h.listing?.title}</h3>
                                                        <p className="text-xs text-gray-400 mt-0.5">{h.listing?.year} · {h.listing?.make} {h.listing?.model}</p>
                                                    </div>
                                                    <span className="inline-flex px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-bold shrink-0">
                                                        PENDING REVIEW
                                                    </span>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                                    <div>
                                                        <p className="text-gray-500 uppercase tracking-widest font-bold text-[9px] mb-0.5">Seller</p>
                                                        <p className="text-white">{h.listing?.seller?.firstName} {h.listing?.seller?.lastName}</p>
                                                        <p className="text-gray-400">{h.listing?.seller?.email}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 uppercase tracking-widest font-bold text-[9px] mb-0.5">Winner / Buyer</p>
                                                        <p className="text-white">{h.winner?.firstName} {h.winner?.lastName}</p>
                                                        <p className="text-gray-400">{h.winner?.email}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 uppercase tracking-widest font-bold text-[9px] mb-0.5">Winning Bid</p>
                                                        <p className="text-emerald-400 font-bold">{formatPrice(Number(h.winningBidAmount ?? 0))}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fee summary + Proof */}
                                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Fee Breakdown</p>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Buyer paid</span>
                                                    <span className="font-bold text-white">£125.00</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">→ Seller bonus (on approval)</span>
                                                    <span className="font-bold text-emerald-400">£100.00</span>
                                                </div>
                                                <div className="flex justify-between border-t border-white/10 pt-1">
                                                    <span className="text-gray-400">Carmazium keeps</span>
                                                    <span className="font-bold text-white">£25.00</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs mt-2">
                                                <div className={`w-2 h-2 rounded-full ${h.buyerFeePaid ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                                <span className="text-gray-400">Buyer fee {h.buyerFeePaid ? 'paid' : 'not yet paid'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs mt-1">
                                                {h.listing?.seller?.stripeConnectOnboardingComplete ? (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                        <span className="text-gray-400">Seller bank account <strong className="text-emerald-300">connected</strong> — payout will fire automatically</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                        <span className="text-amber-300">Seller bank account <strong>not connected</strong> — payout will NOT be sent</span>
                                                    </>
                                                )}
                                            </div>
                                            {h.handoverSubmittedAt && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Clock size={12} />
                                                    Submitted {new Date(h.handoverSubmittedAt).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Proof Submitted</p>
                                            {h.handoverProofUrl && (
                                                <a
                                                    href={h.handoverProofUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-sm text-blue-400 hover:text-blue-300"
                                                >
                                                    <ExternalLink size={16} />
                                                    View Handover Proof
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="px-5 pb-5 flex items-center gap-3">
                                        <Button
                                            onClick={() => handleApprove(h.id, !!h.listing?.seller?.stripeConnectOnboardingComplete)}
                                            disabled={processing === h.id}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                                        >
                                            {processing === h.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                            {h.listing?.seller?.stripeConnectOnboardingComplete ? 'Approve & Pay £100' : 'Approve (No Payout)'}
                                        </Button>
                                        <Button
                                            onClick={() => handleDeny(h.id)}
                                            disabled={processing === h.id}
                                            variant="outline"
                                            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2"
                                        >
                                            {processing === h.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                            Deny & Refund £100
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
