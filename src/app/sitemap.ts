import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"

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
]

export default function sitemap(): MetadataRoute.Sitemap {
    const staticEntries = STATIC_ROUTES.map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date(),
        changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
        priority: route === "" ? 1.0 : route === "/search" ? 0.9 : 0.7,
    }))

    // TODO: Fetch dynamic listing slugs from API at build time
    // const listings = await fetch(`${API_URL}/listings?limit=1000`).then(r => r.json())
    // const listingEntries = listings.map(l => ({
    //     url: `${BASE_URL}/buy-cars/${l.slug}`,
    //     lastModified: l.updatedAt,
    //     changeFrequency: "weekly",
    //     priority: 0.8,
    // }))

    return [...staticEntries]
}
