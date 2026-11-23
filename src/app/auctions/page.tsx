import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Banknote, Building2, ClipboardCheck, Gavel, ShieldCheck, Truck, type LucideIcon } from "lucide-react"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"
import { TradeXchangeAccountActions, TradeXchangePartnerAction } from "@/components/tradexchange/TradeXchangeAccountActions"
import { deliveryServiceEnabled, inspectionServiceEnabled, financeServiceEnabled, warrantyServiceEnabled } from "@/lib/featureFlags"

type Service = {
    title: string; description: string; href: string; cta: string; icon: LucideIcon;
    tone: string; enabled: boolean; detail: string;
}

// Customer services are the primary navigation, not provider registration.
const services: Service[] = [
    { title: "Vehicle auctions", description: "Sell your vehicle through a free dealer auction, or browse live auctions as a verified motor trader.", href: "/auctions/how-it-works", cta: "Explore auctions", icon: Gavel, tone: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200", enabled: true, detail: "Free seller listing · Verified dealer bidding" },
    { title: "Vehicle transport", description: "Arrange delivery, collection or recovery for one vehicle or several. Compare fixed-price quotes from approved transport providers.", href: "/services/delivery", cta: "Get transport quotes", icon: Truck, tone: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200", enabled: deliveryServiceEnabled, detail: "Delivery · Collection · Recovery" },
    { title: "Vehicle inspections", description: "Request an independent vehicle inspection and compare quotes from approved inspection businesses.", href: "/services/inspection", cta: "Request an inspection", icon: ClipboardCheck, tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200", enabled: inspectionServiceEnabled, detail: "Pre-purchase and condition checks" },
    { title: "Vehicle finance", description: "Start from a participating vehicle listing and continue your application with the selected finance provider. Subject to status and approval.", href: "/services/finance", cta: "Explore finance", icon: Banknote, tone: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200", enabled: financeServiceEnabled, detail: "Finance application with a selected partner" },
    { title: "Vehicle warranty", description: "Choose available cover, see your warranty quote and order online. Cover is confirmed after issuance.", href: "/services/warranty", cta: "Get a warranty quote", icon: ShieldCheck, tone: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200", enabled: warrantyServiceEnabled, detail: "Vehicle-specific cover options" },
]

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)]"
const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"

function ServiceCard({ service }: { service: Service }) {
    const Icon = service.icon
    const body = <>
        <span className={"flex size-12 shrink-0 items-center justify-center rounded-xl " + service.tone}><Icon size={25} aria-hidden="true" /></span>
        <h3 className="mt-4 text-xl font-bold font-heading leading-snug text-[var(--text-primary)]">{service.title}</h3>
        <p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{service.description}</p>
        <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{service.detail}</p>
        <span className="mt-auto pt-5 flex items-center justify-between gap-2 font-bold text-base">
            {service.enabled ? <><span className="text-red-700 dark:text-red-300">{service.cta}</span><ArrowRight size={20} className="shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" /></> : <span className="text-[var(--text-muted)]">Temporarily unavailable</span>}
        </span>
    </>
    return <li className="min-w-0 h-full">
        {service.enabled
            ? <Link href={service.href} className={panel + " " + focus + " flex h-full flex-col p-5 sm:p-6 shadow-sm transition-colors hover:border-primary hover:bg-[var(--bg-card-hover)]"}>{body}</Link>
            : <article className={panel + " flex h-full flex-col p-5 sm:p-6"}>{body}</article>}
    </li>
}

export default function TradeXchangePage() {
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <PageJsonLd path="/auctions" title="TradeXchange Car Auctions & Vehicle Services UK | CarMazium"
            description="Vehicle auctions, delivery, collection, recovery, inspections, finance and warranty services across the UK."
            about={SEO_TRADEXCHANGE} type="CollectionPage"
            mainEntity={{ "@type": "ItemList", "@id": SEO_SITE + "/auctions#service-directory",
                name: "TradeXchange vehicle auctions and services",
                itemListElement: services.filter(service => service.enabled).map((service, index) => ({ "@type": "ListItem", position: index + 1, url: SEO_SITE + service.href, name: service.title })) }} />
        <section className="relative isolate overflow-hidden bg-slate-950 text-white">
            <Image src="/assets/images/live-auction-hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/60" aria-hidden="true" />
            <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
                <div className="max-w-3xl">
                    <p className="text-sm font-bold tracking-wide text-red-200">CarMazium TradeXchange</p>
                    <h1 className="mt-3 text-4xl font-heading font-black tracking-tight leading-[1.12] sm:text-5xl lg:text-6xl">Everything your vehicle needs.<br className="hidden sm:block" /> One marketplace.</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">Sell at auction, buy at auction as a verified motor trader, arrange vehicle transport and inspections, explore finance and choose warranty cover. For private customers and automotive businesses across the UK.</p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <a href="#tradexchange-areas" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explore services <ArrowRight size={18} aria-hidden="true" /></a>
                        <a href="#business-partnerships" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">For automotive businesses</a>
                    </div>
                </div>
            </div>
        </section>

        <section id="tradexchange-areas" aria-labelledby="services-heading" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-8 sm:py-14">
            <h2 id="services-heading" className="text-3xl font-heading font-bold tracking-tight sm:text-4xl">What can we help you with?</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">Choose the service you need. Each service has its own clear process and terms.</p>
            <ul className="mt-7 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map(service => <ServiceCard key={service.href} service={service} />)}
                <li className="min-w-0 h-full"><a href="#business-partnerships" className={panel + " " + focus + " flex h-full flex-col p-5 sm:p-6 shadow-sm transition-colors hover:border-primary hover:bg-[var(--bg-card-hover)]"}>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"><Building2 size={25} aria-hidden="true" /></span>
                    <h3 className="mt-4 text-xl font-bold font-heading">Business partnerships</h3>
                    <p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">Join CarMazium as a motor trader or service provider, or discuss a specialist integration with our team.</p>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">One Partner Account for eligible trading and paid services</p>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-5 font-bold text-red-700 dark:text-red-300">Explore partnerships <ArrowRight size={20} className="shrink-0" aria-hidden="true" /></span>
                </a></li>
            </ul>
            <TradeXchangeAccountActions paidJobsEnabled={deliveryServiceEnabled || inspectionServiceEnabled} />
        </section>

        {(deliveryServiceEnabled || inspectionServiceEnabled) && <section id="request-services" aria-labelledby="jobs-heading" className="scroll-mt-24 border-y border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <h2 id="jobs-heading" className="text-2xl font-heading font-bold sm:text-3xl">How transport and inspection requests work</h2>
                <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {[["Request a service", "Tell us about your vehicle, location and the work you need."], ["Compare and choose", "Approved providers may send fixed-price quotes. Review the scope and price before accepting."], ["Pay and track", "Pay for the service through CarMazium, track progress and review completion under the service payment terms."]].map(([title, description], index) => <li key={title} className="flex gap-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-input)] text-lg font-bold" aria-hidden="true">{index + 1}</span>
                        <div><h3 className="font-bold text-lg">{title}</h3><p className="mt-1 text-base leading-7 text-[var(--text-secondary)]">{description}</p></div>
                    </li>)}
                </ol>
                <div className="mt-6 flex flex-wrap gap-3">{deliveryServiceEnabled && <Link href="/services/delivery/new" className="inline-flex min-h-12 items-center rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800">Request transport</Link>}{inspectionServiceEnabled && <Link href="/services/inspection/new" className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border-default)] px-5 py-3 font-bold hover:bg-[var(--bg-input)]">Request inspection</Link>}</div>
                <p className="mt-6 text-sm leading-6 text-[var(--text-muted)]">Service availability depends on suitable providers. Vehicle purchase funds are paid directly between buyer and seller, separately from paid service jobs.</p>
            </div>
        </section>}

        <section id="business-partnerships" aria-labelledby="business-heading" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-8 sm:py-14">
            <h2 id="business-heading" className="text-3xl font-heading font-bold tracking-tight">Grow your automotive business</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">Choose the route that matches your business. No separate account is needed for each eligible service.</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <article className={panel + " p-5 sm:p-7"}>
                    <h3 className="text-xl font-heading font-bold">Motor traders and paid service providers</h3>
                    <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">Use one Partner Account for trading and apply for delivery, collection, recovery or inspection services. Each service requires approval before you can quote.</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">For completed paid transport and inspection jobs, the platform fee is 9% and the provider share is 91%. Payment release is subject to the service terms.</p>
                    <TradeXchangePartnerAction />
                </article>
                <article className={panel + " p-5 sm:p-7"}>
                    <h3 className="text-xl font-heading font-bold">Finance, warranty and insurance businesses</h3>
                    <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">These partnerships are arranged directly with CarMazium. Contact our team to discuss products, integration and requirements. They are not paid-job applications.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {["finance", "warranty", "insurance"].map(topic => <Link key={topic} href={"/contact?topic=" + topic + "-partnership"} className={focus + " inline-flex min-h-12 items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 font-semibold capitalize hover:bg-[var(--bg-input)]"}>{topic} partnership <ArrowRight size={16} aria-hidden="true" /></Link>)}
                    </div>
                </article>
            </div>
            <Link href="/business-spotlight" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-3 font-semibold hover:bg-[var(--bg-input)]">Explore Business Spotlight <ArrowRight size={18} aria-hidden="true" /></Link>
        </section>
    </div>
}
