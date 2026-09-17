"use client"

import Image from "next/image"
import Link from "next/link"
import {
    ArrowRight,
    BadgeCheck,
    Building2,
    Car,
    Eye,
    Handshake,
    MapPin,
    Phone,
    SearchCheck,
    ShieldCheck,
} from "lucide-react"
import { AccordionItem } from "@/components/ui/Accordion"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"
import { useAuth } from "@/context/AuthContext"

const values = [
    {
        icon: Eye,
        title: "Clarity first",
        text: "Fees, marketplace roles and service workflows should be understandable before a user commits to an action.",
    },
    {
        icon: ShieldCheck,
        title: "Trust through information",
        text: "Vehicle data, seller information and relevant checks are presented so buyers can make their own informed decisions.",
    },
    {
        icon: Handshake,
        title: "Direct marketplace relationships",
        text: "CarMazium provides the platform and workflow while buyers and sellers remain responsible for the vehicle transaction between them.",
    },
]

const differentiators = [
    {
        icon: Car,
        title: "Auction and retail routes",
        text: "Sellers can choose the route that fits their vehicle rather than being forced into one selling method.",
    },
    {
        icon: SearchCheck,
        title: "Compare before committing",
        text: "Buyers can browse listings, compare vehicles and review the information supplied before arranging the next step.",
    },
    {
        icon: Building2,
        title: "One Partner Account",
        text: "Automotive businesses can use one Partner Account and add the services or capabilities relevant to the work they provide.",
    },
]

