import type { Metadata } from "next"
import { PageJsonLd, SEO_TRADEXCHANGE } from "@/components/seo/PageJsonLd"

export const metadata: Metadata = {
    title: "Car Auctions UK | How Dealer Auctions Work",
    description: "Free vehicle auction listings, verified dealer bidding, £125 standard buyer fee, qualifying £100 seller incentive and direct payment between buyer and seller.",
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
