import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Vehicle Warranty Providers UK",
    description: "Request vehicle warranty options from approved matching providers through CarMazium Trade Exchange. Providers set their own cover, exclusions and pricing.",
    alternates: { canonical: "/services/warranty" },
    openGraph: {
        title: "Vehicle Warranty Providers UK | CarMazium",
        description: "Request vehicle warranty options from approved matching providers through CarMazium Trade Exchange.",
        url: "/services/warranty",
        type: "website",
    },
}

export default function WarrantyLayout({ children }: { children: React.ReactNode }) {
    return children
}
