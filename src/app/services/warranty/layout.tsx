import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

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
    return (
        <>
            <PageJsonLd
                path="/services/warranty"
                title="Vehicle Warranty Providers UK | CarMazium"
                description={metadata.description as string}
                crumbs={[
                    { label: "Home", path: "/" },
                    { label: "Services", path: "/services" },
                    { label: "Vehicle warranty options", path: "/services/warranty" },
                ]}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/services/warranty#service",
                    name: "Vehicle warranty options",
                    serviceType: "Used vehicle warranty introduction",
                    description: metadata.description,
                    url: SEO_SITE + "/services/warranty",
                    broker: { "@id": SEO_SITE + "/#organization" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
