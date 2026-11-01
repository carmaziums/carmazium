import { redirect } from "next/navigation"

export default function LegacyShortlistedAuctions() {
    redirect("/dashboard/dealer/wishlist?tab=auctions")
}
