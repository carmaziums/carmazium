"use client"

import Link from "next/link"
import { ArrowUpRight, Gavel, Gift, Handshake, Tag } from "lucide-react"

/**
 * The existing homepage lazy-import name is retained for compatibility.
 * Real customer reviews must not be hard-coded: the previous static names,
 * stock portraits, "verified" badges and "Trusted by Thousands" heading had
 * no linked source of approval or genuine review evidence in the application.
 *
 * Show accurate marketplace benefits until genuine, consented testimonials
 * can be fetched from a verified review source.
 */
const BENEFITS = [
    {
        icon: Gavel,
        eyebrow: "AUCTION FREE",
        title: "Let verified dealers bid",
        description: "List your vehicle in the dealer auction without a seller listing fee. Verified motor traders can compete to buy it.",
        href: "/sell",
        linkLabel: "Sell by auction",
        theme: "from-rose-500/15 via-red-500/5 to-transparent border-rose-500/25",
        iconTheme: "bg-rose-600 text-white",
    },
    {
        icon: Tag,
        eyebrow: "RETAIL £1",
        title: "Advertise to UK buyers",
        description: "Prefer a direct retail sale? Create a listing for a one-time £1 fee until sold, and advertise your vehicle to buyers.",
        href: "/sell",
        linkLabel: "Create a retail listing",
        theme: "from-sky-500/15 via-blue-500/5 to-transparent border-sky-500/25",
        iconTheme: "bg-sky-600 text-white",
    },
    {
        icon: Gift,
        eyebrow: "£100 SELLER REWARD",
        title: "A reward for auction sellers",
        description: "Qualifying completed auction sales can earn a £100 seller reward once the handover photograph has been approved.",
        href: "/how-it-works",
        linkLabel: "See how it works",
        theme: "from-amber-500/15 via-orange-500/5 to-transparent border-amber-500/25",
        iconTheme: "bg-amber-500 text-slate-950",
    },
    {
        icon: Handshake,
        eyebrow: "DIRECT TRANSACTIONS",
        title: "Your vehicle payment stays direct",
        description: "Vehicle purchase funds pass directly between buyer and seller. CarMazium collects its own platform fees, not the vehicle price.",
        href: "/pricing",
        linkLabel: "Understand the fees",
        theme: "from-emerald-500/15 via-teal-500/5 to-transparent border-emerald-500/25",
        iconTheme: "bg-emerald-600 text-white",
    },
] as const

export function TestimonialsSection() {
    return (
        <section className="relative overflow-hidden border-y border-[var(--border-default)] py-16 md:py-24" aria-labelledby="why-carmazium">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-sky-500/5" />
            <div className="container relative z-10 mx-auto px-5">
                <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.19em] text-primary">
                        A different way to buy and sell cars
                    </p>
                    <h2 id="why-carmazium" className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-5xl">
                        More choice. <span className="text-primary">Clearer fees.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] md:text-lg">
                        Choose a free dealer auction or a £1 retail listing, with transparent
                        terms and straightforward next steps.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {BENEFITS.map((benefit) => {
                        const Icon = benefit.icon
                        return (
                            <article
                                key={benefit.eyebrow}
                                className={"group flex h-full flex-col rounded-3xl border bg-gradient-to-br p-6 shadow-lg shadow-black/5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl " + benefit.theme}
                            >
                                <div className={"mb-6 flex h-12 w-12 items-center justify-center rounded-2xl shadow-md " + benefit.iconTheme}>
                                    <Icon size={24} aria-hidden="true" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.13em] text-primary">{benefit.eyebrow}</p>
                                <h3 className="mt-3 text-xl font-black leading-snug text-[var(--text-primary)]">{benefit.title}</h3>
                                <p className="mt-3 flex-grow text-sm leading-7 text-[var(--text-secondary)]">{benefit.description}</p>
                                <Link
                                    href={benefit.href}
                                    className="mt-7 inline-flex min-h-11 items-center gap-2 self-start rounded-lg text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    {benefit.linkLabel} <ArrowUpRight size={17} aria-hidden="true" />
                                </Link>
                            </article>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
