import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE } from "@/components/seo/PageJsonLd"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, Search, ShieldCheck } from "lucide-react"
import type { Listing } from "@/lib/listingApi"
import { formatPrice } from "@/lib/listingApi"
import { serverBackendFetch } from "@/lib/serverBackendFetch"

const SITE_URL = "https://www.carmazium.com"

export const revalidate = 300

export const metadata: Metadata = {
    title: "Used Car Body Types UK — SUVs, Hatchbacks, Estates and More",
    description: "Compare eight used-car body types in the UK. Understand space, practicality and buying checks, then search live CarMazium listings by body style.",
    alternates: { canonical: SITE_URL + "/used-car-types" },
    openGraph: {
        title: "Explore Used Car Body Types | CarMazium",
        description: "A practical UK guide to SUVs, hatchbacks, estates, saloons, MPVs, coupes, convertibles and pickups.",
        url: SITE_URL + "/used-car-types",
        type: "website",
    },
}

const BODY_TYPES = [
    {
        key: "HATCHBACK",
        name: "Hatchbacks",
        image: "/assets/images/body-hatchback.png",
        description: "Compact outside and flexible inside, hatchbacks are popular for commuting, town parking and everyday errands. A lift-up tailgate usually makes loading luggage straightforward.",
        check: "Check boot access, rear-seat space, clutch or automatic gearbox behaviour, and how the car fits your regular journeys.",
        accent: "from-sky-500/20 to-blue-500/5",
    },
    {
        key: "SUV",
        name: "SUVs",
        image: "/assets/images/body-suv.png",
        description: "SUVs often offer a higher driving position and useful family room, but actual cabin space and running costs vary considerably from model to model.",
        check: "Compare tyre prices, visibility, parking dimensions, fuel consumption and whether all-wheel drive is genuinely needed.",
        accent: "from-emerald-500/20 to-teal-500/5",
    },
    {
        key: "ESTATE",
        name: "Estate cars",
        image: "/assets/images/body-estate.png",
        description: "Estates combine a familiar car driving position with an extended load area, making them worth considering for family trips, hobbies and regular luggage.",
        check: "Inspect the tailgate, load-floor condition, rear-seat folding mechanism and the car's full service history.",
        accent: "from-purple-500/20 to-violet-500/5",
    },
    {
        key: "SEDAN",
        name: "Saloons",
        image: "/assets/images/body-saloon.png",
        description: "A saloon generally has a separate boot and a traditional three-box body. Many suit longer trips, although the boot opening may be smaller than an equivalent hatchback.",
        check: "Consider rear headroom, the size of the boot opening, tyre wear and the cost of routine maintenance.",
        accent: "from-amber-500/20 to-orange-500/5",
    },
    {
        key: "COUPE",
        name: "Coupés",
        image: "/assets/images/body-coupe.png",
        description: "Coupés put style and driving character first. Some have only two seats, while others have a smaller rear row, so their everyday practicality deserves a careful look.",
        check: "Test access to the rear seats, door clearance in tight parking spaces, insurance costs and previous modifications.",
        accent: "from-rose-500/20 to-red-500/5",
    },
    {
        key: "CONVERTIBLE",
        name: "Convertibles",
        image: "/assets/images/body-convertible.png",
        description: "Convertibles add open-air driving to a used-car purchase. Their folding roofs can be great fun, but they introduce extra seals and mechanisms to inspect.",
        check: "Operate the roof several times, look for water ingress and worn seals, and check boot space with the roof stored.",
        accent: "from-pink-500/20 to-fuchsia-500/5",
    },
    {
        key: "MPV",
        name: "MPVs and people carriers",
        image: "/assets/images/body-mpv.png",
        description: "MPVs are designed around passenger versatility. Some offer seven seats or movable rows, while smaller versions focus on easy access and flexible family transport.",
        check: "Check every seatbelt, child-seat mounting point, sliding door, folding seat and air-conditioning control.",
        accent: "from-cyan-500/20 to-sky-500/5",
    },
    {
        key: "PICKUP_TRUCK",
        name: "Pickup trucks",
        image: "/assets/images/body-pickup.png",
        description: "Pickups mix a passenger cabin with an open or covered load bed. They suit some work and leisure needs, but their ride, dimensions and tax treatment can differ from cars.",
        check: "Inspect the load bed, chassis, underbody corrosion, tow equipment and the vehicle's actual permitted weights.",
        accent: "from-lime-500/20 to-green-500/5",
    },
] as const

/** Optional public stock preview. Never exposes trade-only auction inventory. */
async function latestRetailCars(): Promise<Listing[]> {
    try {
        const response = await serverBackendFetch(
            "/listings?page=1&limit=12&sortBy=newest",
            { next: { revalidate: 300 } },
            { timeoutMs: 6_000, retries: 1 },
        )
        if (!response.ok) return []
        const payload = await response.json()
        if (!Array.isArray(payload?.data)) return []
        return (payload.data as Listing[]).filter((listing) =>
            listing &&
            listing.type === "CLASSIFIED" &&
            listing.status === "ACTIVE" &&
            typeof listing.slug === "string" &&
            /^[a-z0-9][a-z0-9-]*$/i.test(listing.slug) &&
            typeof listing.title === "string" &&
            Number(listing.price) > 0,
        ).slice(0, 8)
    } catch {
        // The independent body-type guide should remain useful when Fly is slow.
        return []
    }
}

