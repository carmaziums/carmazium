import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Used Cars for Sale UK — Browse Verified Vehicles",
    description:
        "Browse used cars for sale across the UK on CarMazium. Search verified vehicle listings and filter by price, mileage, fuel type, transmission and more.",
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
        title: "Used Cars for Sale UK — Browse Verified Vehicles | CarMazium",
        description:
            "Search verified used cars for sale across the UK and filter by price, mileage, fuel type, transmission and more.",
        url: "/search",
        type: "website",
    },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children
}
