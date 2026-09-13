import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "About CarMazium — UK Online Car Marketplace",
    description:
        "Learn about CarMazium, a UK online car marketplace built to make buying, selling and auctioning vehicles more transparent and straightforward.",
    alternates: {
        canonical: "/about",
    },
    openGraph: {
        title: "About CarMazium — UK Online Car Marketplace",
        description:
            "Learn about CarMazium and our approach to buying, selling and auctioning vehicles online in the UK.",
        url: "/about",
        type: "website",
    },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return children
}
