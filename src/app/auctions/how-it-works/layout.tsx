import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "How Auctions Work — Sell for £100, Bid as a Verified Dealer",
    description:
        "How Carmazium car auctions work: sellers list free and earn a £100 bonus, verified dealers bid over a 24-hour window with anti-snipe protection. See the full process, fees, and rules.",
    openGraph: {
        title: "How Carmazium Auctions Work",
        description:
            "Sellers list free and earn £100. Verified dealers bid over 24 hours with anti-snipe protection. See the full auction process, fees, and rules.",
    },
}

export default function AuctionHowItWorksLayout({ children }: { children: React.ReactNode }) {
    return children
}
