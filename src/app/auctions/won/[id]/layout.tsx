import type { Metadata } from "next"

// Won-auction details are transaction-specific and authentication-gated.
// Do not allow these pages to appear in public search indexes.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

export default function WonDealerAuctionLayout({ children }: { children: React.ReactNode }) {
    return children
}
