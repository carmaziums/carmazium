"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"
import { downloadAuthenticatedFile } from "@/lib/apiClient"

/** Only render this for purchases with a server-recorded buyer collection. */
export function PurchaseReceiptButton({ saleId, className = "" }: {
    saleId: string
    className?: string
}) {
    const [downloading, setDownloading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const download = async () => {
        setDownloading(true)
        setError(null)
        try {
            await downloadAuthenticatedFile(
                \`/dealers/purchases/\${encodeURIComponent(saleId)}/receipt.pdf\`,
                \`carmazium-vehicle-purchase-\${saleId.slice(0, 8)}.pdf\`,
            )
        } catch (err) {
            if ((err as Error).message !== "AUTH_REDIRECT") {
                setError("Unable to download the purchase PDF. Please try again.")
            }
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className={className}>
            <button type="button" onClick={download} disabled={downloading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-primary hover:bg-[var(--bg-input)] disabled:opacity-50">
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? "Preparing PDF…" : "Download purchase receipt (PDF)"}
            </button>
            {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    )
}
