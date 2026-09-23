"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchCheck, Loader2 } from "lucide-react"
import { createInspectionFromAuction } from "@/lib/servicesApi"
import { inspectionServiceEnabled } from "@/lib/featureFlags"

export function ArrangeInspection({ auctionId }: { auctionId: string }) {
    const router = useRouter()
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const create = async () => {
        setBusy(true)
        setError(null)
        try {
            const job = await createInspectionFromAuction({ auctionId })
            router.push(`/services/jobs/${job.id}?posted=1`)
        } catch (err: any) {
            setError(err?.message || "Could not create the inspection request")
            setBusy(false)
        }
    }

    if (!inspectionServiceEnabled) return null

    return (
        <div className="flex flex-col items-stretch sm:items-end gap-2">
            <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-sm font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
            >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <SearchCheck size={16} />}
                Get inspection quotes
            </button>
            {error && (
                <p className="text-xs text-red-500 max-w-xs sm:text-right">
                    {error} If the seller postcode is unavailable, use the full inspection request form.
                </p>
            )}
        </div>
    )
}
