import Link from "next/link"
import { ArrowRight, BadgeCheck, MessageSquareText, ShieldCheck, Star } from "lucide-react"

export default function ReviewsPage() {
    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-6xl">
                <section className="text-center max-w-3xl mx-auto mb-14">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 mb-5 text-xs font-black uppercase tracking-widest text-primary">
                        <BadgeCheck size={14} /> CarMazium reviews
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black font-heading mb-5">Reviews tied to real marketplace activity</h1>
                    <p className="text-[var(--text-muted)] text-lg leading-relaxed">
                        CarMazium does not publish invented customer counts, ratings or testimonials. Seller reviews come from the marketplace review system and are shown against the relevant seller profile.
                    </p>
                </section>

                <section className="grid md:grid-cols-3 gap-5 mb-12">
                    <InfoCard icon={ShieldCheck} title="Transaction-linked" text="Reviews are connected to CarMazium marketplace activity rather than anonymous marketing quotes." />
                    <InfoCard icon={Star} title="Seller-specific" text="Ratings belong to the seller involved in the transaction, so buyers can judge the business or person they may deal with." />
                    <InfoCard icon={MessageSquareText} title="Real feedback" text="Where a review exists, customers can read the rating and comment on the seller profile instead of seeing a fabricated platform testimonial." />
                </section>

                <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-7">
                    <div className="max-w-2xl">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-3">Browse the marketplace</p>
                        <h2 className="text-2xl md:text-3xl font-black font-heading mb-3">Check the seller attached to the vehicle you are considering</h2>
                        <p className="text-sm leading-6 text-[var(--text-muted)]">
                            Open a vehicle listing and use the seller information available there. When that seller has marketplace review history, CarMazium presents it in the seller context where it is useful.
                        </p>
                    </div>
                    <Link href="/search" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white whitespace-nowrap">
                        Browse cars <ArrowRight size={17} />
                    </Link>
                </section>
            </main>
        </div>
    )
}

function InfoCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; text: string }) {
    return (
        <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Icon size={21} /></div>
            <h2 className="font-heading font-bold text-lg mb-2">{title}</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">{text}</p>
        </article>
    )
}
