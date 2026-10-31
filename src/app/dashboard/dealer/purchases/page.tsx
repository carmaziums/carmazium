"use client"

import { DealerPurchasesView } from "@/components/dealer/DealerPurchasesView"

/** All Purchases: every purchase at its current stage. Purchase History is a separate page. */
export default function DealerPurchasesPage() {
    return <DealerPurchasesView mode="all" />
}
