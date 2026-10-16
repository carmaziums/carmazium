import type { Metadata } from "next"

// Live bidding is only available to eligible verified motor traders.
// Do not expose authenticated, transient bidding URLs in search results.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function LiveDealerAuctionLayout({ children }: { children: React.ReactNode }) {
    return children
}
