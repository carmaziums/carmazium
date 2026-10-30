import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { VehicleDetailPageClient } from "./VehicleDetailPageClient"
import { formatPrice } from "@/lib/listingApi"
import { VehicleViewTracker } from "@/components/analytics/VehicleViewTracker"
import { serverBackendFetch } from "@/lib/serverBackendFetch"

// Legacy vehicle links must point to the same www canonical as /buy-cars and the sitemap.
const SITE_URL = "https://www.carmazium.com"

/** Keep legacy URLs available without converting temporary API outages to 404s. */
async function getListingBySlug(slug: string) {
    try {
        const res = await serverBackendFetch(`/listings/${slug}`, { next: { revalidate: 60 } })
        if (res.status === 404 || res.status === 410) return { listing: null, missing: true } as const
        if (!res.ok) return { listing: null, missing: false } as const
        const json = await res.json()
        return { listing: json.data ?? null, missing: false } as const
    } catch {
        return { listing: null, missing: false } as const
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
    const { listing, missing } = await getListingBySlug(id)
    if (missing) notFound()

    if (!listing) {
        return { title: "Vehicle Not Found", robots: { index: false, follow: false } }
    }

    // The requested param can be a UUID or old alias: canonicalise to the published slug.
    const canonicalUrl = listing.type === "CLASSIFIED"
        ? `${SITE_URL}/buy-cars/${listing.slug || id}`
        : `${SITE_URL}/vehicle/${id}`
    const title = `${listing.title} — ${formatPrice(listing.price)}`
    const description = listing.description
        ? `${listing.description.slice(0, 155).trim()}${listing.description.length > 155 ? '…' : ''}`
        : `${listing.title}. ${formatPrice(listing.price)} in ${listing.location || 'the UK'}. Vehicle listing on CarMazium.`

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
    const { listing: initialListing, missing } = await getListingBySlug(id)
    if (missing) notFound()
    // Trade-only auction vehicles keep their existing detail route and access logic.
    if (initialListing?.type === "CLASSIFIED") {
        permanentRedirect(`${SITE_URL}/buy-cars/${initialListing.slug || id}`)
    }
    return (
        <>
            {initialListing && (
                <VehicleViewTracker
                    id={initialListing.id}
                    title={initialListing.title}
                    make={initialListing.make}
                    model={initialListing.model}
                    year={initialListing.year}
                    price={initialListing.price}
                    listingType={initialListing.listingType}
                />
            )}
            <VehicleDetailPageClient params={params} initialListing={initialListing} />
        </>
    )
}
