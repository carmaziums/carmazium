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
    buyerCollectedAt?: string | null
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
    /** Auction purchases only. */
    auction?: { wonAt: string | null; winningBid: number | null; buyerFeeDeadlineAt: string | null } | null
    /** Seller-supplied advert: the purchase-time snapshot when one exists, else the current listing. */
    listingRecord?: PurchaseListingRecord
    /** True once the backend has snapshots and inspection notes switched on. */
    inspectionNotesEnabled?: boolean
}

export interface PurchaseListingRecord {
    source: "CURRENT_LISTING" | "PURCHASE_SNAPSHOT"
    /** When the snapshot was saved; null for the current-listing fallback. */
    capturedAt?: string | null
    /** The snapshot was saved more than an hour after the sale (by the retry sweep). */
    capturedAfterSale?: boolean
    lastUpdatedAt: string | null
    removedFromSaleAt: string | null
    images: string[]
    description: string | null
    variant: string | null; fuelType: string | null; transmission: string | null
    color: string | null; doors: number | null; seats: number | null
    engineSize: number | null; bhp: number | null; bodyType: string | null; driveType: string | null
    features: unknown; vin: string | null; condition: string | null; firstRegistered: string | null
    motStatus: string | null; motExpiryDate: string | null; motHistory: unknown
    serviceHistory: string | null; numberOfKeys: number | null; owners: string | null
    exteriorGrade: number | null; writeOffCategory: string | null
    sellerDeclarations: {
        mechanicalIssues: string | null; electricalIssues: string | null
        hasOutstandingFinance: boolean | null; stolenRecovered: boolean | null
        isLegalRegisteredKeeper: boolean | null
    }
    damage: { id: string; part: string; type: string; size: string; coords: unknown; imageUrl: string | null }[]
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
