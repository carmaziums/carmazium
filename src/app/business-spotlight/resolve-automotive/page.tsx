import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react"
import { businessSpotlights } from "@/lib/businessSpotlights"

const business = businessSpotlights.find((item) => item.slug === "resolve-automotive")!

export const metadata: Metadata = {
  title: "Resolve Automotive | After-Sales Complaints Handling | CarMazium",
  description:
    "Meet Resolve Automotive, CarMazium's featured specialist business partner for outsourced motor-trade customer complaints handling.",
  alternates: { canonical: "/business-spotlight/resolve-automotive" },
}

export default function ResolveAutomotiveSpotlight() {
  return (
    <main className="min-h-screen bg-[var(--bg-body)] pb-20 pt-24 text-[var(--text-primary)]">
      <section className="bg-[#112d3e] px-5 py-14 text-white sm:py-20">
        <div className="container mx-auto max-w-6xl">
          <Link href="/business-spotlight" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a7e8df] hover:text-white">
            <ArrowLeft size={17} aria-hidden="true" /> All business spotlights
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#8be2d9]">CarMazium featured business partner • After-sales support</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{business.name}</h1>
          <p className="mt-5 max-w-3xl text-2xl font-semibold text-[#b3eee8]">{business.strapline}</p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-200">{business.summary}</p>
          <a
            href={`mailto:${business.email}?subject=Resolve%20Automotive%20Enquiry%20via%20CarMazium`}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#38b4a6] px-6 py-3 font-bold text-[#0c2f3f] transition hover:bg-[#8de9df]"
          >
            <Mail size={18} aria-hidden="true" /> Enquire with Resolve Automotive
          </a>
        </div>
      </section>

      <section className="container mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">What Resolve Automotive offers</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
            Resolve Automotive advertises a managed, end-to-end service for motor dealers dealing with customer after-sales complaints. Its approach is designed to support communication, evidence tracking and the pursuit of fair outcomes.
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
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2bab9e]">For motor-trade businesses</p>
          <h2 className="mt-3 text-2xl font-black">Find out more</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{business.priceNote}</p>
          <a href={`mailto:${business.email}`} className="mt-6 block break-all font-bold text-[#2b9f94] underline underline-offset-4">
            {business.email}
          </a>
        </aside>
      </section>
      <section className="container mx-auto max-w-6xl px-5">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-xs leading-6 text-[var(--text-muted)]">
          <strong>Important:</strong> Resolve Automotive is a separate third-party business. CarMazium's feature does not automatically enrol any dealer or transfer any customer complaint. Buyers should first contact the business that sold them the vehicle. Outsourcing complaint handling does not remove a trader's responsibilities under applicable consumer law. Resolve Automotive is not being presented as an official ombudsman or statutory dispute-resolution body.
        </div>
      </section>
    </main>
  )
}
