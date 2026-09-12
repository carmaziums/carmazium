import { redirect } from "next/navigation"

/**
 * Legacy finance URL kept for existing links and search traffic.
 * The real approved-provider enquiry flow now lives in TradeXchange Services.
 */
export default function FinanceHubPage() {
    redirect("/services/finance")
}
