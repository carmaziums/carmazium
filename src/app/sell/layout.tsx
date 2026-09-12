import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sell Your Car Online | Free Auction or £1 Retail | CarMazium",
    description:
        "Sell your car online with CarMazium. List in our dealer auction for £0 or advertise retail for £1. Verified dealers compete and qualifying auction sales can receive a £100 seller incentive.",
    keywords: [
        "sell my car",
        "sell car online UK",
        "car auction UK",
        "sell car to dealers",
        "free car auction",
        "CarMazium",
    ],
    alternates: {
        canonical: "https://www.carmazium.com/sell",
    },
    openGraph: {
        title: "Sell Your Car Online | Free Auction or £1 Retail | CarMazium",
        description:
            "Choose a £0 dealer auction or a £1 retail listing. Verified dealers can compete and qualifying auction sales can receive a £100 seller incentive.",
        url: "https://www.carmazium.com/sell",
        siteName: "CarMazium",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Sell Your Car Online | CarMazium",
        description:
            "Free dealer auction or £1 retail listing, with a £100 incentive on qualifying auction sales.",
    },
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
    return children
}
