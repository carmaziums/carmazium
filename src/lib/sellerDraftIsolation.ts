import { normalizeVehicleRegistration } from "./sellerVehicleSpecs"

/**
 * Listing drafts belong to an authenticated account, not a browser.
 * Unattributable legacy drafts are discarded, never silently assigned to the next login.
 */
export function sellerDraftKeys(userId: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) return null
    const prefix = `carmazium_seller_v2:${userId}`
    return {
        draft: `${prefix}:draft`,
        step: `${prefix}:step`,
        hpiDraftId: `${prefix}:hpi_draft_id`,
        hpiCheckout: `${prefix}:hpi_checkout`,
        auctionSchedule: `${prefix}:auction_schedule`,
    }
}

export function discardUnownedLegacySellerDraft(storage: Pick<Storage, "removeItem">): void {
    for (const key of [
        "carmazium_listing_draft",
        "carmazium_listing_draft_step",
        "carmazium_hpi_draft_id",
    ]) storage.removeItem(key)
}

export const HPI_BINDING_TTL_MS = 2 * 60 * 60 * 1000
export interface HpiCheckoutBinding {
    vrm: string
    listingId: string
    startedAt: number
}

export function createHpiBinding(vrm: string, listingId: string, now = Date.now()): HpiCheckoutBinding | null {
    const normalized = normalizeVehicleRegistration(vrm)
    if (!/^[A-Z0-9]{2,8}$/.test(normalized) || !/^[a-zA-Z0-9_-]{1,128}$/.test(listingId)) return null
    return { vrm: normalized, listingId, startedAt: now }
}

/**
 * URL, draft and the checkout initiated in the same tab must all identify
 * the same car. Payment status is still verified with the backend separately.
 */
export function matchesHpiReturn(
    binding: HpiCheckoutBinding | null,
    savedDraftVrm: unknown,
    urlVrm: unknown,
    savedListingId: string | null,
    now = Date.now(),
): boolean {
    if (!binding || !Number.isFinite(binding.startedAt)
        || binding.startedAt > now || now - binding.startedAt > HPI_BINDING_TTL_MS
        || !savedListingId || !savedDraftVrm || !urlVrm) return false
    const normalizedSaved = normalizeVehicleRegistration(savedDraftVrm)
    const normalizedUrl = normalizeVehicleRegistration(urlVrm)
    return binding.vrm === normalizedSaved
        && binding.vrm === normalizedUrl
        && binding.listingId === savedListingId
}

export function parseHpiBinding(raw: string | null): HpiCheckoutBinding | null {
    if (!raw || raw.length > 512) return null
    try {
        const obj = JSON.parse(raw)
        return typeof obj.vrm === "string" && typeof obj.listingId === "string" && typeof obj.startedAt === "number"
            ? createHpiBinding(obj.vrm, obj.listingId, obj.startedAt)
            : null
    } catch { return null }
}
