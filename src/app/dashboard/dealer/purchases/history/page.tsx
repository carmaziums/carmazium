"use client"

import { DealerPurchasesView } from "@/components/dealer/DealerPurchasesView"

/** Purchase History: completed purchases and cancelled sales. */
export default function DealerPurchaseHistoryPage() {
    return <DealerPurchasesView mode="history" />
}
