"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, ClipboardCheck, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
  getHistoricalAuctionReconciliation,
  type HistoricalAuctionReconciliation,
  type HistoricalAuctionReviewReason,
} from "@/lib/adminApi"

const REASONS: Record<HistoricalAuctionReviewReason, string> = {
  CANCELLED_OR_UNWON_APPROVAL: "Bonus or handover was approved on a cancelled/unwon auction",
  SALE_MISMATCH: "Sale buyer or amount does not match the recorded winner",
  BUYER_FEE_NOT_VERIFIED: "No matching completed £125 fee or documented completed £0 admin waiver",
  BUYER_FEE_FLAG_MISMATCH: "A matching completed fee/waiver exists, but the auction flag disagrees",
  UNSAFE_MISSING_WIN_TIMESTAMP: "Missing win timestamp cannot be safely grandfathered",
}

export default function HistoricalAuctionReconciliationPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [audit, setAudit] = React.useState<HistoricalAuctionReconciliation | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAudit(await getHistoricalAuctionReconciliation())
    } catch (err: any) {
      setError(err?.message || "Could not retrieve the historical auction audit")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace("/auth/login"); return }
    if (profile?.role !== "ADMIN") { router.replace("/dashboard"); return }
    void load()
  }, [authLoading, user, profile?.role, load, router])

  if (authLoading || !user || !profile || profile.role !== "ADMIN") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>
  }

  const name = profile.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`
    : user.email?.split("@")[0] || "Admin"
  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={name} userType="Super Admin" />
        <main className="flex-1 min-w-0 space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
            <Link href="/dashboard/admin/handovers" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-primary">
              <ArrowLeft size={15}/> Back to handovers
            </Link>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black flex items-center gap-2">
                  <ShieldAlert className="text-amber-400" /> Historical auction reconciliation
                </h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Admin-only, read-only review of grandfathered wins and historical £125 fee, handover and £100 bonus inconsistencies.
                </p>
              </div>
              <button type="button" onClick={() => void load()} disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm font-bold disabled:opacity-50">
                <RefreshCw size={16} /> Refresh audit
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm">
            <p className="font-bold text-amber-300">Preserve financial history: no automatic corrections</p>
            <p className="mt-2 text-[var(--text-secondary)]">
              A payment-intent reference or a recorded manual £100 bonus does not prove the buyer paid the £125 fee.
              Verify the original Stripe merchant account, charge and refund history, and bank/payout evidence before proposing any record-specific financial adjustment.
              Do not backfill legacy win dates or repeat seller payments.
            </p>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
          {loading && <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="animate-spin" size={18}/> Loading historical evidence…</div>}

          {audit && !loading && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Preserved historic wins", count: audit.protectedLegacyWinCount, hint: "Matching sales; original wonAt remains empty" },
                  { label: "Needs financial review", count: audit.manualReviewCount, hint: "Do not change fee, refund or £100 payout records automatically" },
                  { label: "Other win-date anomalies", count: audit.legacyWinMismatchCount + audit.postFeatureMissingWinCount, hint: "Unmatched legacy or newer wins without timestamps" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-[var(--border-default)] p-4">
                    <p className="text-sm text-[var(--text-muted)]">{item.label}</p>
                    <p className="my-1 text-3xl font-black tabular-nums">{item.count}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.hint}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Snapshot {new Date(audit.generatedAt).toLocaleString("en-GB")}. Historic win and financial-review counts may overlap for the same auction.
              </p>
              <h2 className="text-lg font-black flex items-center gap-2"><ClipboardCheck size={20}/> Manual-review queue</h2>
              {audit.cases.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-default)] p-5 text-sm">No historical cases currently require manual investigation.</div>
              ) : (
                <div className="space-y-4">
                  {audit.cases.map(item => (
                    <article key={item.auctionId} className="rounded-2xl border border-amber-500/25 p-5 space-y-3">
                      <div className="flex flex-wrap gap-3 justify-between">
                        <div>
                          <h3 className="font-bold">{item.vehicleTitle}</h3>
                          <p className="text-xs text-[var(--text-muted)]">Auction {item.auctionId} · {new Date(item.auctionDate).toLocaleDateString("en-GB")} · {item.status}</p>
                        </div>
                        <span className="self-start rounded-lg border border-amber-500/25 px-2 py-1 text-xs text-amber-300">Manual investigation</span>
                      </div>
                      {item.reasons.map(reason => (
                        <p key={reason} className="flex items-start gap-2 text-sm text-amber-300"><AlertTriangle size={15} className="shrink-0 mt-0.5"/>{REASONS[reason]}</p>
                      ))}
                      {item.legacyWinProtected && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Matched legacy sale: retain the empty wonAt timestamp even while investigating the fee.
                        </p>
                      )}
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>Current winner: <strong>{item.hasWinner ? "Recorded" : "None"}</strong></div>
                        <div>Matching Sale: <strong>{item.saleMatchesWinningRecord ? "Yes" : "No"}</strong></div>
                        <div>Handover: <strong>{item.handoverSubmitted ? "Recorded" : "No"}</strong></div>
                        <div>£100 bonus approved: <strong>{item.sellerBonusApproved ? "Yes" : "No"}</strong></div>
                        <div>Manual £100 payment recorded: <strong>{item.manualSellerPayoutRecorded ? "Yes — verify before repeating" : "No"}</strong></div>
                        <div>Stripe seller transfer recorded: <strong>{item.stripeSellerTransferRecorded ? "Yes — verify settlement" : "No"}</strong></div>
                      </dl>
                      <div className="border-t border-[var(--border-default)] pt-3 text-xs space-y-2">
                        <p className="font-bold">£125 commission evidence (not proof of capture)</p>
                        {item.transactions.records.length === 0 ? (
                          <p className="text-[var(--text-muted)]">No non-deleted commission transaction records</p>
                        ) : item.transactions.records.map(tx => (
                          <p key={tx.id} className="break-all text-[var(--text-secondary)]">
                            {tx.status} · £{tx.amount} · {tx.matchesWinner ? "Winner account" : "Other/unknown account"} ·
                            {tx.hasStripeReference ? " Stripe reference exists (unverified)" : " No Stripe reference"} · {tx.id}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-default)] pt-3">
                        Review the correct payment-provider account and supporting bank documentation before requesting a separately guarded correction.
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
