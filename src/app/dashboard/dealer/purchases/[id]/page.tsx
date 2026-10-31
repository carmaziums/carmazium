"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
    ArrowLeft, BadgeCheck, Calendar, CarFront, ChevronRight, ClipboardList,
    FileText, Loader2, LockKeyhole, Mail, MapPin, MoreHorizontal,
    Phone, ShieldCheck, Truck, UserRound, Wallet, X,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { SaleCancellationModal } from "@/components/sales/SaleCancellationModal"
import { useAuth } from "@/context/AuthContext"
import { useDealerAccess } from "@/context/DealerAccessContext"
import { apiClient } from "@/lib/apiClient"
import { PurchaseVehicleRecord } from "@/components/dealer/PurchaseVehicleRecord"
import { PurchaseInspectionNotes } from "@/components/dealer/PurchaseInspectionNotes"
import { deliveryServiceEnabled } from "@/lib/featureFlags"
import {
    type DealerPurchaseDetail, type DealerPurchaseSeller,
    purchaseDeliveryHref, recordedPurchaseLabel,
} from "@/lib/dealerPurchaseDetail"

const formatGBP = (amount: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
}).format(amount)

const formatDate = (value: string | null | undefined) => value
    ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Not yet recorded"

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-default)] py-3 last:border-0">
            <span className="text-sm text-[var(--text-muted)]">{label}</span>
            <span className="text-sm font-semibold text-right break-words max-w-full">{value}</span>
        </div>
    )
}

/**
 * One screen per recorded Sale. Data comes from a VIEW_PURCHASES-gated endpoint,
 * and seller PII is fetched *separately* from the existing fee-gated endpoint.
 * Never infer vehicle funds, document completion or a pickup address.
 */
