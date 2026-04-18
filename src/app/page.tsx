/* ============================================================================
 * HOME PAGE — Server Component
 * ============================================================================
 * This is a thin Server Component wrapper that:
 * 1. Fetches featured listings at build/request time with ISR (revalidate: 300s)
 * 2. Passes pre-fetched data to the interactive HomeClient component
 *
 * Benefits over the previous "use client" approach:
 * - No client-side fetch waterfall (HTML → JS → API → Render)
 * - Featured listings data is embedded in the initial HTML response
 * - Improved TTFB: data is fetched on the server, closer to the API
 * - ISR: cached for 5 minutes, so most visitors get instant responses
 * ============================================================================ */

import { Suspense } from "react"
import HomeClient from "./HomeClient"
import { type Listing } from "@/lib/listingApi"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

/**
 * Server-side fetch for featured listings with ISR caching.
 * Revalidates every 5 minutes — a good balance between freshness
 * and performance for seller-boosted content.
 */
async function getFeaturedListings(): Promise<Listing[]> {
    try {
        const res = await fetch(`${API_URL}/listings/featured`, {
            next: { revalidate: 300 },
        })
        if (!res.ok) return []
        const data = await res.json()
        return data.data || []
    } catch {
        return []
    }
}

export default async function Home() {
    const featuredListings = await getFeaturedListings()

    return (
        <Suspense>
            <HomeClient initialListings={featuredListings} />
        </Suspense>
    )
}
