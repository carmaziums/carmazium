import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

type TopicLink = {
    href: string
    label: string
    description: string
}

/**
 * Route readers to the most relevant public CarMazium guides and marketplace
 * entry points. Use only the post's editorial title/tags; never add every
 * commercial link to every article or invent dynamic listing URLs.
 */
export function EditorialTopicLinks({ title, tags = [] }: { title: string; tags?: string[] }) {
    const topic = [title, ...tags].join(" ").toLowerCase()

    const selling = /\b(sell|selling|seller|valuation|value my car|value your car|trade-in|part exchange|car worth)\b/.test(topic)
    const auctions = /\b(auction|auctions|bidding|bidder|reserve price|dealer auction)\b/.test(topic)
    const buying = /\b(buy|buying|buyer|used cars?|second.hand car|car shopping|vehicle history|hpi|mot history)\b/.test(topic)
    const bodyTypes = /\b(suv|hatchback|estate|saloon|mpv|coupe|convertible|pickup|body type|family car)\b/.test(topic)

    const links: TopicLink[] = []

    if (selling) {
        links.push({
            href: "/sell",
            label: "Get a free car valuation",
            description: "Compare your CarMazium auction and retail selling options.",
        })
    }
    if (auctions) {
        links.push({
            href: "/auctions/how-it-works",
            label: "How CarMazium dealer auctions work",
            description: "Learn about free seller listings and verified trade bidding.",
        })
    }
    if (buying || bodyTypes) {
        links.push({
            href: "/search",
            label: "Search used cars for sale",
            description: "Browse current retail listings on CarMazium.",
        })
    }
    if (bodyTypes) {
        links.push({
            href: "/used-car-types",
            label: "Compare used-car body types",
            description: "Explore practical differences between hatchbacks, SUVs and more.",
        })
    }

    if (links.length === 0) return null

    return (
        <section aria-labelledby="relevant-carmazium-guides" className="mt-10 border-t border-[var(--border-default)] pt-8">
            <h2 id="relevant-carmazium-guides" className="text-lg font-black font-heading text-[var(--text-primary)]">
                Relevant CarMazium guides and next steps
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
                Continue with the guides and tools most relevant to this article.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {links.slice(0, 3).map((link) => (
                    <li key={link.href}>
                        <Link href={link.href} className="group flex h-full items-start justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <span>
                                <span className="block text-sm font-extrabold leading-5 text-[var(--text-primary)] group-hover:text-primary">{link.label}</span>
                                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{link.description}</span>
                            </span>
                            <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
