"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import {
  Search, ShieldCheck, Calculator, Gavel, Banknote, Clock, Users, TrendingUp,
  Handshake, Truck, Umbrella, ArrowRight, CheckCircle2, Phone, Gift, Trophy,
  ClipboardCheck, Tag, Lock, Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

type Step = {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  desc: string
  mock: React.ReactNode
}

const SELLER_FLOW: Step[] = [
  {
    id: "01",
    icon: Calculator,
    title: "Get Your Valuation",
    desc: "Enter your reg and details to get a free valuation for your car in seconds.",
    mock: (
      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <TrendingUp size={14} className="text-emerald-400 shrink-0" />
        <span className="text-[11px] text-[var(--text-muted)]">Est. Value</span>
        <span className="ml-auto text-sm font-bold text-emerald-400">£8,450</span>
      </div>
    ),
  },
  {
    id: "02",
    icon: Gavel,
    title: "Go Live in Auction",
    desc: "Your car goes live for verified dealers to view and place their bids.",
    mock: (
      <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 tracking-wide">LIVE AUCTION</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Highest Bid</span>
          <span className="text-sm font-bold text-primary">£8,450</span>
        </div>
      </div>
    ),
  },
  {
    id: "03",
    icon: Users,
    title: "Dealers Compete",
    desc: "Verified dealers compete with bids in a 24-hour auction.",
    mock: (
      <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2 space-y-1 text-[11px]">
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Dealer One</span><span className="font-semibold">£8,450</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Auto Traders Ltd</span><span className="font-semibold">£8,250</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-muted)]">Premier Cars</span><span className="font-semibold">£8,100</span></div>
      </div>
    ),
  },
  {
    id: "04",
    icon: Phone,
    title: "Dealer Contacts You",
    desc: "The winning dealer contacts you and arranges collection and inspection.",
    mock: (
      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <Truck size={14} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[11px] text-[var(--text-secondary)]">Collection arranged</span>
      </div>
    ),
  },
  {
    id: "05",
    icon: Banknote,
    title: "Dealer Pays You Directly",
    desc: "If everything is as described, the dealer pays you directly. CarMazium never holds the payment.",
    mock: (
      <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-[var(--text-muted)]">Payment Received</p>
          <p className="text-sm font-bold">£8,450</p>
        </div>
        <CheckCircle2 size={18} className="text-emerald-400" />
      </div>
    ),
  },
  {
    id: "06",
    icon: Gift,
    title: "Get Your £100 Reward",
    desc: "After handover, submit a photo. Once approved, we release your £100 reward.",
    mock: (
      <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-emerald-400 font-semibold">Handover Approved!</p>
          <p className="text-sm font-bold">£100 Reward Released</p>
        </div>
        <CheckCircle2 size={18} className="text-emerald-400" />
      </div>
    ),
  },
]

const BUYER_FLOW: Step[] = [
  {
    id: "01",
    icon: Search,
    title: "Search & Find",
    desc: "Use advanced filters and AI search to find the perfect car that matches your needs.",
    mock: (
      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <ImageIcon size={14} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[11px] text-[var(--text-secondary)]">142 matching cars found</span>
      </div>
    ),
  },
  {
    id: "02",
    icon: Gavel,
    title: "Join the Auction",
    desc: "Place your bid in live auctions. Compete with other verified dealers in real-time.",
    mock: (
      <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-400 tracking-wide">LIVE AUCTION</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">Current Bid</span>
          <span className="text-sm font-bold text-primary">£8,450</span>
        </div>
      </div>
    ),
  },
  {
    id: "03",
    icon: Trophy,
    title: "Win the Auction",
    desc: "If you're the highest bidder when the auction ends, you win the car.",
    mock: (
      <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-emerald-400 font-semibold">You Won!</p>
          <p className="text-sm font-bold">£8,450</p>
        </div>
        <CheckCircle2 size={18} className="text-emerald-400" />
      </div>
    ),
  },
  {
    id: "04",
    icon: ClipboardCheck,
    title: "Complete Checkout",
    desc: "Review the car details and pay the £125 buyer fee securely.",
    mock: (
      <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-[var(--text-muted)]">Buyer Fee</p>
          <p className="text-sm font-bold">£125</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
          <Lock size={11} /> Secure Payment
        </div>
      </div>
    ),
  },
  {
    id: "05",
    icon: Truck,
    title: "Arrange Collection",
    desc: "Coordinate with the seller for inspection and collection.",
    mock: (
      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <Truck size={14} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-[11px] text-[var(--text-secondary)]">Collection scheduled</span>
      </div>
    ),
  },
  {
    id: "06",
    icon: ShieldCheck,
    title: "Drive with Confidence",
    desc: "Inspect, complete the handover and enjoy your new purchase.",
    mock: (
      <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
        <span className="text-[11px] text-[var(--text-secondary)]">Ready to drive</span>
      </div>
    ),
  },
]

const TRUST_BADGES = [
  { icon: Tag, title: "100% Free Listing", desc: "No fees, no hidden charges." },
  { icon: Users, title: "Verified Dealers Only", desc: "Only trusted dealers can bid." },
  { icon: Banknote, title: "You Get Paid Directly", desc: "Payment is made by the dealer to you." },
  { icon: Gift, title: "£100 Seller Reward", desc: "Complete a successful handover and get £100." },
]

