"use client"

import HomeHero from "./HomeHero"
import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
import { Search, ArrowRight, ShieldCheck, UserCheck, FileText, CheckCircle, Handshake, Shield, Lightbulb, Star, Sparkles, Loader2, Gavel, Flame, Users, Clock, Building2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { BrowseByCategory } from "@/components/features/BrowseByCategory"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { motion, AnimatePresence } from "framer-motion"
import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/listingApi"
import type { HomeCardListing } from "@/lib/homeCardListing"
import { aiSearch, type AiSearchResult } from "@/lib/aiApi"
import { CarCard } from "@/components/features/CarCard"
import { getActiveAuctions, type Auction, getCurrentBid, getBidCount } from "@/lib/auctionApi"
import { canAccessTradeStock } from "@/lib/tradeAccess"
import { useAuth } from "@/context/AuthContext"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { type BlogPostSummary } from "@/lib/blogApi"
import { HomeAppPromoCompact } from "@/components/features/HomeAppPromoCompact"
import styles from "./home.module.css"

/* ── Dynamic imports for below-fold heavy components ────────────────────────
 * Code-split these into separate chunks so they don't block initial load.
 * They still SSR (no `ssr: false`) so HTML is present for SEO.
 */
const DiscoverSection = dynamic(() => import("@/components/features/DiscoverSection").then(mod => mod.DiscoverSection))
const BrowseByBodyType = dynamic(() => import("@/components/features/BrowseByBodyType").then(mod => mod.BrowseByBodyType))
const TestimonialsSection = dynamic(() => import("@/components/features/TestimonialsSection").then(mod => mod.TestimonialsSection))

interface HomeClientProps {
  initialListings: HomeCardListing[]
  latestRetailListings: HomeCardListing[]
  latestBlogPosts?: BlogPostSummary[]
}

export default function HomeClient({ initialListings, latestRetailListings, latestBlogPosts = [] }: HomeClientProps) {
  // Avoid repeating paid-featured cars in the latest retail strip. This is a
  // preview only: the public search page contains the complete live inventory.
  const featuredIds = new Set(initialListings.map(listing => listing.id))
  const moreRetailCars = latestRetailListings
    .filter(listing => listing.status === "ACTIVE" && !featuredIds.has(listing.id))
    .slice(0, 8)

  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // The homepage auction strip is dealer-only. TradeXchange is a trade room
  // now, so a retail buyer landing on the homepage must not be shown trade
  // stock and its live bids — and the /auctions/active endpoint refuses them
  // anyway, so fetching it for everyone would just be a guaranteed 403.
  const { profile } = useAuth()
  const [liveAuctions, setLiveAuctions] = useState<Auction[]>([])
  const canTrade = canAccessTradeStock(profile)
  useEffect(() => {
    if (!canTrade) {
      setLiveAuctions([])
      return
    }
    getActiveAuctions().then(data => setLiveAuctions(data.slice(0, 4))).catch(() => {})
  }, [canTrade])

  return (
    <div className={cn(styles.home, "w-full max-w-[100vw] overflow-x-hidden flex flex-col")}>
      <HomeHero />

      {/* Natural-language search stays connected to the existing MaziuM API. */}
      <section className={styles.aiSection} aria-labelledby="home-ai-search-heading">
        <div className={styles.contentWidth}>
          <p className={styles.eyebrow}>MaziuM AI search</p>
          <h2 id="home-ai-search-heading" className={styles.sectionHeading}>Describe your next car.</h2>
          <form onSubmit={handleAiSearch} className={styles.searchForm} aria-busy={aiSearching}>
            <Search size={23} className={styles.searchIcon} aria-hidden="true" />
            <label htmlFor="home-ai-query" className="sr-only">Describe the car you want</label>
            <input id="home-ai-query" ref={searchInputRef} type="search" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-describedby="home-ai-search-help"
              placeholder="Try: automatic under £8,000"
              className={styles.searchInput} />
            <Button type="submit" className={styles.searchSubmit} disabled={aiSearching || !searchQuery.trim()}>
              {aiSearching && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {aiSearching ? "Finding cars…" : "Find matching cars"}
            </Button>
          </form>
          <div className={styles.searchHelpers}>
            <p id="home-ai-search-help"><Sparkles size={16} aria-hidden="true" /> Powered by MaziuM AI</p>
            <div className={styles.searchExamples} aria-label="Example car searches">
              {["Automatic under £5,000", "7-seat family car", "Small first car"].map(example => (
                <button key={example} type="button" disabled={aiSearching} onClick={() => {
                  setSearchQuery(example)
                  searchInputRef.current?.focus()
                }}>{example}</button>
              ))}
            </div>
            <Link href="/search" className={styles.quietLink}>Prefer filters? Browse all cars <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <div aria-live="polite" aria-atomic="true">
          {/* AI Result Card */}
          <AnimatePresence>
            {(aiSearching || aiResult) && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="w-full mt-6"
              >
                <div className="bg-[var(--bg-dropdown)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-default)] p-6 text-left shadow-sm">
                  {aiSearching ? (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={20} className="text-primary animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">Mazium AI is thinking...</p>
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
                          <p className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-1">AI Recommendation</p>
                          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{aiResult.text}</p>
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
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">View matching cars</p>
                            <p className="text-base font-semibold text-[var(--text-primary)]">{aiResult.filterCard.label}</p>
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

          </div>
        </div>
      </section>

      <section className={styles.valueStrip} aria-label="CarMazium listing fees and auction seller reward">
        <div className={styles.valueGrid}>
          <Link href="/pricing"><strong>£1</strong><span>Basic retail listing until sold</span><small>Compare all retail packages <ArrowRight size={14} aria-hidden="true" /></small></Link>
          <Link href="/sell?sellMode=auction#sell-options"><strong>FREE</strong><span>Auction listing</span><small>Let verified dealers compete <ArrowRight size={14} aria-hidden="true" /></small></Link>
          <Link href="/how-it-works"><strong>£100</strong><span>Qualifying auction seller reward</span><small>Successful auction sales after approved handover. Terms apply.</small></Link>
        </div>
      </section>

      <section className={styles.utilityStrip} aria-label="Marketplace information and quick links">
        <div className={styles.utilityInner}>
          <Link href="/search">Retail Listings <ArrowRight size={15} aria-hidden="true" /></Link>
          <Link href="/sell">Sell My Car <ArrowRight size={15} aria-hidden="true" /></Link>
          <span><ShieldCheck size={17} aria-hidden="true" /> Protected accounts</span>
          <span><UserCheck size={17} aria-hidden="true" /> Verified sellers</span>
          <span><FileText size={17} aria-hidden="true" /> Vehicle history checks</span>
          <span><CheckCircle size={17} aria-hidden="true" /> Independent checks advised</span>
        </div>
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
                <Sparkles className="text-primary" size={26} strokeWidth={1.5} aria-hidden="true" />
                <span>Featured Listings</span>
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Featured retail cars — see more active cars below</p>
            </div>
            <Link href="/search" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {initialListings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <CarCard
                  sellerServices={listing.sellerServices}
                  title={listing.title}
                  make={listing.make}
                  model={listing.model}
                  price={formatPrice(listing.price)}
                  image={listing.images?.[0] || ""}
                  images={listing.images ?? []}
                  href={`/buy-cars/${listing.slug}`}
                  year={listing.year ?? undefined}
                  mileage={listing.mileage ?? undefined}
                  fuelType={listing.fuelType ?? undefined}
                  transmission={listing.transmission ?? undefined}
                  bodyType={listing.bodyType ?? undefined}
                  isFeatured={true}
                  badgeTier={listing.badgeTier}
                  status={listing.status}
                  bannerLabel={listing.bannerLabel}
                  hasLinkedAuction={!!listing.linkedListingId}
                  isDepartedSale={listing.isDepartedSale ?? false}
                  deliveryAvailable={listing.deliveryAvailable ?? false}
                  exteriorGrade={listing.exteriorGrade}
                  writeOffCategory={listing.writeOffCategory}
                  isImported={listing.isImported ?? false}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* A dedicated retail sample prevents the limited number of featured
          packages from being mistaken for the full vehicle inventory. */}
      {moreRetailCars.length > 0 && (
        <section className="container mx-auto px-5 mb-12 md:mb-16" aria-labelledby="latest-retail-cars-title">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-2">More to discover</p>
              <h2 id="latest-retail-cars-title" className="text-2xl md:text-3xl font-extrabold font-heading">More Cars to Explore</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                More active retail cars from across the marketplace — not just paid featured listings.
              </p>
            </div>
            <Link href="/search" className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-extrabold text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Browse All Used Cars <ArrowRight size={17} />
            </Link>
          </div>
          <p className="sm:hidden mb-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Swipe sideways to explore more cars</p>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 sm:gap-5" aria-label="More active retail cars">
            {moreRetailCars.map((listing) => (
              <div key={listing.id} className="snap-start shrink-0 w-[min(83vw,320px)] sm:w-auto">
                <CarCard
                  sellerServices={listing.sellerServices}
                key={listing.id}
                title={listing.title}
                make={listing.make}
                model={listing.model}
                price={formatPrice(listing.price)}
                image={listing.images?.[0] || ""}
                images={listing.images ?? []}
                href={`/buy-cars/${listing.slug}`}
                year={listing.year ?? undefined}
                mileage={listing.mileage ?? undefined}
                fuelType={listing.fuelType ?? undefined}
                transmission={listing.transmission ?? undefined}
                bodyType={listing.bodyType ?? undefined}
                isFeatured={false}
                badgeTier={listing.badgeTier}
                status={listing.status}
                bannerLabel={listing.bannerLabel}
                hasLinkedAuction={!!listing.linkedListingId}
                isDepartedSale={listing.isDepartedSale ?? false}
                deliveryAvailable={listing.deliveryAvailable ?? false}
                exteriorGrade={listing.exteriorGrade}
                writeOffCategory={listing.writeOffCategory}
                isImported={listing.isImported ?? false}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Always give visitors an obvious route to the complete real inventory.
          No fictitious listing count when server data is temporarily missing. */}
      <div className="container mx-auto px-5 mb-12 md:mb-16">
        <Link href="/search"
          className="group flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-[var(--bg-card)] px-6 py-6 md:px-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="text-center sm:text-left">
            <p className="font-heading text-xl md:text-2xl font-extrabold">Explore the Full Car Marketplace</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Search and filter all publicly listed vehicles by make, price, mileage and more.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-extrabold text-white group-hover:brightness-110">
            Browse All Cars <ArrowRight size={17} />
          </span>
        </Link>
      </div>

      {/* Live Auctions Section */}
      {liveAuctions.length > 0 && (
        <section className="container mx-auto px-5 mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 text-xs font-bold uppercase tracking-widest">Live Now</span>
              </div>
              <h2 className="text-3xl font-bold font-heading flex items-center gap-3">
                <Gavel className="text-red-500" size={28} strokeWidth={1.5} />
                Live Auctions
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Real-time bidding — place your bid before the gavel drops</p>
            </div>
            <Link href="/auctions/browse" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {liveAuctions.map((auction, i) => {
              const currentBid = getCurrentBid(auction)
              const bidCount = getBidCount(auction) // label only; never displayed
              const image = auction.listing.images?.[0] ?? "/assets/images/featured-sports.webp"
              const vehicle = `${auction.listing.year ?? ""} ${auction.listing.make ?? ""} ${auction.listing.model ?? ""}`.trim()
              return (
                <motion.div
                  key={auction.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                >
                  <Link href={`/auctions/live/${auction.id}`} className="group block bg-slate-900/80 rounded-2xl overflow-hidden border border-[var(--border-default)] hover:border-red-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(220,38,38,0.12)]">
                    <div className="relative h-44 overflow-hidden">
                      <Image src={image} alt={auction.listing.title} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                        <Flame size={9} /> LIVE
                      </div>
                    </div>
                    <div className="p-3.5 space-y-2.5">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">{vehicle}</p>
                        <h3 className="text-white font-bold text-sm leading-tight line-clamp-1 mt-0.5">{auction.listing.title}</h3>
                      </div>
                      <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{bidCount > 0 ? "Current Bid" : "Starting"}</p>
                          <p className="text-white font-mono font-bold text-base leading-none">£{currentBid.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Ends In</p>
                          <div className="text-red-400 text-xs font-mono font-bold">
                            <CountdownTimer targetDate={new Date(auction.endTime)} minimal />
                          </div>
                        </div>
                      </div>
                      <p className="text-red-500 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Bid Now <ArrowRight size={11} />
                      </p>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* Testimonials Section (dynamically imported) */}
      <TestimonialsSection />

      {/* Steps Section */}
      <section className="py-14 md:py-20 border-y" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="container mx-auto px-5 text-center">
          <h2 className="text-3xl font-bold mb-16 font-heading">Simple Steps to Buy, Sell, or Auction</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Search, title: "Browse or List a Car", desc: "Explore verified listings or create your own car listing in minutes." },
              { icon: Handshake, title: "Connect or Bid", desc: "Buy directly, negotiate with sellers, or place bids in live auctions." },
              { icon: Shield, title: "Pay the Seller Directly", desc: "Agree a secure payment method with the seller after completing your vehicle checks." },
              { icon: FileText, title: "Ownership Transfer", desc: "Finalise documentation and drive away with confidence." }
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
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 text-primary border shadow-lg group-hover:border-primary/30 group-hover:shadow-[0_0_20px_rgba(237,28,36,0.2)] transition-all duration-300" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
                  <step.icon size={36} />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{step.title}</h3>
                <p className="text-sm leading-relaxed max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <Button asChild variant="outline" shape="pill" className="px-8 py-4 hover:bg-primary/5 dark:hover:bg-[var(--bg-card)] text-lg">
              <Link href="/how-it-works">
                See Exactly How It Works <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Personalization */}
      <section className="py-14 md:py-20 text-center">
        <div className="container mx-auto px-5 flex flex-col items-center gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-4xl p-12 rounded-3xl border relative overflow-hidden shadow-2xl group"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full group-hover:bg-primary/10 transition-colors duration-500" />

            <div className="relative z-10 flex flex-col items-center text-center w-full">
              <Lightbulb className="text-primary h-12 w-12 mb-6 mx-auto animate-pulse" />
              <h3 className="text-3xl font-bold mb-4">Get personalised car recommendations</h3>
              <p className="mb-8 max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
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

      {/* Partner Account */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto rounded-3xl border p-10 md:p-14 text-center relative overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                <Building2 size={32} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-3">Partner Account</p>
              <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Built for Automotive Businesses</h2>
              <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-muted)' }}>
                Create one Partner Account for your automotive business, then use the Vehicle Dealer and other approved capabilities relevant to the work you provide.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10 text-left">
                {[
                  { icon: FileText, title: "Vehicle Dealer", desc: "Manage vehicle stock and the existing dealer workspace from your business account." },
                  { icon: Users, title: "Business Workspace", desc: "Keep the tools and account access for your automotive operation together." },
                  { icon: Star, title: "Approved Services", desc: "Add supported service capabilities as they are approved for your business." },
                ].map((feature, index) => (
                  <div key={index} className="p-5 rounded-2xl border bg-primary/5 border-primary/10">
                    <feature.icon className="text-primary mb-3" size={22} />
                    <h3 className="font-bold mb-1">{feature.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{feature.desc}</p>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup?role=dealer" className="block sm:inline-block">
                <Button size="lg" className="w-full sm:w-auto justify-center px-6 text-base sm:px-10 sm:text-lg shadow-neon">
                  Create Partner Account <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* App installation options retained below the main marketplace journeys. */}
      <HomeAppPromoCompact />

      {/* Blog Section */}
      {latestBlogPosts.length > 0 && (
        <section className="container mx-auto px-5 mb-24">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-bold font-heading">Automotive Insights & Market Updates</h2>
            <Link href="/blog" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}>
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {latestBlogPosts.map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="glass-card overflow-hidden group hover:border-primary/30 block"
                >
                  <div className="h-48 overflow-hidden relative bg-[var(--bg-input)]">
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors z-10" />
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        width={400}
                        height={250}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                    <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{post.excerpt}</p>
                    <Button variant="link" className="p-0 h-auto text-primary group-hover:translate-x-2 transition-transform">Read More <ArrowRight className="ml-1 h-4 w-4" /></Button>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