export default async function UsedCarTypesPage() {
    const cars = await latestRetailCars()

    return (
        <main className="min-h-screen pb-24 pt-24 md:pt-28">
            <PageJsonLd
                path="/used-car-types"
                title="Used Car Body Types: Hatchbacks, SUVs, Estates & More | CarMazium"
                type="CollectionPage"
                mainEntity={{
                    "@type": "ItemList", "@id": SEO_SITE + "/used-car-types#types",
                    name: "Used car body type guide",
                    itemListElement: BODY_TYPES.map((type, i) => ({
                        "@type": "ListItem", position: i + 1,
                        name: type.name,
                        url: SEO_SITE + "/search?bodyType=" + encodeURIComponent(type.key),
                    })),
                }}
            />}
            <div className="container mx-auto max-w-7xl px-5">
                <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[var(--text-muted)]">
                    <Link href="/" className="hover:text-primary">Home</Link>
                    <span aria-hidden="true"> / </span>
                    <span>Used car body types</span>
                </nav>

                <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-rose-500/15 via-[var(--bg-card)] to-sky-500/15 px-6 py-12 md:px-12 md:py-16">
                    <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
                        <BookOpen size={16} aria-hidden="true" /> UK used-car buying guide
                    </p>
                    <h1 className="max-w-4xl text-3xl font-black leading-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                        Find the right body type for your next used car
                    </h1>
                    <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
                        From city hatchbacks to family SUVs and practical estates, the right shape depends on how you drive.
                        Compare eight common UK vehicle styles, see what to check and search current listings without changing your filters.
                    </p>
                    <Link href="/search" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Search size={17} aria-hidden="true" /> Browse all used cars
                    </Link>
                </header>

                <section aria-labelledby="body-types-heading" className="mt-14 md:mt-20">
                    <h2 id="body-types-heading" className="text-2xl font-black text-[var(--text-primary)] md:text-3xl">Compare body types</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                        These are general buying considerations, not promises about any individual car. Review each listing's actual specifications and condition.
                    </p>
                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        {BODY_TYPES.map((body) => (
                            <article key={body.key} className={"flex flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-gradient-to-br shadow-lg shadow-black/5 " + body.accent}>
                                <div className="flex items-center gap-4 border-b border-[var(--border-default)] p-5 sm:gap-6 sm:p-7">
                                    <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-white sm:h-28 sm:w-36">
                                        <Image src={body.image} alt="" fill sizes="(max-width: 640px) 112px, 144px" loading="lazy" className="object-contain p-2" />
                                    </div>
                                    <h3 className="text-xl font-black text-[var(--text-primary)] sm:text-2xl">{body.name}</h3>
                                </div>
                                <div className="flex flex-1 flex-col p-5 sm:p-7">
                                    <p className="text-sm leading-7 text-[var(--text-secondary)]">{body.description}</p>
                                    <p className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/70 p-4 text-sm leading-7 text-[var(--text-secondary)]">
                                        <strong className="text-[var(--text-primary)]">What to check: </strong>{body.check}
                                    </p>
                                    <Link href={"/search?bodyType=" + body.key} className="mt-6 inline-flex min-h-11 items-center gap-2 self-start text-sm font-black text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        Browse used {body.name.toLowerCase()} <ArrowRight size={17} aria-hidden="true" />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {cars.length > 0 && (
                    <section aria-labelledby="latest-used-cars" className="mt-16 md:mt-20">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Explore the marketplace</p>
                                <h2 id="latest-used-cars" className="mt-2 text-2xl font-black text-[var(--text-primary)] md:text-3xl">Recently listed used cars</h2>
                            </div>
                            <Link href="/search" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary hover:underline">
                                All listings <ArrowRight size={17} aria-hidden="true" />
                            </Link>
                        </div>
                        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {cars.map((car) => (
                                <Link key={car.id} href={"/buy-cars/" + car.slug} className="group flex min-h-40 flex-col justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 transition-transform hover:-translate-y-1 hover:border-primary/50">
                                    <div>
                                        <h3 className="line-clamp-2 text-base font-black text-[var(--text-primary)] group-hover:text-primary">{car.title}</h3>
                                        <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
                                            {[car.year, car.fuelType, car.transmission].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    <p className="mt-5 text-lg font-black text-primary">{formatPrice(car.price)}</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section aria-labelledby="buyer-checks" className="mt-16 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-10">
                    <h2 id="buyer-checks" className="flex items-center gap-3 text-2xl font-black text-[var(--text-primary)]">
                        <ShieldCheck className="text-primary" size={26} aria-hidden="true" />
                        Checks that matter for every used car
                    </h2>
                    <p className="mt-4 max-w-4xl text-sm leading-8 text-[var(--text-secondary)]">
                        Whichever body type you prefer, compare the advertised mileage, service history, MOT record, condition, insurance and running costs.
                        Check the vehicle's identity and available history independently, inspect it in person and make sure the seller has the right to sell.
                        A marketplace listing is not a substitute for your own due diligence.
                    </p>
                    <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                        CarMazium is a marketplace: buyers pay sellers directly for vehicles. Its seller auction listing is free and the basic retail listing costs £1; these are seller options, not extra retail buyer fees.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-5">
                        <Link href="/how-it-works" className="font-bold text-primary hover:underline">How CarMazium works</Link>
                        <Link href="/pricing" className="font-bold text-primary hover:underline">Marketplace fees</Link>
                        <Link href="/search" className="font-bold text-primary hover:underline">Search used cars</Link>
                    </div>
                </section>
            </div>
        </main>
    )
}
