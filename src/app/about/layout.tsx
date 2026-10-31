import type { Metadata } from "next"
import { PageJsonLd } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: { absolute: "About CarMazium — UK Online Car Marketplace" },
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
    return <><PageJsonLd path="/about" title="About CarMazium — UK Online Car Marketplace" type="AboutPage" description={metadata.description as string} />{children}</>
}
