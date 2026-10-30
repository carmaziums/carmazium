import type { Metadata } from "next"
import { PageJsonLd, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "How CarMazium Vehicle Auctions Work",
    description: "Learn how CarMazium TradeXchange auctions work for sellers and verified trade dealers, including bidding, the winning buyer fee and vehicle handover.",
    alternates: { canonical: "/auctions/how-it-works" },
    openGraph: {
        title: "How CarMazium Vehicle Auctions Work | CarMazium",
        description: "Learn how CarMazium TradeXchange auctions work for sellers and verified trade dealers.",
        url: "/auctions/how-it-works",
        type: "website",
    },
}

export default function AuctionHowItWorksLayout({ children }: { children: React.ReactNode }) {
    return <><PageJsonLd path="/auctions/how-it-works" title="How CarMazium Vehicle Auctions Work" description={metadata.description as string} about={SEO_TRADEXCHANGE} />{children}</>
}
