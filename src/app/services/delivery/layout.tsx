import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Delivery & Recovery UK",
    description: "Post vehicle delivery or recovery work and compare fixed-price quotes from approved transport providers through CarMazium Trade Exchange.",
    alternates: { canonical: "/services/delivery" },
    openGraph: {
        title: "Vehicle Delivery & Recovery UK | CarMazium",
        description: "Compare quotes from approved vehicle delivery and recovery providers through CarMazium Trade Exchange.",
        url: "/services/delivery",
        type: "website",
    },
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
    return children
}
