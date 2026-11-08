import type { DvlaLookupResult } from './dvlaApi'
import type { ListingMotHistoryEntry } from './listingApi'
import { normalizeMotHistorySnapshot } from './listingMotHistory'

/** A failed lookup must never be presented as a vehicle with no MOT tests. */
export function motLookupMessage(result: {
    motHistoryStatus?: unknown
    motHistory?: unknown
}): string {
    switch (result.motHistoryStatus) {
        case 'UNAVAILABLE':
            return 'MOT history is temporarily unavailable. This does not mean the vehicle has no MOT tests. You can continue with the DVLA details and retry the lookup later.'
        case 'IDENTITY_MISMATCH':
            return 'The MOT record did not match this vehicle, so it has not been applied. Check the registration and retry.'
        case 'NO_TESTS':
            return 'DVSA returned no MOT tests for this registration.'
        case 'AVAILABLE':
            return Array.isArray(result.motHistory) && result.motHistory.length
                ? `MOT history loaded: ${result.motHistory.length} tests.`
                : 'MOT history has not been confirmed. Retry the lookup to check.'
        default:
            return Array.isArray(result.motHistory) && result.motHistory.length
                ? `Saved MOT history: ${result.motHistory.length} tests. Use the lookup to refresh it.`
                : 'MOT history has not been confirmed. Use the lookup to check it.'
    }
}

/** Preserve official facts in bulk imports, without copying historical mileage. */
export function importedOfficialFacts(result: DvlaLookupResult) {
    const history = normalizeMotHistorySnapshot<ListingMotHistoryEntry>(result.motHistory)
    const usableHistory = result.motHistoryStatus !== 'UNAVAILABLE'
        && result.motHistoryStatus !== 'IDENTITY_MISMATCH'
        && result.motHistoryStatus !== 'NO_TESTS'
    return {
        motHistory: usableHistory && history.length ? history : undefined,
        officialVehicleData: result.officialVehicleData,
        dateOfLastV5CIssued: result.dateOfLastV5CIssued,
        firstUsedDate: result.firstUsedDate,
        markedForExport: result.markedForExport,
    }
}
