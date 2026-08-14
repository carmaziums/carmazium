"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import {
  Search, ShieldCheck, Calculator, Gavel, Banknote, Clock, Users, TrendingUp,
  Handshake, Truck, Umbrella, ArrowRight, Phone, Gift, Trophy, ClipboardCheck, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

// ─── Content ────────────────────────────────────────────────────────────────
// Signature device: each flow reads like an itemised receipt, not a grid of
// icon cards — because the one thing CarMazium actually does differently is
// keep the money moving directly between the two of you. The ledger makes
// that literal instead of illustrating it with a stock icon.

type LedgerStep = {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  desc: string
  tag: string
}

const SELLER_STEPS: LedgerStep[] = [
  { icon: Calculator, title: "Get your valuation", desc: "Enter your reg and details for a free, instant estimate.", tag: "Est. £8,450" },
  { icon: Gavel, title: "Go live in auction", desc: "Your car goes live for verified dealers to view and bid on.", tag: "LIVE · 24h" },
  { icon: Users, title: "Dealers compete", desc: "Verified trade buyers bid against each other, not against you.", tag: "3 bids" },
  { icon: Phone, title: "Dealer contacts you", desc: "The winning dealer arranges collection and inspection directly.", tag: "Direct chat" },
  { icon: Banknote, title: "Dealer pays you directly", desc: "The money moves dealer → you. CarMazium is never in that chain.", tag: "£8,450" },
  { icon: Gift, title: "Get your £100 reward", desc: "Submit handover proof and we release your reward.", tag: "+£100" },
]

const BUYER_STEPS: LedgerStep[] = [
  { icon: Search, title: "Search & find", desc: "Filter by make, model, grade and location to shortlist cars.", tag: "142 found" },
  { icon: Gavel, title: "Join the auction", desc: "Bid live against other verified dealers in real time.", tag: "LIVE · 24h" },
  { icon: Trophy, title: "Win the auction", desc: "Highest bid when the clock runs out takes the car.", tag: "Won" },
  { icon: ClipboardCheck, title: "Complete checkout", desc: "Pay the one-off buyer fee that unlocks the seller's contact details.", tag: "£125 fee" },
  { icon: Truck, title: "Arrange collection", desc: "Coordinate inspection and collection directly with the seller.", tag: "Direct chat" },
  { icon: ShieldCheck, title: "Drive with confidence", desc: "Inspect, complete the handover, and it's yours.", tag: "✓ Done" },
]

const RECEIPTS = {
  seller: {
    label: "Your sale, itemised",
    rows: [
      { k: "Vehicle sale price", v: "£8,450", note: "paid to you, by the dealer" },
      { k: "CarMazium listing fee", v: "£0", note: "free, always" },
      { k: "CarMazium seller reward", v: "+£100", note: "paid to you, after handover" },
    ],
    total: { k: "You receive", v: "£8,550" },
  },
  buyer: {
    label: "Your purchase, itemised",
    rows: [
      { k: "Winning bid", v: "£8,450", note: "paid to the seller, directly" },
      { k: "CarMazium buyer fee", v: "£125", note: "unlocks the seller's contact details" },
    ],
    total: { k: "Total to drive away", v: "£8,575" },
  },
}

