import type { Metadata } from "next"
import { SELL_FAQS } from "@/lib/sellFaqs"
import { PageJsonLd, SEO_SITE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Sell My Car Online UK | Free Car Valuation",
    description:
        "Sell your car online in the UK with CarMazium. Get a free car valuation, choose a £0 verified-dealer auction or a £1 retail listing, and get paid directly by the buyer.",
    keywords: [
        "sell my car",
        "sell my car online",
        "sell car online UK",
        "free car valuation",
        "car valuation",
        "how much is my car worth",
        "value my car",
        "car auction UK",
        "sell car to dealers",
        "free car auction",
        "CarMazium",
    ],
    alternates: {
        canonical: "https://www.carmazium.com/sell",
    },
    openGraph: {
        title: "Sell My Car Online | Free Car Valuation | CarMazium",
        description:
            "Get a free car valuation, choose a £0 dealer auction or a £1 retail listing, and sell your car online with CarMazium.",
        url: "https://www.carmazium.com/sell",
        siteName: "CarMazium",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Sell My Car Online | Free Car Valuation | CarMazium",
        description:
            "Get a free car valuation, then choose a free dealer auction or £1 retail listing on CarMazium.",
    },
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageJsonLd
                path="/sell"
                title="Sell My Car Online UK | Free Car Valuation | CarMazium"
                description={metadata.description as string}
                mainEntity={{
                    "@type": "Service",
                    "@id": SEO_SITE + "/sell#service",
                    name: "Sell your car online",
                    serviceType: "Online car selling marketplace",
                    provider: { "@id": SEO_SITE + "/#organization" },
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                    offers: [
                        { "@type": "Offer", name: "Dealer auction listing", price: "0", priceCurrency: "GBP" },
                        { "@type": "Offer", name: "Basic retail listing", price: "1.00", priceCurrency: "GBP" },
                    ],
                }}
                nodes={[{
                    "@type": "FAQPage", "@id": SEO_SITE + "/sell#faq",
                    isPartOf: { "@id": SEO_SITE + "/sell#webpage" },
                    mainEntity: SELL_FAQS.map(faq => ({
                        "@type": "Question", name: faq.question,
                        acceptedAnswer: { "@type": "Answer", text: faq.answer },
                    })),
                }]}
            />
            {children}
        </>
    )
}
