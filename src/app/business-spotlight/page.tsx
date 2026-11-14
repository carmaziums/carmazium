import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Building2, Mail } from "lucide-react"
import { businessSpotlights } from "@/lib/businessSpotlights"

export const metadata: Metadata = {
  title: "Business Spotlight | CarMazium Automotive Partners",
  description:
    "Discover automotive businesses featured by CarMazium, including after-sales specialists and motor-trade service providers.",
  alternates: { canonical: "/business-spotlight" },
}

export default function BusinessSpotlightDirectory() {
  return (
    <main className="min-h-screen bg-[var(--bg-body)] pb-20 pt-24 text-[var(--text-primary)]">
      <section className="bg-[#112d3e] px-5 py-16 text-white sm:py-20">
        <div className="container mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8be2d9]">CarMazium partner directory</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Business Spotlight</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">
            Explore specialist automotive businesses and the services they offer. Featured businesses have dedicated pages that remain available after their homepage promotion ends.
          </p>
        </div>
      </section>

      <section aria-labelledby="featured-businesses" className="container mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <div className="mb-8">
          <h2 id="featured-businesses" className="text-2xl font-black tracking-tight sm:text-3xl">Featured automotive businesses</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">Our directory will grow as additional businesses join the spotlight.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {businessSpotlights.map((business) => (
            <article
              key={business.slug}
              className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm"
            >
              <div className="bg-[#102f40] p-7 text-white sm:p-9">
                <span className="inline-flex rounded-full border border-[#7be4d8]/50 bg-[#2da99b]/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#aaf0e8]">
                  {business.category}
                </span>
                <h3 className="mt-5 text-3xl font-black tracking-tight">{business.name}</h3>
                <p className="mt-2 text-lg font-semibold text-[#b3eee8]">{business.strapline}</p>
              </div>
              <div className="p-7 sm:p-9">
                <p className="text-sm leading-7 text-[var(--text-secondary)]">{business.summary}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/business-spotlight/${business.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#258f86] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#16756f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Read business profile <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <a
                    href={`mailto:${business.email}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] px-5 py-3 text-sm font-semibold transition hover:bg-[var(--bg-hover)]"
                  >
                    <Mail size={16} aria-hidden="true" /> Contact business
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 sm:p-9">
          <div className="flex flex-wrap items-start gap-4">
            <Building2 aria-hidden="true" className="mt-1 text-[#2aab9e]" size={27} />
            <div>
              <h2 className="text-xl font-black">Want your automotive business to be featured?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                Contact CarMazium to discuss an editorial or promotional feature. Listing and placement are subject to approval, accurate business information and agreed terms.
              </p>
              <a href="mailto:info@carmazium.com?subject=Business%20Spotlight%20Enquiry" className="mt-4 inline-flex font-bold text-[#2aa99a] underline underline-offset-4">
                info@carmazium.com
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
