import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Compare Used Cars Side by Side UK",
    description:
        "Compare used cars side by side on CarMazium, including vehicle specifications, prices, mileage and features to help choose the right car.",
    keywords: [
        "compare used cars UK",
        "car comparison UK",
        "compare car prices",
        "compare car specifications",
        "used car comparison",
        "CarMazium compare cars",
    ],
    alternates: {
        canonical: "/compare",
    },
    openGraph: {
        title: "Compare Used Cars Side by Side UK | CarMazium",
        description:
            "Compare vehicle specifications, prices, mileage and features side by side on CarMazium.",
        url: "/compare",
        type: "website",
    },
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
    return children
}
