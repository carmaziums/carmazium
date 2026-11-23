import Link from "next/link"
import { ArrowLeft, ArrowRight, CarFront, Truck, Wrench, ShieldCheck } from "lucide-react"
import { deliveryServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"
import { TradeXchangePartnerAction } from "@/components/tradexchange/TradeXchangeAccountActions"

const choices = [
    { kind: "delivery", title: "Delivery", description: "Move a vehicle to your home, dealership or another destination.", icon: Truck },
    { kind: "collection", title: "Collection", description: "Arrange collection from a seller, auction or other agreed location.", icon: CarFront },
    { kind: "recovery", title: "Recovery", description: "Move a non-running, damaged or immobilised vehicle. Explain its condition so providers can quote suitable equipment.", icon: Wrench },
] as const
const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-6"
const action = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"

export default function DeliveryLandingPage() {
    if (!deliveryServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Transport" />
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <Link href="/auctions" className="mb-6 inline-flex min-h-12 items-center gap-2 text-[var(--text-secondary)] font-semibold hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to TradeXchange</Link>
                <p className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300"><Truck size={19} aria-hidden="true" /> Vehicle Transport</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-heading font-black leading-tight tracking-tight sm:text-5xl">Vehicle delivery, collection and recovery across the UK.</h1>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Request fixed-price transport quotes for one vehicle or up to 12 vehicles travelling on the same route. Choose an approved provider that suits your requirements. Availability depends on your route and providers.</p>
            </div>
        </section>
        <div className="mx-auto max-w-7xl space-y-12 px-5 py-10 sm:px-8 sm:py-14">
            <section aria-labelledby="transport-choice"><h2 id="transport-choice" className="text-2xl font-heading font-bold">What do you need?</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">{choices.map(choice => <Link key={choice.kind} href={"/services/delivery/new?kind=" + choice.kind} className={panel + " flex flex-col gap-3 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"}>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"><choice.icon size={25} aria-hidden="true" /></span>
                    <h3 className="text-xl font-bold">{choice.title}</h3><p className="text-base leading-7 text-[var(--text-secondary)]">{choice.description}</p>
                    <span className="mt-auto pt-2 flex items-center justify-between gap-2 font-bold text-red-700 dark:text-red-300">Get {choice.kind} quotes <ArrowRight size={18} aria-hidden="true" /></span>
                </Link>)}</div>
                <Link href="/services/jobs" className={action + " mt-4 border border-[var(--border-default)] hover:bg-[var(--bg-input)]"}>My service requests</Link>
            </section>
            <section aria-labelledby="transport-process"><h2 id="transport-process" className="text-2xl font-heading font-bold">How it works</h2>
                <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
                    ["Request transport", "Enter collection and delivery postcodes, vehicles and your preferred date."],
                    ["Compare quotes", "Approved providers can quote for your route. No booking or payment is made just by posting."],
                    ["Choose and pay", "Accept a suitable quote and pay through CarMazium. Your chosen provider receives the required contact and address details after payment."],
                    ["Confirm completion", "Review the completed work. Provider payout follows the service terms, including the 48-hour completion review and dispute process."],
                ].map(([title,desc],index) => <li key={title} className={panel}><span className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-input)] font-bold">{index+1}</span><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{desc}</p></li>)}</ol>
            </section>
            <section className={panel}><div className="flex gap-3"><ShieldCheck size={25} className="shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" /><div><h2 className="text-xl font-bold">Approved transport providers</h2><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">Transport providers must have approved Motor Trade Insurance and Public Liability Insurance. Vehicle purchase payments remain separate and go directly to the vehicle seller. For a vehicle purchased on CarMazium, use the linked transport option in your purchase details where available.</p></div></div></section>
            <section className={panel}><h2 className="text-xl font-bold">Do you provide vehicle transport?</h2><p className="mt-2 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">Use your existing Partner Account to add transport services or learn how to join. The platform fee is 9% of the accepted job price and the provider share is 91%, subject to completion and payment release terms.</p><TradeXchangePartnerAction /></section>
        </div>
    </div>
}
