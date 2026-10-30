import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

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
    twitter: {
        title: "Vehicle Delivery & Recovery UK | CarMazium",
        description: "Post vehicle delivery or recovery work and compare fixed-price quotes from approved transport providers through CarMazium TradeXchange.",
    },
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/services/delivery"
                title="Vehicle Delivery & Recovery UK | CarMazium"
                description={metadata.description as string}
                crumbs={[
                    { label: "Home", path: "/" },
                    { label: "Services", path: "/services" },
                    { label: "Vehicle delivery and recovery", path: "/services/delivery" },
                ]}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/services/delivery#service",
                    name: "Vehicle delivery and recovery",
                    serviceType: "Vehicle transport",
                    description: metadata.description,
                    url: SEO_SITE + "/services/delivery",
                    broker: { "@id": SEO_SITE + "/#organization" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
