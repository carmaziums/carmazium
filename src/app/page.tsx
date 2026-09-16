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
import { type BlogPost, type BlogPostSummary } from "@/lib/blogApi"

const SOCIAL_IMAGE = "/assets/images/discover-hero.webp"

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
        siteName: "CarMazium",
        images: [
            {
                url: SOCIAL_IMAGE,
                alt: "CarMazium UK car marketplace",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
        description:
            "Free dealer auctions, £1 retail listings and used cars from verified sellers across the UK.",
        images: [SOCIAL_IMAGE],
    },
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

/**
 * Server-side fetch for the latest published blog posts, shown on the
 * homepage's "Automotive Insights" section. Same ISR pattern as featured
 * listings above.
 *
 * The public blog endpoint returns full article bodies. The homepage only
 * needs card data, so deliberately project each article down to a compact
 * summary before it crosses the Server → Client boundary. This keeps large
 * article bodies out of the homepage HTML/RSC payload without changing the
 * blog cards or article pages themselves.
 */
async function getLatestBlogPosts(): Promise<BlogPostSummary[]> {
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
        const posts: BlogPost[] = data.data || []

        return posts.map(({ id, slug, title, excerpt, coverImage }) => ({
            id,
            slug,
            title,
            excerpt,
            coverImage,
        }))
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
             *
             * The hero H1 and its supporting copy are important LCP/search content. Framer
             * Motion's server-rendered initial state otherwise emits them at opacity:0 until
             * hydration. Keep those text nodes visible from the first paint; interactive
             * controls and all marketplace behaviour remain unchanged.
             */}
            <style>{`
                main .animate-page-in > div > section:first-of-type > div.relative.z-10 > h1,
                main .animate-page-in > div > section:first-of-type > div.relative.z-10 > p {
                    opacity: 1 !important;
                    transform: none !important;
                    filter: none !important;
                }

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

            {/* Search-engine-readable marketplace context, structured for human scanning. */}
            <section
                aria-labelledby="carmazium-uk-marketplace"
                className="border-t py-14 md:py-18"
                style={{ background: "var(--bg-body)", borderColor: "var(--border-default)" }}
            >
                <div className="container mx-auto max-w-6xl px-5">
                    <div className="mx-auto mb-9 max-w-3xl text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">UK vehicle marketplace</p>
                        <h2 id="carmazium-uk-marketplace" className="text-3xl font-black tracking-tight md:text-4xl">
                            Sell Your Car or Buy Used Cars in the UK
                        </h2>
                        <p className="mt-4 leading-7" style={{ color: "var(--text-muted)" }}>
                            Choose the route that suits the transaction, then use the relevant CarMazium tools without wading through repeated marketing copy.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <article className="rounded-2xl border p-6 md:p-7" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="text-lg font-bold">Two clear ways to sell</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                                CarMazium gives UK drivers a choice when they want to sell a car online: use a free dealer auction and let verified dealers compete, or create a retail listing for £1 and advertise directly to buyers. Sellers stay in control of how the vehicle is offered, with a straightforward route into each option.
                            </p>
                            <Link href="/sell" className="mt-5 inline-flex rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                Sell your car
                            </Link>
                        </article>

                        <article className="rounded-2xl border p-6 md:p-7" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="text-lg font-bold">Browse and compare used cars</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                                Buyers can browse used cars for sale across the UK from verified sellers and compare live listings before narrowing down a choice. CarMazium is a marketplace rather than the seller of every vehicle, so buyers should review the listing, inspect the car and complete the usual checks before purchase. See the <a href="https://www.gov.uk/checks-when-buying-a-used-car" className="font-semibold text-primary underline-offset-4 hover:underline">GOV.UK used-vehicle checks</a> for official guidance.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                                <Link href="/search" className="rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Browse used cars</Link>
                                <Link href="/compare" className="rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Compare vehicles</Link>
                            </div>
                        </article>

                        <article className="rounded-2xl border p-6 md:p-7" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="text-lg font-bold">Competitive dealer auctions</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                                Sellers who prefer trade bidding can list a vehicle for auction free of charge and let verified dealers compete. The winning dealer can arrange inspection and collection. Qualifying completed auction sales can also receive CarMazium&apos;s £100 seller incentive after the required handover confirmation.
                            </p>
                            <Link href="/how-it-works" className="mt-5 inline-flex rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                How selling works
                            </Link>
                        </article>

                        <article className="rounded-2xl border p-6 md:p-7" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="text-lg font-bold">One marketplace model</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                                Whether you want to sell your car, compare auction options or browse used cars in the UK, CarMazium is built around direct marketplace transactions with dedicated buying, selling and automotive-service entry points. Vehicle purchase funds are handled between buyer and seller rather than being held by CarMazium.
                            </p>
                            <Link href="/services" className="mt-5 inline-flex rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                Explore TradeXchange services
                            </Link>
                        </article>
                    </div>
                </div>
            </section>
        </>
    )
}
