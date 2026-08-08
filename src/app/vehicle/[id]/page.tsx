import type { Metadata } from "next"
import { VehicleDetailPageClient } from "./VehicleDetailPageClient"
import { formatPrice } from "@/lib/listingApi"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"

async function getListingBySlug(slug: string) {
    try {
        const res = await fetch(`${API_BASE}/listings/${slug}`, { next: { revalidate: 60 } })
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? null
    } catch {
        return null
    }
}

/**
 * `/vehicle/[id]` renders the exact same listing as `/buy-cars/[slug]` (both
 * resolve the param as a listing slug) — it's kept around because several
 * places in the app still link here. To avoid duplicate-content SEO issues,
 * this route points its canonical tag at the `/buy-cars/` URL and excludes
 * itself from indexing rather than competing with it for ranking.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const listing = await getListingBySlug(id)
    const canonicalUrl = `${SITE_URL}/buy-cars/${id}`

    if (!listing) {
        return { title: "Vehicle Not Found", robots: { index: false, follow: false } }
    }

    const title = `${listing.title} — ${formatPrice(listing.price)}`
    const description = listing.description
        ? `${listing.description.slice(0, 155).trim()}${listing.description.length > 155 ? '…' : ''}`
        : `${listing.title}. ${formatPrice(listing.price)} in ${listing.location || 'the UK'}. Verified listing on CarMazium.`

    return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        robots: { index: false, follow: true },
    }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    // Deduped against the identical fetch in generateMetadata() — no extra
    // network round-trip. Passed down so the client component skips its own
    // fetch-on-mount (which used to mean an empty shell + a second,
    // uncached network hit before content ever appeared).
    const initialListing = await getListingBySlug(id)
    return <VehicleDetailPageClient params={params} initialListing={initialListing} />
}
