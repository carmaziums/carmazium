import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight, CheckCircle2, Mail } from "lucide-react"
import { businessSpotlights } from "@/lib/businessSpotlights"

const business = businessSpotlights.find((item) => item.slug === "simpledms")!

export const metadata: Metadata = {
  title: "SimpleDMS | Dealer Management Software | CarMazium",
  description:
    "Discover SimpleDMS BuySmart buying intelligence and dealer management for independent UK used-car dealers in CarMazium Business Spotlight.",
  alternates: { canonical: "/business-spotlight/simpledms" },
}

export default function SimpleDmsSpotlight() {
  return (
    <div className="min-h-screen bg-[var(--bg-body)] pb-20 pt-24 text-[var(--text-primary)]">
      <section className="bg-[#112d3e] px-5 py-14 text-white sm:py-20">
        <div className="container mx-auto max-w-6xl">
          <Link href="/business-spotlight" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a7e8df] hover:text-white">
            <ArrowLeft size={17} aria-hidden="true" /> All business spotlights
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#8be2d9]">
            CarMazium featured business partner • Dealer management software
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{business.name}</h1>
          <p className="mt-5 max-w-3xl text-2xl font-semibold text-[#b3eee8]">{business.strapline}</p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-200">{business.summary}</p>
          <a
            href={business.website} target="_blank" rel="noopener noreferrer sponsored"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#38b4a6] px-6 py-3 font-bold text-[#0c2f3f] transition hover:bg-[#8de9df]"
          >
            <ArrowUpRight size={18} aria-hidden="true" /> Explore SimpleDMS BuySmart
          </a>
        </div>
      </section>

      <section className="container mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">What SimpleDMS offers</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            SimpleDMS combines buying intelligence with dealership-management services. Its BuySmart promotional material presents auction research, vehicle history and buying guidance. Confirm available products and subscription details directly with SimpleDMS.
          </p>
          <ul className="mt-7 space-y-5">
            {business.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm leading-7 text-[var(--text-secondary)]">
                <CheckCircle2 className="mt-1 shrink-0 text-[#2baf9e]" size={20} aria-hidden="true" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="h-fit rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2bab9e]">For independent motor dealers</p>
          <h2 className="mt-3 text-2xl font-black">Talk to SimpleDMS</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            Explore BuySmart or ask SimpleDMS directly about its services, onboarding and current pricing.
          </p>
          <a href={`mailto:${business.email}`} className="mt-6 block break-all font-bold text-[#2b9f94] underline underline-offset-4">
            {business.email}
          </a>
        </aside>
      </section>

      <section className="container mx-auto max-w-6xl px-5">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-xs leading-6 text-[var(--text-muted)]">
          <strong>Important:</strong> SimpleDMS is an independent third-party software provider. This promotional business profile does not mean the proposed CarMazium–SimpleDMS data integration is active. No dealership enrolment, account access or data sharing occurs when this profile is viewed.
        </div>
      </section>
    </div>
  )
}
