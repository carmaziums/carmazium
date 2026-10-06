import type { Metadata } from "next"

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

const sellPageJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebPage",
            "@id": "https://www.carmazium.com/sell#webpage",
            url: "https://www.carmazium.com/sell",
            name: "Sell My Car Online UK | Free Car Valuation | CarMazium",
            description:
                "Sell your car online in the UK. Get a free car valuation, choose a £0 verified-dealer auction or £1 retail listing, and get paid directly by the buyer.",
            inLanguage: "en-GB",
            isPartOf: { "@id": "https://www.carmazium.com/#website" },
        },
        {
            "@type": "FAQPage",
            "@id": "https://www.carmazium.com/sell#faq",
            mainEntity: [
                {
                    "@type": "Question",
                    name: "How much does it cost to sell my car on CarMazium?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Auction listings are £0 for sellers. Retail listings cost £1. Optional services, if selected, can have their own separate charges.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Can I sell a car with outstanding finance?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Yes. You can list a vehicle with outstanding finance as long as you disclose it accurately. The buyer can clear the agreed settlement with the finance company as part of collection and handover.",
                    },
                },
                {
                    "@type": "Question",
                    name: "Who pays me for my car?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "The buyer pays you directly for the vehicle after the agreed inspection and handover process. CarMazium does not hold the vehicle purchase price between buyer and seller.",
                    },
                },
            ],
        },
    ],
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(sellPageJsonLd).replace(/</g, "\\u003c"),
                }}
            />
            {children}
        </>
    )
}
