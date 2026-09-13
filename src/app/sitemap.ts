import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.carmazium.com"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

/** Public, indexable routes that should appear in the sitemap. */
const STATIC_ROUTES = [
    "",
    "/search",
    "/sell",
    "/pricing",
    "/about",
    "/contact",
    "/finance",
    "/services",
    "/how-it-works",
    "/reviews",
    "/auctions",
    "/compare",
]

interface SitemapListing {
    slug: string
    updatedAt?: string | null
}

async function getActiveListingSlugs(): Promise<SitemapListing[]> {
    try {
        const res = await fetch(`${API_BASE}/listings?limit=1000&sortBy=newest`, { next: { revalidate: 3600 } })
        if (!res.ok) return []
        const json = await res.json()
        return (json.data ?? []) as SitemapListing[]
    } catch {
        // Build-time fetch failures shouldn't break the sitemap — fall back to static routes only.
        return []
    }
}

async function getPublishedBlogSlugs(): Promise<SitemapListing[]> {
    try {
        const res = await fetch(`${API_BASE}/blog?limit=1000`, { next: { revalidate: 3600 } })
        if (!res.ok) return []
        const json = await res.json()
        return (json.data ?? []) as SitemapListing[]
    } catch {
        return []
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries = STATIC_ROUTES.map((route) => ({
        url: `${BASE_URL}${route}`,
        changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
        priority: route === "" ? 1.0 : route === "/search" || route === "/sell" ? 0.9 : 0.7,
    }))

    const listings = await getActiveListingSlugs()
    const listingEntries = listings.map((listing) => ({
        url: `${BASE_URL}/buy-cars/${listing.slug}`,
        ...(listing.updatedAt ? { lastModified: new Date(listing.updatedAt) } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    const blogPosts = await getPublishedBlogSlugs()
    const blogEntries = blogPosts.map((post) => ({
        url: `${BASE_URL}/blog/${post.slug}`,
        ...(post.updatedAt ? { lastModified: new Date(post.updatedAt) } : {}),
        changeFrequency: "monthly" as const,
        priority: 0.6,
    }))

    return [
        ...staticEntries,
        { url: `${BASE_URL}/blog`, changeFrequency: "weekly" as const, priority: 0.7 },
        ...listingEntries,
        ...blogEntries,
    ]
}
