import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Vehicle Finance Enquiries UK",
    description: "Send a vehicle finance enquiry to approved matching providers through CarMazium TradeXchange. Providers set their own eligibility, rates and regulated terms.",
    alternates: { canonical: "/services/finance" },
    openGraph: {
        title: "Vehicle Finance Enquiries UK | CarMazium",
        description: "Send a vehicle finance enquiry to approved matching providers through CarMazium TradeXchange.",
        url: "/services/finance",
        type: "website",
    },
    twitter: {
        title: "Vehicle Finance Enquiries UK | CarMazium",
        description: "Send a vehicle finance enquiry to approved matching providers through CarMazium TradeXchange.",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/services/finance"
                title="Vehicle Finance Enquiries UK | CarMazium"
                description={metadata.description as string}
                crumbs={[
                    { label: "Home", path: "/" },
                    { label: "Services", path: "/services" },
                    { label: "Vehicle finance enquiries", path: "/services/finance" },
                ]}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/services/finance#service",
                    name: "Vehicle finance enquiries",
                    serviceType: "Vehicle finance introduction",
                    description: metadata.description,
                    url: SEO_SITE + "/services/finance",
                    broker: { "@id": SEO_SITE + "/#organization" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
