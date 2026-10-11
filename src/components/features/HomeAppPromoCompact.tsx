import Link from "next/link"
import { ArrowRight, CarFront, CheckCircle2, Smartphone } from "lucide-react"
import { FaApple, FaGooglePlay } from "react-icons/fa"

/**
 * Compact homepage reminder using the same blue/purple/cyan campaign styling
 * as FooterAppPromo. This intentionally is not another giant hero section.
 *
 * iPhone and Android lead to the verified-installation status page.
 * Microsoft Store is an active link to the verified-installation status page.
 * Only /download-app offers a direct store install after a valid release URL is configured.
 */
export function HomeAppPromoCompact() {
  const installClass =
    "group flex min-h-[68px] items-center gap-3 rounded-2xl border border-cyan-200/35 bg-[#071436]/90 px-4 py-3 text-left text-white shadow-[0_8px_24px_rgba(4,16,60,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-[#12255a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#191357] motion-reduce:transform-none"

  return (
    <section aria-labelledby="carmazium-app-home-title" className="container mx-auto mb-10 px-5 md:mb-16">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-cyan-300/40 bg-[#0a1850] text-white shadow-[0_20px_55px_rgba(20,36,99,0.28)]">
        {/* Campaign lighting echoes the large approved CarMazium visual. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_76%_0%,rgba(0,177,255,0.55),transparent_52%),radial-gradient(ellipse_at_2%_100%,rgba(134,43,245,0.62),transparent_58%),linear-gradient(120deg,#0a1553_0%,#104398_54%,#241072_100%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-40 h-80 w-80 rounded-full border-[12px] border-cyan-300/25 blur-lg" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 h-52 w-80 rounded-full bg-fuchsia-500/20 blur-[54px]" />

        <div className="relative z-10 grid items-center gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_1.15fr] lg:gap-8 lg:px-10 lg:py-10">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-2xl font-black shadow-[0_0_22px_rgba(255,84,113,0.42)]" aria-hidden="true">C</span>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                Car<span className="text-[#ff819c]">Mazium</span> on the go
              </p>
            </div>
            <h2 id="carmazium-app-home-title" className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Get the <span className="bg-gradient-to-r from-[#ffbc93] via-[#ff778b] to-[#ff5b82] bg-clip-text text-transparent">CarMazium</span> App
            </h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-white sm:text-base">
              Browse, buy, sell and manage your cars wherever you are.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-blue-100">
              <span className="inline-flex items-center gap-1.5"><CarFront className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Find cars</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> Manage listings</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-pink-300" aria-hidden="true" /> Your device</span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-100">
              Choose your installation option
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/download-app#iphone" className={installClass} aria-label="Check official CarMazium iPhone installation options">
                <FaApple className="h-8 w-8 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-blue-100">Get it for</span>
                  <span className="block text-sm font-black">iPhone</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-200 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
              <Link href="/download-app#android" className={installClass} aria-label="Check official CarMazium Android installation options">
                <FaGooglePlay className="h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-blue-100">Get it for</span>
                  <span className="block text-sm font-black">Android</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-200 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
              <Link href="/download-app#windows" className={installClass} aria-label="Check official CarMazium Microsoft Store installation options">
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 grid-cols-2 gap-[2px]">
                  <span className="bg-[#f35325]" /><span className="bg-[#81bc06]" />
                  <span className="bg-[#05a6f0]" /><span className="bg-[#ffba08]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-blue-100">Get it from</span>
                  <span className="block text-sm font-black leading-tight">Microsoft Store</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-200 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-100">
              Official installation links are offered only when a verified release is ready.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
