import { redirect } from "next/navigation"

/** Historic auction-win links continue on Purchases with all actions intact. */
export default function LegacyDealerAuctionWinsPage() {
    redirect("/dashboard/dealer/purchases?detail=wins&tab=progress&channel=auction")
}
