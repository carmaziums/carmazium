import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRetailCollections, collectionPath, type CollectionKind } from '@/lib/retailCollections'
import { getRetailCatalogue, parseRetailPage } from '@/lib/retailCatalogue'
import { retailVehicleName } from './RetailVehicleJsonLd'
import { formatPrice } from '@/lib/listingApi'

const SITE = 'https://www.carmazium.com'
export type CollectionProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string | string[] }> }
async function load(kind: CollectionKind, props: CollectionProps) {
    const { slug } = await props.params
    const page = parseRetailPage((await props.searchParams).page)
    if (page === null) notFound()
    const collections = await getRetailCollections()
    const collection = collections[kind].find(c => c.slug === slug)
    if (!collection) notFound()
    const catalogue = await getRetailCatalogue(page, kind === 'makes' ? collection.label : '', kind === 'locations' ? collection.label : '')
    if (catalogue.outOfRange) notFound()
    const title = kind === 'makes' ? `Used ${collection.label} cars for sale` : `Used cars for sale in ${collection.label}`
    return { ...catalogue, collection, collections, title, page }
}
export async function collectionMetadata(kind: CollectionKind, props: CollectionProps): Promise<Metadata> {
    const { title, page, total, collection } = await load(kind, props)
    const description = kind === 'makes' ? `Browse available used ${collection.label} cars on CarMazium. Compare prices, mileage and seller details, then enquire or call the seller.` : `Find used cars advertised in ${collection.label} on CarMazium. Compare available vehicles and contact the seller to confirm the collection location or discuss delivery.`
    return { title: `${title}${page > 1 ? ` — Page ${page}` : ''}`, description, alternates: { canonical: SITE + collectionPath(kind, collection.slug, page) }, robots: { index: total > 0, follow: true }, openGraph: { title, description, url: SITE + collectionPath(kind, collection.slug, page) } }
}
export async function RetailCollectionPage({ kind, ...props }: CollectionProps & { kind: CollectionKind }) {
    const { listings, total, totalPages, collection, collections, title, page } = await load(kind, props)
    const query = new URLSearchParams({ [kind === 'makes' ? 'make' : 'location']: collection.label, vehicleType: 'CAR' })
    const schema = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'CollectionPage', name: title, url: SITE + collectionPath(kind, collection.slug, page), mainEntity: { '@type': 'ItemList', itemListElement: listings.map((l, i) => ({ '@type': 'ListItem', position: (page - 1) * 40 + i + 1, url: `${SITE}/buy-cars/${l.slug}`, name: retailVehicleName(l) })) } },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Used cars', item: `${SITE}/used-cars` }, { '@type': 'ListItem', position: 2, name: collection.label, item: SITE + collectionPath(kind, collection.slug) }] },
    ] }
    return <main className="container mx-auto max-w-6xl px-5 py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
        <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/used-cars" className="text-primary underline">Used cars</Link> / {collection.label}</nav>
        <h1 className="text-3xl font-bold">{title}{page > 1 ? ` — page ${page}` : ''}</h1>
        <p className="mt-4 max-w-3xl text-[var(--text-secondary)]">{kind === 'makes' ? `Explore available ${collection.label} retail listings from dealers and private sellers. Compare the model, year, mileage and price, then open a vehicle for its full specifications and seller information.` : `Browse vehicles whose advertised location includes ${collection.label}. Confirm the exact viewing and collection location with the seller. Delivery and inspection options are available from individual vehicle pages.`}</p>
        <p className="mt-3 font-semibold">{total} {total === 1 ? 'vehicle' : 'vehicles'} currently advertised</p>
        <Link href={`/search?${query}`} className="mt-4 inline-block rounded-lg bg-primary px-5 py-3 font-bold text-white">Refine this search</Link>
        {listings.length ? <ul className="my-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(l => <li key={l.slug} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <h2 className="text-lg font-bold"><Link className="text-primary hover:underline" href={`/buy-cars/${l.slug}`}>{retailVehicleName(l)}</Link></h2>
            <p className="mt-3 font-bold">{Number(l.price) > 0 ? formatPrice(l.price) : 'Contact seller for price'}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{[typeof l.mileage === 'number' ? `${l.mileage.toLocaleString('en-GB')} miles` : '', l.fuelType?.replace(/_/g, ' '), l.transmission?.replace(/_/g, ' '), l.location].filter(Boolean).join(' · ')}</p>
        </li>)}</ul> : <div className="my-8 rounded-xl border border-[var(--border-default)] p-6"><h2 className="text-xl font-bold">No matching vehicles right now</h2><p className="mt-2">Stock changes as vehicles are listed and sold. You can browse all available cars or choose another make or location below.</p><Link href="/search" className="mt-3 inline-block text-primary underline">Browse all available vehicles</Link></div>}
        {totalPages > 1 && <nav aria-label="Vehicle collection pagination" className="my-7 flex flex-wrap items-center gap-4">{page > 1 && <Link href={collectionPath(kind, collection.slug, page - 1)} className="text-primary underline">Previous page</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link href={collectionPath(kind, collection.slug, page + 1)} className="text-primary underline">Next page</Link>}</nav>}
        <section className="mt-10"><h2 className="text-xl font-bold">{kind === 'makes' ? 'Explore other makes' : 'Explore other locations'}</h2><div className="mt-4 flex flex-wrap gap-3">{collections[kind].filter(c => c.count > 0 && c.slug !== collection.slug).map(c => <Link key={c.slug} href={collectionPath(kind, c.slug)} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-primary">{c.label}</Link>)}</div></section>
    </main>
}
