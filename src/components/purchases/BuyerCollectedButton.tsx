"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/apiClient"

/** Purchaser's physical-collection attestation; distinct from seller payment
 * receipt, admin handover approval and TradeXchange delivery fulfilment. */
export function BuyerCollectedButton({ saleId, onCollected, className = "" }: {
    saleId: string
    onCollected?: () => void
    className?: string
}) {
    const [confirming, setConfirming] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [done, setDone] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const confirm = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            await apiClient(`/listings/purchase-sales/${encodeURIComponent(saleId)}/confirm-collection`, { method: "POST" })
            setDone(true)
            onCollected?.()
        } catch (error: any) {
            setError(error?.message || "Could not confirm collection. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    if (done) return <p role="status" className={`text-sm font-semibold text-emerald-500 ${className}`}>Collection recorded. This purchase is now under Completed.</p>

    return (
        <div className={`space-y-2 ${className}`}>
            {!confirming ? (
                <button type="button" onClick={() => setConfirming(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                    <CheckCircle2 size={16} aria-hidden="true" /> I&apos;ve collected this car
                </button>
            ) : (
                <div role="group" aria-label="Confirm physical vehicle collection" className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                    <p className="text-sm">I confirm I have physically received this vehicle and have paid the seller directly. This moves my purchase into Completed. It does not confirm payment on behalf of the seller or mark a transport job completed.</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={confirm} disabled={busy}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                            {busy && <Loader2 size={15} className="animate-spin" />} Confirm collected
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} disabled={busy}
                            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-semibold">
                            Not yet
                        </button>
                    </div>
                </div>
            )}
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>
    )
}
