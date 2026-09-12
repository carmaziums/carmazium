import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "TradeXchange Services — Delivery, Inspections, Finance & Warranty",
    description:
        "CarMazium TradeXchange Services connects customers with approved vehicle delivery, recovery, inspection, finance and warranty providers across the UK.",
    openGraph: {
        title: "TradeXchange Services | CarMazium",
        description:
            "Arrange vehicle delivery or inspections, or request finance and warranty options from approved CarMazium providers.",
    },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
    return children
}
