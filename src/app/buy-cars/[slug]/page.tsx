import type { Metadata } from "next"
import { VehicleDetailsPageClient } from "./VehicleDetailsPageClient"
import { formatPrice } from "@/lib/listingApi"
import { VehicleViewTracker } from "@/components/analytics/VehicleViewTracker"
import { serverBackendFetch } from "@/lib/serverBackendFetch"

const SITE_URL = "https://www.carmazium.com"

/**
 * Keep obvious seeded/test records out of search results while leaving the
 * listing itself fully accessible and unchanged inside the application.
 */
function isLikelyTestListingSlug(slug: string): boolean {
    return /(^|-)(undefined|test\d*|aaa|qqq|www)(-|$)/i.test(slug)
}

async function getListingBySlug(slug: string) {
    try {
        const res = await serverBackendFetch(`/listings/${slug}`, { next: { revalidate: 60 } })
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? null
    } catch {
        return null
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const listing = await getListingBySlug(slug)

    if (!listing) {
        return { title: "Vehicle Not Found", robots: { index: false, follow: false } }
    }

    const specs = [listing.year, listing.mileage ? `${Number(listing.mileage).toLocaleString('en-GB')} miles` : null, listing.fuelType, listing.transmission]
        .filter(Boolean)
        .join(' · ')
    const description = listing.description
        ? `${listing.description.slice(0, 155).trim()}${listing.description.length > 155 ? '…' : ''}`
        : `${listing.title} — ${specs}. ${formatPrice(listing.price)} in ${listing.location || 'the UK'}. Vehicle listing on CarMazium.`

    // The root layout's title template ("%s | CarMazium") applies automatically
    // to the <title> tag, but NOT to openGraph/twitter titles — those need the
    // brand suffix added explicitly.
    const title = `${listing.title} — ${formatPrice(listing.price)}`
    const socialTitle = `${title} | CarMazium`
    // Canonicalise direct UUID/legacy detail links to the published listing slug.
    const url = `${SITE_URL}/buy-cars/${listing.slug || slug}`
    const image = listing.images?.find((img: string) => !img.includes('example.com'))

    // Only ACTIVE publicly offered retail vehicles belong in organic search.
    // SOLD and OFFER_ACCEPTED pages remain reachable by direct links for deal
    // history, but must not be advertised as cars for sale in Google. Auction
    // and private/draft listings also must not enter the retail index.
    const indexable =
        listing.type === 'CLASSIFIED' &&
        listing.status === 'ACTIVE' &&
        !isLikelyTestListingSlug(listing.slug || slug)

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
    const initialListing = await getListingBySlug(slug)
    return (
        <>
            {initialListing && (
                <>
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
