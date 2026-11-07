import Link from "next/link"
import { indexableRetail } from "@/components/seo/RetailVehicleJsonLd"
import { serverBackendFetch } from "@/lib/serverBackendFetch"
import type { Listing } from "@/lib/listingApi"

// This section is rendered on the server, independently of the interactive
// search filters. Only public ACTIVE retail listings may be linked.
// The API returns full listing records: 40 per page remains under the
// measured 2 MB Next.js cache ceiling (see issue #723).
const MAX_DISCOVERY_LINKS = 24

type PublicRetailLink = { slug: string; title: string }

async function getCrawlableRetailLinks(): Promise<PublicRetailLink[]> {
    try {
        const response = await serverBackendFetch(
            "/listings?page=1&limit=40&sortBy=newest",
            { next: { revalidate: 300 } },
            { timeoutMs: 6_000, retries: 1 },
        )
        if (!response.ok) return []
        const payload = await response.json()
        if (!Array.isArray(payload?.data)) return []

        const seen = new Set<string>()
        return (payload.data as Listing[]).filter((listing) => {
            if (!listing || !indexableRetail(listing)) return false
            if (typeof listing.slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,190}$/i.test(listing.slug)) return false
            if (typeof listing.title !== "string" || !listing.title.trim()) return false
            if (!Number.isFinite(Number(listing.price)) || Number(listing.price) <= 0) return false
            if (seen.has(listing.slug)) return false
            seen.add(listing.slug)
            return true
        }).slice(0, MAX_DISCOVERY_LINKS).map((listing) => ({
            slug: listing.slug,
            title: listing.title.trim().slice(0, 140),
        }))
    } catch {
        // Preserve the normal search page during backend interruptions.
        return []
    }
}

export async function PublicRetailLinks() {
    const recentCars = await getCrawlableRetailLinks()

    return (
        <section
            aria-labelledby="recent-retail-inventory-heading"
            className="border-t border-[var(--border-default)] bg-[var(--bg-body)] py-10 md:py-14"
        >
            <div className="container mx-auto max-w-6xl px-5">
                <h2
                    id="recent-retail-inventory-heading"
                    className="text-xl font-bold text-[var(--text-primary)] md:text-2xl"
                >
                    Recently added used cars
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                    Explore recently published retail adverts. To compare the full selection,
                    prices and vehicle specifications, use the search filters above.
                </p>
                {recentCars.length > 0 && (
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {recentCars.map((listing) => (
                            <li key={listing.slug}>
                                <Link
                                    href={"/buy-cars/" + listing.slug}
                                    className="block rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--text-primary)] hover:border-primary/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    {listing.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                    <Link href="/used-cars" className="font-semibold text-primary underline-offset-4 hover:underline">Browse all active retail cars</Link>
                    {" · "}
                    Looking for a different style of car?{" "}
                    <Link href="/used-car-types" className="font-semibold text-primary underline-offset-4 hover:underline">
                        Compare used-car body types
                    </Link>
                    .
                </p>
            </div>
        </section>
    )
}
