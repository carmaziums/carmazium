import type { Metadata } from "next"

// The dealer inventory browser is authentication-gated and dynamically
// filtered. Search engines should index the public /auctions hub instead.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function DealerAuctionBrowseLayout({ children }: { children: React.ReactNode }) {
    return children
}