function Ledger({ steps, startIndex = 0 }: { steps: LedgerStep[]; startIndex?: number }) {
  return (
    <ol className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/50 via-[var(--border-default)] to-transparent" aria-hidden />
      {steps.map((step, idx) => (
        <motion.li
          key={step.title}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, delay: idx * 0.06 }}
          className="relative flex items-start gap-4 py-4"
        >
          <span className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center text-primary">
            <step.icon size={16} />
          </span>
          <div className="flex-grow min-w-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-4 border-b border-[var(--border-default)] pb-4">
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-snug">
                <span className="font-mono text-primary/70 text-xs mr-2 align-middle">{String(startIndex + idx + 1).padStart(2, "0")}</span>
                {step.title}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{step.desc}</p>
            </div>
            <span className="self-start shrink-0 font-mono text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border-default)] rounded-full px-3 py-1 tabular-nums">
              {step.tag}
            </span>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

function ReceiptCard({ receipt }: { receipt: typeof RECEIPTS.seller }) {
  return (
    <div className="relative">
      <div
        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-t-2xl pt-6 px-6 pb-4"
        style={{
          maskImage: "radial-gradient(circle 6px at 12px bottom, transparent 98%, black 100%), radial-gradient(circle 6px at calc(100% - 12px) bottom, transparent 98%, black 100%)",
          WebkitMaskImage: "radial-gradient(circle 6px at 12px bottom, transparent 98%, black 100%), radial-gradient(circle 6px at calc(100% - 12px) bottom, transparent 98%, black 100%)",
        }}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-4">{receipt.label}</p>
        <div className="space-y-2.5">
          {receipt.rows.map((row) => (
            <div key={row.k} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-[var(--text-secondary)]">{row.k}</span>
              <span className="flex-grow border-b border-dotted border-[var(--border-default)] translate-y-[-3px]" />
              <span className="font-mono font-bold tabular-nums shrink-0">{row.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="h-px w-full bg-[repeating-linear-gradient(90deg,var(--border-default)_0,var(--border-default)_6px,transparent_6px,transparent_12px)]"
        aria-hidden
      />
      <div
        className="bg-[var(--bg-input)] border border-[var(--border-default)] border-t-0 rounded-b-2xl px-6 py-4 flex items-baseline justify-between"
        style={{
          maskImage: "radial-gradient(circle 6px at 12px top, transparent 98%, black 100%), radial-gradient(circle 6px at calc(100% - 12px) top, transparent 98%, black 100%)",
          WebkitMaskImage: "radial-gradient(circle 6px at 12px top, transparent 98%, black 100%), radial-gradient(circle 6px at calc(100% - 12px) top, transparent 98%, black 100%)",
        }}
      >
        <span className="font-bold text-sm">{receipt.total.k}</span>
        <span className="font-mono font-black text-xl text-primary tabular-nums">{receipt.total.v}</span>
      </div>
    </div>
  )
}

function PhotoBreak({ src, alt, quote, align = "left" }: { src: string; alt: string; quote: string; align?: "left" | "right" }) {
  return (
    <div className="relative rounded-2xl overflow-hidden my-10 border border-[var(--border-default)]">
      <div className="relative h-[280px] md:h-[340px]">
        <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-r ${align === "left" ? "from-slate-950/95 via-slate-950/60" : "from-transparent via-slate-950/60"} to-slate-950/95`} />
      </div>
      <div className={`absolute inset-0 flex items-center ${align === "left" ? "justify-start text-left" : "justify-end text-right"} p-8 md:p-12`}>
        <p className="max-w-sm text-lg md:text-xl font-heading font-bold text-white leading-snug drop-shadow-lg">
          &ldquo;{quote}&rdquo;
        </p>
      </div>
    </div>
  )
}

function FlowSection({
  eyebrow, title, highlight, subtitle, steps, receipt, ctaLabel, ctaHref, photo,
}: {
  eyebrow: string
  title: string
  highlight: string
  subtitle: string
  steps: LedgerStep[]
  receipt: typeof RECEIPTS.seller
  ctaLabel: string
  ctaHref: string
  photo: { src: string; alt: string; quote: string; align: "left" | "right" }
}) {
  return (
    <section className="py-16 md:py-20 container mx-auto px-5">
      <div className="max-w-2xl mb-10">
        <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-3 font-mono">{eyebrow}</p>
        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
          {title} <span className="text-primary">{highlight}</span>
        </h2>
        <p className="text-[var(--text-muted)] leading-relaxed">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">
        <div className="lg:col-span-3">
          <Ledger steps={steps.slice(0, 3)} startIndex={0} />
          <PhotoBreak src={photo.src} alt={photo.alt} quote={photo.quote} align={photo.align} />
          <Ledger steps={steps.slice(3)} startIndex={3} />
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-28 self-start">
          <ReceiptCard receipt={receipt} />
          <div className="mt-6">
            <Link href={ctaHref}>
              <Button size="lg" shape="pill" className="w-full py-6 text-base shadow-neon group">
                {ctaLabel}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const TRUST_STRIP = [
  { icon: Banknote, label: "Free to list" },
  { icon: ShieldCheck, label: "Verified dealers only" },
  { icon: Handshake, label: "Paid direct, no middleman" },
  { icon: Gift, label: "£100 seller reward" },
]

// A worked example of anti-snipe actually resetting the clock — more honest
// than a static "current bid" stat, which doesn't show the mechanic at all.
const BID_LOG = [
  { t: "23:57:02", amount: "£41,000", reset: true },
  { t: "23:58:41", amount: "£42,500", reset: true },
]

export default function HowItWorksPage() {
  const router = useRouter()

  useEffect(() => {
    router.prefetch('/search')
    router.prefetch('/sell')
  }, [router])

  return (
    <div className="min-h-screen pb-20 selection:bg-primary/30">

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center overflow-hidden h-[70vh] min-h-[500px]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/images/live-auction-hero.jpg"
            alt="A car on auction at sunset"
            fill
            className="object-cover scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/70 to-slate-950" />
        </div>

        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        <div className="container mx-auto px-5 relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-5xl md:text-7xl font-bold font-heading mb-8 text-white tracking-tight drop-shadow-2xl">
              The Future of <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-200">Car Trading is Here</span>
            </h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed font-medium drop-shadow-lg">
              List your car for free, let dealers compete, and get paid directly — or find your next car and win it in a live auction.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="relative -mt-10 z-10 container mx-auto px-5">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-md px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_STRIP.map((item, i) => (
            <div key={item.label} className="flex items-center gap-2.5 text-sm font-semibold">
              <item.icon size={16} className="text-primary shrink-0" />
              <span className="text-[var(--text-secondary)]">{item.label}</span>
              {i < TRUST_STRIP.length - 1 && <span className="hidden sm:block w-px h-4 bg-[var(--border-default)] ml-8" aria-hidden />}
            </div>
          ))}
        </div>
      </div>

      {/* Seller flow */}
      <FlowSection
        eyebrow="For Sellers"
        title="How it works for"
        highlight="sellers"
        subtitle="List your car for free, let dealers compete, get paid directly and receive £100 from CarMazium after a successful handover."
        steps={SELLER_STEPS}
        receipt={RECEIPTS.seller}
        ctaLabel="Start Selling For Free"
        ctaHref="/sell"
        photo={{ src: "/assets/images/blog-keys.png", alt: "Car keys handover", quote: "The dealer pays you. Not us.", align: "left" }}
      />

      <div className="border-t border-[var(--border-default)]" />

      {/* Buyer flow */}
      <FlowSection
        eyebrow="For Buyers"
        title="How it works for"
        highlight="buyers"
        subtitle="Find the right car, win with confidence, and enjoy a smooth, secure buying experience."
        steps={BUYER_STEPS}
        receipt={RECEIPTS.buyer}
        ctaLabel="Browse Live Auctions"
        ctaHref="/auctions"
        photo={{ src: "/assets/images/featured-suv.png", alt: "Vehicle ready for collection", quote: "One fee. Nothing else moves through CarMazium.", align: "right" }}
      />

      {/* Feature Highlight: Auctions */}
      <section className="py-32 container mx-auto px-5">
        <div className="relative rounded-[3rem] overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-md">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 p-8 md:p-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold uppercase tracking-wider mb-6 border border-primary/20">
                <Clock size={16} /> Live Auctions
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-heading mb-6">
                Fairness Built-In with <br /> <span className="text-primary">Anti-Snipe</span> Tech
              </h2>
              <p className="text-[var(--text-muted)] text-lg mb-8 leading-relaxed">
                Say goodbye to last-second "sniping". Our auction system simulates a real auction room—if a bid comes in during the final 3 minutes, the clock resets, giving everyone a fair chance to win.
              </p>

              <div className="space-y-6 mb-10">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-input)] flex items-center justify-center shrink-0 border border-[var(--border-default)]">
                    <Users className="text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Community Driven</h4>
                    <p className="text-sm text-[var(--text-muted)]">Real bidders, verified identities, no bots.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-input)] flex items-center justify-center shrink-0 border border-[var(--border-default)]">
                    <TrendingUp className="text-emerald-400" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">True Market Value</h4>
                    <p className="text-sm text-[var(--text-muted)]">Competitive bidding ensures fair prices for all.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)] p-6 sm:p-8 shadow-2xl overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 border-b border-[var(--border-default)] pb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-red-400 font-mono font-bold tracking-wider text-sm">LIVE NOW</span>
                  <span className="text-[var(--text-muted)] font-mono text-sm ml-auto">ID: #83921</span>
                </div>

                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Time left</p>
                <p className="text-4xl sm:text-5xl font-mono text-primary font-bold tabular-nums mb-1">00:01:58</p>
                <p className="text-xs text-[var(--text-muted)] mb-6">Resets to 3:00 on every bid in the final 3 minutes</p>

                <div className="space-y-2">
                  {BID_LOG.map((row) => (
                    <div key={row.t} className="flex items-center justify-between gap-3 text-sm bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
                      <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">{row.t}</span>
                      <span className="font-mono font-bold tabular-nums">{row.amount}</span>
                      {row.reset && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                          <Zap size={10} /> clock reset
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services strip */}
      <section className="py-20 container mx-auto px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold font-heading mb-4">Complete Peace of Mind</h2>
          <p className="text-[var(--text-muted)]">Everything you need to handle your vehicle effortlessly.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 border-y border-l border-[var(--border-default)]">
          {[
            { icon: Truck, title: "Delivery", desc: "Via trusted 3rd party" },
            { icon: Umbrella, title: "Warranty", desc: "Via 3rd-party providers" },
            { icon: Handshake, title: "Direct Deals", desc: "Buyer & seller connect" },
            { icon: ShieldCheck, title: "Support", desc: "24/7 Expert help" }
          ].map((item) => (
            <div key={item.title} className="border-r border-[var(--border-default)] px-6 py-8 text-center hover:bg-[var(--bg-card)] transition-colors">
              <item.icon className="mx-auto mb-3 text-primary" size={22} />
              <h3 className="font-bold mb-1 text-sm">{item.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
