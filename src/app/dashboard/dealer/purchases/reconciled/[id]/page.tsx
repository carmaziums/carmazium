"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, BadgeCheck, CarFront, FileText, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { PurchaseReceiptButton } from "@/components/purchases/PurchaseReceiptButton"

type ReconciledPurchase = {
    id: string
    vehicleTitle: string
    registration: string
    imageUrl: string | null
    vehicleSubtitle: string
    collectedAt: string
    purchasePrice: number | null
    provenance: "OWNER_CONFIRMED"
    status: "CHECKS_COMPLETE"
}

export default function ReconciledPurchasePage() {
    const { id } = useParams<{ id: string }>()
    const [purchase, setPurchase] = React.useState<ReconciledPurchase | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!id) return
        let live = true
        apiClient<{ data: ReconciledPurchase }>(
            "/dealers/purchases/reconciled/" + encodeURIComponent(id), { cache: "no-store" },
        ).then(result => {
            if (live) setPurchase(result.data)
        }).catch(err => {
            if (live) setError(err instanceof Error ? err.message : "Purchase not found")
        }).finally(() => {
            if (live) setLoading(false)
        })
        return () => { live = false }
    }, [id])

    const formattedDate = purchase
        ? new Date(purchase.collectedAt + "T12:00:00Z").toLocaleDateString(
            "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" },
        )
        : ""

    return (
        <main className="min-h-screen pt-24 pb-24 px-4">
            <div className="mx-auto max-w-3xl space-y-5">
                <Link href="/dashboard/dealer/purchases?tab=completed&channel=all"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
                    <ArrowLeft size={17} /> Completed Purchases
                </Link>
                <h1 className="text-2xl font-black">Completed purchase record</h1>
                {loading && <div className="flex items-center gap-2 py-12"><Loader2 className="animate-spin" /> Loading purchase…</div>}
                {error && <p role="alert" className="rounded-xl border border-red-500/20 p-4 text-sm text-red-500">{error}</p>}
                {!loading && purchase && (
                    <>
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-input)]">
                                    {purchase.imageUrl
                                        ? <Image src={purchase.imageUrl} alt={purchase.vehicleTitle}
                                            fill sizes="112px" className="object-cover" />
                                        : <CarFront size={28} className="mx-auto mt-7" />}
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <p className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                                        <BadgeCheck size={16} /> Completed · Collected
                                    </p>
                                    <h2 className="text-lg font-black break-words">{purchase.vehicleTitle}</h2>
                                    <p className="text-sm text-[var(--text-muted)]">{purchase.vehicleSubtitle}</p>
                                </div>
                            </div>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-3 border-b border-[var(--border-default)] pb-2">
                                    <dt>Registration</dt><dd className="font-bold">{purchase.registration}</dd>
                                </div>
                                <div className="flex justify-between gap-3 border-b border-[var(--border-default)] pb-2">
                                    <dt>Collection date</dt><dd className="font-bold">{formattedDate}</dd>
                                </div>
                                <div className="flex justify-between gap-3 border-b border-[var(--border-default)] pb-2">
                                    <dt>Agreed purchase price</dt>
                                    <dd className="font-bold">{purchase.purchasePrice === null ? "Not yet recorded"
                                        : purchase.purchasePrice.toLocaleString("en-GB", { style: "currency", currency: "GBP" })}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt>Record reference</dt><dd className="font-semibold break-all">CMZ-REC-{purchase.id.slice(0, 8).toUpperCase()}</dd>
                                </div>
                            </dl>
                            <PurchaseReceiptButton saleId={purchase.id} reconciled />
                        </section>
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-2">
                            <h2 className="flex items-center gap-2 font-bold"><FileText size={17} /> About this recovered record</h2>
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                                You confirmed this vehicle was purchased and collected. This completed record was
                                recovered after a missing transaction in CarMazium's earlier website workflow.
                                It does not change the historic auction outcome, create a buyer fee, or mark
                                your stock listing as sold.
                            </p>
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                                A CarMazium purchase record is not a VAT invoice or independent proof of payment.
                                Keep your seller invoice and bank transfer evidence with your accounts.
                            </p>
                        </section>
                    </>
                )}
            </div>
        </main>
    )
}