export default function AboutPage() {
    const { user } = useAuth()

    return (
        <main className="min-h-screen pb-20 pt-20">
            <PageHero
                eyebrow="About CarMazium"
                title="A clearer way to connect the UK vehicle marketplace"
                description={
                    <p>
                        CarMazium brings buying, selling, dealer access and automotive services into one platform while keeping the role of each participant clear.
                    </p>
                }
                actions={
                    <>
                        <Button asChild size="lg">
                            <Link href="/search">Browse cars <ArrowRight size={17} /></Link>
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <Link href="/sell">Sell a car</Link>
                        </Button>
                    </>
                }
            />

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Our story</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Built around a simple marketplace problem</h2>
                        <div className="mt-5 space-y-4 text-base leading-7 text-[var(--text-muted)]">
                            <p>
                                Buying and selling a used vehicle often means jumping between advertising sites, dealer channels, vehicle checks and separate service providers. CarMazium was created to bring those journeys closer together without pretending the platform itself is the buyer, seller, lender or warranty provider.
                            </p>
                            <p>
                                The result is a marketplace with distinct routes for retail listings, dealer auctions and supporting automotive services. Each route is designed to make the next action easier to understand while preserving the responsibilities of the people and businesses actually completing the transaction.
                            </p>
                        </div>
                    </div>

                    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                        <Image
                            src="/assets/images/featured-sports.png"
                            alt="Vehicle on the CarMazium marketplace"
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white md:p-7">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Marketplace, not middleman</p>
                            <p className="mt-2 max-w-md text-sm leading-6 text-slate-200">CarMazium provides the digital tools; vehicle sale funds are handled directly between buyer and seller.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">What the platform does</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Different journeys, one connected platform</h2>
                    </div>

                    <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
                        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Car size={20} /></span>
                            <h3 className="mt-5 text-xl font-bold">For sellers</h3>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Choose between the available auction and retail routes, create the vehicle listing and deal directly with the successful buyer.</p>
                            <Button asChild size="sm" className="mt-5">
                                <Link href="/sell">Explore selling <ArrowRight size={14} /></Link>
                            </Button>
                        </article>

                        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><SearchCheck size={20} /></span>
                            <h3 className="mt-5 text-xl font-bold">For buyers</h3>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Browse live vehicles, compare listings and use the available listing information and checks before agreeing a purchase.</p>
                            <Button asChild size="sm" className="mt-5">
                                <Link href="/search">Browse vehicles <ArrowRight size={14} /></Link>
                            </Button>
                        </article>

                        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 size={20} /></span>
                            <h3 className="mt-5 text-xl font-bold">For automotive businesses</h3>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Use one Partner Account for the business and the relevant approved capabilities, including Vehicle Dealer and supported TradeXchange services.</p>
                            <Button asChild size="sm" className="mt-5">
                                <Link href="/services">Explore TradeXchange <ArrowRight size={14} /></Link>
                            </Button>
                        </article>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">How we think about trust</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Useful information over empty claims</h2>
                        <p className="mt-4 leading-7 text-[var(--text-muted)]">CarMazium&apos;s trust model is based on clearer information, defined platform roles and practical checks — not unsupported awards, rankings or invented marketplace statistics.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {values.map(({ icon: Icon, title, text }) => (
                            <article key={title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                                <Icon className="text-primary" size={24} />
                                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto max-w-6xl">
                        <div className="mb-10 max-w-3xl">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">What makes CarMazium different</p>
                            <h2 className="text-3xl font-black tracking-tight md:text-4xl">Choice without mixing the workflows</h2>
                        </div>
                        <div className="grid gap-5 md:grid-cols-3">
                            {differentiators.map(({ icon: Icon, title, text }) => (
                                <article key={title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                                    <Icon className="text-primary" size={24} />
                                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{text}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPin size={20} /></div>
                        <h2 className="mt-5 text-lg font-bold">Our location</h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">181-187 Hunters Rd<br />Lozells, Birmingham<br />B19 1ES, United Kingdom</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Phone size={20} /></div>
                        <h2 className="mt-5 text-lg font-bold">Contact CarMazium</h2>
                        <a href="tel:+441218385040" className="mt-2 inline-flex rounded-sm text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">0121 838 5040</a>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">Monday – Friday, 9am – 6pm GMT</p>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16 md:pb-20">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-9 text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Common questions</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">About the marketplace model</h2>
                    </div>
                    <AccordionItem title="Is CarMazium involved in the sale of vehicles?" defaultOpen>
                        <p>CarMazium is a marketplace platform. Buyers and sellers agree the vehicle transaction between themselves, and CarMazium does not hold the vehicle purchase funds.</p>
                    </AccordionItem>
                    <AccordionItem title="How does vehicle information work?">
                        <p>Listings can include vehicle data, photos, history information and other seller-provided details. Buyers should review the available information and arrange any inspection or checks they consider appropriate before completing a purchase.</p>
                    </AccordionItem>
                    <AccordionItem title="How do auctions work?">
                        <p>Auction listings use the current auction workflow and connect the successful verified dealer bidder with the seller so they can arrange the next steps. Vehicle payment remains between the buyer and seller.</p>
                    </AccordionItem>
                    <AccordionItem title="What is a Partner Account?">
                        <p>A Partner Account is the main business account. Vehicle Dealer, Delivery & Recovery and Vehicle Inspection are capabilities or services used from that business architecture rather than separate customer account types.</p>
                    </AccordionItem>
                    <AccordionItem title="How do finance and warranty services work?">
                        <p>Finance and warranty are matched-enquiry workflows to relevant providers. They are not the same paid-job workflow used for Delivery / Recovery and Vehicle Inspection.</p>
                    </AccordionItem>
                </div>
            </section>

            {!user && (
                <section className="container mx-auto px-5">
                    <div className="mx-auto max-w-6xl rounded-3xl border border-[var(--border-default)] bg-slate-900 px-6 py-10 text-center text-white shadow-xl md:px-10 md:py-12">
                        <BadgeCheck className="mx-auto text-red-300" size={28} />
                        <h2 className="mt-4 text-3xl font-black">Explore CarMazium for yourself</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">Browse the marketplace, understand the selling journey, or create an account when you are ready.</p>
                        <div className="mt-7 flex flex-wrap justify-center gap-3">
                            <Button asChild size="lg"><Link href="/search">Browse cars</Link></Button>
                            <Button asChild variant="outline" size="lg" className="border-white/25 text-white hover:border-white/50 hover:bg-white/10 hover:text-white"><Link href="/how-it-works">How it works</Link></Button>
                            <Button asChild variant="ghost" size="lg" className="text-white hover:bg-white/10 hover:text-white"><Link href="/auth/signup">Create account</Link></Button>
                        </div>
                    </div>
                </section>
            )}
        </main>
    )
}
