"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { BadgeCheck, Gavel, Handshake, ShieldCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/Button"

const TRUST_POINTS = [
    {
        icon: BadgeCheck,
        title: "Verified marketplace profiles",
        text: "Identity and business verification help customers understand who they are dealing with before they transact.",
    },
    {
        icon: Gavel,
        title: "Transparent selling routes",
        text: "Choose a free dealer auction or a retail listing, with the relevant fees and workflow shown before you continue.",
    },
    {
        icon: Handshake,
        title: "Direct vehicle transactions",
        text: "Vehicle purchase funds are agreed and paid directly between buyer and seller; CarMazium provides the marketplace tools.",
    },
    {
        icon: ShieldCheck,
        title: "Checks remain in your control",
        text: "Review listing information, arrange inspections and complete the usual vehicle checks before purchase or handover.",
    },
]

export function TestimonialsSection() {
    return (
        <section className="py-20 md:py-24 border-y border-[var(--border-default)]" style={{ background: "var(--bg-card)" }}>
            <div className="container mx-auto px-5">
                <div className="mx-auto mb-12 max-w-3xl text-center">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary"
                    >
                        Built for clearer decisions
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-5xl font-bold font-heading mb-4"
                    >
                        A marketplace designed around <span className="text-primary">transparency</span>
                    </motion.h2>
                    <p className="text-[var(--text-muted)] text-lg leading-relaxed">
                        CarMazium gives buyers, sellers and automotive businesses clear tools for listings, auctions and vehicle services without inventing social proof or hiding how each workflow operates.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {TRUST_POINTS.map((item, index) => (
                        <motion.article
                            key={item.title}
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.06 }}
                            className="h-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6"
                        >
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                                <item.icon size={22} className="text-primary" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold font-heading">{item.title}</h3>
                            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{item.text}</p>
                        </motion.article>
                    ))}
                </div>

                <div className="mt-10 flex justify-center">
                    <Button asChild variant="outline" size="lg">
                        <Link href="/how-it-works">See how CarMazium works <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </div>
            </div>
        </section>
    )
}
