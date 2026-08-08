import type { Metadata } from "next"
import { VehicleDetailsPageClient } from "./VehicleDetailsPageClient"
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
        : `${listing.title} — ${specs}. ${formatPrice(listing.price)} in ${listing.location || 'the UK'}. Verified listing on CarMazium.`

    // The root layout's title template ("%s | CarMazium") applies automatically
    // to the <title> tag, but NOT to openGraph/twitter titles — those need the
    // brand suffix added explicitly.
    const title = `${listing.title} — ${formatPrice(listing.price)}`
    const socialTitle = `${title} | CarMazium`
    const url = `${SITE_URL}/buy-cars/${slug}`
    const image = listing.images?.find((img: string) => !img.includes('example.com'))

    // Only ACTIVE (and post-sale OFFER_ACCEPTED/SOLD, which keep the URL alive for
    // record-keeping) listings should be indexed — draft/pending/rejected ones
    // aren't meant to be public yet.
    const indexable = ['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'].includes(listing.status)

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
    return <VehicleDetailsPageClient params={params} initialListing={initialListing} />
}
