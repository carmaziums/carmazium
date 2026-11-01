import { redirect } from "next/navigation"

/** Retain legacy bookmarks, notifications and external links. */
export default function LegacyPurchasesPage() {
    redirect("/dashboard/dealer/purchases?tab=progress&channel=retail")
}
