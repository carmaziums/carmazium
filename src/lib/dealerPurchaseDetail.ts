/** Read-only dealer purchase detail returned by the buyer-scoped API. */
export interface DealerPurchaseDetail {
    id: string
    listingId: string
    vehicle: {
        title: string
        imageUrl: string | null
        slug: string
        year: number | null
        make: string | null
        model: string | null
        mileage: number | null
        registration: string | null
        listedLocation: string | null
    }
    purchasePrice: number
    purchasedAt: string
    purchaseStatus: string
    retailSold: boolean
    channel: "RETAIL" | "AUCTION"
    buyerFee: { required: boolean; settled: boolean }
    payment: { route: "DIRECT_TO_SELLER"; sellerFundsConfirmedAt: string | null }
    delivery: { jobId: string; status: string; createdAt: string; requestedFor: string | null } | null
    documents: {
        handoverSubmittedAt: string | null
        handoverRejectedAt: string | null
        sellerBonusReleased: boolean
    }
}

export interface DealerPurchaseSeller {
    saleId: string
    sellerName: string
    sellerCompany: string | null
    contactUnlocked: boolean
    buyerFeeRequired: boolean
    sellerEmail: string | null
    sellerPhone: string | null
    sellerAddress: string | null
    sellerAddressSource: "BUSINESS" | "VERIFIED_POSTAL" | null
    vehicleLocation: string | null
}

export function recordedPurchaseLabel(purchase: Pick<DealerPurchaseDetail, "retailSold" | "purchaseStatus" | "channel">): string {
    // Same rule and wording as Purchase History: a recorded retail sale
    // (listing SOLD) shows as purchased, not awaiting confirmation.
    if (purchase.retailSold) return "Purchased"
    if (purchase.channel === "AUCTION") return "Auction won"
    return purchase.purchaseStatus.replace(/_/g, " ").toLowerCase()
}

export function purchaseDeliveryHref(purchase: Pick<DealerPurchaseDetail, "listingId" | "vehicle">): string {
    const params = new URLSearchParams({
        listingId: purchase.listingId,
        vehicleTitle: purchase.vehicle.title,
    })
    if (purchase.vehicle.registration) params.set("registration", purchase.vehicle.registration)
    if (purchase.vehicle.make) params.set("make", purchase.vehicle.make)
    if (purchase.vehicle.model) params.set("model", purchase.vehicle.model)
    if (purchase.vehicle.year != null) params.set("year", String(purchase.vehicle.year))
    return `/services/delivery/new?${params.toString()}`
}
