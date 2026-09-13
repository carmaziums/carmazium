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
import { type BlogPost } from "@/lib/blogApi"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

/**
 * Server-side fetch for the latest published blog posts, shown on the
 * homepage's "Automotive Insights" section. Same ISR pattern as featured
 * listings above.
 */
async function getLatestBlogPosts(): Promise<BlogPost[]> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(`${API_URL}/blog?page=1&limit=3`, {
            next: { revalidate: 300 },
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) return []
        const data = await res.json()
        return data.data || []
    } catch (err) {
        console.error("Latest blog posts fetch failed during build:", err)
        return []
    }
}

/**
 * Server-side fetch for featured listings with ISR caching.
 * Revalidates every 5 minutes — a good balance between freshness
 * and performance for seller-boosted content.
 */
async function getFeaturedListings(): Promise<Listing[]> {
    try {
        // Add a 10s timeout to prevent Vercel build hangs if the backend is slow or down
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(`${API_URL}/listings/featured`, {
            next: { revalidate: 300 },
            signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (!res.ok) return []
        const data = await res.json()
        return data.data || []
    } catch (err) {
        console.error("Featured listings fetch failed during build:", err)
        return []
    }
}

export default async function Home() {
    const [featuredListings, latestBlogPosts] = await Promise.all([
        getFeaturedListings(),
        getLatestBlogPosts(),
    ])

    return (
        <>
            {/*
             * HomeClient intentionally shows only the three newest articles.
             * Its archive link is a desktop-only Tailwind control (`hidden sm:inline-flex`).
             * On phones, promote that same real /blog link into a full-width CTA so the
             * complete archive remains reachable without making the homepage excessively long.
             */}
            <style>{`
                @media (max-width: 639px) {
                    section:has(> div > a[href="/blog"].hidden) > div:first-child {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 1rem;
                        margin-bottom: 2rem;
                    }

                    section:has(> div > a[href="/blog"].hidden) > div:first-child > a[href="/blog"].hidden {
                        display: inline-flex !important;
                        width: 100%;
                        min-height: 48px;
                        align-items: center;
                        justify-content: center;
                        padding: 0.75rem 1rem;
                        border: 1px solid rgba(237, 28, 36, 0.35);
                        border-radius: 0.75rem;
                        background: rgba(237, 28, 36, 0.08);
                    }
                }
            `}</style>
            <Suspense>
                <HomeClient initialListings={featuredListings} latestBlogPosts={latestBlogPosts} />
            </Suspense>
        </>
    )
}
