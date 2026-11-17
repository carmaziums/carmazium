import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { businessSpotlights } from "@/lib/businessSpotlights"

/**
 * Responsive homepage partner promotion.
 * Independent third-party business profiles only; no integration, automatic
 * referrals or partner-data sharing is implied by appearing here.
 */
export function BusinessSpotlightPromo() {
  const featured = businessSpotlights.filter((business) => business.featured)
  if (!featured.length) return null

  return (
    <section
      aria-labelledby="business-spotlight-heading"
      className="relative isolate overflow-hidden border-y border-[#2b9d94]/40 bg-[#102d3d] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#34b2a5]/20 blur-3xl" />
      <div className="container relative mx-auto max-w-6xl px-5 py-11 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#79e0d5]">
          CarMazium business spotlight
        </p>
        <h2 id="business-spotlight-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          Meet our featured automotive businesses
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
          Discover independent services for the motor trade. Explore each profile to learn more and contact the business directly.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {featured.map((business) => (
            <article key={business.slug} className="flex h-full flex-col rounded-2xl border border-[#56bbb0]/45 bg-white/[0.08] p-6 shadow-xl backdrop-blur-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#9ceddf]">{business.category}</p>
              <h3 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">{business.name}</h3>
              <p className="mt-2 text-lg font-semibold text-[#bceee8]">{business.strapline}</p>
              <p className="mt-4 text-sm leading-7 text-slate-200">{business.summary}</p>
              {business.bannerDesktopUrl ? (
                <div className="mt-5 overflow-hidden rounded-xl border border-white/15 bg-[#06121e]">
                  <Image
                    src={business.bannerDesktopUrl}
                    alt="SimpleDMS BuySmart dealer buying intelligence: original business-approved advertising banner with example reports"
                    width={1920}
                    height={960}
                    sizes="(max-width: 768px) 100vw, 580px"
                    className="h-auto w-full"
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-white/15 bg-white/[0.07] p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9ceddf]">Specialist partner services</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                    {business.highlights.slice(0, 3).map((highlight) => (
                      <li key={highlight} className="flex gap-2"><span aria-hidden="true" className="text-[#79e0d5]">•</span>{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link
                href={`/business-spotlight/${business.slug}`}
                className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[#38b4a6] px-5 py-3 text-sm font-bold text-[#082936] transition hover:bg-[#81e3d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Discover {business.name} <ArrowRight size={17} aria-hidden="true" />
              </Link>
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Visit BuySmart <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              )}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 text-sm text-slate-300">
          <p>Independent businesses. Promotional inclusion does not imply CarMazium provides or endorses every service.</p>
          <Link href="/business-spotlight" className="shrink-0 font-semibold text-[#9ceddf] underline underline-offset-4 hover:text-white">View all partners</Link>
        </div>
      </div>
    </section>
  )
}
