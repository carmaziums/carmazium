import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "TradeXchange — Live Auctions & Vehicle Services",
    description:
        "CarMazium TradeXchange brings together live dealer auctions, vehicle delivery and recovery, inspections, finance enquiries and warranty providers in one place.",
    openGraph: {
        title: "TradeXchange | CarMazium",
        description:
            "Live dealer auctions plus vehicle delivery, inspections, finance enquiries and warranty providers through CarMazium.",
    },
}

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
    return children
}
