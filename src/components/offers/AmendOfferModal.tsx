"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { amendOffer, formatPrice, type Offer } from "@/lib/listingApi"

interface AmendOfferModalProps {
    offer: Offer
    onClose: () => void
    onSaved: (offer: Offer) => void | Promise<void>
}

export function AmendOfferModal({ offer, onClose, onSaved }: AmendOfferModalProps) {
    const askingPrice = Number(offer.listing?.price ?? 0)
    const minAllowedOffer = askingPrice > 0 ? Math.floor(askingPrice * 0.7) : 0
    const [amount, setAmount] = React.useState(String(Number(offer.amount)))
    const [message, setMessage] = React.useState(offer.message ?? "")
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const numericAmount = Number(amount)
    const invalid = !amount || !Number.isFinite(numericAmount) || numericAmount <= 0 ||
        (minAllowedOffer > 0 && numericAmount < minAllowedOffer)

    const handleSave = async () => {
        if (invalid || saving) return
        setSaving(true)
        setError(null)
        try {
            const updated = await amendOffer(
                offer.id,
                numericAmount,
                message,
                numericAmount,
                numericAmount,
            )
            await onSaved(updated)
            onClose()
        } catch (err: any) {
            setError(err?.message || "Could not amend this offer.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl p-6 relative"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Close amend offer dialog"
                >
                    <X size={20} />
                </button>

                <div className="flex items-start gap-3 pr-8">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <Pencil size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-black">Amend Offer</h2>
                        <p className="text-sm text-[var(--text-muted)] truncate">
                            {offer.listing?.title || "Vehicle"}
                        </p>
                    </div>
                </div>

                <div className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">Current offer</span>
                        <strong>{formatPrice(offer.amount)}</strong>
                    </div>
                    {askingPrice > 0 && (
                        <div className="flex items-center justify-between gap-3 mt-1">
                            <span className="text-[var(--text-muted)]">Asking price</span>
                            <span>{formatPrice(askingPrice)}</span>
                        </div>
                    )}
                </div>

                <div className="mt-5">
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        New Offer
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">£</span>
                        <Input
                            type="number"
                            min={minAllowedOffer || 1}
                            step={100}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="pl-8"
                            autoFocus
                        />
                    </div>
                    {minAllowedOffer > 0 && numericAmount < minAllowedOffer && (
                        <p className="text-xs text-red-400 mt-2">
                            Offer must be at least £{minAllowedOffer.toLocaleString("en-GB")}.
                        </p>
                    )}
                </div>

                <div className="mt-4">
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        Message <span className="normal-case font-medium">(optional)</span>
                    </label>
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm resize-none focus:outline-none focus:border-primary"
                        placeholder="Add or update your message to the seller"
                    />
                </div>

                <p className="text-xs text-[var(--text-muted)] mt-3">
                    You can amend a bid only while it is still awaiting the seller. Once negotiation starts, use the counter-offer controls instead.
                </p>

                {error && (
                    <div className="mt-4 flex gap-2 items-start rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-6">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={invalid || saving} className="gap-2">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                        Update Offer
                    </Button>
                </div>
            </div>
        </div>
    )
}
