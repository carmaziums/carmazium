"use client"

import { DealerPurchasesView } from "@/components/dealer/DealerPurchasesView"

/** Purchase History: finished purchases and cancelled sales. */
export default function DealerPurchaseHistoryPage() {
    return <DealerPurchasesView mode="history" />
}
