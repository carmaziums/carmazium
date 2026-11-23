import Link from "next/link"
import { ArrowRight, BadgeCheck, Banknote, Clock, CreditCard, FileText, Gavel, Handshake, Lock, Search, ShieldCheck, Truck, Zap, type LucideIcon } from "lucide-react"
import { deliveryServiceEnabled, inspectionServiceEnabled } from "@/lib/featureFlags"

// Literal content is also the source for the native auction guide.
const SELLER_STEPS = [
    { icon: FileText, title: "List your vehicle for free", desc: "Add vehicle details, photos and all known faults. Motor vehicles use registration-assisted entry. Touring caravans use manual details and at least one photo; no registration, VIN, mileage or year is required for a touring caravan." },
    { icon: Lock, title: "Choose a private reserve", desc: "Set the minimum price you are willing to accept. Bidders cannot see your reserve." },
    { icon: Clock, title: "Let verified dealers bid", desc: "Your approved listing enters a 24-hour auction. Late bids can extend the closing time." },
    { icon: Gavel, title: "Agree a successful sale", desc: "A qualifying winning bid or an offer you explicitly accept below reserve can complete the auction. If no sale is agreed, you can relist." },
    { icon: Handshake, title: "Arrange the handover", desc: "The winning dealer can contact you once the buyer fee is paid or an approved waiver applies. Arrange inspection and collection directly." },
    { icon: Banknote, title: "Receive payment directly", desc: "The dealer pays you for the vehicle. Confirm receipt of the funds before releasing the vehicle and submitting handover evidence." },
    { icon: BadgeCheck, title: "Receive the qualifying £100 incentive", desc: "After a qualifying successful sale, confirmed payment and approved handover photo, CarMazium releases the £100 seller incentive through its payout process." },
]

const BUYER_STEPS = [
    { icon: ShieldCheck, title: "Complete dealer verification", desc: "Use your existing Partner Account or create one if you are new. Verified motor traders can bid; ordinary retail customers cannot bid." },
    { icon: Search, title: "Find and review a vehicle", desc: "Review the seller's photographs, declared faults and available vehicle history. Exterior grading is not a mechanical inspection." },
    { icon: Gavel, title: "Place a bid or request Buy It Now", desc: "Bid in real time. If the seller offers Buy It Now, submit a request at that price; it is not an instant win and requires seller acceptance." },
    { icon: Clock, title: "Wait for a confirmed win", desc: "The highest qualifying bid can win when the auction closes. A below-reserve offer requires the seller's explicit acceptance." },
    { icon: CreditCard, title: "Pay the standard £125 buyer fee", desc: "Complete the buyer-fee checkout within the displayed 72-hour deadline, unless an approved fee waiver applies. This unlocks seller contact and chat; the fee is separate from the vehicle price." },
    { icon: Truck, title: "Inspect and arrange collection", desc: "After winning and fee clearance, use the purchase's linked inspection or delivery request where available. Agree collection and inspect the vehicle before handover." },
    { icon: Handshake, title: "Pay the seller and complete handover", desc: "Pay the vehicle price directly to the seller. CarMazium does not collect or hold the vehicle purchase funds." },
]

const RULES = [
    { icon: Clock, term: "24-hour auction", def: "The initial auction window is 24 hours; late bids may extend it." },
    { icon: Zap, term: "Late-bid extension", def: "A qualifying bid in the final 3 minutes adds 3 minutes to the scheduled closing time. This can repeat." },
    { icon: Lock, term: "Reserve price", def: "The seller's minimum remains private. Below-reserve bids do not automatically complete a sale; the seller may explicitly accept a provisional offer." },
    { icon: Gavel, term: "Buy It Now", def: "The seller must accept the request before the earlier of 24 hours after the request or the auction closing time." },
    { icon: CreditCard, term: "Buyer fee", def: "The standard £125 fee is charged after a confirmed win, subject to an approved fee waiver. It is separate from the vehicle price." },
    { icon: BadgeCheck, term: "Seller incentive", def: "The £100 incentive is conditional on a qualifying completed sale and approved handover evidence." },
]

const TRUST = [
    { icon: ShieldCheck, title: "Verified trade buyers", desc: "Dealer bidding requires verification. Private buyers can use the retail marketplace." },
    { icon: FileText, title: "Seller-reported condition", desc: "Review declared faults and photographs. Exterior damage grades are based on reported damage, not independent mechanical checks. Touring caravans use seller-supplied details." },
    { icon: Search, title: "Available vehicle history", desc: "Motor-vehicle listings show available MOT and registration information. History and disclosed condition do not guarantee a fault-free vehicle." },
]

const FAQS = [
    { q: "Can a private individual sell at auction?", a: "Yes. Private sellers and motor traders can list for free. Only verified trade dealers can bid." },
    { q: "What if my reserve is not met?", a: "There is no automatic sale. The seller may explicitly accept a provisional offer below reserve or relist if no sale is agreed." },
    { q: "When do I receive the £100 incentive?", a: "After a qualifying successful sale, confirmation that the dealer paid you directly and approval of your handover photo. Payout is subject to the applicable terms." },
    { q: "Does CarMazium hold the vehicle purchase price?", a: "No. Buyers pay sellers directly for vehicles. The auction buyer fee, seller incentive and separate paid TradeXchange services use their own payment processes." },
    { q: "Can a winning dealer arrange an independent inspection?", a: "Where available, an eligible winning dealer can request a linked inspection after fee clearance and before approved handover. A completed linked inspection with faults recorded may allow refusal under the auction terms. The £125 buyer fee is refunded if paid; a waived fee has no cash refund." },
    { q: "Can I arrange vehicle delivery?", a: "Yes, where available. Use the linked delivery option on an eligible purchase to request transport quotes. Delivery is a separate paid service, not included in the auction fee." },
]

