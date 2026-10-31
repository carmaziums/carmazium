"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { completePurchaseAsBuyer } from "@/lib/listingApi"

/**
 * Either party can complete an accepted retail sale, so a deal is never stuck
 * at Sale Pending when a seller stops using CarMazium. Shown to the buyer
 * only while the listing is OFFER_ACCEPTED; asks for confirmation first.
 */
export function CompletePurchaseButton({ listingId, onCompleted, className = "" }: {
    listingId: string
    onCompleted?: () => void
    className?: string
}) {
    const [confirming, setConfirming] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [done, setDone] = React.useState(false)

    if (done) {
        return <p role="status" className={`text-sm font-bold text-emerald-500 ${className}`}>Purchase completed. The seller has been told.</p>
    }

    const complete = async () => {
        setBusy(true)
        setError(null)
        try {
            await completePurchaseAsBuyer(listingId)
            setDone(true)
            onCompleted?.()
        } catch (err: any) {
            setError(err?.message || "The purchase could not be completed. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {!confirming ? (
                <button type="button" onClick={() => setConfirming(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                    <CheckCircle2 size={16} /> I&apos;ve bought this car
                </button>
            ) : (
                <div role="group" aria-label="Confirm purchase" className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                    <p className="text-sm">
                        Only confirm once you have paid the seller and the deal is done. This records the sale at the accepted
                        offer price and tells the seller. If anything goes wrong later, use Cancel sale.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={complete} disabled={busy}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                            {busy && <Loader2 size={15} className="animate-spin" />} Yes, complete the purchase
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} disabled={busy}
                            className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-semibold">
                            Not yet
                        </button>
                    </div>
                </div>
            )}
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>
    )
}
