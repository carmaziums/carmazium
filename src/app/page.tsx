/* ============================================================================
 * HOME PAGE — Server Component
 * ============================================================================
 * This is a thin Server Component wrapper that:
 * 1. Fetches featured listings at build/request time with ISR (revalidate: 300s)
 * 2. Passes pre-fetched data to the interactive HomeClient component
 * ============================================================================ */

import type { Metadata } from "next"
import Link from "next/link"
import HomeClient from "./HomeClient"
import { type Listing } from "@/lib/listingApi"
import { type BlogPost, type BlogPostSummary } from "@/lib/blogApi"

const SOCIAL_IMAGE = "/assets/images/discover-hero.webp"

export const metadata: Metadata = {
    title: { absolute: "CarMazium | Sell Your Car or Buy Used Cars in the UK" },
    description: "Sell your car online in the UK with a free dealer auction or £1 retail listing, or browse used cars from verified sellers on CarMazium.",
    alternates: { canonical: "/" },
    openGraph: {
        title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
        description: "Sell your car through a free dealer auction or £1 retail listing, or browse used cars from verified sellers across the UK.",
        url: "/",
        type: "website",
        siteName: "CarMazium",
        images: [{ url: SOCIAL_IMAGE, alt: "CarMazium UK car marketplace" }],
    },
    twitter: {
        card: "summary_large_image",
        title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
        description: "Free dealer auctions, £1 retail listings and used cars from verified sellers across the UK.",
        images: [SOCIAL_IMAGE],
    },
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

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
        return posts.map(({ id, slug, title, excerpt, coverImage }) => ({ id, slug, title, excerpt, coverImage }))
    } catch (err) {
        console.error("Latest blog posts fetch failed during build:", err)
        return []
    }
}

async function getFeaturedListings(): Promise<Listing[]> {
    try {
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

            <section
                aria-labelledby="carmazium-uk-marketplace"
                className="border-t py-14 md:py-16"
                style={{ background: "var(--bg-body)", borderColor: "var(--border-default)" }}
            >
                <div className="container mx-auto px-5 max-w-6xl">
                    <div className="mx-auto mb-9 max-w-3xl text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">UK automotive marketplace</p>
                        <h2 id="carmazium-uk-marketplace" className="text-3xl md:text-4xl font-bold font-heading mb-4">
                            Buy, sell or auction a car your way
                        </h2>
                        <p className="text-base md:text-lg leading-7" style={{ color: "var(--text-muted)" }}>
                            CarMazium gives UK drivers two clear ways to sell and one place to browse used vehicles, compare cars and access automotive services.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                        <article className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="mb-3 text-lg font-bold font-heading">Sell by dealer auction</h3>
                            <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                                List a vehicle for auction free of charge and let verified motor traders compete. Qualifying completed auction sales can receive CarMazium&apos;s £100 seller incentive after the required handover confirmation.
                            </p>
                            <Link href="/sell" className="mt-5 inline-flex font-bold text-primary hover:underline">Start selling</Link>
                        </article>

                        <article className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="mb-3 text-lg font-bold font-heading">Advertise for £1</h3>
                            <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                                Prefer to sell directly to the public? Create a retail listing from £1 and give buyers the vehicle information they need to decide whether to enquire and inspect.
                            </p>
                            <Link href="/pricing" className="mt-5 inline-flex font-bold text-primary hover:underline">View pricing</Link>
                        </article>

                        <article className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                            <h3 className="mb-3 text-lg font-bold font-heading">Browse used cars</h3>
                            <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                                Search used cars from sellers across the UK, compare vehicles side by side and review listing details before arranging your own inspection and purchase checks.
                            </p>
                            <Link href="/search" className="mt-5 inline-flex font-bold text-primary hover:underline">Browse cars</Link>
                        </article>
                    </div>

                    <div className="mt-7 rounded-2xl border px-6 py-5 text-sm leading-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
                        <strong style={{ color: "var(--text-primary)" }}>How the marketplace works:</strong> CarMazium provides the platform and marketplace tools; the vehicle transaction is completed directly between buyer and seller. Review the listing, inspect the vehicle and complete the usual checks before purchase. See <a href="https://www.gov.uk/checks-when-buying-a-used-car" className="font-semibold text-primary hover:underline">GOV.UK used-vehicle checks</a> or <Link href="/how-it-works" className="font-semibold text-primary hover:underline">learn how CarMazium works</Link>.
                    </div>
                </div>
            </section>
        </>
    )
}
