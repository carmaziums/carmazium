/**
 * A pricing CTA carries a *choice*, not a payment authorisation.
 * The listing wizard remains the authority on the selected package and checkout.
 * Invalid package parameters fall back to Basic rather than an unsupported tier.
 */
export type SellChannelIntent = "auction" | "retail"
export type RetailPackageIntent = "BASIC" | "STANDARD" | "PREMIUM"

export type SellPricingIntent = {
    listingType: "AUCTION" | "CLASSIFIED"
    badgeTier: "FREE" | RetailPackageIntent
    key: string
}

export function parseSellPricingIntent(
    sellMode: string | null,
    packageParam: string | null,
): SellPricingIntent | null {
    if (sellMode === "auction") {
        return { listingType: "AUCTION", badgeTier: "FREE", key: "auction:FREE" }
    }
    if (sellMode !== "retail") return null
    const candidate = packageParam?.trim().toUpperCase()
    const badgeTier: RetailPackageIntent =
        candidate === "STANDARD" || candidate === "PREMIUM" ? candidate : "BASIC"
    return { listingType: "CLASSIFIED", badgeTier, key: `retail:${badgeTier}` }
}
