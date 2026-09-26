/**
 * /seller/[id]/listings — all active listings for one public seller.
 *
 * Uses the public seller endpoint so the result set cannot accidentally include
 * another seller's stock or non-active listings.
 */
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
const PAGE_SIZE = 12

interface SellerData {
    user: {
        id: string
        firstName: string | null
        lastName: string | null
    }
}

interface SellerListing {
    id: string
    title: string
    slug: string
    price: number | string
    images: string[]
    make: string | null
    model: string | null
    year: number | null
    mileage: number | null
    fuelType: string | null
    bodyType: string | null
    location: string | null
    viewCount: number
    createdAt: string
}

interface SellerListingsResponse {
    data: SellerListing[]
    pagination?: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
    total?: number
    page?: number
    limit?: number
}

async function getSeller(userId: string): Promise<SellerData | null> {
    try {
        const response = await fetch(`${API_BASE}/sellers/${userId}`, {
            next: { revalidate: 60 },
        })
        if (response.status === 404) return null
        if (!response.ok) return null
        const body = await response.json()
        return body.data ?? null
    } catch {
        return null
    }
}

async function getSellerListings(userId: string, page: number): Promise<{
    data: SellerListing[]
    total: number
    page: number
    totalPages: number
}> {
    try {
        const response = await fetch(
            `${API_BASE}/sellers/${userId}/listings?page=${page}&limit=${PAGE_SIZE}`,
            { next: { revalidate: 60 } },
        )
        if (!response.ok) return { data: [], total: 0, page, totalPages: 1 }

        const body: SellerListingsResponse = await response.json()
        const total = body.pagination?.total ?? body.total ?? body.data?.length ?? 0
        const currentPage = body.pagination?.page ?? body.page ?? page
        const totalPages =
            body.pagination?.totalPages ??
            Math.max(1, Math.ceil(total / (body.pagination?.limit ?? body.limit ?? PAGE_SIZE)))

        return {
            data: body.data ?? [],
            total,
            page: currentPage,
            totalPages,
        }
    } catch {
        return { data: [], total: 0, page, totalPages: 1 }
    }
}

function sellerName(seller: SellerData) {
    return [seller.user.firstName, seller.user.lastName].filter(Boolean).join(" ") || "Seller"
}

function pageNumber(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value
    const parsed = Number.parseInt(raw || "1", 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function formatPrice(value: number | string) {
    const amount = typeof value === "number" ? value : Number.parseFloat(value)
    return Number.isFinite(amount)
        ? `£${amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
        : "Price unavailable"
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>
}): Promise<Metadata> {
    const { id } = await params
    const seller = await getSeller(id)
    if (!seller) return { title: "Seller Listings" }

    const name = sellerName(seller)
    return {
        title: `${name} — Cars for Sale`,
        description: `Browse all active CarMazium listings from ${name}.`,
        robots: { index: true, follow: true },
    }
}

export default async function SellerListingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ page?: string | string[] }>
}) {
    const { id } = await params
    const query = await searchParams
    const requestedPage = pageNumber(query.page)

    const [seller, listings] = await Promise.all([
        getSeller(id),
        getSellerListings(id, requestedPage),
    ])

    if (!seller) notFound()

    const name = sellerName(seller)
    const currentPage = Math.min(Math.max(listings.page, 1), Math.max(listings.totalPages, 1))

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                <Link
                    href={`/seller/${id}`}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                    <ArrowLeft size={16} />
                    Back to {name}&apos;s profile
                </Link>

                <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Seller inventory
                        </p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight">
                            {name}&apos;s Active Listings
                        </h1>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                        {listings.total} active {listings.total === 1 ? "listing" : "listings"}
                    </p>
                </div>

                {listings.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-16 text-center">
                        <p className="text-lg font-bold">No active listings</p>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                            This seller does not currently have any active vehicles for sale.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {listings.data.map((listing) => {
                            const image = listing.images?.[0] || "/placeholder-car.jpg"
                            return (
                                <Link
                                    key={listing.id}
                                    href={`/buy-cars/${listing.slug}`}
                                    className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] transition hover:border-primary/40 hover:shadow-lg"
                                >
                                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-input)]">
                                        <Image
                                            src={image}
                                            alt={listing.title}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                        />
                                    </div>
                                    <div className="p-4">
                                        <h2 className="line-clamp-2 text-base font-bold">{listing.title}</h2>
                                        <p className="mt-2 text-xl font-black text-primary">{formatPrice(listing.price)}</p>
                                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                                            {[listing.year, listing.mileage != null ? `${listing.mileage.toLocaleString("en-GB")} mi` : null, listing.location]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {listings.totalPages > 1 && (
                    <nav
                        className="mt-10 flex items-center justify-center gap-3"
                        aria-label="Seller listings pagination"
                    >
                        {currentPage > 1 ? (
                            <Link
                                href={`/seller/${id}/listings?page=${currentPage - 1}`}
                                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold hover:border-primary/40"
                            >
                                <ChevronLeft size={16} /> Previous
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold opacity-40">
                                <ChevronLeft size={16} /> Previous
                            </span>
                        )}

                        <span className="text-sm text-[var(--text-muted)]">
                            Page {currentPage} of {listings.totalPages}
                        </span>

                        {currentPage < listings.totalPages ? (
                            <Link
                                href={`/seller/${id}/listings?page=${currentPage + 1}`}
                                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold hover:border-primary/40"
                            >
                                Next <ChevronRight size={16} />
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold opacity-40">
                                Next <ChevronRight size={16} />
                            </span>
                        )}
                    </nav>
                )}
            </div>
        </main>
    )
}
