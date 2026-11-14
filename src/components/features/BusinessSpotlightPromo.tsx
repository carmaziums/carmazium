import Link from "next/link"
import { ArrowRight, Headset, ShieldCheck } from "lucide-react"
import { featuredBusinessSpotlight } from "@/lib/businessSpotlights"

/**
 * Reusable and responsive homepage partner promotion.
 * This points to an evergreen business profile, not a third-party booking
 * or complaint submission flow.
 */
export function BusinessSpotlightPromo() {
  const business = featuredBusinessSpotlight()
  if (!business) return null

  return (
    <section
      aria-labelledby="business-spotlight-heading"
      className="relative isolate overflow-hidden border-y border-[#2b9d94]/40 bg-[#102d3d] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#34b2a5]/20 blur-3xl" />
      <div className="container relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-11 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:gap-10 md:py-14">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.17em] text-[#79e0d5]">
            CarMazium featured business partner
          </p>
          <h2 id="business-spotlight-heading" className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {business.name}
          </h2>
          <p className="mt-3 max-w-xl text-xl font-semibold text-[#bceee8]">{business.strapline}</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            {business.summary}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/business-spotlight/${business.slug}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#38b4a6] px-5 py-3 text-sm font-bold text-[#082936] transition hover:bg-[#81e3d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Discover {business.name} <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/business-spotlight"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              View business spotlight
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[#56bbb0]/45 bg-white/[0.075] p-6 shadow-xl backdrop-blur-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#9ceddf]">Motor-trade specialist</p>
          <div className="mt-5 flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[#81dcd2]" size={25} />
            <div>
              <p className="font-bold text-white">Dedicated case handling</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">An outsourced complaints process with a case history and progress updates.</p>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-3">
            <Headset aria-hidden="true" className="mt-0.5 shrink-0 text-[#81dcd2]" size={25} />
            <div>
              <p className="font-bold text-white">Less time on disputes</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">Support for participating dealers, so their teams can stay focused on customers and sales.</p>
            </div>
          </div>
          <p className="mt-6 border-t border-white/20 pt-4 text-xs leading-5 text-slate-300">
            Independent third-party service. A dealer remains responsible for its statutory consumer obligations; CarMazium does not automatically handle or refer every dispute.
          </p>
        </div>
      </div>
    </section>
  )
}
