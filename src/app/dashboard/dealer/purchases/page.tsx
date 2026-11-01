"use client"

import { useSearchParams } from "next/navigation"
import { DealerPurchasesView } from "@/components/dealer/DealerPurchasesView"
import DealerAuctionWinsView from "@/components/dealer/DealerAuctionWinsView"

/**
 * Purchases owns all recorded purchases, accepted retail deals, cancellation
 * history and the existing auction-win/£125-fee/handover actions.
 */
export default function DealerPurchasesPage() {
    const params = useSearchParams()
    if (params.get("detail") === "wins") return <DealerAuctionWinsView />
    return <DealerPurchasesView mode="all" />
}
