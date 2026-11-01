"use client"

import { CompletePurchaseButton } from "@/components/purchases/CompletePurchaseButton"
import { BuyerCollectedButton } from "@/components/purchases/BuyerCollectedButton"
import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Receipt, ShoppingBag } from "lucide-react"
import { getMyOffers, getMyTransactions, type Offer, type Transaction } from "@/lib/listingApi"
import { apiClient, downloadAuthenticatedFile } from "@/lib/apiClient"

const money = (value: string | number | null | undefined) =>
    Number(value ?? 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" })

/**
 * Personal buyers have retail accepted offers and separate platform receipts.
 * An accepted offer is a DEAL AGREED, not evidence vehicle funds cleared.
 * Never label platform transaction totals as the vehicle purchase price.
 */
interface PrivateRecordedSale {
    id: string
    title: string
    imageUrl: string | null
    price: number
    purchasedAt: string
    purchaseStatus: string
    buyerCollectedAt: string | null
    canConfirmCollection: boolean
}

export function PrivatePurchasesTab() {
    const [offers, setOffers] = React.useState<Offer[]>([])
    const [transactions, setTransactions] = React.useState<Transaction[]>([])
    const [sales, setSales] = React.useState<PrivateRecordedSale[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        let active = true
        Promise.allSettled([
            getMyOffers(), getMyTransactions(1, 50),
            apiClient<{ data: PrivateRecordedSale[] }>('/listings/my-purchase-sales', { cache: 'no-store' }),
        ]).then(([offerRes, txRes, saleRes]) => {
            if (!active) return
            if (offerRes.status === "fulfilled") setOffers(offerRes.value)
            if (txRes.status === "fulfilled") setTransactions(txRes.value.data || [])
            if (saleRes.status === "fulfilled") setSales(saleRes.value.data ?? [])
            if (offerRes.status === "rejected" || txRes.status === "rejected" || saleRes.status === "rejected") {
                setError("Some purchase records could not be loaded. Refresh to retry.")
            }
        }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    const accepted = offers.filter(o => o.status === "ACCEPTED")
    const receipts = transactions.filter(tx => ["COMMISSION", "HPI_REPORT", "REFUND", "DEPOSIT", "FULL_PAYMENT"].includes(tx.type))
    const receipt = (id: string) => {
        void downloadAuthenticatedFile(`/transactions/${id}/receipt.pdf`, `carmazium-receipt-${id.slice(0, 8)}.pdf`)
            .catch(err => { setError(err instanceof Error ? err.message : "Receipt download unavailable.") })
    }

    return (
        <div className="space-y-6" aria-label="Private purchases and receipts">
            <div>
                <h2 className="text-2xl font-black">Purchases</h2>
                <p className="text-sm text-[var(--text-muted)]">
                    Retail deals you agreed, and separate CarMazium transaction receipts.
                    Vehicle sale proceeds go directly to the seller.
                </p>
            </div>
            {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading purchases…</p>}
            {error && <p role="alert" className="text-sm text-amber-400">{error}</p>}
            {!loading && (
                <>
                    <section className="space-y-3">
                        <h3 className="font-black">Agreed retail purchases ({accepted.length})</h3>
                        {accepted.length === 0 && <p className="rounded-xl border border-[var(--border-default)] p-5 text-sm text-[var(--text-muted)]">No accepted retail offers found.</p>}
                        {accepted.map(offer => (
                            <article key={offer.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                {offer.listing?.images?.[0]
                                    ? <Image src={offer.listing.images[0]} alt="" width={80} height={64} className="h-16 w-20 shrink-0 rounded object-cover" />
                                    : <ShoppingBag size={23} className="shrink-0 text-[var(--text-muted)]" />}
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold break-words">{offer.listing?.title || "Retail vehicle"}</p>
                                    <p className="text-sm">{money(offer.finalAmount ?? offer.counterAmount ?? offer.amount)}</p>
                                    {offer.listing?.status === "OFFER_ACCEPTED" ? (
                                        <>
                                            <p className="text-xs text-emerald-400 font-bold">
                                                Offer accepted. Arrange payment, inspection and collection with the seller; once paid, either of you can complete the sale.
                                            </p>
                                            <CompletePurchaseButton listingId={offer.listingId} className="mt-2" />
                                        </>
                                    ) : (
                                        <p className="text-xs text-emerald-400 font-bold">
                                            {offer.listing?.status === "SOLD" ? "Purchase completed" : "Offer accepted"}
                                        </p>
                                    )}
                                </div>
                                <Link href="/dashboard/user?tab=bids"
                                    className="text-xs font-bold text-primary hover:underline">View offer</Link>
                            </article>
                        ))}
                    </section>
                    <section className="space-y-3">
                        <h3 className="font-black">Recorded vehicle purchases ({sales.length})</h3>
                        {sales.length === 0 && <p className="rounded-xl border border-[var(--border-default)] p-4 text-sm text-[var(--text-muted)]">No recorded vehicle purchases yet.</p>}
                        {sales.map(sale => (
                            <article key={sale.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                {sale.imageUrl
                                    ? <Image src={sale.imageUrl} alt="" width={80} height={64} className="h-16 w-20 shrink-0 rounded object-cover" />
                                    : <ShoppingBag size={22} className="shrink-0 text-[var(--text-muted)]" />}
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p className="font-bold break-words">{sale.title}</p>
                                    <p className="text-sm">{money(sale.price)} · {new Date(sale.purchasedAt).toLocaleDateString('en-GB')}</p>
                                    {sale.buyerCollectedAt
                                        ? <p className="text-sm font-bold text-emerald-500">Collected · {new Date(sale.buyerCollectedAt).toLocaleDateString('en-GB')}</p>
                                        : <p className="text-xs text-[var(--text-muted)]">Stage: {sale.purchaseStatus.replaceAll('_', ' ').toLowerCase()}</p>}
                                    {sale.canConfirmCollection && !sale.buyerCollectedAt &&
                                        <BuyerCollectedButton saleId={sale.id}
                                            onCollected={() => setSales(previous => previous.map(item => item.id === sale.id
                                                ? { ...item, purchaseStatus: 'CHECKS_COMPLETE', buyerCollectedAt: new Date().toISOString(), canConfirmCollection: false }
                                                : item))} />}
                                </div>
                            </article>
                        ))}
                    </section>
                    <section className="space-y-3">
                        <h3 className="font-black">Receipts and payments ({receipts.length})</h3>
                        {receipts.length === 0 && <p className="rounded-xl border border-[var(--border-default)] p-5 text-sm text-[var(--text-muted)]">No platform receipts found.</p>}
                        {receipts.map(tx => (
                            <article key={tx.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                <Receipt size={22} className="text-primary" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm">{tx.listing?.title || tx.type.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{tx.status} · {new Date(tx.createdAt).toLocaleDateString("en-GB")}</p>
                                </div>
                                <span className="font-black tabular-nums">{money(tx.amount)}</span>
                                <button type="button" onClick={() => receipt(tx.id)} className="text-xs font-bold text-primary hover:underline">PDF receipt</button>
                            </article>
                        ))}
                    </section>
                    <p className="text-xs text-[var(--text-muted)]">
                        For auction wins, use your existing won-auction and handover records.
                        A platform fee receipt is not evidence that the vehicle was paid for.
                    </p>
                </>
            )}
        </div>
    )
}
