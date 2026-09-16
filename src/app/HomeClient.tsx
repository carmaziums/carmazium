"use client"

import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowRight, Building2, CheckCircle, FileText, Flame, Gavel, Handshake, Loader2, Search, Shield, ShieldCheck, Sparkles, Truck, UserCheck, Users, Wrench } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { BrowseByCategory } from "@/components/features/BrowseByCategory"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { formatPrice, type Listing } from "@/lib/listingApi"
import { aiSearch, type AiSearchResult } from "@/lib/aiApi"
import { CarCard } from "@/components/features/CarCard"
import { getActiveAuctions, type Auction, getCurrentBid, getBidCount } from "@/lib/auctionApi"
import { canAccessTradeStock } from "@/lib/tradeAccess"
import { useAuth } from "@/context/AuthContext"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { type BlogPostSummary } from "@/lib/blogApi"

const DiscoverSection = dynamic(() => import("@/components/features/DiscoverSection").then(mod => mod.DiscoverSection))
const TestimonialsSection = dynamic(() => import("@/components/features/TestimonialsSection").then(mod => mod.TestimonialsSection))

interface HomeClientProps {
    initialListings: Listing[]
    latestBlogPosts?: BlogPostSummary[]
}

export default function HomeClient({ initialListings, latestBlogPosts = [] }: HomeClientProps) {
    const router = useRouter()
    const { resolvedTheme } = useTheme()
    const { profile } = useAuth()
    const [mounted, setMounted] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [aiResult, setAiResult] = useState<AiSearchResult | null>(null)
    const [aiSearching, setAiSearching] = useState(false)
    const [liveAuctions, setLiveAuctions] = useState<Auction[]>([])

    useEffect(() => setMounted(true), [])

    const heroVideoSrc = mounted && resolvedTheme === "light" ? "/assets/videos/hero-cinematic-light.mp4" : "/assets/videos/hero-cinematic.mp4"
    const heroPosterSrc = mounted && resolvedTheme === "light" ? "/assets/videos/hero-cinematic-light-poster.jpg" : "/assets/videos/hero-cinematic-poster.jpg"
    const canTrade = canAccessTradeStock(profile)

    useEffect(() => {
        if (!canTrade) {
            setLiveAuctions([])
            return
        }
        getActiveAuctions().then(data => setLiveAuctions(data.slice(0, 4))).catch(() => {})
    }, [canTrade])

    const handleAiSearch = async (e?: React.FormEvent) => {
        e?.preventDefault()
        const q = searchQuery.trim()
        if (!q || aiSearching) return
        setAiSearching(true)
        setAiResult(null)
        try {
            setAiResult(await aiSearch(q))
        } catch (err) {
            console.error("AI search failed:", err)
            setAiResult({ text: "Something went wrong — try again or use the search page filters!" })
        } finally {
            setAiSearching(false)
        }
    }

    const handleApplyFilters = (params: Record<string, string>) => {
        router.push(`/search?${new URLSearchParams(params).toString()}`)
    }

    return (
        <div className="w-full max-w-[100vw] overflow-x-hidden flex flex-col">
            <section className="relative min-h-[86vh] flex items-center justify-center text-center text-white overflow-hidden" style={{ marginTop: "-100px", paddingTop: "100px" }}>
                <div className="absolute inset-0">
                    <video key={heroVideoSrc} autoPlay muted loop playsInline preload="none" poster={heroPosterSrc} className="absolute top-1/2 left-1/2 min-w-full min-h-full object-cover -translate-x-1/2 -translate-y-1/2">
                        <source src={heroVideoSrc} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/35 to-slate-950/80" />
                </div>

                <div className="relative z-10 container mx-auto px-5 max-w-5xl">
                    <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-red-300">CarMazium UK Marketplace</motion.p>
                    <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="text-5xl md:text-7xl font-black font-heading mb-5 leading-tight drop-shadow-2xl">
                        Sell Your Car <br /> Your <span className="text-primary">Way</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="text-xl md:text-2xl font-bold mb-3">Auction <span className="text-primary">FREE</span> · Retail from <span className="text-primary">£1</span></motion.p>
                    <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mx-auto mb-8 max-w-2xl text-sm md:text-base text-slate-200 leading-relaxed">Let verified motor traders compete in a dealer auction, or advertise directly to retail buyers. Qualifying completed auction sales can receive a £100 seller reward.</motion.p>

                    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                        <form onSubmit={handleAiSearch} className="flex flex-col md:flex-row w-full max-w-3xl mx-auto mb-3 rounded-2xl border border-white/20 bg-black/25 p-2 shadow-2xl backdrop-blur-xl">
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ask Mazium AI: e.g. red SUV under £30k..." className="flex-1 min-w-0 bg-transparent px-6 py-4 text-white placeholder:text-slate-300 focus:outline-none text-base" />
                            <Button type="submit" size="lg" className="px-8" disabled={aiSearching || !searchQuery.trim()}>{aiSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}{aiSearching ? "Thinking..." : "AI Search"}</Button>
                        </form>
                        <p className="mb-6 text-xs text-slate-300">Powered by Mazium AI — describe the car you want in your own words.</p>
                    </motion.div>

                    <AnimatePresence>
                        {(aiSearching || aiResult) && <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto mb-8 max-w-3xl rounded-2xl border border-white/15 bg-black/35 p-5 text-left backdrop-blur-xl">
                            {aiSearching ? <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="font-bold">Mazium AI is searching...</span></div> : aiResult && <div className="space-y-4"><p className="text-sm leading-relaxed text-slate-100">{aiResult.text}</p>{aiResult.filterCard && <button onClick={() => handleApplyFilters(aiResult.filterCard!.params)} className="flex w-full items-center justify-between rounded-xl border border-primary/35 bg-primary/10 px-5 py-4 text-left hover:bg-primary/15"><span><span className="block text-xs font-black uppercase tracking-wider text-red-300">View matching cars</span><span className="font-semibold">{aiResult.filterCard.label}</span></span><ArrowRight className="text-primary" size={18} /></button>}</div>}
                        </motion.div>}
                    </AnimatePresence>

                    <div className="flex flex-wrap justify-center gap-3"><Button asChild size="lg"><Link href="/sell">Sell my car <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" size="lg" className="border-white/35 text-white hover:border-white/60 hover:bg-white/10"><Link href="/search">Browse cars</Link></Button></div>
                </div>
            </section>

            <section className="border-b border-[var(--border-default)] py-8" style={{ background: "var(--bg-card)" }}><div className="container mx-auto px-5"><div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-sm font-semibold text-[var(--text-muted)]">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Account verification</div>
                <div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Verified sellers & partners</div>
                <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Vehicle information tools</div>
                <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Direct buyer-seller transactions</div>
            </div></div></section>

            <DiscoverSection />
            <BrowseByCategory />

            {initialListings.length > 0 && <section className="container mx-auto px-5 py-16"><div className="flex items-end justify-between mb-8"><div><p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-primary">Marketplace picks</p><h2 className="text-3xl font-black font-heading">Featured Listings</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Seller-boosted vehicles currently live on CarMazium.</p></div><Link href="/search" className="text-sm font-bold text-primary hover:underline">View all cars</Link></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{initialListings.map(listing => <CarCard key={listing.id} title={listing.title} make={listing.make} model={listing.model} price={formatPrice(listing.price)} image={listing.images?.[0] || "/assets/images/featured-sports.png"} images={listing.images ?? []} href={`/vehicle/${listing.slug}`} year={listing.year ?? undefined} mileage={listing.mileage ?? undefined} fuelType={listing.fuelType ?? undefined} bodyType={listing.bodyType ?? undefined} isFeatured badgeTier={listing.badgeTier} status={listing.status} bannerLabel={listing.bannerLabel} hasLinkedAuction={!!listing.linkedListingId} isDepartedSale={listing.isDepartedSale ?? false} deliveryAvailable={listing.deliveryAvailable ?? false} exteriorGrade={listing.exteriorGrade} writeOffCategory={listing.writeOffCategory} />)}</div></section>}

            {liveAuctions.length > 0 && <section className="container mx-auto px-5 pb-16"><div className="flex items-end justify-between mb-8"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-500"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Live dealer auctions</p><h2 className="text-3xl font-black font-heading">Trade Stock Live Now</h2></div><Link href="/auctions/browse" className="text-sm font-bold text-primary hover:underline">View all auctions</Link></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{liveAuctions.map(auction => { const currentBid = getCurrentBid(auction); const bidCount = getBidCount(auction); const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"; return <Link key={auction.id} href={`/auctions/live/${auction.id}`} className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-slate-950 text-white hover:border-red-500/40"><div className="relative h-44"><Image src={image} alt={auction.listing.title} fill className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" /><span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black"><Flame size={10} className="mr-1 inline" /> LIVE</span></div><div className="p-4"><h3 className="mb-3 line-clamp-1 font-bold">{auction.listing.title}</h3><div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">{bidCount ? "Current bid" : "Starting"}</p><p className="font-mono text-lg font-bold">£{currentBid.toLocaleString()}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-400">Ends in</p><CountdownTimer targetDate={new Date(auction.endTime)} minimal /></div></div></div></Link> })}</div></section>}

            <TestimonialsSection />

            <section className="py-20"><div className="container mx-auto px-5"><div className="mx-auto max-w-5xl text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Simple process</p><h2 className="mb-12 text-3xl md:text-4xl font-black font-heading">From search or listing to a completed handover</h2><div className="grid gap-5 md:grid-cols-4">{[
                { icon: Search, title: "Browse or list", text: "Find a vehicle or create your own listing." },
                { icon: Handshake, title: "Connect or bid", text: "Retail buyers enquire; verified traders can bid in dealer auctions." },
                { icon: Shield, title: "Complete checks", text: "Review the vehicle, arrange inspection and agree the transaction." },
                { icon: FileText, title: "Pay & hand over", text: "Vehicle payment and handover take place directly between buyer and seller." },
            ].map(item => <article key={item.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-left"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><item.icon size={20} className="text-primary" /></div><h3 className="mb-2 font-bold">{item.title}</h3><p className="text-sm leading-relaxed text-[var(--text-muted)]">{item.text}</p></article>)}</div><div className="mt-9"><Button asChild variant="outline" size="lg"><Link href="/how-it-works">See how it works <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div></div></section>

            <section className="border-y border-[var(--border-default)] py-20" style={{ background: "var(--bg-card)" }}><div className="container mx-auto px-5"><div className="mx-auto max-w-5xl rounded-3xl border border-primary/25 bg-primary/5 p-8 md:p-12"><div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center"><div><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Building2 size={27} className="text-primary" /></div><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">For automotive businesses</p><h2 className="mb-4 text-3xl md:text-4xl font-black font-heading">Build one Partner Account around your business</h2><p className="text-[var(--text-muted)] leading-relaxed">Vehicle Dealer, Delivery & Recovery and Vehicle Inspection are capabilities within the Partner Account. Apply for the services you actually provide and manage them from one business workspace.</p></div><div className="grid gap-4 sm:grid-cols-3">{[
                { icon: Gavel, title: "Vehicle Dealer", text: "Trade bidding, inventory and dealer tools." },
                { icon: Truck, title: "Delivery & Recovery", text: "Quote on suitable vehicle movement jobs." },
                { icon: Wrench, title: "Vehicle Inspection", text: "Quote on independent inspection work." },
            ].map(item => <div key={item.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><item.icon className="mb-3 text-primary" size={22} /><h3 className="mb-1 font-bold">{item.title}</h3><p className="text-xs leading-relaxed text-[var(--text-muted)]">{item.text}</p></div>)}</div></div><div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/auth/signup?role=DEALER">Create Partner Account <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" size="lg"><Link href="/auctions">Explore TradeXchange</Link></Button></div></div></div></section>

            {latestBlogPosts.length > 0 && <section className="container mx-auto px-5 py-16 md:py-20"><div className="flex items-end justify-between mb-9"><div><p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-primary">Learn</p><h2 className="text-3xl font-black font-heading">Automotive Insights</h2></div><Link href="/blog" className="text-sm font-bold text-primary hover:underline">View all articles</Link></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{latestBlogPosts.map(post => <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-primary/35"><div className="relative h-44 bg-[var(--bg-input)]">{post.coverImage ? <Image src={post.coverImage} alt={post.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Sparkles className="text-[var(--text-muted)]" /></div>}</div><div className="p-5"><h3 className="mb-2 line-clamp-2 font-bold group-hover:text-primary">{post.title}</h3><p className="line-clamp-2 text-sm text-[var(--text-muted)]">{post.excerpt}</p><span className="mt-4 inline-flex items-center text-sm font-bold text-primary">Read article <ArrowRight className="ml-1 h-4 w-4" /></span></div></Link>)}</div></section>}
        </div>
    )
}
