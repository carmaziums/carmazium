import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Car Selling Fees & Listing Prices UK",
    description:
        "See CarMazium car selling fees and listing prices, including free auction listings, £1 retail listings and optional upgrades for UK vehicle sellers.",
    keywords: [
        "car selling fees UK",
        "car listing price UK",
        "free car auction listing",
        "£1 car listing",
        "sell car online fees",
        "CarMazium pricing",
    ],
    alternates: {
        canonical: "/pricing",
    },
    openGraph: {
        title: "Car Selling Fees & Listing Prices UK | CarMazium",
        description:
            "Compare CarMazium listing prices, from free auction listings and £1 retail listings to optional seller upgrades.",
        url: "/pricing",
        type: "website",
    },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
