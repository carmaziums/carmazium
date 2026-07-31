import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Live Auctions — Real-Time Car Bidding",
    description:
        "Join live car auctions on CarMazium. Bid in real-time on quality vehicles and get the best deals. Coming soon to UK.",
    openGraph: {
        title: "Live Auctions | CarMazium",
        description:
            "Bid in real-time on quality vehicles. Coming soon to UK.",
    },
}

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
    return children
}
