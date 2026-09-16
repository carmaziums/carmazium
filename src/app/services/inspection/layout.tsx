import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Inspection Services UK",
    description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers through CarMazium Trade Exchange.",
    alternates: { canonical: "/services/inspection" },
    openGraph: {
        title: "Vehicle Inspection Services UK | CarMazium",
        description: "Compare quotes from approved vehicle inspection providers through CarMazium Trade Exchange.",
        url: "/services/inspection",
        type: "website",
    },
}

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
    return children
}
