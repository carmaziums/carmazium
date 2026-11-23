import type { Metadata } from "next"
import { PageJsonLd, SEO_SITE, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Car Finance UK | Vehicle Finance Applications",
    description: "Apply from participating listings through the selected finance provider’s form. CarMazium does not provide finance. Finance providers should contact our team.",
    keywords: ["car finance UK","used car finance","vehicle finance calculator","monthly car payments"],
    alternates: { canonical: "/services/finance" },
    openGraph: {
        title: "Car Finance UK | Vehicle Finance Applications | CarMazium",
        description: "Apply through the selected finance provider from participating CarMazium listings.",
        url: "/services/finance",
        type: "website",
    },
    twitter: {
        title: "Car Finance UK | Vehicle Finance Applications | CarMazium",
        description: "Apply through the selected finance provider from participating CarMazium listings.",
    },
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/services/finance"
                title="Car Finance UK | Vehicle Finance Applications | CarMazium"
                description={metadata.description as string}
                crumbs={[
                    { label: "Home", path: "/" },
                    { label: "TradeXchange", path: "/auctions" },
                    { label: "Vehicle finance", path: "/services/finance" },
                ]}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/services/finance#service",
                    name: "Vehicle finance",
                    serviceType: "Vehicle finance introduction",
                    description: metadata.description,
                    url: SEO_SITE + "/services/finance",
                    brand: { "@id": SEO_TRADEXCHANGE },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                }}
            />
            {children}
        </>
    )
}
