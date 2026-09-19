/**
 * Build-time availability switches for the four live TradeXchange services.
 *
 * Product policy:
 * - These are core live services, so an omitted variable intentionally defaults ON.
 * - Set a variable to the exact string "false" for an emergency/customer-facing kill switch.
 * - Set it to "true" to make the production/preview intent explicit.
 * - Any other non-empty value is a configuration error and fails the build instead
 *   of silently enabling or disabling a customer service.
 */
export function liveServiceEnabled(name: string, value?: string): boolean {
    const normalised = value?.trim().toLowerCase()

    if (!normalised) return true
    if (normalised === 'true') return true
    if (normalised === 'false') return false

    throw new Error(
        `Invalid ${name} value "${value}". Use "true" to keep the service live or "false" for the emergency kill switch.`,
    )
}

/** Delivery & Recovery — paid job marketplace, 9% CarMazium / 91% provider. */
export const deliveryServiceEnabled = liveServiceEnabled(
    'NEXT_PUBLIC_FEATURE_DELIVERY',
    process.env.NEXT_PUBLIC_FEATURE_DELIVERY,
)

/** Vehicle Inspections — same paid job/quote/payment engine as Delivery. */
export const inspectionServiceEnabled = liveServiceEnabled(
    'NEXT_PUBLIC_FEATURE_INSPECTION',
    process.env.NEXT_PUBLIC_FEATURE_INSPECTION,
)

/** Vehicle Finance — approved-provider enquiry matching; no platform payment. */
export const financeServiceEnabled = liveServiceEnabled(
    'NEXT_PUBLIC_FEATURE_FINANCE_SERVICES',
    process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES,
)

/** Warranty Providers — approved-provider enquiry matching; no platform payment. */
export const warrantyServiceEnabled = liveServiceEnabled(
    'NEXT_PUBLIC_FEATURE_WARRANTY',
    process.env.NEXT_PUBLIC_FEATURE_WARRANTY,
)

/** True on a Vercel preview deployment — drives the staging banner. */
export const isPreviewEnvironment =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() === 'preview'