export default function DealerPurchaseDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile, loading: authLoading } = useAuth()
    const { loading: accessLoading, hasPermission } = useDealerAccess()
    const [purchase, setPurchase] = React.useState<DealerPurchaseDetail | null>(null)
    const [seller, setSeller] = React.useState<DealerPurchaseSeller | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [sellerError, setSellerError] = React.useState(false)
    const [actionsOpen, setActionsOpen] = React.useState(false)
    const [cancelOpen, setCancelOpen] = React.useState(false)
    const summaryRef = React.useRef<HTMLElement>(null)
    const deliveryRef = React.useRef<HTMLElement>(null)

    React.useEffect(() => {
        if (authLoading || !user || !id) return
        let active = true
        setLoading(true)
        setError(null)
        setSellerError(false)
        Promise.allSettled([
            apiClient<{ data: DealerPurchaseDetail }>(
                `/dealers/purchases/${encodeURIComponent(id)}`, { cache: "no-store" }),
            apiClient<{ data: DealerPurchaseSeller }>(
                `/dealers/purchases/${encodeURIComponent(id)}/seller`, { cache: "no-store" }),
        ]).then(([purchaseResult, sellerResult]) => {
            if (!active) return
            if (purchaseResult.status === "fulfilled") {
                setPurchase(purchaseResult.value.data)
            } else {
                setPurchase(null)
                setError(purchaseResult.reason instanceof Error
                    ? purchaseResult.reason.message : "Purchase not found or access denied.")
            }
            if (sellerResult.status === "fulfilled") setSeller(sellerResult.value.data)
            else { setSeller(null); setSellerError(true) }
        }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [authLoading, user?.id, id])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : user?.email?.split("@")[0] || "Dealer"
    const canArrange = !!purchase && (!purchase.buyerFee.required || purchase.buyerFee.settled)
        && deliveryServiceEnabled

    const chooseAction = (action: "summary" | "seller" | "delivery" | "adjustments") => {
        setActionsOpen(false)
        if (action === "seller") {
            window.location.assign(`/dashboard/dealer/purchases/${encodeURIComponent(id)}/seller`)
        } else if (action === "summary") {
            summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        } else if (action === "delivery") {
            deliveryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        } else {
            setCancelOpen(true)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-32">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />
                <main className="flex-1 min-w-0 space-y-6 max-w-5xl">
                    <div className="flex items-center justify-between gap-3">
                        <Link href="/dashboard/dealer/purchases"
                            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                            <ArrowLeft size={16} /> All Purchases
                        </Link>
                        <div className="relative">
                            <button type="button" aria-label="Purchase actions" aria-expanded={actionsOpen}
                                aria-haspopup="menu" onClick={() => setActionsOpen(v => !v)}
                                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                                <MoreHorizontal size={20} />
                            </button>
                            {actionsOpen && (
                                <div role="menu" aria-label="Purchase actions"
                                    className="absolute right-0 top-full mt-2 w-64 z-40 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-xl">
                                    {([
                                        ["summary", "Purchase summary"],
                                        ["seller", "Seller details"],
                                        ["delivery", "Delivery details"],
                                        ["adjustments", "Adjustments & cancellations"],
                                    ] as const).map(([action, label]) => (
                                        <button type="button" role="menuitem" key={action} onClick={() => chooseAction(action)}
                                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-[var(--bg-input)]">
                                            {label}<ChevronRight size={14} />
                                        </button>
                                    ))}
                                    <button type="button" onClick={() => setActionsOpen(false)}
                                        className="w-full border-t border-[var(--border-default)] px-4 py-2 text-left text-xs text-[var(--text-muted)]">
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <PageHeader title="Purchase details"
                        subHeader="Vehicle, seller, payment, documents and delivery in one place" />

                    {(loading || authLoading || accessLoading) && (
                        <p role="status" className="flex items-center gap-2 py-10 text-[var(--text-muted)]">
                            <Loader2 size={19} className="animate-spin" /> Loading your purchase…
                        </p>
                    )}
                    {!loading && error && (
                        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {!loading && !error && purchase && (
                        <>
                            <section ref={summaryRef} id="purchase-summary"
                                className="dealer-glass-card p-5 md:p-7 space-y-5 scroll-mt-24">
                                <div className="flex flex-col sm:flex-row gap-5">
                                    <div className="relative h-44 sm:h-40 w-full sm:w-56 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-input)]">
                                        {purchase.vehicle.imageUrl
                                            ? <Image src={purchase.vehicle.imageUrl} alt={purchase.vehicle.title}
                                                fill sizes="(max-width: 640px) 100vw, 224px" className="object-cover" />
                                            : <span className="flex h-full items-center justify-center"><CarFront size={30} /></span>}
                                    </div>
                                    <div className="min-w-0 space-y-3">
                                        <span className="inline-flex gap-2 items-center rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                                            <BadgeCheck size={15} /> {recordedPurchaseLabel(purchase)}
                                        </span>
                                        <h2 className="text-xl md:text-2xl font-black break-words">{purchase.vehicle.title}</h2>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            {[purchase.vehicle.year, purchase.vehicle.registration,
                                                purchase.vehicle.mileage != null
                                                    ? `${purchase.vehicle.mileage.toLocaleString("en-GB")} miles` : null,
                                            ].filter(Boolean).join(" · ")}
                                        </p>
                                        <p className="text-2xl font-black tabular-nums">{formatGBP(purchase.purchasePrice)}</p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            Purchased {formatDate(purchase.purchasedAt)} · Reference {purchase.id.slice(0, 8).toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                                <DetailRow label="Sale channel" value={purchase.channel === "RETAIL" ? "Retail listing" : "Auction"} />
                                <DetailRow label="Purchase stage" value={purchase.purchaseStatus.replace(/_/g, " ")} />
                                <DetailRow label="Listed vehicle location" value={purchase.vehicle.listedLocation || "Not provided"} />
                                {purchase.listingRecord && (
                                    <a href="#original-listing" className="inline-flex min-h-[44px] items-center text-sm font-bold text-primary hover:underline">
                                        View photos, description and declared damage
                                    </a>
                                )}
                                {purchase.inspectionNotesEnabled && (
                                    <a href="#inspection-notes" className="ml-4 inline-flex min-h-[44px] items-center text-sm font-bold text-primary hover:underline">
                                        Inspection notes
                                    </a>
                                )}
                            </section>

                            {purchase.listingRecord && (
                                <PurchaseVehicleRecord record={purchase.listingRecord} title={purchase.vehicle.title} purchasedAt={purchase.purchasedAt} />
                            )}

                            {purchase.inspectionNotesEnabled && <PurchaseInspectionNotes saleId={purchase.id} />}

                            <section className="dealer-glass-card p-5 md:p-7 space-y-3">
                                <h2 className="flex items-center gap-2 text-lg font-black"><UserRound size={20} className="text-primary" /> Seller details</h2>
                                {sellerError ? (
                                    <p className="text-sm text-amber-400">Seller details could not be loaded. Open the authorised seller page to retry.</p>
                                ) : seller ? (
                                    <>
                                        <DetailRow label="Seller" value={seller.sellerCompany || seller.sellerName} />
                                        {!seller.contactUnlocked ? (
                                            <p className="flex gap-2 items-start rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-400">
                                                <LockKeyhole size={18} className="shrink-0" />
                                                Auction seller contacts remain locked until the applicable buyer-fee checks are satisfied.
                                            </p>
                                        ) : (
                                            <>
                                                <DetailRow label="Phone" value={seller.sellerPhone
                                                    ? <a href={`tel:${seller.sellerPhone.replace(/[^+\d]/g, "")}`} className="text-primary">{seller.sellerPhone}</a>
                                                    : "Not provided"} />
                                                <DetailRow label="Email" value={seller.sellerEmail
                                                    ? <a href={`mailto:${seller.sellerEmail}`} className="text-primary break-all">{seller.sellerEmail}</a>
                                                    : "Not provided"} />
                                                <DetailRow label="Address on file" value={seller.sellerAddress || "Not available"} />
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    The address on file is not necessarily the collection address. Confirm collection directly with the seller.
                                                </p>
                                            </>
                                        )}
                                    </>
                                ) : null}
                                <Link href={`/dashboard/dealer/purchases/${encodeURIComponent(id)}/seller`}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                                    View full seller details <ChevronRight size={16} />
                                </Link>
                            </section>

                            <section className="dealer-glass-card p-5 md:p-7 space-y-3">
                                <h2 className="flex items-center gap-2 text-lg font-black"><Wallet size={20} className="text-primary" /> Payment and fees</h2>
                                <DetailRow label="Vehicle sale price" value={formatGBP(purchase.purchasePrice)} />
                                {purchase.auction?.winningBid != null && (
                                    <DetailRow label="Winning bid" value={formatGBP(purchase.auction.winningBid)} />
                                )}
                                {purchase.auction?.buyerFeeDeadlineAt && !purchase.buyerFee.settled && (
                                    <DetailRow label="Buyer fee due by" value={new Date(purchase.auction.buyerFeeDeadlineAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} />
                                )}
                                <DetailRow label="How vehicle funds move" value="Buyer pays seller directly; CarMazium does not hold vehicle proceeds" />
                                <DetailRow label="Seller confirms funds"
                                    value={purchase.payment.sellerFundsConfirmedAt
                                        ? `Confirmed ${formatDate(purchase.payment.sellerFundsConfirmedAt)}`
                                        : "Not confirmed in this record"} />
                                <DetailRow label="Auction buyer fee"
                                    value={!purchase.buyerFee.required ? "Not applicable — retail purchase"
                                        : purchase.buyerFee.settled ? "Settled"
                                            : "Not marked settled; checkout confirms any applicable grant"} />
                                {purchase.buyerFee.required && !purchase.buyerFee.settled
                                    && !accessLoading && hasPermission("PAY_AUCTION_FEE") && (
                                    <Link href={`/checkout?listing_id=${encodeURIComponent(purchase.listingId)}&mode=auction_fee`}
                                        className="text-sm font-bold text-primary hover:underline">
                                        Check auction fee payment options
                                    </Link>
                                )}
                            </section>

                            <section id="purchase-documents" className="dealer-glass-card p-5 md:p-7 space-y-3">
                                <h2 className="flex items-center gap-2 text-lg font-black"><FileText size={20} className="text-primary" /> Documents and handover</h2>
                                {purchase.channel === "RETAIL"
                                    ? <p className="text-sm text-[var(--text-secondary)]">
                                        No retail document upload or handover verification is recorded in this purchase.
                                        Request V5C and other documents directly from the seller; do not transfer keys before verifying funds.
                                      </p>
                                    : <>
                                        <DetailRow label="Handover proof submitted" value={formatDate(purchase.documents.handoverSubmittedAt)} />
                                        <DetailRow label="Handover proof review" value={purchase.documents.handoverRejectedAt
                                            ? "Rejected — replacement evidence may be needed"
                                            : purchase.documents.sellerBonusReleased ? "Seller reward released"
                                                : "Not marked approved"} />
                                        <p className="text-xs text-[var(--text-muted)]">
                                            A handover photo does not establish that the vehicle payment was received.
                                        </p>
                                      </>}
                            </section>

                            <section ref={deliveryRef} id="purchase-delivery"
                                className="dealer-glass-card p-5 md:p-7 space-y-3 scroll-mt-24">
                                <h2 className="flex items-center gap-2 text-lg font-black"><Truck size={20} className="text-primary" /> Delivery details</h2>
                                {purchase.delivery ? (
                                    <>
                                        <DetailRow label="TradeXchange job" value={purchase.delivery.status.replace(/_/g, " ")} />
                                        <DetailRow label="Job created" value={formatDate(purchase.delivery.createdAt)} />
                                        <DetailRow label="Requested date" value={formatDate(purchase.delivery.requestedFor)} />
                                        <Link href={`/services/jobs/${encodeURIComponent(purchase.delivery.jobId)}`}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                                            View delivery quotes and progress <ChevronRight size={16} />
                                        </Link>
                                    </>
                                ) : (
                                    <p className="text-sm text-[var(--text-muted)]">
                                        No TradeXchange delivery job is linked to this vehicle yet. You can post a job
                                        for approved transporters to quote. Posting a job does not book or charge for delivery.
                                    </p>
                                )}
                                {!canArrange && (
                                    <p className="text-xs text-amber-400">
                                        {!deliveryServiceEnabled ? "Delivery jobs are currently unavailable."
                                            : "Complete the applicable auction fee checks before arranging collection."}
                                    </p>
                                )}
                            </section>
                        </>
                    )}
                </main>
            </div>

            {purchase && (
                <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-default)] bg-[var(--bg-card)]/95 backdrop-blur-xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    <div className="mx-auto flex max-w-3xl gap-3">
                        <Link href={`/dashboard/dealer/purchases/${encodeURIComponent(id)}/seller`}
                            className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-2 text-xs sm:text-sm font-black">
                            <UserRound size={17} /> Seller&apos;s details
                        </Link>
                        {purchase.delivery ? (
                            // A delivery job already exists for this car: open it rather
                            // than starting a second job (matches the app).
                            <Link href={`/services/jobs/${encodeURIComponent(purchase.delivery.jobId)}`}
                                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-2 text-xs sm:text-sm font-black text-white">
                                <Truck size={17} /> View delivery
                            </Link>
                        ) : canArrange ? (
                            <Link href={purchaseDeliveryHref(purchase)}
                                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-2 text-xs sm:text-sm font-black text-white">
                                <Truck size={17} /> Book delivery
                            </Link>
                        ) : (
                            <button type="button" disabled
                                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary/40 px-2 text-xs sm:text-sm font-black text-white/75">
                                <Truck size={17} /> Book delivery
                            </button>
                        )}
                    </div>
                </div>
            )}
            {cancelOpen && purchase && (
                <SaleCancellationModal
                    listingId={purchase.listingId}
                    vehicleTitle={purchase.vehicle.title}
                    onClose={() => setCancelOpen(false)}
                    onCreated={() => setCancelOpen(false)}
                />
            )}
        </div>
    )
}
