"use client"

import Link from "next/link"
import {
    ArrowLeft,
    ArrowRight,
    Briefcase,
    Building2,
    ClipboardList,
    PlusCircle,
    Search,
    ShieldCheck,
    WalletCards,
} from "lucide-react"
import { GiTowTruck, GiMagnifyingGlass, GiRibbonMedal, GiMoneyStack } from "react-icons/gi"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"
import { useTradeXchangeAvailability } from "@/hooks/useTradeXchangeAvailability"

export default function ServicesPage() {
    const { availability, loading } = useTradeXchangeAvailability()
    const deliveryEnabled = availability?.DELIVERY === true
    const inspectionEnabled = availability?.INSPECTION === true
    const financeEnabled = availability?.FINANCE === true
    const warrantyEnabled = availability?.WARRANTY === true
    const unavailableCta = loading ? "Checking availability…" : "Temporarily unavailable"
    const paidJobsEnabled = deliveryEnabled || inspectionEnabled
    const services = [
        {
            title: "Vehicle Dealer",
            icon: Building2,
            desc: "Run your vehicle sales capability from one Partner Account, with dealer tools, stock workflows and access to the parts of CarMazium built for the motor trade.",
            color: "text-primary",
            bg: "bg-primary/10",
            link: "/auth/signup?role=dealer",
            cta: "Explore dealer access",
            badge: "Partner capability",
        },
        {
            title: "Delivery & Recovery",
            icon: GiTowTruck,
            desc: "Post a single-car, multi-car or recovery job and let approved transport businesses compete with fixed-price quotes.",
            color: "text-blue-500 dark:text-blue-400",
            bg: "bg-blue-500/10",
            link: deliveryEnabled ? "/services/delivery" : undefined,
            cta: deliveryEnabled ? "Arrange transport" : unavailableCta,
            badge: "Paid job marketplace",
        },
        {
            title: "Vehicle Inspection",
            icon: GiMagnifyingGlass,
            desc: "Request an independent vehicle inspection and receive quotes from approved inspection providers before you commit to a car.",
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
            link: inspectionEnabled ? "/services/inspection" : undefined,
            cta: inspectionEnabled ? "Book an inspection" : unavailableCta,
            badge: "Paid job marketplace",
        },
        {
            title: "Vehicle Finance",
            icon: GiMoneyStack,
            desc: "Send one finance enquiry to approved matching providers. Providers respond with their own terms; CarMazium does not lend or guarantee approval.",
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
            link: financeEnabled ? "/services/finance" : undefined,
            cta: financeEnabled ? "Request finance options" : unavailableCta,
            badge: "Matched enquiry",
        },
        {
            title: "Warranty",
            icon: GiRibbonMedal,
            desc: "Tell us about the vehicle and cover you want. Approved warranty providers can respond with suitable products and indicative prices.",
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10",
            link: warrantyEnabled ? "/services/warranty" : undefined,
            cta: warrantyEnabled ? "Request warranty options" : unavailableCta,
            badge: "Matched enquiry",
        },
    ]

    return (
        <main className="min-h-screen pb-20 pt-20">
            <div className="container mx-auto px-5 pt-7">
                <Link
                    href="/auctions"
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <ArrowLeft size={15} /> TradeXchange overview
                </Link>
            </div>

            <PageHero
                eyebrow="TradeXchange Services"
                title="Post work or compete for it"
                description={
                    <p>
                        Need delivery, recovery or an inspection? Any signed-in CarMazium user can post a paid service job. Approved Partner businesses see matching open jobs and compete by sending quotes.
                    </p>
                }
                actions={
                    paidJobsEnabled ? (
                        <div className="flex flex-wrap justify-center gap-3">
                            <Button asChild size="lg">
                                <Link href="/services/jobs/new">
                                    <PlusCircle size={17} /> Post a Job
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link href="/services/jobs">
                                    <ClipboardList size={17} /> My Posted Jobs
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link href="/dashboard/service/jobs">
                                    <Search size={17} /> Provider: Available Jobs
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <Button asChild variant="outline" size="lg">
                            <Link href="/auth/signup?role=dealer">
                                <Building2 size={17} /> Create Partner Account
                            </Link>
                        </Button>
                    )
                }
            />

            {paidJobsEnabled && (
                <section className="container mx-auto px-5 pt-10">
                    <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
                        <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-6 md:p-7">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><PlusCircle size={20} /></div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">For customers</p>
                            <h2 className="mt-2 text-xl font-bold">Post one job and compare competing quotes</h2>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Choose Delivery, Collection, Recovery or Vehicle Inspection. Your job is shown only to businesses approved for that service type.</p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <Button asChild><Link href="/services/jobs/new">Post a Job</Link></Button>
                                <Button asChild variant="outline"><Link href="/services/jobs">My Posted Jobs</Link></Button>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-7">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Search size={20} /></div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">For providers</p>
                            <h2 className="mt-2 text-xl font-bold">See matching jobs and compete with quotes</h2>
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Approved Partner businesses see open work matching their Delivery or Inspection capabilities. Staff can act for the business where permission is granted.</p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <Button asChild><Link href="/dashboard/service/jobs">Available Jobs</Link></Button>
                                <Button asChild variant="outline"><Link href="/dashboard/service/capabilities">Manage Service Areas</Link></Button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">How it works</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Choose the workflow that fits the job</h2>
                        <p className="mt-4 leading-7 text-[var(--text-muted)]">
                            TradeXchange separates paid service jobs from matched provider enquiries, so customers and automotive businesses can see what happens before they start.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <ClipboardList size={20} />
                            </div>
                            <h3 className="font-bold">1. Pick a service</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Start with the vehicle need — dealer tools, a paid job, or a provider enquiry.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Search size={20} />
                            </div>
                            <h3 className="font-bold">2. Get the right response</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Paid jobs receive competitive quotes; finance and warranty requests are matched to approved providers.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <ShieldCheck size={20} />
                            </div>
                            <h3 className="font-bold">3. Manage it in CarMazium</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Keep the relevant job or enquiry workflow together without changing how the underlying service operates.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="tradexchange-areas" className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Five service areas</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">One hub, clearly separated services</h2>
                        <p className="mt-4 leading-7 text-[var(--text-muted)]">Each area has its own purpose and commercial workflow. Choose the capability you need.</p>
                    </div>

                    <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-6">
                        {services.map((service, index) => (
                            <article
                                key={service.title}
                                className={`flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)] md:p-7 lg:col-span-2 ${index === 3 ? "lg:col-start-2" : ""}`}
                            >
                                <div className="mb-5 flex items-start justify-between gap-3">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${service.bg} ${service.color}`}>
                                        <service.icon size={24} />
                                    </div>
                                    <span className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                        {service.badge}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold">{service.title}</h3>
                                <p className="mt-3 flex-1 text-sm leading-6 text-[var(--text-muted)]">{service.desc}</p>
                                <div className="mt-6 border-t border-[var(--border-default)] pt-5">
                                    {service.link ? (
                                        <Button asChild variant="outline" className="w-full justify-between">
                                            <Link href={service.link}>
                                                {service.cta} <ArrowRight size={15} />
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button variant="outline" className="w-full" disabled>
                                            {service.cta}
                                        </Button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Provider economics & requirements</p>
                        <h2 className="text-3xl font-black tracking-tight md:text-4xl">The fee model depends on the workflow</h2>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-7 md:p-8">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><WalletCards size={20} /></div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-primary">Paid service jobs</p>
                                    <h3 className="text-xl font-bold">Delivery / Recovery & Vehicle Inspection</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                    <p className="text-3xl font-black text-[var(--text-primary)]">91%</p>
                                    <p className="mt-1 text-sm text-[var(--text-muted)]">Provider share of the paid job</p>
                                </div>
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                    <p className="text-3xl font-black text-primary">9%</p>
                                    <p className="mt-1 text-sm text-[var(--text-muted)]">CarMazium service fee</p>
                                </div>
                            </div>
                            <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">Providers must be approved for the relevant capability before they can quote for work.</p>
                        </div>

                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 md:p-8">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><Briefcase size={20} /></div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Matched enquiries</p>
                                    <h3 className="text-xl font-bold">Finance & Warranty</h3>
                                </div>
                            </div>
                            <p className="text-sm leading-7 text-[var(--text-muted)]">
                                These are provider-enquiry workflows, not paid TradeXchange service jobs. The 91% provider share / 9% CarMazium job-fee model does not apply to finance or warranty enquiries.
                            </p>
                            {(financeEnabled || warrantyEnabled) && (
                                <Button asChild variant="outline" className="mt-6">
                                    <Link href="/services/leads">My finance & warranty enquiries</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5">
                <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-[var(--border-default)] bg-slate-900 px-6 py-10 text-center text-white shadow-xl md:px-10 md:py-12">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-red-300">Partner Account</p>
                    <h2 className="text-3xl font-black md:text-4xl">Run an automotive business on CarMazium</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                        Start with one Partner Account, then use the automotive capabilities relevant to your business. Service approvals remain separate so customers only meet providers cleared for that work.
                    </p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        <Button asChild size="lg">
                            <Link href="/auth/signup?role=dealer">Create Partner Account</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="border-white/25 text-white hover:border-white/50 hover:bg-white/10 hover:text-white">
                            <Link href="/dashboard/service/capabilities">View service capabilities</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    )
}
