import Image from "next/image"
import Link from "next/link"
import { Apple, ArrowRight, BarChart3, CarFront, Heart, Search, Smartphone, Tag } from "lucide-react"

const features = [
  { label: "Browse cars", detail: "Find your next car", Icon: CarFront, color: "bg-violet-600" },
  { label: "Buy & sell", detail: "Quick and easy", Icon: Tag, color: "bg-rose-500" },
  { label: "Get valuations", detail: "Know your car's value", Icon: BarChart3, color: "bg-sky-500" },
  { label: "Save & compare", detail: "Keep your favourites", Icon: Heart, color: "bg-emerald-500" },
]

const installLinkClass =
  "group inline-flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-white/30 bg-slate-950/85 px-4 py-3 text-left text-white shadow-[0_0_22px_rgba(72,124,255,0.38)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"

function PlayMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 26" className="h-9 w-9 shrink-0">
      <path fill="#34A853" d="M1 1.5v23L13.2 13z" />
      <path fill="#4285F4" d="M1 1.5 14.9 10 19.7 7.2 4.3.7a2.4 2.4 0 0 0-3.3.8z" />
      <path fill="#EA4335" d="m1 24.5 13.9-8.5 4.8 2.8-15.4 6.5a2.4 2.4 0 0 1-3.3-.8z" />
      <path fill="#FBBC04" d="m13.2 13 6.5-5.8 3.1 3a3 3 0 0 1 0 5.6l-3.1 3z" />
    </svg>
  )
}

function WindowsMark() {
  return (
    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 grid-cols-2 gap-0.5">
      <span className="bg-[#f35325]" /><span className="bg-[#81bc06]" />
      <span className="bg-[#05a6f0]" /><span className="bg-[#ffba08]" />
    </span>
  )
}

/**
 * A responsive, interactive version of the approved CarMazium app-install
 * campaign artwork. Store links remain routed through /download-app, which
 * only exposes validated customer installation destinations. Microsoft Store
 * now links to its status section just like Apple/Android, but is not a direct
 * store download until a verified Microsoft listing exists.
 */
