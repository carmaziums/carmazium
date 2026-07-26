import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

/** Static routes that should appear in the sitemap */
const STATIC_ROUTES = [
    "",
    "/search",
    "/sell",
    "/about",
    "/contact",
    "/finance",
    "/services",
    "/how-it-works",
    "/reviews",
    "/auctions",
    "/auctions/how-it-works",
    "/compare",
]

interface SitemapListing {
    slug: string
    updatedAt: string
}

async function getActiveListingSlugs(): Promise<SitemapListing[]> {
    try {
        const res = await fetch(`${API_BASE}/listings?limit=1000&sortBy=newest`, { next: { revalidate: 3600 } })
        if (!res.ok) return []
        const json = await res.json()
        return (json.data ?? []) as SitemapListing[]
    } catch {
        // Build-time fetch failures shouldn't break the whole sitemap — fall back to static routes only.
        return []
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries = STATIC_ROUTES.map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
        priority: route === "" ? 1.0 : route === "/search" ? 0.9 : 0.7,
    }))

    const listings = await getActiveListingSlugs()
    const listingEntries = listings.map((l) => ({
        url: `${BASE_URL}/buy-cars/${l.slug}`,
        lastModified: l.updatedAt ? new Date(l.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    return [...staticEntries, ...listingEntries]
}
