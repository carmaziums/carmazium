import type { DvlaLookupResult } from '../dvla/dvla.service';

/** A verified, non-inferred subset of the DVSA response for the retail record.
 * MOT readings are historical and must never replace the advertised mileage.
 */
export function motEnrichmentUpdate(
    listing: { vrm?: string | null; make?: string | null; year?: number | null; model?: string | null; motHistory?: unknown },
    official: DvlaLookupResult,
): { motHistory: NonNullable<DvlaLookupResult['motHistory']>; model?: string } | null {
    const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!listing.vrm || !listing.make || !official.make
        || norm(official.make) !== norm(listing.make)
        || (official.year && listing.year && Math.abs(official.year - listing.year) > 2)) return null;

    // DVLA core response cannot be applied if DVSA MOT failed/timed out or
    // returned no tests. Never fabricate MOT passes or missing metadata.
    const tests = official.motHistory;
    if (!Array.isArray(tests) || tests.length === 0) return null;
    if (!tests.every(test =>
        test && /^\d{4}-\d{2}-\d{2}/.test(test.completedDate || '')
        && ['PASSED', 'FAILED'].includes(test.testResult)
        && typeof test.motTestNumber === 'string' && test.motTestNumber.length > 0)) return null;

    const model = String(official.model ?? '').trim();
    const currentModel = String(listing.model ?? '').trim();
    const canFillModel = !currentModel && model.length >= 2
        && !/^undefined$|^unknown$|^n\/?a$/i.test(model)
        && norm(model) !== norm(listing.make)
        && !/^\d{4}$/.test(model);
    return { motHistory: tests, ...(canFillModel ? { model } : {}) };
}
