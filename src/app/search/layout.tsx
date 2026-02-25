import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Buy Cars — Browse Verified Vehicles in London",
    description:
        "Search thousands of verified used cars for sale in London. Filter by price, mileage, fuel type, and more. Transparent pricing with seller reviews.",
    openGraph: {
        title: "Buy Cars — Browse Verified Vehicles in London",
        description:
            "Search thousands of verified used cars for sale in London. Filter by price, mileage, fuel type, and more.",
    },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children
}