function FlowSection({
  eyebrow, title, highlight, subtitle, steps, ctaLabel, ctaHref,
}: {
  eyebrow: string
  title: string
  highlight: string
  subtitle: string
  steps: Step[]
  ctaLabel: string
  ctaHref: string
}) {
  return (
    <section className="py-16 md:py-20 container mx-auto px-5">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-3">{eyebrow}</p>
        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
          {title} <span className="text-primary">{highlight}</span>
        </h2>
        <p className="text-[var(--text-muted)] leading-relaxed">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {steps.map((step, idx) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: idx * 0.06 }}
            className="relative h-full p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] hover:border-primary/30 transition-colors flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center text-primary shrink-0">
                <step.icon size={18} />
              </div>
              <span className="text-xs font-black text-[var(--text-muted)] tabular-nums">{step.id}</span>
            </div>
            <h3 className="font-bold text-[15px] mb-2 leading-snug">{step.title}</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4 flex-grow">{step.desc}</p>
            {step.mock}
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href={ctaHref}>
          <Button size="lg" shape="pill" className="px-10 py-6 text-base shadow-neon group">
            {ctaLabel}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </section>
  )
}

export default function HowItWorksPage() {
  const router = useRouter()

  // Pre-warm the target pages so clicking the CTA buttons is instant
  useEffect(() => {
    router.prefetch('/search')
    router.prefetch('/sell')
  }, [router])

  return (
    <div className="min-h-screen pb-20 selection:bg-primary/30">

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center overflow-hidden h-[70vh] min-h-[500px]">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/images/live-auction-hero.jpg"
            alt="CarMazium Hero"
            fill
            className="object-cover opacity-40 scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/80 to-slate-950" />
          <div className="absolute inset-0 bg-slate-950/30 mix-blend-multiply" />
        </div>

        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        <div className="container mx-auto px-5 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
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

      {/* How it works for sellers */}
      <div className="relative -mt-10 z-10">
        <FlowSection
          eyebrow="For Sellers"
          title="How it works for"
          highlight="sellers"
          subtitle="List your car for FREE, let dealers compete, get paid directly and receive £100 from CarMazium after a successful handover."
          steps={SELLER_FLOW}
          ctaLabel="Start Selling For Free"
          ctaHref="/sell"
        />
      </div>

      {/* Trust badges */}
      <section className="container mx-auto px-5">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_BADGES.map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <item.icon size={18} />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works for buyers */}
      <FlowSection
        eyebrow="For Buyers"
        title="How it works for"
        highlight="buyers"
        subtitle="Find the right car, win with confidence, and enjoy a smooth, secure buying experience."
        steps={BUYER_FLOW}
        ctaLabel="Browse Live Auctions"
        ctaHref="/auctions"
      />

      {/* Feature Highlight: Auctions */}
      <section className="py-32 container mx-auto px-5">
        <div className="relative rounded-[3rem] overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-md">
          {/* Background Effects */}
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

            <div className="order-1 lg:order-2 relative">
              {/* Abstract Visual Representation of Auction Header */}
              <div className="relative z-10 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)] p-8 shadow-2xl transition-transform duration-700">
                <div className="flex justify-between items-center mb-8 border-b border-[var(--border-default)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 font-mono font-bold tracking-wider">LIVE NOW</span>
                  </div>
                  <span className="text-[var(--text-muted)] font-mono">ID: #83921</span>
                </div>

                <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-sm text-[var(--text-muted)] mb-2 uppercase tracking-wide">Current Bid</p>
                    <p className="text-5xl font-bold tracking-tight">£42,500</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--text-muted)] mb-2 uppercase tracking-wide">Time Left</p>
                    <p className="text-3xl font-mono text-primary font-bold tabular-nums">00:01:58</p>
                  </div>
                </div>

                {/* Progress Bar Visual */}
                <div className="h-3 bg-[var(--bg-input)] rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "80%" }}
                    animate={{ width: "95%" }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  />
                </div>
                <p className="text-xs text-center text-[var(--text-muted)] font-medium">Anti-snipe active: Auto-extends on new bids</p>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-10 -right-10 w-full h-full bg-[var(--bg-input)] rounded-2xl -z-10 blur-xl mt-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid (Compact) */}
      <section className="py-20 container mx-auto px-5">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold font-heading mb-4">Complete Peace of Mind</h2>
          <p className="text-[var(--text-muted)]">Everything you need to handle your vehicle effortlessly.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            { icon: Truck, title: "Delivery", desc: "Via trusted 3rd party" },
            { icon: Umbrella, title: "Warranty", desc: "Via 3rd-party providers" },
            { icon: Handshake, title: "Direct Deals", desc: "Buyer & seller connect" },
            { icon: ShieldCheck, title: "Support", desc: "24/7 Expert help" }
          ].map((item, idx) => (
            <div key={idx} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 text-center hover:bg-[var(--bg-card-hover)] transition-colors">
              <item.icon className="mx-auto mb-3 text-[var(--text-muted)]" size={24} />
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
