import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Warranty Providers UK",
    description: "Request vehicle warranty options from approved matching providers through CarMazium TradeXchange. Providers set their own cover, exclusions and pricing.",
    alternates: { canonical: "/services/warranty" },
    openGraph: {
        title: "Vehicle Warranty Providers UK | CarMazium",
        description: "Request vehicle warranty options from approved matching providers through CarMazium TradeXchange.",
        url: "/services/warranty",
        type: "website",
    },
    twitter: {
        title: "Vehicle Warranty Providers UK | CarMazium",
        description: "Request vehicle warranty options from approved matching providers through CarMazium TradeXchange.",
    },
}

export default function WarrantyLayout({ children }: { children: React.ReactNode }) {
    return children
}
