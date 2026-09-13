import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "TradeXchange Car Auctions & Vehicle Services UK",
    description:
        "Explore CarMazium TradeXchange for live dealer car auctions plus vehicle delivery, recovery, inspections, finance enquiries and warranty services across the UK.",
    keywords: [
        "car auctions UK",
        "dealer car auctions UK",
        "vehicle auctions UK",
        "vehicle delivery UK",
        "vehicle inspection services UK",
        "TradeXchange",
        "CarMazium",
    ],
    alternates: {
        canonical: "/auctions",
    },
    openGraph: {
        title: "TradeXchange Car Auctions & Vehicle Services UK | CarMazium",
        description:
            "Live dealer vehicle auctions plus delivery, recovery, inspections, finance enquiries and warranty services through CarMazium TradeXchange.",
        url: "/auctions",
        type: "website",
    },
}

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
    return children
}
