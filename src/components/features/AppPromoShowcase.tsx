import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeftRight, ArrowRight, CarFront, ChartNoAxesColumnIncreasing, Heart, Search, Tag } from "lucide-react"
import { FaAndroid, FaApple, FaGooglePlay, FaWindows } from "react-icons/fa"

/**
 * Shared website-only download promotion. Decorative device mockups are made
 * from accessible HTML/CSS, not screenshots of unshipped native software.
 * Store buttons are real DOM links supplied by the calling page.
 */
export const appPromoButtonClass =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/40 bg-[#090e27]/90 px-4 py-3 text-left text-white shadow-[0_0_22px_rgba(77,145,255,0.25)] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-[#192758] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"

export function AppPromoShowcase({
  variant = "footer",
  actions,
}: {
  variant?: "footer" | "page"
  actions?: ReactNode
}) {
  const isFooter = variant === "footer"

  return (
    <section
      aria-label="Get the CarMazium app"
      className={
        "relative isolate overflow-hidden rounded-[1.75rem] border border-blue-400/40 bg-[#081746] text-white shadow-[0_22px_70px_rgba(10,23,72,0.35)] " +
        (isFooter ? "px-5 py-8 sm:px-9 sm:py-10 lg:px-12" : "px-5 py-11 sm:px-10 sm:py-14 lg:px-14 lg:py-20")
      }
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_66%_15%,rgba(0,174,255,0.65),transparent_47%),radial-gradient(ellipse_at_86%_87%,rgba(153,39,255,0.55),transparent_46%),linear-gradient(118deg,#061235_4%,#073281_48%,#2d1077_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full border-[3px] border-cyan-300/45 shadow-[0_0_38px_15px_rgba(17,169,255,0.25)] blur-[2px] sm:h-[33rem] sm:w-[33rem]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-8 right-[-10%] h-20 w-[75%] -rotate-12 rounded-full bg-fuchsia-500/40 blur-[56px]" />

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:gap-5">
        <div className="min-w-0">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-pink-400/55 bg-indigo-950/50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-pink-200">
            <span className="h-2 w-2 rounded-full bg-pink-400" aria-hidden="true" />
            CarMazium mobile
          </p>
          <h2 className={"font-black leading-[1.06] tracking-tight " + (isFooter ? "text-3xl sm:text-5xl xl:text-6xl" : "text-4xl sm:text-6xl xl:text-7xl")}>
            Get the <span className="block"><span className="bg-gradient-to-r from-[#ff875d] via-[#ff4c6c] to-[#ff709d] bg-clip-text text-transparent">CarMazium</span> App</span>
          </h2>
          <p className="mt-5 text-lg font-bold text-white sm:text-xl">
            Buy, sell, value and manage your cars on the go.
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
            Explore cars, manage listings, follow auctions and save your favourites — all in one place.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {actions ?? (
              <>
                <Link href="/download-app#iphone" className={appPromoButtonClass} aria-label="See CarMazium iPhone installation options">
                  <FaApple className="h-8 w-8 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 text-xs leading-4">Get it for <strong className="block text-base">iPhone</strong></span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
                <Link href="/download-app#android" className={appPromoButtonClass} aria-label="See CarMazium Android installation options">
                  <FaGooglePlay className="h-7 w-7 shrink-0 text-green-300" aria-hidden="true" />
                  <span className="min-w-0 text-xs leading-4">Get it for <strong className="block text-base">Android</strong></span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
                <Link href="/download-app#windows" className={appPromoButtonClass} aria-label="See Microsoft Store availability information">
                  <FaWindows className="h-7 w-7 shrink-0 text-sky-300" aria-hidden="true" />
                  <span className="min-w-0 text-xs leading-4">Check <strong className="block text-sm">Microsoft Store</strong></span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-5 border-t border-white/20 pt-7 sm:grid-cols-4 sm:gap-4">
            {[
              { icon: CarFront, label: "Browse cars", color: "bg-violet-600" },
              { icon: Tag, label: "Buy & sell", color: "bg-rose-500" },
              { icon: ChartNoAxesColumnIncreasing, label: "Get valuations", color: "bg-sky-500" },
              { icon: Heart, label: "Save & compare", color: "bg-emerald-500" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-2 sm:flex-col sm:items-start">
                <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full " + color}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-extrabold leading-4 text-white sm:text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto hidden h-[470px] w-full max-w-[500px] items-center justify-center md:flex lg:h-[475px]">
          <div className="absolute top-4 left-[5%] flex h-24 w-24 items-center justify-center rounded-[2rem] border border-cyan-300/60 bg-blue-500/35 text-white shadow-[0_0_45px_rgba(0,178,255,0.38)]">
            <FaApple className="h-14 w-14" />
          </div>
          <div className="absolute right-[17%] top-0 flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-blue-300/60 bg-blue-500/45 text-white shadow-[0_0_38px_rgba(0,178,255,0.3)]">
            <FaWindows className="h-11 w-11" />
          </div>
          <div className="absolute right-0 top-24 flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-emerald-300/60 bg-green-500/35 text-lime-300 shadow-[0_0_38px_rgba(46,220,127,0.3)]">
            <FaAndroid className="h-12 w-12" />
          </div>

          <div className="absolute right-3 top-24 w-[205px] rotate-[10deg] overflow-hidden rounded-[2.7rem] border-[7px] border-[#070c1e] bg-white shadow-[0_22px_50px_rgba(0,0,0,0.6)]">
            <div className="rounded-t-[2rem] bg-[#071a46] px-4 pb-5 pt-6 text-white">
              <span className="text-xs font-black"><span className="text-red-400">C</span> CARMAZIUM</span>
              <p className="mt-4 text-lg font-black leading-6">Find. Buy. Sell.<br />All in one app.</p>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              <div className="h-20 rounded-md bg-gradient-to-br from-red-600 via-orange-400 to-slate-900" />
              <div className="h-20 rounded-md bg-gradient-to-br from-cyan-300 via-blue-600 to-slate-900" />
            </div>
            <div className="space-y-1 px-3 pb-7 pt-2 text-[#162c4d]">
              {["Buy Cars", "Sell Cars", "Get Valuation", "Saved Cars", "Compare Cars"].map(label => (
                <p key={label} className="rounded-md border border-slate-100 px-3 py-2 text-[11px] font-bold">{label}</p>
              ))}
            </div>
          </div>

          <div className="absolute bottom-0 left-[14%] w-[229px] -rotate-[7deg] overflow-hidden rounded-[2.9rem] border-[8px] border-[#060b20] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
            <div className="relative bg-[#071a46] px-4 pb-4 pt-8 text-white">
              <span className="absolute left-1/2 top-2 h-3 w-16 -translate-x-1/2 rounded-full bg-black" />
              <span className="text-xs font-black"><span className="text-red-400">C</span> CARMAZIUM</span>
              <p className="mt-4 text-xl font-black leading-6">Find your<br />next car</p>
              <p className="mt-3 flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[10px] text-slate-500">
                <Search className="h-3 w-3" /> Search cars...
              </p>
            </div>
            <div className="relative mx-3 mt-2 h-32 overflow-hidden rounded-lg bg-blue-200">
              <Image src="/assets/images/discover-hero.webp" alt="" fill sizes="230px" className="object-cover" />
            </div>
            <div className="grid grid-cols-3 gap-1 p-3 text-[#1d3555]">
              {[
                { icon: CarFront, label: "Cars" },
                { icon: Tag, label: "Sell" },
                { icon: ChartNoAxesColumnIncreasing, label: "Value" },
                { icon: Heart, label: "Saved" },
                { icon: ArrowLeftRight, label: "Compare" },
                { icon: Search, label: "More" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border border-slate-100 bg-slate-50">
                  <Icon className="h-4 w-4 text-blue-600" />
                  <span className="text-[9px] font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
