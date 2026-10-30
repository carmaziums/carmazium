import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

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
    twitter: {
        title: "Vehicle Inspection Services UK | CarMazium",
        description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers through CarMazium TradeXchange.",
    },
}

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/services/inspection"
                title="Vehicle Inspection Services UK | CarMazium"
                description={metadata.description as string}
                crumbs={[
                    { label: "Home", path: "/" },
                    { label: "Services", path: "/services" },
                    { label: "Vehicle inspection", path: "/services/inspection" },
                ]}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/services/inspection#service",
                    name: "Vehicle inspection",
                    serviceType: "Pre-purchase vehicle inspection",
                    description: metadata.description,
                    url: SEO_SITE + "/services/inspection",
                    broker: { "@id": SEO_SITE + "/#organization" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
