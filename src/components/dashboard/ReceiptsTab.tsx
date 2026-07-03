"use client"

import * as React from "react"
import Image from "next/image"
import {
    Receipt, Car, Download, Loader2, CheckCircle2, Clock,
    XCircle, FileText, Shield,
} from "lucide-react"
import { getPaymentHistory } from "@/lib/paymentApi"
import { getDealerKyc } from "@/lib/dealerApi"
import { formatPrice } from "@/lib/listingApi"

const TYPE_LABELS: Record<string, string> = {
    DEPOSIT: 'Deposit',
    FULL_PAYMENT: 'Full Payment',
    COMMISSION: 'Commission',
    REFUND: 'Refund',
    HPI_REPORT: 'HPI Report',
    LISTING_FEE: 'Listing Fee',
    BOOST: 'Featured Boost',
    KYC_VERIFICATION: 'KYC Verification',
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Paid' },
    PENDING: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
    FAILED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Failed' },
    REFUNDED: { icon: Receipt, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Refunded' },
}

interface ReceiptEntry {
    id: string
    type: string
    amount: number
    status: string
    date: string
    description: string | null
    stripePaymentId: string | null
    vehicle?: { title: string; image?: string; make: string | null; model: string | null; year: number | null }
}

function printReceipt(receipt: ReceiptEntry, receiptNum: number) {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>CarMazium Receipt #${receiptNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; padding: 48px; max-width: 640px; margin: 0 auto; color: #111; }
  h1 { font-size: 22px; letter-spacing: 4px; margin-bottom: 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 32px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; font-size: 14px; }
  td:last-child { text-align: right; }
  .total td { font-weight: bold; font-size: 16px; padding-top: 16px; }
  .footer { margin-top: 40px; color: #888; font-size: 11px; line-height: 1.6; }
  @media print { body { padding: 24px; } }
</style></head><body>
<h1>CARMAZIUM</h1>
<p class="sub">UK's Trusted Car Marketplace — carmazium.vercel.app</p>
<hr/>
<p style="font-size:13px;margin-bottom:4px"><strong>RECEIPT #${receiptNum}</strong></p>
<p style="font-size:12px;color:#555">${new Date(receipt.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
<hr/>
<table>
  <tr><td>Transaction Type</td><td>${TYPE_LABELS[receipt.type] || receipt.type}</td></tr>
  ${receipt.vehicle ? `<tr><td>Vehicle</td><td>${receipt.vehicle.title}</td></tr>` : ''}
  ${receipt.description ? `<tr><td>Description</td><td>${receipt.description}</td></tr>` : ''}
  <tr><td>Status</td><td>${receipt.status}</td></tr>
  ${receipt.stripePaymentId ? `<tr><td>Payment Reference</td><td style="font-size:11px">${receipt.stripePaymentId}</td></tr>` : ''}
</table>
<hr/>
<table>
  <tr class="total"><td>Amount Paid (inc. VAT)</td><td>£${Number(receipt.amount).toFixed(2)}</td></tr>
</table>
<div class="footer">
  <p>This receipt confirms your payment to CarMazium. For support, contact us at support@carmazium.com.</p>
  <p style="margin-top:8px">VAT may apply. Prices shown are in GBP (£).</p>
</div>
</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
}

export function ReceiptsTab({ isDealer = false }: { isDealer?: boolean }) {
    const [receipts, setReceipts] = React.useState<ReceiptEntry[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function load() {
            try {
                const [txns, kycData] = await Promise.all([
                    getPaymentHistory().catch(() => []),
                    isDealer ? getDealerKyc().catch(() => null) : Promise.resolve(null),
                ])

                const entries: ReceiptEntry[] = txns.map(t => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    status: t.status,
                    date: t.createdAt,
                    description: t.description,
                    stripePaymentId: t.stripePaymentId,
                    vehicle: t.listing ? {
                        title: t.listing.title,
                        image: t.listing.images?.[0],
                        make: t.listing.make,
                        model: t.listing.model,
                        year: t.listing.year,
                    } : undefined,
                }))

                // Synthetic KYC receipt for dealers
                if (isDealer && kycData?.stripeChargedAt) {
                    entries.push({
                        id: kycData.stripePaymentIntentId || 'kyc-fee',
                        type: 'KYC_VERIFICATION',
                        amount: 1,
                        status: 'COMPLETED',
                        date: kycData.stripeChargedAt,
                        description: 'One-time dealer identity verification fee',
                        stripePaymentId: kycData.stripePaymentIntentId || null,
                    })
                }

                entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                setReceipts(entries)
            } catch {
                // silently handled per-call above
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isDealer])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        )
    }

    if (receipts.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 py-24 text-[var(--text-muted)]">
                <div className="w-20 h-20 bg-[var(--bg-card)] rounded-3xl flex items-center justify-center border border-[var(--border-default)]">
                    <Receipt size={36} className="opacity-20" />
                </div>
                <p className="font-bold text-lg">No receipts yet</p>
                <p className="text-sm opacity-60 max-w-xs text-center">
                    Your payment receipts will appear here as you make transactions on the platform.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3 p-6">
            {receipts.map((receipt, i) => {
                const receiptNum = receipts.length - i
                const status = STATUS_CONFIG[receipt.status] || STATUS_CONFIG.PENDING
                const StatusIcon = status.icon
                const isKyc = receipt.type === 'KYC_VERIFICATION'

                return (
                    <div
                        key={receipt.id}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border-default)] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                    >
                        {/* Receipt index */}
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary text-xs font-black">
                            #{receiptNum}
                        </div>

                        {/* Icon / vehicle thumbnail */}
                        {receipt.vehicle?.image ? (
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[var(--border-default)]">
                                <Image src={receipt.vehicle.image} alt="" fill className="object-cover" />
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
                                {isKyc
                                    ? <Shield size={22} className="text-blue-400" />
                                    : receipt.type === 'HPI_REPORT'
                                        ? <FileText size={22} className="text-amber-400" />
                                        : <Car size={22} className="text-[var(--text-muted)]" />
                                }
                            </div>
                        )}

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                    {TYPE_LABELS[receipt.type] || receipt.type}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                                    <StatusIcon size={9} /> {status.label}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-white truncate">
                                {receipt.vehicle?.title || receipt.description || TYPE_LABELS[receipt.type]}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{new Date(receipt.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span className="text-gray-700">·</span>
                                <span>{new Date(receipt.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                {receipt.stripePaymentId && (
                                    <>
                                        <span className="text-gray-700">·</span>
                                        <span className="font-mono opacity-60 text-xs">ref: ···{receipt.stripePaymentId.slice(-8)}</span>
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Amount + print */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <p className="text-lg font-black">{formatPrice(receipt.amount)}</p>
                            <button
                                onClick={() => printReceipt(receipt, receiptNum)}
                                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-primary transition-colors"
                            >
                                <Download size={10} /> Print receipt
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
