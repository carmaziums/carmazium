"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
    ArrowLeft, CarFront, ExternalLink, Loader2, LockKeyhole, Mail, MapPin, Phone, UserRound,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

interface PurchaseSellerDetails {
    saleId: string
    vehicleTitle: string
    vehicleLocation: string | null
    sellerName: string
    sellerCompany: string | null
    contactUnlocked: boolean
    sellerEmail: string | null
    sellerPhone: string | null
    sellerAddress: string | null
    sellerAddressSource: "BUSINESS" | "VERIFIED_POSTAL" | null
}

export default function PurchaseSellerDetailsPage() {
    const params = useParams<{ id: string }>()
    const { user, profile, loading: authLoading } = useAuth()
    const [details, setDetails] = React.useState<PurchaseSellerDetails | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (authLoading || !user || !params.id) return
        let cancelled = false
        setLoading(true)
        setError(null)
        apiClient<{ data: PurchaseSellerDetails }>(
            `/dealers/purchases/${encodeURIComponent(params.id)}/seller`,
        )
            .then((response) => {
                if (!cancelled) setDetails(response.data)
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message || "Unable to load seller details")
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [authLoading, params.id, user])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : (user?.email?.split("@")[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />
                <main className="flex-1 min-w-0 space-y-6">
                    <Link
                        href="/dashboard/dealer/purchases"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                    >
                        <ArrowLeft size={16} />
                        Back to All Purchases
                    </Link>

                    <PageHeader
                        title="Full Seller Details"
                        subHeader="Contact information for a vehicle you purchased"
                    />

                    {(loading || authLoading) && (
                        <div className="flex items-center gap-3 py-12 text-[var(--text-secondary)]">
                            <Loader2 size={22} className="animate-spin" />
                            Loading seller information...
                        </div>
                    )}
                    {!loading && error && (
                        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {!loading && !error && details && (
                        <div className="space-y-5 max-w-3xl">
                            <section className="dealer-glass-card p-5 md:p-7 space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <UserRound size={25} />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-black break-words">{details.sellerName}</h2>
                                        {details.sellerCompany && (
                                            <p className="text-sm text-[var(--text-secondary)]">{details.sellerCompany}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start rounded-xl bg-[var(--bg-input)] p-4 border border-[var(--border-default)]">
                                    <CarFront size={20} className="shrink-0 text-primary" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Purchased vehicle</p>
                                        <p className="font-semibold break-words">{details.vehicleTitle}</p>
                                        {details.vehicleLocation && (
                                            <p className="text-xs text-[var(--text-muted)] mt-1">Listed location: {details.vehicleLocation}</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {!details.contactUnlocked ? (
                                <div className="dealer-glass-card p-6 space-y-3 border border-amber-500/30" role="status">
                                    <div className="flex items-center gap-2 font-bold text-amber-500">
                                        <LockKeyhole size={20} />
                                        Seller contact details locked
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Auction seller contact details become available once the winning buyer fee is paid.
                                        Complete the payment from your auction purchase before arranging collection.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <section className="dealer-glass-card p-5 md:p-7 space-y-4">
                                        <h2 className="text-base font-black uppercase tracking-wide">Contact the seller</h2>
                                        <div className="grid gap-3">
                                            <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                                                <div className="flex gap-3 items-start">
                                                    <Phone className="text-primary shrink-0" size={19} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Phone number</p>
                                                        {details.sellerPhone ? (
                                                            <a
                                                                href={`tel:${details.sellerPhone.replace(/[^+\d]/g, "")}`}
                                                                className="block mt-1 text-sm font-semibold text-primary hover:underline break-all"
                                                            >
                                                                {details.sellerPhone}
                                                            </a>
                                                        ) : (
                                                            <p className="mt-1 text-sm text-[var(--text-secondary)]">Not provided</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                                                <div className="flex gap-3 items-start">
                                                    <Mail className="text-primary shrink-0" size={19} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Email address</p>
                                                        {details.sellerEmail ? (
                                                            <a
                                                                href={`mailto:${details.sellerEmail}`}
                                                                className="block mt-1 text-sm font-semibold text-primary hover:underline break-all"
                                                            >
                                                                {details.sellerEmail}
                                                            </a>
                                                        ) : (
                                                            <p className="mt-1 text-sm text-[var(--text-secondary)]">Not provided</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dealer-glass-card p-5 md:p-7 space-y-4">
                                        <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                                            <MapPin size={19} className="text-primary" />
                                            Seller address
                                        </h2>
                                        {details.sellerAddress ? (
                                            <>
                                                <p className="text-base font-semibold whitespace-pre-line break-words">
                                                    {details.sellerAddress}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    {details.sellerAddressSource === "BUSINESS"
                                                        ? "Business address on file"
                                                        : "Verified postal address on file"}
                                                </p>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.sellerAddress)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                                                >
                                                    View address on map <ExternalLink size={14} />
                                                </a>
                                            </>
                                        ) : (
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                No full seller address is currently on file. Contact the seller using
                                                the phone number or email above to arrange vehicle collection.
                                            </p>
                                        )}
                                        <p className="text-sm rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-[var(--text-secondary)]">
                                            The seller’s address on file is not necessarily where the vehicle is kept.
                                            Confirm the exact collection address, date and time directly with the seller
                                            before travelling. Do not hand over keys until payment has been confirmed.
                                        </p>
                                    </section>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
