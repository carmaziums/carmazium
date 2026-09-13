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

import type { Metadata } from "next"
import Link from "next/link"
import HomeClient from "./HomeClient"
import { type Listing } from "@/lib/listingApi"
import { type BlogPost } from "@/lib/blogApi"

export const metadata: Metadata = {
    title: {
        absolute: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
    },
    description:
        "Sell your car online in the UK with a free dealer auction or £1 retail listing, or browse used cars from verified sellers on CarMazium.",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
        description:
            "Sell your car through a free dealer auction or £1 retail listing, or browse used cars from verified sellers across the UK.",
        url: "/",
        type: "website",
    },
}

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

            <HomeClient initialListings={featuredListings} latestBlogPosts={latestBlogPosts} />

            {/*
             * Search-engine-readable homepage copy. This is intentionally rendered by the
             * server so crawlers receive useful marketplace context in the initial HTML.
             */}
            <section
                aria-labelledby="carmazium-uk-marketplace"
                className="border-t py-16 md:py-20"
                style={{ background: "var(--bg-body)", borderColor: "var(--border-default)" }}
            >
                <div className="container mx-auto px-5 max-w-5xl">
                    <h2 id="carmazium-uk-marketplace" className="text-3xl md:text-4xl font-bold font-heading mb-8">
                        Sell Your Car or Buy Used Cars in the UK
                    </h2>
                    <div className="space-y-5 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
                        <p>
                            CarMazium is a UK car marketplace designed to give drivers more choice when they want to sell a car or shop for a used vehicle. If you are looking to sell your car online, you can choose a free dealer auction and let verified dealers compete, or create a retail listing for £1 and advertise directly to buyers. The aim is to keep the process clear, flexible and easy to understand while giving sellers control over how their vehicle is offered.
                        </p>
                        <p>
                            For buyers, CarMazium brings together used cars for sale across the UK from verified sellers. You can browse retail listings, compare vehicles and use the available vehicle information to help narrow down the right car for your needs. CarMazium is a marketplace rather than the seller of every vehicle, so buyers and sellers deal directly with each other for the vehicle transaction. That makes it important to review the listing details, inspect the vehicle and complete the usual checks before purchase. For official guidance, see the <a href="https://www.gov.uk/checks-when-buying-a-used-car" className="font-semibold text-primary hover:underline">GOV.UK used-vehicle checks</a>.
                        </p>
                        <p>
                            CarMazium also supports dealer auctions for sellers who prefer competitive trade bidding. A seller can list a vehicle for auction free of charge, verified dealers can compete, and the winning dealer can arrange inspection and collection. Qualifying completed auction sales can also receive CarMazium&apos;s £100 seller incentive after the required handover confirmation. If you prefer to advertise to the public instead, the £1 retail listing gives you another route to market without forcing you into one selling method.
                        </p>
                        <p>
                            Whether you want to <Link href="/sell" className="font-semibold text-primary hover:underline">sell your car</Link>, compare car auction options or <Link href="/search" className="font-semibold text-primary hover:underline">browse used cars in the UK</Link>, CarMazium is built around a straightforward marketplace model. Explore current used cars for sale, <Link href="/how-it-works" className="font-semibold text-primary hover:underline">learn how the selling process works</Link>, or start a listing when you are ready.
                        </p>
                    </div>
                </div>
            </section>
        </>
    )
}
