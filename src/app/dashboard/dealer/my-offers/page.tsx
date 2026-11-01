import { redirect } from "next/navigation"

/** Old sent-offers deep links retain their permission-scoped retail destination. */
export default function LegacyDealerRetailOffersPage() {
    redirect("/dashboard/dealer/bids?tab=retail")
}
