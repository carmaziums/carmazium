import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Delivery & Recovery UK",
    description: "Post vehicle delivery or recovery work and compare fixed-price quotes from approved transport providers through CarMazium TradeXchange.",
    alternates: { canonical: "/services/delivery" },
    openGraph: {
        title: "Vehicle Delivery & Recovery UK | CarMazium",
        description: "Post vehicle delivery or recovery work and compare fixed-price quotes from approved transport providers through CarMazium TradeXchange.",
        url: "/services/delivery",
        type: "website",
    },
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
    return children
}
