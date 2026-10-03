/**
 * Canonical seller specification values shared by listing prefill, manual entry
 * and validation. Lookup values are advisory; a seller's valid choice wins.
 */
export function normalizeVehicleRegistration(value: unknown): string {
    return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : ""
}

export type SellerTransmission = "MANUAL" | "AUTOMATIC" | "SEMI_AUTOMATIC" | "CVT"

export function normalizeSellerTransmission(value: unknown): SellerTransmission | "" {
    if (typeof value !== "string") return ""
    const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_")
    if (key === "MANUAL") return "MANUAL"
    if (key === "AUTOMATIC" || key === "AUTO") return "AUTOMATIC"
    if (key === "SEMI_AUTOMATIC" || key === "SEMIAUTOMATIC") return "SEMI_AUTOMATIC"
    if (key === "CVT" || key === "CONTINUOUSLY_VARIABLE") return "CVT"
    return ""
}

export function normalizeSellerBodyType<B extends string>(
    value: unknown,
    allowedBodyTypes: readonly B[],
): B | "" {
    if (typeof value !== "string") return ""
    const key = value.trim().toUpperCase().replace(/[\s/-]+/g, "_")
    const aliases: Record<string, string> = {
        SALOON: "SEDAN",
        HATCH_BACK: "HATCHBACK",
        PICKUP: "PICKUP_TRUCK",
        PICK_UP: "PICKUP_TRUCK",
        STATIONWAGON: "STATION_WAGON",
    }
    const canonical = aliases[key] ?? key
    return allowedBodyTypes.find((candidate) => candidate === canonical) ?? ""
}

export interface SellerSpecs {
    vrm: string
    transmission: string
    bodyType: string
}

export function resolveSellerVehicleSpecs<B extends string>(
    current: SellerSpecs,
    incoming: { vrm: string; transmission?: unknown; bodyType?: unknown },
    allowedBodyTypes: readonly B[],
): { transmission: SellerTransmission | ""; bodyType: B | "" } {
    const sameRegistration = !!normalizeVehicleRegistration(current.vrm)
        && normalizeVehicleRegistration(current.vrm) === normalizeVehicleRegistration(incoming.vrm)
    const incomingTransmission = normalizeSellerTransmission(incoming.transmission)
    const incomingBodyType = normalizeSellerBodyType(incoming.bodyType, allowedBodyTypes)
    return {
        transmission: sameRegistration
            ? normalizeSellerTransmission(current.transmission) || incomingTransmission
            : incomingTransmission,
        bodyType: sameRegistration
            ? normalizeSellerBodyType(current.bodyType, allowedBodyTypes) || incomingBodyType
            : incomingBodyType,
    }
}
