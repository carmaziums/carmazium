import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Vehicle Finance Enquiries UK",
    description: "Apply from participating listings through the Jigsaw Finance form. CarMazium does not provide finance. Finance providers should contact our team.",
    alternates: { canonical: "/services/finance" },
    openGraph: {
        title: "Vehicle Finance Enquiries UK | CarMazium",
        description: "Apply through Jigsaw Finance from participating CarMazium listings.",
        url: "/services/finance",
        type: "website",
    },
    twitter: {
        title: "Vehicle Finance Enquiries UK | CarMazium",
        description: "Apply through Jigsaw Finance from participating CarMazium listings.",
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
                    provider: { "@type": "Organization", name: "Jigsaw Finance" },
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
