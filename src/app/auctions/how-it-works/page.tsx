import { redirect } from "next/navigation"

// The full "How Auctions Work" content now lives directly on /auctions
// (under the #how-it-works anchor) instead of a separate page — this route
// stays only so any existing links/bookmarks still land somewhere useful.
export default function AuctionHowItWorksRedirect() {
    redirect("/auctions#how-it-works")
}
