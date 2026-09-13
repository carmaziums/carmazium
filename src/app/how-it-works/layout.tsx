import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "How to Sell Your Car Online or Buy a Car — How It Works",
    description:
        "Learn how CarMazium works for UK car sellers and buyers: get a valuation, list your car, let verified dealers bid, arrange collection and complete the sale directly.",
    keywords: [
        "how to sell my car online",
        "sell car online UK",
        "online car auction UK",
        "sell car to dealers",
        "buy used car online UK",
        "CarMazium how it works",
    ],
    alternates: {
        canonical: "/how-it-works",
    },
    openGraph: {
        title: "How to Sell Your Car Online or Buy a Car | CarMazium",
        description:
            "See the CarMazium process for UK sellers and buyers, from valuation and listing through bidding, collection and handover.",
        url: "/how-it-works",
        type: "website",
    },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
    return children
}
