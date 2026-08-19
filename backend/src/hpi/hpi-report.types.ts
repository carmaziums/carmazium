/**
 * Shape of an admin-prepared HPI report.
 *
 * This is the contract between the admin form, the stored `HpiReport.reportData`
 * JSON column and the PDF renderer — all three read these same definitions so a
 * field can't be added to the form and silently missed by the PDF.
 *
 * Deliberately mirrors the approved CarMazium Vehicle History Report layout.
 * CarMazium presents third-party check data rather than originating it, so the
 * source name and its check date are required, not decorative — they're what
 * makes the disclosure on the document accurate.
 */

/** The eleven pass/fail checks, in the order they appear on the PDF. */
export const HPI_CHECK_DEFINITIONS = [
    { key: 'stolen', label: 'Not recorded as stolen' },
    { key: 'scrapped', label: 'Not recorded as scrapped' },
    { key: 'writeOff', label: 'Not recorded as a write-off' },
    { key: 'imported', label: 'Not imported' },
    { key: 'exported', label: 'Not exported' },
    { key: 'thirdPartyInterest', label: 'No third-party interest' },
    { key: 'outstandingFinance', label: 'No outstanding finance' },
    { key: 'mileageDiscrepancy', label: 'No mileage discrepancies' },
    { key: 'colourChange', label: 'No colour changes' },
    { key: 'plateChange', label: 'No recorded plate changes' },
    { key: 'stockingFinance', label: 'No outstanding stocking finance' },
] as const;

export type HpiCheckKey = (typeof HPI_CHECK_DEFINITIONS)[number]['key'];

export const HPI_CHECK_KEYS: HpiCheckKey[] = HPI_CHECK_DEFINITIONS.map((c) => c.key);

/**
 * `passed: false` is what makes a vehicle "not clear" — see deriveIsClear.
 * `note` surfaces on the PDF next to a failed check (e.g. the write-off
 * category), and is ignored for passed checks.
 */
export interface HpiCheckEntry {
    passed: boolean;
    note?: string;
}

export interface HpiVehicleDetails {
    make?: string;
    model?: string;
    bodyType?: string;
    fuelType?: string;
    transmission?: string;
    engineCapacity?: string;
    vrm?: string;
    vin?: string;
    engineNumber?: string;
    colour?: string;
    firstRegistered?: string;
    yearOfManufacture?: string;
    previousOwners?: string;
    currentV5cIssueDate?: string;
    co2Emissions?: string;
}

export interface HpiMileageEntry {
    date: string;
    mileage: string;
    source?: string;
}

export interface HpiMotHistoryEntry {
    date: string;
    /** Free text so "Pass - 63,512 mi - 0 advisories" renders verbatim. */
    detail: string;
}

export interface HpiSearchEntry {
    type: string;
    date: string;
}

export interface HpiReportData {
    /** Name of the underlying third-party check, e.g. "AutoTrader Vehicle Check". */
    sourceName: string;
    /** Date the third-party check was run — printed in the disclosure paragraph. */
    sourceCheckDate: string;

    vehicle: HpiVehicleDetails;
    checks: Record<HpiCheckKey, HpiCheckEntry>;

    motStatus?: string;
    motExpiry?: string;
    motMileageRecording?: string;
    motCurrentAdvisory?: string;
    motHistory: HpiMotHistoryEntry[];

    mileageHistory: HpiMileageEntry[];

    previousKeepers?: string;
    lastKeeperChange?: string;
    previousSearches: HpiSearchEntry[];
}

/**
 * A vehicle is "clear" only when every check passed. Derived rather than
 * entered so the badge shown across listings/auctions can never contradict
 * the checks printed on the PDF.
 */
export function deriveIsClear(checks: Record<string, HpiCheckEntry> | undefined | null): boolean {
    if (!checks) return false;
    return HPI_CHECK_KEYS.every((key) => checks[key]?.passed === true);
}

/** Empty check set with everything passing — the admin form's starting point. */
export function defaultChecks(): Record<HpiCheckKey, HpiCheckEntry> {
    return HPI_CHECK_KEYS.reduce(
        (acc, key) => {
            acc[key] = { passed: true };
            return acc;
        },
        {} as Record<HpiCheckKey, HpiCheckEntry>,
    );
}
