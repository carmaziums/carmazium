import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Inspection Services UK",
    description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers through CarMazium TradeXchange.",
    alternates: { canonical: "/services/inspection" },
    openGraph: {
        title: "Vehicle Inspection Services UK | CarMazium",
        description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers through CarMazium TradeXchange.",
        url: "/services/inspection",
        type: "website",
    },
}

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
    return children
}
