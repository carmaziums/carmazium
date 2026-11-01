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

/**
 * Keep only an explicitly chosen CarMazium seller channel and permitted retail
 * package across account registration, verification and onboarding.
 * Never accept a general URL or external redirect as a post-signup target.
 */
export function safeSellReturnPath(raw: string | null): string | null {
    if (!raw || !raw.startsWith("/sell?")) return null
    try {
        const target = new URL(raw, "https://www.carmazium.com")
        if (target.origin !== "https://www.carmazium.com" || target.pathname !== "/sell") return null
        const mode = target.searchParams.get("sellMode")
        const intent = parseSellPricingIntent(mode, target.searchParams.get("package"))
        if (!intent) return null
        if (intent.listingType === "AUCTION") return "/sell?sellMode=auction"
        return `/sell?sellMode=retail&package=${intent.badgeTier.toLowerCase()}`
    } catch {
        return null
    }
}
