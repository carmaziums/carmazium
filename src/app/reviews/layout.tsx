import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "CarMazium Reviews — Buyer & Seller Experiences",
    description:
        "Read CarMazium reviews and see feedback from buyers and sellers using the UK car marketplace for vehicle listings, auctions and purchases.",
    keywords: [
        "CarMazium reviews",
        "car selling platform reviews UK",
        "car marketplace reviews UK",
        "car buyer reviews",
        "car seller reviews",
    ],
    alternates: {
        canonical: "/reviews",
    },
    openGraph: {
        title: "CarMazium Reviews — Buyer & Seller Experiences",
        description:
            "Read feedback from buyers and sellers using CarMazium for vehicle listings, auctions and purchases.",
        url: "/reviews",
        type: "website",
    },
}

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
    return children
}
