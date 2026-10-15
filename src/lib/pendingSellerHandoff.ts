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
    vehicle: Record<string, unknown>
    valuationId?: string
    dvlaVerified: boolean
}

const VEHICLE_FIELDS = [
    "vrm", "make", "model", "year", "mileage", "vehicleType", "fuelType",
    "transmission", "bodyType", "variant", "driveType", "doors", "seats",
    "bhp", "color", "primaryColour", "engineSize", "euroStandard",
    "co2Emissions", "motStatus", "taxStatus", "motExpiryDate",
    "taxDueDate", "markedForExport", "monthOfFirstRegistration",
    "wheelplan", "typeApproval", "firstUsedDate", "dateOfLastV5CIssued",
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
    // A bounded, sanitised history travels with the verified vehicle facts
    // when the wizard loads after the initial click. Never store the entire
    // upstream response, tokens, VIN or unrelated seller/account information.
    if (Array.isArray(vehicle.motHistory)) {
        selected.motHistory = vehicle.motHistory.slice(0, 20).flatMap((entry: unknown) => {
            if (!entry || typeof entry !== "object") return []
            const test = entry as Record<string, unknown>
            if (test.testResult !== "PASSED" && test.testResult !== "FAILED") return []
            const safeText = (value: unknown, length = 160) =>
                typeof value === "string" ? value.slice(0, length) : ""
            const defects = Array.isArray(test.defects) ? test.defects.slice(0, 8).flatMap((item: unknown) => {
                if (!item || typeof item !== "object") return []
                const defect = item as Record<string, unknown>
                if (!["ADVISORY", "MINOR", "MAJOR", "DANGEROUS"].includes(String(defect.type))) return []
                return [{
                    text: safeText(defect.text, 240),
                    type: String(defect.type),
                    dangerous: defect.dangerous === true,
                }]
            }) : []
            return [{
                completedDate: safeText(test.completedDate, 40),
                testResult: test.testResult,
                expiryDate: safeText(test.expiryDate, 40),
                odometerValue: safeText(test.odometerValue, 20),
                odometerUnit: safeText(test.odometerUnit, 12),
                motTestNumber: safeText(test.motTestNumber, 40),
                defects,
            }]
        })
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
    if (!raw || raw.length > 75000) return null
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
