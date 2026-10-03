import { normalizeVehicleRegistration } from "./sellerVehicleSpecs"

/**
 * Only identity and already-entered vehicle facts cross the sign-in redirect.
 * Never persist the full valuation, user details, images or payment information.
 * sessionStorage expires on tab close; the TTL also prevents stale later visits.
 */
export const SELLER_HANDOFF_KEY = "carmazium_pending_seller_handoff_v1"
export const SELLER_HANDOFF_MAX_AGE_MS = 20 * 60 * 1000

export interface PendingSellerHandoff {
    createdAt: number
    listingType: "AUCTION" | "CLASSIFIED"
    vehicle: Record<string, string | number | boolean>
    valuationId?: string
    dvlaVerified: boolean
}

const VEHICLE_FIELDS = [
    "vrm", "make", "model", "year", "mileage", "vehicleType", "fuelType",
    "transmission", "bodyType", "variant", "driveType", "doors", "seats",
    "bhp", "color", "primaryColour", "engineSize", "euroStandard",
] as const

export function createSellerHandoff(
    listingType: "AUCTION" | "CLASSIFIED",
    vehicle: Record<string, unknown>,
    valuationId?: string,
    dvlaVerified = true,
    now = Date.now(),
): PendingSellerHandoff | null {
    if (!["AUCTION", "CLASSIFIED"].includes(listingType)) return null
    const vrm = normalizeVehicleRegistration(vehicle.vrm)
    const mileage = String(vehicle.mileage ?? "").trim()
    if (!/^[A-Z0-9]{2,7}$/.test(vrm) || !vehicle.make || !vehicle.model ||
        !String(vehicle.year ?? "").trim() || !/^\d+$/.test(mileage)) return null

    const selected: PendingSellerHandoff["vehicle"] = {}
    for (const field of VEHICLE_FIELDS) {
        const value = vehicle[field]
        if (typeof value === "string" && value.length <= 160) selected[field] = value
        else if (typeof value === "number" && Number.isFinite(value)) selected[field] = value
        else if (typeof value === "boolean") selected[field] = value
    }
    selected.vrm = vrm
    return {
        createdAt: now,
        listingType,
        vehicle: selected,
        valuationId: typeof valuationId === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(valuationId)
            ? valuationId : undefined,
        dvlaVerified: !!dvlaVerified,
    }
}

export function parseSellerHandoff(raw: string | null, now = Date.now()): PendingSellerHandoff | null {
    if (!raw || raw.length > 6000) return null
    try {
        const candidate = JSON.parse(raw)
        if (typeof candidate?.createdAt !== "number" ||
            candidate.createdAt > now ||
            now - candidate.createdAt > SELLER_HANDOFF_MAX_AGE_MS) return null
        if (candidate.listingType !== "AUCTION" && candidate.listingType !== "CLASSIFIED") return null
        const reconstructed = createSellerHandoff(
            candidate.listingType,
            candidate.vehicle ?? {},
            candidate.valuationId,
            candidate.dvlaVerified === true,
            candidate.createdAt,
        )
        if (!reconstructed) return null
        // Reject payloads inconsistent with the stored normalized registration.
        if (reconstructed.vehicle.vrm !== candidate.vehicle.vrm) return null
        return reconstructed
    } catch { return null }
}

export function saveSellerHandoff(
    storage: Pick<Storage, "setItem">,
    listingType: "AUCTION" | "CLASSIFIED",
    vehicle: Record<string, unknown>,
    valuationId?: string,
    dvlaVerified = true,
): boolean {
    const pending = createSellerHandoff(listingType, vehicle, valuationId, dvlaVerified)
    if (!pending) return false
    try {
        storage.setItem(SELLER_HANDOFF_KEY, JSON.stringify(pending))
        return true
    } catch { return false }
}

export function readSellerHandoff(storage: Pick<Storage, "getItem" | "removeItem">): PendingSellerHandoff | null {
    try {
        const result = parseSellerHandoff(storage.getItem(SELLER_HANDOFF_KEY))
        if (!result) storage.removeItem(SELLER_HANDOFF_KEY)
        return result
    } catch { return null }
}

export function clearSellerHandoff(storage: Pick<Storage, "removeItem">): void {
    try { storage.removeItem(SELLER_HANDOFF_KEY) } catch {}
}
