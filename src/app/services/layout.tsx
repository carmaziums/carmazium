import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Delivery, Inspection, Finance & Warranty Services UK",
    description:
        "Find approved vehicle delivery, recovery and inspection providers, plus finance enquiries and warranty services through CarMazium Trade Exchange across the UK.",
    keywords: [
        "vehicle delivery UK",
        "car recovery UK",
        "vehicle inspection UK",
        "car inspection service UK",
        "car warranty services UK",
        "Trade Exchange services",
        "CarMazium",
    ],
    alternates: {
        canonical: "/services",
    },
    openGraph: {
        title: "Vehicle Delivery, Inspection, Finance & Warranty Services UK | CarMazium",
        description:
            "Access approved vehicle delivery, recovery, inspection, finance enquiry and warranty services through CarMazium Trade Exchange.",
        url: "/services",
        type: "website",
    },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
    return children
}
