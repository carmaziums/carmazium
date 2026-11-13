import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Vehicle Warranty Providers UK",
    description: "Contact the CarMazium team about vehicle warranties. Admin manages warranty partners and applications directly. Online quotes and purchases are being prepared.",
    alternates: { canonical: "/services/warranty" },
    openGraph: {
        title: "Vehicle Warranty Providers UK | CarMazium",
        description: "Contact the CarMazium team about vehicle warranties and warranty partnerships.",
        url: "/services/warranty",
        type: "website",
    },
    twitter: {
        title: "Vehicle Warranty Providers UK | CarMazium",
        description: "Contact the CarMazium team about vehicle warranties and warranty partnerships.",
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
                    serviceType: "Vehicle warranty enquiry",
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
