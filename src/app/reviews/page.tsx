import type { Metadata } from "next"
import Link from "next/link"
import {
    ArrowRight,
    BadgeCheck,
    BookOpen,
    CarFront,
    CheckCircle2,
    CreditCard,
    Mail,
    MessageSquareText,
    SearchCheck,
    ShieldCheck,
} from "lucide-react"

const SITE_URL = "https://www.carmazium.com"

export const metadata: Metadata = {
    title: { absolute: "CarMazium Reviews & Customer Feedback" },
    description: "Learn how to share feedback about CarMazium and what to check when buying a used car. We do not publish unverified testimonials or unsupported review scores.",
    alternates: { canonical: SITE_URL + "/reviews" },
    openGraph: {
        title: "Reviews & Customer Feedback | CarMazium",
        description: "A transparent guide to customer feedback, vehicle checks, marketplace payments and buyer due diligence.",
        url: SITE_URL + "/reviews",
        type: "website",
    },
}

const BUYER_CHECKS = [
    {
        icon: CarFront,
        label: "Examine the individual vehicle",
        description:
            "Compare the advertisement with the car itself. Check its condition, mileage, specification and history. A listing is not an independent mechanical inspection.",
        href: "/search",
        link: "Explore retail listings",
        accent: "from-sky-500/15 to-cyan-500/5 border-sky-500/25",
        iconStyle: "bg-sky-600 text-white",
    },
    {
        icon: ShieldCheck,
        label: "Understand verification",
        description:
            "Account and motor-trade checks support safer participation, but they are not a guarantee about a vehicle's condition, its value or the outcome of a purchase.",
        href: "/how-it-works",
        link: "How the marketplace works",
        accent: "from-violet-500/15 to-fuchsia-500/5 border-violet-500/25",
        iconStyle: "bg-violet-600 text-white",
    },
    {
        icon: CreditCard,
        label: "Know who receives the money",
        description:
            "For the vehicle purchase, buyers pay the seller directly. CarMazium does not hold vehicle purchase funds; its own marketplace fees are separate.",
        href: "/pricing",
        link: "Understand marketplace fees",
        accent: "from-emerald-500/15 to-teal-500/5 border-emerald-500/25",
        iconStyle: "bg-emerald-600 text-white",
    },
] as const

export default function ReviewsPage() {
    return (
        <main className="min-h-screen pb-24 pt-24 md:pt-28">
            <div className="container mx-auto max-w-7xl px-5">
                <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[var(--text-muted)]">
                    <Link href="/" className="hover:text-primary focus-visible:underline">Home</Link>
                    <span aria-hidden="true"> / </span>
                    <span>Reviews &amp; feedback</span>
                </nav>

                <header className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-rose-500/15 via-[var(--bg-card)] to-sky-500/15 px-6 py-12 shadow-lg shadow-black/5 md:px-12 md:py-16">
                    <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                        <MessageSquareText size={16} aria-hidden="true" />
                        Customer experiences matter
                    </p>
                    <h1 className="max-w-4xl text-3xl font-black leading-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                        CarMazium reviews and customer feedback
                    </h1>
                    <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
                        Buying or selling a car is a significant decision. We welcome genuine experiences, questions and concerns,
                        and we believe any published customer review should have a traceable source.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <a
                            href="mailto:info@carmazium.com?subject=CarMazium%20customer%20feedback"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <Mail size={17} aria-hidden="true" /> Share your experience
                        </a>
                        <Link
                            href="/search"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <BookOpen size={17} aria-hidden="true" /> Browse used cars
                        </Link>
                    </div>
                </header>

                <section aria-labelledby="reviews-transparency" className="mt-10 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <BadgeCheck className="mt-1 shrink-0 text-amber-600 dark:text-amber-400" size={25} aria-hidden="true" />
                        <div>
                            <h2 id="reviews-transparency" className="text-xl font-black text-[var(--text-primary)]">
                                Our approach to genuine reviews
                            </h2>
                            <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--text-secondary)]">
                                We do not currently display a sourced customer-review feed or a calculated star average on this page.
                                We will not use made-up customer quotes, names, star ratings or customer counts as substitutes for real feedback.
                                If authenticated reviews become available, their publication will need an appropriate source and permission.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-16 md:mt-20" aria-labelledby="buyer-checks-heading">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Confidence through information</p>
                    <h2 id="buyer-checks-heading" className="mt-3 text-2xl font-black text-[var(--text-primary)] md:text-3xl">
                        What to check before buying
                    </h2>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                        A positive testimonial cannot replace checking the individual car and seller. Use these practical steps
                        alongside your own inspection and independent research.
                    </p>
                    <div className="mt-8 grid gap-5 md:grid-cols-3">
                        {BUYER_CHECKS.map((item) => {
                            const Icon = item.icon
                            return (
                                <article key={item.label} className={"flex h-full flex-col rounded-3xl border bg-gradient-to-br p-6 shadow-sm " + item.accent}>
                                    <div className={"mb-5 flex h-12 w-12 items-center justify-center rounded-2xl " + item.iconStyle}>
                                        <Icon size={24} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-xl font-black text-[var(--text-primary)]">{item.label}</h3>
                                    <p className="mt-4 flex-1 text-sm leading-7 text-[var(--text-secondary)]">{item.description}</p>
                                    <Link href={item.href} className="mt-6 inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        {item.link} <ArrowRight size={16} aria-hidden="true" />
                                    </Link>
                                </article>
                            )
                        })}
                    </div>
                </section>

                <section aria-labelledby="independent-checks" className="mt-16 grid gap-8 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:grid-cols-[auto_1fr] md:p-10">
                    <SearchCheck className="text-primary" size={37} aria-hidden="true" />
                    <div>
                        <h2 id="independent-checks" className="text-2xl font-black text-[var(--text-primary)]">Use independent vehicle checks</h2>
                        <p className="mt-4 text-sm leading-8 text-[var(--text-secondary)]">
                            Before committing to a purchase, verify the vehicle registration and identity, review the available DVLA and MOT information,
                            consider an independent history check where appropriate, and inspect or arrange an inspection of the vehicle.
                            The details supplied in an advert should be checked against the actual car and its documents.
                        </p>
                        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                            CarMazium does not require buyers to purchase a vehicle history report, but you can choose independent checks to suit your circumstances.
                        </p>
                        <Link href="/used-car-types" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline">
                            Compare used-car body types <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </section>

                <section aria-labelledby="feedback-heading" className="mt-16 rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-violet-500/10 px-6 py-9 md:px-10 md:py-12">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-primary" size={26} aria-hidden="true" />
                        <h2 id="feedback-heading" className="text-2xl font-black text-[var(--text-primary)]">Tell us about your experience</h2>
                    </div>
                    <p className="mt-4 max-w-4xl text-sm leading-8 text-[var(--text-secondary)]">
                        If you bought, sold or tried to use a service on CarMazium, email us with the relevant listing URL,
                        a brief description and the date. Please do not send passwords, identity-document images or bank account details.
                        Sending feedback by email does not automatically publish a public review.
                    </p>
                    <a href="mailto:info@carmazium.com?subject=CarMazium%20customer%20feedback" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Mail size={17} aria-hidden="true" /> Email CarMazium feedback
                    </a>
                </section>
            </div>
        </main>
    )
}
