"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ShieldCheck, CreditCard, Calculator, Gavel, Banknote, Clock, Users, TrendingUp, Handshake, Truck, Umbrella, FileText, ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function HowItWorksPage() {
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer')
  const router = useRouter()

  // Pre-warm the target pages so clicking the CTA buttons is instant
  useEffect(() => {
    router.prefetch('/search')
    router.prefetch('/sell')
  }, [router])

  const buyerSteps = [
    {
      id: "01",
      icon: Search,
      title: "Smart Search",
      desc: "Use advanced filters and AI recommendations to find vehicles that match your exact needs.",
      details: ["AI-Powered sorting", "Instant alerts", "Compare tools"]
    },
    {
      id: "02",
      icon: ShieldCheck,
      title: "Verified Listings",
      desc: "Every vehicle comes with comprehensive checks, HPI reports, and verified seller info.",
      details: ["150+ Point check", "HPI Clear", "Service history"]
    },
    {
      id: "03",
      icon: CreditCard,
      title: "Secure Purchase",
      desc: "Connect directly with the seller and agree terms. Delivery arranged via trusted 3rd-party couriers, with warranty options available.",
      details: ["Secure platform", "3rd-party delivery", "Warranty available"]
    }
  ]

  const sellerSteps = [
    {
      id: "01",
      icon: Calculator,
      title: "Quick Valuation",
      desc: "Get an instant AI-powered valuation of your vehicle based on real-time market data.",
      details: ["Instant quote", "Market analysis", "No obligation"]
    },
    {
      id: "02",
      icon: Gavel,
      title: "Choose Method",
      desc: "List for retail sale to maximize price, or enter live auctions for a faster sale.",
      details: ["Retail listing", "Live auction", "Instant cash"]
    },
    {
      id: "03",
      icon: Banknote,
      title: "Get Paid Fast",
      desc: "Receive payment securely within 24 hours of sale completion with full protection.",
      details: ["Secure transfer", "No hidden fees", "Paperwork handled"]
    }
  ]

  return (
    <div className="min-h-screen pb-20 selection:bg-primary/30">

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center overflow-hidden h-[80vh] min-h-[600px]">
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
            <p className="text-xl text-gray-200 max-w-2xl mx-auto mb-12 leading-relaxed font-medium drop-shadow-lg">
              We've streamlined the entire process. Whether you're buying your dream car or selling your current one, experience transparency at every step.
            </p>
          </motion.div>

          {/* Toggle Switch */}
          <div className="inline-flex items-center bg-slate-900/60 p-1 rounded-full border border-[var(--border-default)] backdrop-blur-xl relative shadow-2xl">
            {/* Animated Background Pill */}
            <motion.div
              className="absolute top-1 bottom-1 bg-primary rounded-full shadow-lg shadow-primary/25 z-0"
              layoutId="tab-pill"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              style={{
                left: activeTab === 'buyer' ? '4px' : '50%',
                right: activeTab === 'buyer' ? '50%' : '4px',
                width: 'calc(50% - 4px)' // explicit width calculation
              }}
            />

            <button
              onClick={() => setActiveTab('buyer')}
              className={`relative z-10 px-10 py-3 rounded-full text-lg font-medium transition-colors duration-300 ${activeTab === 'buyer' ? 'text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              I want to Buy
            </button>
            <button
              onClick={() => setActiveTab('seller')}
              className={`relative z-10 px-10 py-3 rounded-full text-lg font-medium transition-colors duration-300 ${activeTab === 'seller' ? 'text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              I want to Sell
            </button>
          </div>
        </div>
      </section>

      {/* Main Process Flow */}
      <section className="py-20 container mx-auto px-5 relative z-10 -mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
          >
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-px bg-gradient-to-r from-[var(--border-default)] via-primary/50 to-[var(--border-default)] z-0" />

            {(activeTab === 'buyer' ? buyerSteps : sellerSteps).map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.15 + 0.2 }}
                className="relative z-10"
              >
                {/* Card */}
                <div className="group h-full p-8 rounded-[2rem] bg-[var(--bg-card)] border border-[var(--border-default)] shadow-2xl hover:border-primary/20 hover:shadow-[0_0_40px_rgba(237,28,36,0.1)] transition-all duration-500">
                  {/* Icon With Glow */}
                  <div className="relative mb-8 inline-block">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="w-20 h-20 bg-[var(--bg-input)] rounded-2xl flex items-center justify-center border border-[var(--border-default)] group-hover:border-primary/50 group-hover:scale-110 transition-all duration-500 relative z-10 shadow-lg">
                      <step.icon size={32} />
                    </div>
                    {/* Number Badge */}
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-full flex items-center justify-center text-sm font-bold text-[var(--text-muted)] group-hover:text-primary group-hover:border-primary/50 transition-colors z-20">
                      {step.id}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors">{step.title}</h3>
                  <p className="text-[var(--text-muted)] leading-relaxed mb-6 min-h-[3rem]">{step.desc}</p>

                  <ul className="space-y-3">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-center text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                        <CheckCircle2 size={16} className="text-primary/50 mr-2 group-hover:text-primary transition-colors" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="mt-16 text-center">
          <Link href={activeTab === 'buyer' ? "/search" : "/sell"}>
            <Button size="lg" shape="pill" className="px-12 py-7 text-lg shadow-neon group">
              {activeTab === 'buyer' ? "Start Buying" : "Start Selling"}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

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
                Fairness Built-In with <br /> <span className="text-primary">Soft-Close</span> Tech
              </h2>
              <p className="text-[var(--text-muted)] text-lg mb-8 leading-relaxed">
                Say goodbye to last-second "sniping". Our auction system simulates a real auction room—if a bid comes in during the final 2 minutes, the clock resets, giving everyone a fair chance to win.
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

              {/* <Link href="/auctions">
                <Button variant="outline" className="border-[var(--border-default)] hover:bg-[var(--bg-card)]">Check Live Auctions</Button>
              </Link> */}
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
                <p className="text-xs text-center text-[var(--text-muted)] font-medium">Soft-close active: Auto-extends on new bids</p>
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
            { icon: Users, title: "Direct Deals", desc: "Buyer & seller connect" },
            { icon: Handshake, title: "Support", desc: "24/7 Expert help" }
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
