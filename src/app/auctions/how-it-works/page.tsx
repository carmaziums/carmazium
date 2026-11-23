import Link from "next/link"
import { ArrowLeft, ArrowRight, Gavel } from "lucide-react"
import { HowAuctionsWork } from "@/components/auctions/HowAuctionsWork"

export default function AuctionHowItWorksPage() {
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <Link href="/auctions" className="mb-6 inline-flex min-h-12 items-center gap-2 font-semibold text-[var(--text-secondary)] hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to TradeXchange</Link>
                <div className="max-w-3xl">
                    <p className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300"><Gavel size={18} aria-hidden="true" /> CarMazium TradeXchange</p>
                    <h1 className="mt-3 text-4xl font-heading font-black tracking-tight leading-tight sm:text-5xl">Free vehicle auctions for sellers. Trade stock for verified dealers.</h1>
                    <p className="mt-4 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">Choose your journey. Sell a vehicle through a 24-hour dealer auction, or buy as a verified motor trader. Vehicle payments go directly between buyer and seller.</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <a href="#for-sellers" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-4">I want to sell <ArrowRight size={18} aria-hidden="true" /></a>
                        <a href="#for-dealers" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-3 font-bold hover:bg-[var(--bg-input)] focus-visible:outline-2 focus-visible:outline-offset-4">I am a motor trader</a>
                    </div>
                    <dl className="mt-7 grid grid-cols-3 gap-3 text-center sm:text-left">
                        {[["£0", "Auction listing"], ["£125", "Standard buyer fee"], ["£100", "Qualifying seller incentive"]].map(([amount,label]) => <div key={label} className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3"><dt className="text-xs font-semibold leading-5 text-[var(--text-secondary)] sm:text-sm">{label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{amount}</dd></div>)}
                    </dl>
                </div>
            </div>
        </section>
        <HowAuctionsWork />
    </div>
}
