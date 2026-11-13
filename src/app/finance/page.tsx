import { redirect } from "next/navigation"

/**
 * Legacy finance URL kept for existing links and search traffic.
 * The Jigsaw referral information and listing-based application flow live in Services.
 */
export default function FinanceHubPage() {
    redirect("/services/finance")
}
