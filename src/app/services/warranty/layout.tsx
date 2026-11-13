import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Vehicle Warranty Quotes UK",
    description: "Get a 12-month vehicle warranty quote, choose repair limits and optional cover, and pay securely with Stripe. Standard cars £360 and SUVs £445 including VAT.",
    alternates: { canonical: "/services/warranty" },
    openGraph: {
        title: "Vehicle Warranty Quotes UK | CarMazium",
        description: "Get a vehicle warranty quote and pay securely online. Warrantywise warranties arranged through Pulse Cars Limited on CarMazium.",
        url: "/services/warranty",
        type: "website",
    },
    twitter: {
        title: "Vehicle Warranty Quotes UK | CarMazium",
        description: "Get a vehicle warranty quote and pay securely online. Warrantywise warranties arranged through Pulse Cars Limited on CarMazium.",
    },
}

export default function WarrantyLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/services/warranty"
                title="Vehicle Warranty Quotes UK | CarMazium"
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
                    serviceType: "Vehicle warranty ordering",
                    description: metadata.description,
                    url: SEO_SITE + "/services/warranty",
                    provider: { "@id": SEO_SITE + "/#organization" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
