"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft, Gavel, Car, Loader2, CheckCircle2,
    AlertTriangle, Info, Calendar, PoundSterling, TrendingUp, Zap,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuth } from "@/context/AuthContext"
import { alsoAuction } from "@/lib/listingApi"
import { apiClient } from "@/lib/apiClient"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minDatetimeLocal(): string {
    const d = new Date(Date.now() + 60 * 60 * 1000) // at least 1h from now
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PutOnAuctionPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const listingId = searchParams.get("listingId")
    const { user, profile, loading: authLoading } = useAuth()

    const [listing, setListing] = React.useState<any | null>(null)
    const [fetchError, setFetchError] = React.useState<string | null>(null)
    const [fetchLoading, setFetchLoading] = React.useState(true)

    // Form state
    const [startTime, setStartTime] = React.useState("")
    const [reserve, setReserve] = React.useState("")
    const [startBid, setStartBid] = React.useState("")
    const [increment, setIncrement] = React.useState("100")
    const [binPrice, setBinPrice] = React.useState("")

    const [submitting, setSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState(false)

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    // Fetch the listing
    React.useEffect(() => {
        if (authLoading || !user || !listingId) return
        setFetchLoading(true)
        apiClient<{ data: any }>(`/listings/${listingId}`)
            .then(res => setListing(res?.data ?? null))
            .catch(() => setFetchError("Could not load vehicle details. Please go back and try again."))
            .finally(() => setFetchLoading(false))
    }, [authLoading, user, listingId])

    // Guard: wrong listing type or already linked
    const canAuction = listing && listing.type === "CLASSIFIED" && listing.status === "ACTIVE" && !listing.linkedListingId

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!listingId || !startTime || !reserve || !startBid) return
        setSubmitting(true)
        setSubmitError(null)
        try {
            await alsoAuction(listingId, {
                startTime: new Date(startTime).toISOString(),
                reservePrice: parseFloat(reserve),
                startingBid: parseFloat(startBid),
                minIncrement: parseFloat(increment) || 100,
                ...(binPrice ? { buyItNowPrice: parseFloat(binPrice) } : {}),
            })
            setSuccess(true)
            setTimeout(() => router.push("/dashboard/dealer/inventory"), 2500)
        } catch (err: any) {
            setSubmitError(err?.message ?? "Failed to schedule auction. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0 max-w-2xl">
                    {/* Back */}
                    <Link
                        href="/dashboard/dealer/inventory"
                        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                        <ArrowLeft size={15} /> Back to Inventory
                    </Link>

                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Gavel size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-tight">Put on Auction</h1>
                            <p className="text-xs text-[var(--text-muted)]">Schedule a live auction for your vehicle</p>
                        </div>
                    </div>

                    {/* Loading / error states */}
                    {fetchLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        </div>
                    )}

                    {fetchError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <AlertTriangle size={16} className="text-red-400 shrink-0" />
                            <p className="text-red-300 text-sm">{fetchError}</p>
                        </div>
                    )}

                    {!fetchLoading && listing && !canAuction && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                            <p className="text-amber-300 text-sm">
                                This vehicle is not eligible for auction. It must be an active retail listing with no existing auction.
                            </p>
                        </div>
                    )}

                    {!fetchLoading && listing && canAuction && (
                        <>
                            {/* Vehicle summary card */}
                            <div className="dealer-glass-card p-5 flex gap-4 items-center">
                                <div className="w-24 h-16 bg-black/40 rounded-xl overflow-hidden border border-[var(--border-default)] shrink-0">
                                    {listing.images?.[0] ? (
                                        <img src={listing.images[0]} alt="" className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                                            <Car size={20} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-white text-base truncate">{listing.title}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 py-0.5 bg-[var(--bg-card)] rounded border border-[var(--border-default)]">{listing.vrm || "PRIVATE"}</span>
                                        <span className="text-xs font-bold text-primary italic uppercase tracking-widest">{listing.make}</span>
                                        {listing.mileage && <span className="text-xs text-gray-600 font-bold">• {listing.mileage.toLocaleString()} mi</span>}
                                        {listing.year && <span className="text-xs text-gray-600 font-bold">• {listing.year}</span>}
                                    </div>
                                    <p className="text-sm font-black text-white mt-1">
                                        Retail price: £{listing.price?.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Info banner */}
                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-3">
                                <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs text-[var(--text-muted)] leading-relaxed">
                                    <p>The auction runs for <strong className="text-[var(--text-primary)]">24 hours</strong> from the start time you set.</p>
                                    <p>Your <strong className="text-[var(--text-primary)]">retail listing stays active</strong> simultaneously — it can sell via either channel.</p>
                                    <p>If the reserve price is not met, the vehicle returns to retail-only listing.</p>
                                </div>
                            </div>

                            {/* Success state */}
                            {success ? (
                                <div className="dealer-glass-card p-8 flex flex-col items-center gap-3 text-center">
                                    <CheckCircle2 size={36} className="text-emerald-400" />
                                    <p className="text-emerald-300 font-black text-lg">Auction Scheduled!</p>
                                    <p className="text-[var(--text-muted)] text-sm">Your retail listing remains active. Returning to inventory…</p>
                                </div>
                            ) : (
                                /* Form */
                                <form onSubmit={handleSubmit} className="dealer-glass-card p-6 space-y-5">
                                    <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-default)] pb-3">
                                        Auction Configuration
                                    </p>

                                    {/* Start time */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                                            <Calendar size={11} /> Auction Start Time
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            min={minDatetimeLocal()}
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            required
                                            className="bg-[var(--bg-input)] border-[var(--border-default)] h-11"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">Must be at least 1 hour from now. Auction ends 24 hours after start.</p>
                                    </div>

                                    {/* Reserve + Starting bid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                                                <PoundSterling size={11} /> Reserve Price
                                            </label>
                                            <Input
                                                type="number"
                                                min="1"
                                                step="any"
                                                placeholder="e.g. 15000"
                                                value={reserve}
                                                onChange={e => setReserve(e.target.value)}
                                                required
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-11"
                                            />
                                            <p className="text-xs text-gray-600 mt-1">Minimum you'll accept.</p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                                                <TrendingUp size={11} /> Starting Bid
                                            </label>
                                            <Input
                                                type="number"
                                                min="1"
                                                step="any"
                                                placeholder="e.g. 10000"
                                                value={startBid}
                                                onChange={e => setStartBid(e.target.value)}
                                                required
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-11"
                                            />
                                            <p className="text-xs text-gray-600 mt-1">Opening bid amount.</p>
                                        </div>
                                    </div>

                                    {/* Increment */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                                            <TrendingUp size={11} /> Min Bid Increment (£)
                                        </label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="any"
                                            placeholder="100"
                                            value={increment}
                                            onChange={e => setIncrement(e.target.value)}
                                            className="bg-[var(--bg-input)] border-[var(--border-default)] h-11"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">Each bid must exceed the previous by at least this amount.</p>
                                    </div>

                                    {/* BIN — optional */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                                            <Zap size={11} /> Buy It Now Price (£)
                                            <span className="normal-case text-gray-600 font-normal tracking-normal ml-1">— optional</span>
                                        </label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="any"
                                            placeholder="Leave blank to disable"
                                            value={binPrice}
                                            onChange={e => setBinPrice(e.target.value)}
                                            className="bg-[var(--bg-input)] border-[var(--border-default)] h-11"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">Buyer can request an immediate purchase at this price.</p>
                                    </div>

                                    {submitError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                            <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                            <p className="text-red-300 text-xs">{submitError}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-1">
                                        <Link href="/dashboard/dealer/inventory" className="flex-1">
                                            <Button variant="outline" type="button" className="w-full border-[var(--border-default)] text-[var(--text-muted)] hover:text-white h-11">
                                                Cancel
                                            </Button>
                                        </Link>
                                        <Button
                                            type="submit"
                                            disabled={submitting || !startTime || !reserve || !startBid}
                                            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 disabled:opacity-50"
                                        >
                                            {submitting
                                                ? <><Loader2 size={15} className="animate-spin" /> Scheduling…</>
                                                : <><Gavel size={15} /> Schedule Auction</>
                                            }
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
