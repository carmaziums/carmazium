import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Used Cars for Sale Across the UK",
    description:
        "Browse used cars for sale across the UK on CarMazium. Compare vehicle adverts and filter by price, mileage, fuel type, transmission and more.",
    keywords: [
        "used cars for sale UK",
        "buy used cars UK",
        "second hand cars UK",
        "cars for sale UK",
        "used car marketplace",
        "CarMazium",
    ],
    alternates: {
        canonical: "/search",
    },
    openGraph: {
        title: "Used Cars for Sale Across the UK | CarMazium",
        description:
            "Find used-car listings across the UK and compare prices, mileage, fuel type, transmission and vehicle details before arranging your checks.",
        url: "/search",
        type: "website",
    },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children
}
