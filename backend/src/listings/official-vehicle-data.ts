/**
 * Bounded, non-personal supplementary vehicle facts returned by DVLA VES or
 * the DVSA MOT History v1 API. Core facts remain in named Listing columns.
 *
 * Client snapshots are historical evidence, not live government verification.
 * This allowlist prevents arbitrary nested client JSON or official identifiers
 * from being stored. Do not add VIN, DVSA vehicleId, API credentials or tokens.
 */
export type OfficialVehicleData = {
    dvla?: {
        monthOfFirstDvlaRegistration?: string;
        artEndDate?: string;
        revenueWeight?: number;
        realDrivingEmissions?: string;
        automatedVehicle?: boolean;
    };
    mot?: {
        registrationDate?: string;
        manufactureDate?: string;
        secondaryColour?: string;
        lastMotTestDate?: string;
        motTestDueDate?: string;
    };
};

const stringFields = {
    dvla: ['monthOfFirstDvlaRegistration', 'artEndDate', 'realDrivingEmissions'],
    mot: ['registrationDate', 'manufactureDate', 'secondaryColour', 'lastMotTestDate', 'motTestDueDate'],
} as const;

export function normalizeOfficialVehicleData(value: unknown): OfficialVehicleData | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const input = value as Record<string, unknown>;
    const out: Record<string, Record<string, unknown>> = {};
    for (const source of ['dvla', 'mot'] as const) {
        const raw = input[source];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const record = raw as Record<string, unknown>;
        const fields: Record<string, unknown> = {};
        for (const name of stringFields[source]) {
            const v = record[name];
            if (typeof v === 'string' && v.trim() && v.length <= 80) fields[name] = v.trim();
        }
        if (source === 'dvla') {
            if (typeof record.revenueWeight === 'number' && Number.isInteger(record.revenueWeight)
                && record.revenueWeight >= 0 && record.revenueWeight <= 100000) {
                fields.revenueWeight = record.revenueWeight;
            }
            if (typeof record.automatedVehicle === 'boolean') fields.automatedVehicle = record.automatedVehicle;
        }
        if (Object.keys(fields).length) out[source] = fields;
    }
    return Object.keys(out).length ? out : undefined;
}

/** Merge two bounded snapshots without deleting fields absent from the latest response. */
export function mergeOfficialVehicleData(previous: unknown, latest: unknown): OfficialVehicleData | undefined {
    const existing = normalizeOfficialVehicleData(previous);
    const incoming = normalizeOfficialVehicleData(latest);
    if (!existing) return incoming;
    if (!incoming) return existing;
    return {
        dvla: { ...existing.dvla, ...incoming.dvla },
        mot: { ...existing.mot, ...incoming.mot },
    };
}
