import Link from "next/link"
import { ArrowLeft, ArrowRight, Gavel } from "lucide-react"
import { HowAuctionsWork } from "@/components/auctions/HowAuctionsWork"

export default function AuctionHowItWorksPage() {
    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
            <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="container mx-auto px-6 py-14 md:py-20">
                    <Link href="/auctions" className="mb-7 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary">
                        <ArrowLeft size={15} /> Back to TradeXchange
                    </Link>
                    <div className="max-w-3xl">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                            <Gavel size={13} /> TradeXchange · Vehicle Auctions
                        </div>
                        <h1 className="mb-5 text-4xl md:text-6xl font-black font-heading tracking-tight leading-[0.98]">
                            Buy and sell vehicles through <span className="text-primary">live trade auctions.</span>
                        </h1>
                        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
                            Sellers can list for free and verified dealers compete in 24-hour auctions. The reserve stays private, anti-snipe protection keeps the finish fair, and CarMazium connects the winner and seller after the auction.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/auctions/browse" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-black uppercase tracking-widest text-white hover:bg-primary/90">
                                Browse auctions <ArrowRight size={16} />
                            </Link>
                            <Link href="/sell" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-7 py-3.5 text-sm font-bold hover:border-primary/40">
                                Sell a vehicle at auction
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <HowAuctionsWork />
        </div>
    )
}
