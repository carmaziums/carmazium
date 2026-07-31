import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Customer Reviews — See What Buyers & Sellers Say",
    description:
        "Read genuine reviews from CarMazium customers. See what buyers and sellers in UK say about their experience on our platform.",
    openGraph: {
        title: "Customer Reviews | CarMazium",
        description:
            "Read genuine reviews from CarMazium buyers and sellers in UK.",
    },
}

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
    return children
}
