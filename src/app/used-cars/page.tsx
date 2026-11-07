import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getRetailCatalogue, parseRetailPage, retailCataloguePath } from "@/lib/retailCatalogue"
import { retailVehicleName } from "@/components/seo/RetailVehicleJsonLd"
import { formatPrice } from "@/lib/listingApi"

type Props = { searchParams: Promise<{ page?: string | string[] }> }
const SITE = "https://www.carmazium.com"

async function catalogueFor({ searchParams }: Props) {
    const page = parseRetailPage((await searchParams).page)
    if (page === null) notFound()
    const catalogue = await getRetailCatalogue(page)
    if (catalogue.outOfRange) notFound()
    return { ...catalogue, page }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { page, total } = await catalogueFor(props)
    const title = `Used Cars for Sale — Retail Catalogue${page > 1 ? ` — Page ${page}` : ""}`
    const description = "Browse active retail vehicle adverts on CarMazium. Compare make, model, year, mileage, gearbox, price and location, then view the seller’s full listing."
    const url = SITE + retailCataloguePath(page)
    return {
        title, description, alternates: { canonical: url },
        robots: { index: total > 0, follow: true, googleBot: { index: total > 0, follow: true } },
        openGraph: { title, description, url, type: "website" },
    }
}

export default async function RetailCataloguePage(props: Props) {
    const { page, listings, totalPages } = await catalogueFor(props)
    const pages = Array.from(new Set([1, totalPages, ...Array.from({ length: 5 }, (_, i) => page + i - 2)]))
        .filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
    const schema = {
        "@context": "https://schema.org", "@type": "CollectionPage",
        url: SITE + retailCataloguePath(page), name: "Used cars for sale — retail catalogue",
        mainEntity: { "@type": "ItemList", itemListElement: listings.map((listing, i) => ({
            "@type": "ListItem", position: i + 1, name: retailVehicleName(listing),
            url: `${SITE}/buy-cars/${listing.slug}`,
        })) },
    }
    return <div className="container mx-auto max-w-6xl px-5 py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Used cars for sale{page > 1 ? ` — page ${page}` : ""}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[var(--text-secondary)]">Explore active retail adverts from dealers and private sellers. Open a listing for its photos, specifications and seller details.</p>
        <Link href="/search" className="mt-4 inline-block font-semibold text-primary underline">Filter cars by make, model, price and location</Link>
        {listings.length ? <ul className="my-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => <li key={listing.slug} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                <h2 className="text-lg font-bold"><Link href={`/buy-cars/${listing.slug}`} className="text-primary underline-offset-4 hover:underline">{retailVehicleName(listing)}</Link></h2>
                <p className="mt-3 font-semibold text-[var(--text-primary)]">{Number(listing.price) > 0 ? formatPrice(listing.price) : "Contact seller for price"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{[
                    typeof listing.mileage === "number" ? `${listing.mileage.toLocaleString("en-GB")} miles` : null,
                    listing.fuelType?.replace(/_/g, " "), listing.transmission?.replace(/_/g, " "), listing.location,
                ].filter(Boolean).join(" · ")}</p>
            </li>)}
        </ul> : <p className="my-8">No retail adverts are available on this page right now. Please check again soon.</p>}
        {totalPages > 1 && <nav aria-label="Retail catalogue pagination" className="mt-8 flex flex-wrap items-center gap-4">
            {page > 1 && <Link href={retailCataloguePath(page - 1)} className="text-primary underline">Previous</Link>}
            {pages.map(p => <Link key={p} href={retailCataloguePath(p)} aria-label={`Page ${p}`} aria-current={p === page ? "page" : undefined}
                className={`rounded border px-3 py-2 ${p === page ? "bg-primary text-white" : "text-primary"}`}>{p}</Link>)}
            {page < totalPages && <Link href={retailCataloguePath(page + 1)} className="text-primary underline">Next</Link>}
            <span className="text-sm text-[var(--text-secondary)]">Page {page} of {totalPages}</span>
        </nav>}
    </div>
}
