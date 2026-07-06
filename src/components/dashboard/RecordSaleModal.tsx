"use client"

import * as React from "react"
import { X, DollarSign, User, Mail, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { recordSale, formatPrice, type Listing, type Offer } from "@/lib/listingApi"

interface RecordSaleModalProps {
    listing: Listing
    offer?: Offer
    onClose: () => void
    onSuccess: (listingId: string) => void
}

export function RecordSaleModal({ listing, offer, onClose, onSuccess }: RecordSaleModalProps) {
    const agreedPrice = offer ? Number(offer.counterAmount ?? offer.amount) : Number(listing.price)
    const [soldPrice, setSoldPrice] = React.useState(agreedPrice.toString())
    const [buyerName, setBuyerName] = React.useState(
        offer ? [offer.buyer?.firstName, offer.buyer?.lastName].filter(Boolean).join(' ') : ""
    )
    const [buyerEmail, setBuyerEmail] = React.useState(offer?.buyer?.email ?? "")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setLoading(true)
            setError(null)
            await recordSale(listing.id, {
                soldPrice: Number(soldPrice),
                buyerId: offer?.buyerId || undefined,
                buyerName: buyerName || undefined,
                buyerEmail: buyerEmail || undefined,
            })
            setSuccess(true)
            setTimeout(() => {
                onSuccess(listing.id)
                onClose()
            }, 2000)
        } catch (err: any) {
            setError(err.message || "Failed to record sale")
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-[var(--bg-dropdown)] border border-emerald-500/30 rounded-2xl p-8 w-full max-w-md shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                        <CheckCircle2 size={40} className="text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2 uppercase tracking-tight">Sale Recorded!</h2>
                    <p className="text-[var(--text-muted)] text-sm">Revenue tracked and listing updated to SOLD.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                        <DollarSign size={24} className="text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Finalize Sale</h2>
                        <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">{listing.title}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                            <DollarSign size={12} /> Final Sold Price
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">£</span>
                            <Input
                                type="number"
                                value={soldPrice}
                                onChange={(e) => setSoldPrice(e.target.value)}
                                className="pl-8 bg-[var(--bg-card)] border-[var(--border-default)] focus:border-primary text-[var(--text-primary)] h-14 text-lg font-black"
                                required
                            />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] italic">
                            {offer ? `Agreed offer: ${formatPrice(agreedPrice)}` : `Asking price: ${formatPrice(listing.price)}`}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                            <User size={12} /> Buyer Name <span className="text-[var(--text-secondary)] normal-case font-medium">(optional)</span>
                        </label>
                        <Input
                            placeholder="e.g. John Smith"
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            className="bg-[var(--bg-card)] border-[var(--border-default)] focus:border-primary text-[var(--text-primary)] h-12"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                            <Mail size={12} /> Buyer Email <span className="text-[var(--text-secondary)] normal-case font-medium">(optional)</span>
                        </label>
                        <Input
                            type="email"
                            placeholder="buyer@example.com"
                            value={buyerEmail}
                            onChange={(e) => setBuyerEmail(e.target.value)}
                            className="bg-[var(--bg-card)] border-[var(--border-default)] focus:border-primary text-[var(--text-primary)] h-12"
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1 h-12 text-[var(--text-muted)]"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-12 shadow-neon font-black uppercase tracking-widest"
                            disabled={loading}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Sale'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
