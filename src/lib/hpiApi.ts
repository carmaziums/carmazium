import { apiClient } from './apiClient'

// Mirrors backend/src/hpi/hpi-report.types.ts — keep the two in step.
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
] as const

export type HpiCheckKey = (typeof HPI_CHECK_DEFINITIONS)[number]['key']

export interface HpiCheckEntry {
    passed: boolean
    note?: string
}

export interface HpiVehicleDetails {
    make?: string
    model?: string
    bodyType?: string
    fuelType?: string
    transmission?: string
    engineCapacity?: string
    vrm?: string
    vin?: string
    engineNumber?: string
    colour?: string
    firstRegistered?: string
    yearOfManufacture?: string
    previousOwners?: string
    currentV5cIssueDate?: string
    co2Emissions?: string
}

export interface HpiMileageEntry { date: string; mileage: string; source?: string }
export interface HpiMotHistoryEntry { date: string; detail: string }
export interface HpiSearchEntry { type: string; date: string }

export interface HpiReportData {
    sourceName: string
    sourceCheckDate: string
    vehicle: HpiVehicleDetails
    checks: Record<HpiCheckKey, HpiCheckEntry>
    motStatus?: string
    motExpiry?: string
    motMileageRecording?: string
    motCurrentAdvisory?: string
    motHistory: HpiMotHistoryEntry[]
    mileageHistory: HpiMileageEntry[]
    previousKeepers?: string
    lastKeeperChange?: string
    previousSearches: HpiSearchEntry[]
}

export interface PendingHpiRequest {
    id: string
    listingId: string
    vrm: string
    purchasedAt: string
    listing: {
        id: string
        title: string
        slug: string
        status: string
        type: string
        vrm: string | null
        make: string | null
        model: string | null
        year: number | null
        seller: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null
    } | null
}

/** Admin-prepared report, or a legacy OneAutoAPI one rendered the old way. */
export type HpiSummaryResponse =
    | {
        format: 'ADMIN'
        status: 'PENDING' | 'COMPLETED'
        vrm: string
        isClear: boolean
        purchasedAt: string
        preparedAt: string | null
        report: HpiReportData | null
    }
    | {
        format: 'LEGACY'
        status: 'PENDING' | 'COMPLETED'
        vrm: string
        make: string
        model: string
        colour: string
        yearOfManufacture: string
        registrationDate: string
        engineSize: string
        fuelType: string
        isClear: boolean
        purchasedAt: string
        createdAt: string
        checks: Record<string, { passed: boolean; detail: string; category?: string | null; agreementId?: string | null }>
    }

export async function getHpiSummary(listingId: string): Promise<HpiSummaryResponse> {
    const res = await apiClient<{ success: boolean; data: HpiSummaryResponse }>(`/hpi/listing/${listingId}/summary`)
    return res.data
}

export async function getPendingHpiRequests(): Promise<PendingHpiRequest[]> {
    const res = await apiClient<{ success: boolean; data: PendingHpiRequest[] }>('/hpi/admin/pending')
    return res.data
}

export async function getHpiPrefill(listingId: string): Promise<HpiReportData> {
    const res = await apiClient<{ success: boolean; data: HpiReportData }>(`/hpi/admin/${listingId}/prefill`)
    return res.data
}

export async function saveHpiReport(listingId: string, report: HpiReportData) {
    return apiClient<{ success: boolean; data: unknown }>(`/hpi/admin/${listingId}`, {
        method: 'POST',
        body: JSON.stringify({ report }),
    })
}

/**
 * The PDF endpoint is cookie-authenticated and streams bytes, so it can't be a
 * plain link — fetch it with credentials and hand the browser a blob instead.
 */
export async function openHpiPdf(listingId: string): Promise<void> {
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev'
    const res = await fetch(`${base}/hpi/listing/${listingId}/pdf`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load the HPI report PDF')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    // Revoke late — revoking immediately can cancel the load in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function deriveIsClear(checks: Record<string, HpiCheckEntry> | undefined | null): boolean {
    if (!checks) return false
    return HPI_CHECK_DEFINITIONS.every((d) => checks[d.key]?.passed === true)
}

export function emptyChecks(): Record<HpiCheckKey, HpiCheckEntry> {
    return HPI_CHECK_DEFINITIONS.reduce((acc, d) => {
        acc[d.key] = { passed: true }
        return acc
    }, {} as Record<HpiCheckKey, HpiCheckEntry>)
}
