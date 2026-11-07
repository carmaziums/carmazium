import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { VehicleDetailsPageClient } from "./VehicleDetailsPageClient"
import { formatPrice } from "@/lib/listingApi"
import { VehicleViewTracker } from "@/components/analytics/VehicleViewTracker"
import { serverBackendFetch } from "@/lib/serverBackendFetch"
import { RetailVehicleJsonLd, retailDescription, retailTitle, indexableRetail } from "@/components/seo/RetailVehicleJsonLd"
import type { Listing } from "@/lib/listingApi"

const SITE_URL = "https://www.carmazium.com"

/**
 * Keep obvious seeded/test records out of search results while leaving the
 * listing itself fully accessible and unchanged inside the application.
 */

/**
 * Distinguish a confirmed missing vehicle from an upstream outage.
 * A backend-confirmed missing/deleted slug uses notFound() in Next.js;
 * streamed responses may still have HTTP 200 but carry robots noindex.
 * Do not turn timeouts or 5xx into a false absent-vehicle / noindex page.
 * The public listing endpoint can still return real SOLD/OFFER_ACCEPTED records;
 * their existing robots and UI states remain unchanged.
 */
async function getListingBySlug(slug: string) {
    const res = await serverBackendFetch(`/listings/${slug}`, { next: { revalidate: 60 } })
    if (res.status === 404 || res.status === 410) return { listing: null, missing: true } as const

    // Trade-only inventory remains restricted; preserve its existing noindex
    // fallback instead of exposing dealer details or masking a real timeout.
    if (res.status === 401 || res.status === 403) return { listing: null, missing: false } as const

    // Network errors, 5xx, and rate limits are temporary, not proof that
    // a vehicle was removed. Do not cache an empty 200/noindex vehicle page.
    if (!res.ok) throw new Error(`[retail] Listing lookup unavailable (HTTP ${res.status})`)
    const json = await res.json()
    if (!json?.data || typeof json.data !== "object" || Array.isArray(json.data)) {
        throw new Error("[retail] Malformed listing lookup payload")
    }
    return { listing: json.data, missing: false } as const
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const { listing, missing } = await getListingBySlug(slug)
    if (missing) notFound()

    if (!listing) {
        return { title: "Vehicle Not Found", robots: { index: false, follow: false } }
    }

    const description = retailDescription(listing as Listing)

    // The root layout's title template ("%s | CarMazium") applies automatically
    // to the <title> tag, but NOT to openGraph/twitter titles — those need the
    // brand suffix added explicitly.
    const title = listing.type === "AUCTION"
        ? `${listing.title} — ${listing.auction?.startingBid != null ? `Starting bid ${formatPrice(listing.auction.startingBid)}` : "Auction listing"}`
        : indexableRetail(listing as Listing) ? retailTitle(listing as Listing) : listing.title
    const socialTitle = `${title} | CarMazium`
    // Canonicalise direct UUID/legacy detail links to the published listing slug.
    const url = `${SITE_URL}/buy-cars/${listing.slug || slug}`
    const image = listing.images?.find((img: string) => img && !img.includes('example.com'))?.split('#')[0]

    // Only ACTIVE publicly offered retail vehicles belong in organic search.
    // SOLD and OFFER_ACCEPTED pages remain reachable by direct links for deal
    // history, but must not be advertised as cars for sale in Google. Auction
    // and private/draft listings also must not enter the retail index.
    const indexable = indexableRetail(listing as Listing)

    return {
        title,
        description,
        alternates: { canonical: url },
        robots: { index: indexable, follow: indexable },
        openGraph: {
            title: socialTitle,
            description,
            url,
            type: 'website',
            images: image ? [{ url: image }] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: socialTitle,
            description,
            images: image ? [image] : undefined,
        },
    }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    // Next.js dedupes this against the identical fetch already made in
    // generateMetadata() (same URL + revalidate options) — no extra network
    // round-trip. Passed down so the client component doesn't have to fetch
    // it again itself on mount (that used to mean an empty shell + a second,
    // uncached network hit before content ever appeared).
    const { listing: initialListing, missing } = await getListingBySlug(slug)
    if (missing) notFound()
    // Canonical auction detail is the real bidding room, never a retail offer page.
    if (initialListing?.type === "AUCTION" && initialListing.auction?.id) {
        permanentRedirect(`/auctions/live/${initialListing.auction.id}`)
    }
    return (
        <>
            {initialListing && (
                <>
                    <RetailVehicleJsonLd listing={initialListing as Listing} />
                    <VehicleViewTracker
                        id={initialListing.id}
                        title={initialListing.title}
                        make={initialListing.make}
                        model={initialListing.model}
                        year={initialListing.year}
                        price={initialListing.price}
                        listingType={initialListing.listingType}
                    />
                </>
            )}
            <VehicleDetailsPageClient params={params} initialListing={initialListing} />
        </>
    )
}
