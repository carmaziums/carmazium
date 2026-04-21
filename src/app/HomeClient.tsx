"use client"

import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Search, ArrowRight, ShieldCheck, UserCheck, FileText, CheckCircle, Handshake, Shield, Lightbulb, Star, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { BrowseByCategory } from "@/components/features/BrowseByCategory"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatPrice, type Listing } from "@/lib/listingApi"
import { aiSearch, type AiSearchResult } from "@/lib/aiApi"

/* ── Dynamic imports for below-fold heavy components ────────────────────────
 * Code-split these into separate chunks so they don't block initial load.
 * They still SSR (no `ssr: false`) so HTML is present for SEO.
 */
const DiscoverSection = dynamic(() => import("@/components/features/DiscoverSection").then(mod => mod.DiscoverSection))
const BrowseByBodyType = dynamic(() => import("@/components/features/BrowseByBodyType").then(mod => mod.BrowseByBodyType))
const TestimonialsSection = dynamic(() => import("@/components/features/TestimonialsSection").then(mod => mod.TestimonialsSection))

interface HomeClientProps {
  initialListings: Listing[]
}

export default function HomeClient({ initialListings }: HomeClientProps) {
  const ref = useRef(null)
  const router = useRouter()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  // AI Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null)
  const [aiSearching, setAiSearching] = useState(false)

  const handleAiSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = searchQuery.trim()
    if (!q || aiSearching) return

    setAiSearching(true)
    setAiResult(null)

    try {
      const result = await aiSearch(q)
      setAiResult(result)
    } catch (err) {
      console.error("AI search failed:", err)
      setAiResult({ text: "Something went wrong — try again or use the search page filters!" })
    } finally {
      setAiSearching(false)
    }
  }

  const handleApplyFilters = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString()
    router.push(`/search?${qs}`)
  }

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden flex flex-col">
      {/* Cinematic Hero Section */}
      <section ref={ref} className="relative min-h-[90vh] flex items-center justify-center text-center text-white overflow-hidden" style={{ marginTop: '-100px', paddingTop: '100px' }}>
        {/* Video Background */}
        <div className="absolute inset-0 w-full h-full">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute top-1/2 left-1/2 min-w-full min-h-full object-cover -translate-x-1/2 -translate-y-1/2"
            onEnded={(e) => e.currentTarget.pause()}
          >
            <source src="/assets/videos/hero-cinematic.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/50 to-slate-900" />
        </div>

        <div className="relative z-10 container mx-auto px-5 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-bold font-heading mb-6 leading-tight drop-shadow-2xl"
          >
            List your car <br /> <span className="text-primary tracking-tight">for £1</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <form
              onSubmit={handleAiSearch}
              className="flex flex-col md:flex-row w-full max-w-3xl mx-auto mb-4 glass-strong p-2 rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:animate-shine pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask AI: e.g. red SUV under £30k..."
                className="flex-1 min-w-0 bg-transparent px-8 py-4 text-white placeholder:text-gray-400 focus:outline-none text-lg truncate"
              />
              <Button
                type="submit"
                variant="default"
                size="lg"
                shape="pill"
                className="rounded-2xl px-10 text-lg shadow-neon group-hover:scale-105 transition-transform duration-300"
                disabled={aiSearching || !searchQuery.trim()}
              >
                {aiSearching ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-5 w-5" />
                )}
                {aiSearching ? "Thinking..." : "AI Search"}
              </Button>
            </form>

            {/* Powered by AI badge */}
            <div className="text-xs text-gray-400 mb-6 flex items-start justify-center gap-1.5 text-left md:text-center max-w-[260px] md:max-w-none mx-auto md:items-center">
              <Sparkles size={14} className="text-primary shrink-0 mt-0.5 md:mt-0" />
              <span>Powered by Mazium AI — describe your dream car in your own words</span>
            </div>
          </motion.div>

          {/* AI Result Card */}
          <AnimatePresence>
            {(aiSearching || aiResult) && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-3xl mx-auto mb-8"
              >
                <div className="glass-strong rounded-2xl border border-white/15 p-6 text-left shadow-2xl backdrop-blur-xl">
                  {aiSearching ? (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={20} className="text-primary animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Mazium AI is thinking...</p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  ) : aiResult && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">AI Recommendation</p>
                          <p className="text-white text-sm leading-relaxed">{aiResult.text}</p>
                        </div>
                      </div>

                      {aiResult.filterCard && (
                        <button
                          onClick={() => handleApplyFilters(aiResult.filterCard!.params)}
                          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all hover:scale-[1.01] group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Search size={18} className="text-primary" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">View matching cars</p>
                            <p className="text-base font-semibold text-white">{aiResult.filterCard.label}</p>
                          </div>
                          <ArrowRight size={18} className="text-primary group-hover:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-200 drop-shadow-lg font-medium"
          >
            Browse live auctions and retail-ready cars from verified sellers.
          </motion.p>
        </div>
      </section>

      {/* Action Hub */}
      <section className="pt-8 pb-16 text-center container mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-8"
        >
          {/* Top Row: Main Actions */}
          <div className="flex flex-wrap justify-center gap-6 w-full">
            {/* <Link href="/auctions">
              <Button size="lg" shape="pill" className="w-full sm:w-auto min-w-[280px] py-7 text-xl shadow-neon hover:scale-105 transition-transform">
                Browse Auctions <ArrowRight className="ml-2" />
              </Button>
            </Link> */}
            <Link href="/search">
              <Button size="lg" shape="pill" variant="dark" className="w-full sm:w-auto min-w-[280px] py-7 text-xl hover:bg-slate-800 hover:border-white/30 border border-white/10 backdrop-blur-md">
                Retail Listings
              </Button>
            </Link>
          </div>

          {/* Middle Row: Sell Action */}
          <div>
            <Link href="/sell">
              <Button variant="outline" shape="pill" className="px-12 py-6 text-base border-primary/50 text-white hover:bg-primary hover:text-white uppercase tracking-wider font-semibold hover:tracking-widest transition-all duration-300">
                Sell My Car
              </Button>
            </Link>
          </div>

          {/* Bottom Row: Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-8 text-gray-400 font-medium">
            <div className="flex items-center gap-2 group cursor-default"><ShieldCheck className="text-primary h-5 w-5 group-hover:scale-110 transition-transform" /> <span className="group-hover:text-white transition-colors">RLS-secured</span></div>
            <div className="flex items-center gap-2 group cursor-default"><UserCheck className="text-primary h-5 w-5 group-hover:scale-110 transition-transform" /> <span className="group-hover:text-white transition-colors">Verified sellers</span></div>
            <div className="flex items-center gap-2 group cursor-default"><FileText className="text-primary h-5 w-5 group-hover:scale-110 transition-transform" /> <span className="group-hover:text-white transition-colors">HPI-ready</span></div>
            <div className="flex items-center gap-2 group cursor-default"><CheckCircle className="text-primary h-5 w-5 group-hover:scale-110 transition-transform" /> <span className="group-hover:text-white transition-colors">Buyer protection</span></div>
          </div>
        </motion.div>
      </section>

      {/* Discover + Browse Sections (dynamically imported) */}
      <DiscoverSection />
      <BrowseByCategory />
      <BrowseByBodyType />

      {/* ✨ Featured Listings — server-fetched via props */}
      {initialListings.length > 0 && (
        <section className="container mx-auto px-5 mb-10 md:mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold font-heading flex items-center gap-3">
                <Sparkles className="text-amber-400" size={32} strokeWidth={1.25} />
                <span style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Featured Listings</span>
              </h2>
              <p className="text-gray-400 text-sm mt-1">Handpicked, seller-boosted cars — verified &amp; ready to go</p>
            </div>
            <Link href="/search" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {initialListings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative group"
              >
                <Link href={`/vehicle/${listing.slug}`}>
                  <div
                    className="rounded-2xl overflow-hidden border border-amber-400/20 hover:border-amber-400/50 transition-all duration-300"
                    style={{ boxShadow: '0 0 0 0 rgba(251,191,36,0)', transition: 'box-shadow 0.3s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(251,191,36,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 rgba(251,191,36,0)'}
                  >
                    <div className="relative h-44 bg-slate-800 overflow-hidden">
                      <FeaturedBadge />
                      {listing.images?.[0] ? (
                        <Image
                          src={listing.images[0]}
                          alt={listing.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Star size={40} className="text-amber-400/20" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-slate-800/80">
                      <p className="font-bold text-white text-sm line-clamp-1">{listing.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{listing.year} • {listing.mileage?.toLocaleString()} mi</p>
                      <p className="text-amber-400 font-bold text-lg mt-2">{formatPrice(listing.price)}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}




      {/* Testimonials Section (dynamically imported) */}
      <TestimonialsSection />

      {/* Steps Section */}
      <section className="py-24 bg-slate-900/50 border-y border-white/5">
        <div className="container mx-auto px-5 text-center">
          <h2 className="text-3xl font-bold mb-16 font-heading">Simple Steps to Buy, Sell, or Auction</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Search, title: "Browse or List a Car", desc: "Explore verified listings or create your own car listing in minutes." },
              { icon: Handshake, title: "Connect or Bid", desc: "Buy directly, negotiate with sellers, or place bids in live auctions." },
              { icon: Shield, title: "Secure Transaction", desc: "Complete payments safely through trusted and transparent methods." },
              { icon: FileText, title: "Ownership Transfer", desc: "Finalize documentation and drive away with confidence." }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -10 }}
                className="flex flex-col items-center group"
              >
                <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 text-primary border border-white/5 shadow-lg group-hover:border-primary/30 group-hover:shadow-[0_0_20px_rgba(237,28,36,0.2)] transition-all duration-300">
                  <step.icon size={36} />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-white transition-colors">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-[200px]">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <Button asChild variant="outline" shape="pill" className="px-8 py-4 border-white/10 text-white hover:bg-white/5 hover:border-white/30 text-lg">
              <Link href="/how-it-works">
                See Exactly How It Works <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Trust & Security + Personalization */}
      <section className="py-24 text-center">
        <div className="container mx-auto px-5 flex flex-col items-center gap-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-2">Secure & Trusted Platform</h2>
            <p className="text-gray-400 mb-8">Your safety and security are our top priorities</p>
            <div className="inline-flex flex-wrap justify-center gap-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 px-8 py-4 rounded-full font-semibold">
              <span className="flex items-center gap-2"><ShieldCheck size={18} /> SSL Secured</span>
              <div className="w-1 h-1 bg-emerald-500/30 rounded-full self-center hidden sm:block" />
              <span className="flex items-center gap-2"><Shield size={18} /> 256-bit Encryption</span>
              <div className="w-1 h-1 bg-emerald-500/30 rounded-full self-center hidden sm:block" />
              <span className="flex items-center gap-2"><CheckCircle size={18} /> GDPR Compliant</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-4xl bg-gradient-to-br from-slate-800 to-slate-900 p-12 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full group-hover:bg-indigo-500/30 transition-colors duration-500" />

            <div className="relative z-10 flex flex-col items-center text-center w-full">
              <Lightbulb className="text-primary h-12 w-12 mb-6 mx-auto animate-pulse" />
              <h3 className="text-3xl font-bold mb-4">Get personalised car recommendations</h3>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                Sign in or create a free account and we'll highlight cars based on your browsing and interests.
              </p>
              <div className="flex justify-center w-full">
                <Link href="/auth/login" className="inline-block">
                  <Button size="lg" shape="pill" className="px-10 py-6 text-lg shadow-neon">Sign in or register <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="container mx-auto px-5 mb-24">
        <h2 className="text-3xl font-bold text-center mb-12 font-heading">Automotive Insights & Market Updates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "How Car Auctions Help You Get the Best Price", image: "/assets/images/featured-suv.png" },
            { title: "Tips for Buying Used Luxury Cars Safely", image: "/assets/images/blog-keys.png" },
            { title: "Selling Your Car Faster with Digital Marketplaces", image: "/assets/images/featured-sports.png" }
          ].map((blog, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card overflow-hidden group hover:border-primary/30"
            >
              <div className="h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors z-10" />
                <Image
                  src={blog.image}
                  alt={blog.title}
                  width={400}
                  height={250}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">{blog.title}</h3>
                <p className="text-gray-400 text-sm mb-4">Discover more about automotive trends...</p>
                <Button variant="link" className="p-0 h-auto text-primary group-hover:translate-x-2 transition-transform">Read More <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