export function FooterAppPromo() {
  return (
    <section
      aria-labelledby="footer-app-promo-heading"
      className="relative isolate mb-12 overflow-hidden rounded-[1.75rem] border border-blue-400/40 bg-[#080f4d] text-white shadow-[0_20px_80px_rgba(0,0,0,.25)] sm:rounded-[2.25rem]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(48,131,255,.76),transparent_53%),radial-gradient(ellipse_at_0%_100%,rgba(124,32,239,.62),transparent_49%),linear-gradient(120deg,#0b175e_0%,#0a1243_52%,#210c6c_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 bottom-10 h-64 w-[65%] rotate-[-18deg] rounded-[100%] border-[16px] border-fuchsia-500/40 blur-xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-28 h-64 w-3/5 rotate-[14deg] rounded-[100%] border-[11px] border-cyan-400/60 blur-md" />
      <div className="relative grid items-center gap-6 px-5 pb-7 pt-7 sm:px-8 sm:pb-9 sm:pt-9 lg:grid-cols-[1.1fr_.9fr] lg:gap-4 lg:px-11 lg:py-11">
        <div className="relative z-10 min-w-0">
          <div className="mb-5 flex items-center gap-3 sm:mb-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-3xl font-black shadow-[0_0_18px_rgba(255,65,65,.45)]">C</span>
            <span className="text-xl font-black uppercase tracking-tight sm:text-2xl">
              Car<span className="text-[#ff5765]">Mazium</span>
            </span>
          </div>
          <h2 id="footer-app-promo-heading" className="max-w-3xl text-[clamp(2.1rem,5vw,4.5rem)] font-black leading-[1.05] tracking-tight">
            Get the<br />
            <span className="bg-gradient-to-r from-[#ff985c] via-[#ff526c] to-[#ff6165] bg-clip-text text-transparent">CarMazium</span> App
          </h2>
          <p className="mt-4 text-lg font-extrabold leading-snug sm:text-2xl">
            For iPhone, Android and Windows
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
            Browse, buy, sell and manage your cars on the go.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:mt-7">
            <Link href="/download-app#iphone-app-title" className={installLinkClass} aria-label="See official CarMazium iPhone installation options">
              <Apple className="h-8 w-8 shrink-0 fill-white" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium text-slate-200">Get it for</span><span className="block text-sm font-black sm:text-base">iPhone</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/download-app#android-app-title" className={installLinkClass} aria-label="See official CarMazium Android installation options">
              <PlayMark />
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium text-slate-200">Get it for</span><span className="block text-sm font-black sm:text-base">Android</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/download-app#windows" className={installLinkClass} aria-label="See official CarMazium Microsoft Store installation options">
              <WindowsMark />
              <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium text-slate-200">Get it from</span><span className="block text-sm font-black leading-tight sm:text-base">Microsoft Store</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-indigo-200">
            Install options are shown only when verified releases are ready.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:mt-9">
            {features.map(({ label, detail, Icon, color }) => (
              <div key={label} className="flex min-w-0 items-start gap-2 sm:block">
                <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-lg sm:mb-2 " + color}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase leading-snug">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-indigo-200">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="relative mx-auto h-[300px] w-full max-w-[510px] sm:h-[405px] lg:h-[470px]">
          <div className="absolute right-[3%] top-[3%] grid h-20 w-20 place-items-center rounded-[1.5rem] border border-cyan-300/60 bg-cyan-400/20 shadow-[0_0_40px_rgba(0,210,255,.6)] backdrop-blur-lg sm:h-24 sm:w-24">
            <Smartphone className="h-11 w-11 text-lime-300" />
          </div>
          <div className="absolute left-[10%] top-[2%] grid h-20 w-20 place-items-center rounded-[1.5rem] border border-cyan-300/60 bg-blue-500/30 shadow-[0_0_40px_rgba(30,120,255,.6)] backdrop-blur-lg sm:h-24 sm:w-24">
            <Apple className="h-12 w-12 fill-white text-white" />
          </div>
          <div className="absolute left-[43%] top-[-1%] grid h-14 w-14 place-items-center rounded-[1rem] border border-cyan-300/60 bg-blue-500/35 shadow-[0_0_35px_rgba(30,120,255,.5)] backdrop-blur-lg sm:h-20 sm:w-20">
            <WindowsMark />
          </div>
          <div className="absolute bottom-0 left-[11%] h-[82%] w-[53%] rotate-[-5deg] overflow-hidden rounded-[2rem] border-[6px] border-[#050b24] bg-white text-slate-900 shadow-[18px_20px_55px_rgba(0,0,0,.6)] sm:rounded-[2.6rem] sm:border-[8px]">
            <div className="relative h-full overflow-hidden rounded-[1.5rem] bg-[#fafaff] sm:rounded-[2rem]">
              <div className="bg-[#0d214f] px-3 pb-3 pt-5 text-white">
                <p className="text-[9px] font-black uppercase tracking-tight sm:text-xs">Car<span className="text-rose-500">Mazium</span></p>
                <p className="mt-3 text-base font-black leading-tight sm:text-xl">Find your<br />next car</p>
                <div className="mt-3 flex h-7 items-center gap-1.5 rounded-lg bg-white px-2 text-[8px] text-slate-500">
                  <Search className="h-3 w-3" /> Search cars...
                </div>
              </div>
              <div className="p-2 sm:p-3">
                <div className="mb-2 flex justify-between gap-1 text-[7px] font-semibold sm:text-[9px]">
                  <span className="rounded bg-blue-600 px-1.5 py-1 text-white">Buy Cars</span>
                  <span className="rounded bg-slate-100 px-1 py-1">Sell Cars</span>
                  <span className="rounded bg-slate-100 px-1 py-1">Valuation</span>
                </div>
                <div className="overflow-hidden rounded-xl bg-sky-50">
                  <Image src="/assets/images/featured-suv.png" alt="" width={420} height={240} className="h-[85px] w-full object-contain sm:h-[125px]" />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[7px] font-bold text-slate-700 sm:text-[9px]">
                  <span className="rounded-lg border bg-white p-1.5">Buy</span>
                  <span className="rounded-lg border bg-white p-1.5">Sell</span>
                  <span className="rounded-lg border bg-white p-1.5">Value</span>
                  <span className="rounded-lg border bg-white p-1.5">Saved</span>
                  <span className="rounded-lg border bg-white p-1.5">Compare</span>
                  <span className="rounded-lg border bg-white p-1.5">More</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-[2%] right-[5%] h-[73%] w-[43%] rotate-[7deg] overflow-hidden rounded-[2rem] border-[6px] border-[#050b24] bg-white text-slate-900 shadow-[18px_15px_45px_rgba(0,0,0,.45)] sm:rounded-[2.6rem] sm:border-[8px]">
            <div className="h-full overflow-hidden rounded-[1.5rem] bg-slate-50 sm:rounded-[2rem]">
              <div className="bg-[#0d214f] px-3 pb-3 pt-6 text-white">
                <p className="text-[8px] font-black sm:text-[11px]">Car<span className="text-rose-500">Mazium</span></p>
                <p className="mt-3 text-sm font-black leading-tight sm:text-lg">Find. Buy. Sell.<br />All in one.</p>
              </div>
              <Image src="/assets/images/featured-sports.png" alt="" width={420} height={240} className="h-[85px] w-full bg-white object-contain sm:h-[105px]" />
              <div className="grid gap-2 px-2 pt-3 text-[8px] font-bold text-slate-700 sm:text-[10px]">
                <span className="rounded-lg bg-white px-2 py-2 shadow-sm">Buy Cars →</span>
                <span className="rounded-lg bg-white px-2 py-2 shadow-sm">Sell Cars →</span>
                <span className="rounded-lg bg-white px-2 py-2 shadow-sm">Get Valuation →</span>
                <span className="rounded-lg bg-white px-2 py-2 shadow-sm">Saved Cars →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