const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7"
const linkStyle = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)]"
const primary = linkStyle + " bg-red-700 text-white hover:bg-red-800"
const secondary = linkStyle + " border border-[var(--border-default)] hover:bg-[var(--bg-input)]"

function Steps({ steps }: { steps: { icon: LucideIcon; title: string; desc: string }[] }) {
    return <ol className="mt-6 space-y-5">
        {steps.map((step, i) => <li key={step.title} className="flex gap-4">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-input)] font-bold tabular-nums">{i + 1}</span>
            <div className="min-w-0"><h3 className="font-bold text-lg leading-snug">{step.title}</h3><p className="mt-1 text-base leading-7 text-[var(--text-secondary)]">{step.desc}</p></div>
        </li>)}
    </ol>
}

export function HowAuctionsWork() {
    return <div id="how-it-works" className="mx-auto max-w-7xl space-y-12 px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-5 lg:grid-cols-2">
            <section id="for-sellers" aria-labelledby="seller-heading" className={panel + " scroll-mt-24 flex flex-col"}>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">For private sellers and motor traders</p>
                <h2 id="seller-heading" className="mt-2 text-3xl font-heading font-bold">Sell a vehicle at auction</h2>
                <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">Free auction listing. No seller auction listing fee. A qualifying sale can earn a £100 incentive.</p>
                <Steps steps={SELLER_STEPS} />
                <div className="mt-auto pt-6"><Link href="/sell?sellMode=auction#sell-options" className={primary}>Start free auction listing <ArrowRight size={18} aria-hidden="true" /></Link></div>
            </section>
            <section id="for-dealers" aria-labelledby="dealer-heading" className={panel + " scroll-mt-24 flex flex-col"}>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">For verified motor traders</p>
                <h2 id="dealer-heading" className="mt-2 text-3xl font-heading font-bold">Buy vehicles at auction</h2>
                <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">Browse trade stock. Pay the standard £125 buyer fee only after a confirmed win, unless an approved waiver applies.</p>
                <Steps steps={BUYER_STEPS} />
                <div className="mt-auto flex flex-wrap gap-2 pt-6"><Link href="/auctions/browse" className={primary}>Browse dealer auctions <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/become-a-partner" className={secondary}>Partner Account guide</Link></div>
            </section>
        </div>
        <section aria-label="Private retail buyers" className={panel}>
            <h2 className="text-xl font-bold">Buying as a private customer?</h2>
            <p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">You can buy directly from retail sellers without bidding in a dealer auction.</p>
            <Link href="/search" className={secondary + " mt-4"}>Browse retail cars <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
        <section aria-labelledby="auction-rules"><h2 id="auction-rules" className="text-2xl font-heading font-bold">Auction rules explained</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{RULES.map(rule => <div key={rule.term} className={panel}>
                <rule.icon size={23} className="text-red-700 dark:text-red-300" aria-hidden="true" />
                <dt className="mt-3 text-lg font-bold">{rule.term}</dt><dd className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{rule.def}</dd>
            </div>)}</dl>
        </section>
        <section aria-labelledby="auction-checks"><h2 id="auction-checks" className="text-2xl font-heading font-bold">Know what you are buying</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">{TRUST.map(item => <article className={panel} key={item.title}><item.icon size={23} className="text-red-700 dark:text-red-300" aria-hidden="true" /><h3 className="mt-3 font-bold text-lg">{item.title}</h3><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{item.desc}</p></article>)}</div>
        </section>
        {(deliveryServiceEnabled || inspectionServiceEnabled) && <section aria-labelledby="auction-services" className={panel}>
            <h2 id="auction-services" className="text-2xl font-heading font-bold">Need help with inspection or transport?</h2>
            <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">For an eligible auction purchase, use the linked services on the won-auction page after fee clearance. This keeps the vehicle and purchase associated with your request. Service charges are separate from the auction fee and vehicle price.</p>
            <div className="mt-4 flex flex-wrap gap-2">{inspectionServiceEnabled && <Link href="/services/inspection" className={secondary}>Explore vehicle inspections</Link>}{deliveryServiceEnabled && <Link href="/services/delivery" className={secondary}>Explore vehicle transport</Link>}</div>
        </section>}
        <section aria-labelledby="auction-faq"><h2 id="auction-faq" className="text-2xl font-heading font-bold">Frequently asked questions</h2>
            <div className="mt-5 space-y-3">{FAQS.map(faq => <details key={faq.q} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]"><summary className="min-h-12 cursor-pointer px-5 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-primary">{faq.q}</summary><p className="px-5 pb-5 text-base leading-7 text-[var(--text-secondary)]">{faq.a}</p></details>)}</div>
            <p className="mt-5 text-base text-[var(--text-secondary)]">Read the <Link href="/terms" className="font-semibold underline">auction terms</Link> or <Link href="/contact" className="font-semibold underline">contact our team</Link>.</p>
        </section>
    </div>
}
