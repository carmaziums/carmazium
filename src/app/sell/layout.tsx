import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sell My Car Online | Free Car Valuation",
    description:
        "Get a free car valuation and sell your car online with CarMazium. List in our dealer auction for £0 or advertise retail for £1. Verified dealers compete and qualifying auction sales can receive a £100 seller incentive.",
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
    return children
}
