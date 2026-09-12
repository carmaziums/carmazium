/**
 * Build-time feature flags for the Trade Exchange service marketplace.
 *
 * DEFAULT IS OFF. Customer-facing services only go live after the matching
 * backend/database slice has passed preview and production smoke tests.
 */
const on = (v?: string) => v?.trim().toLowerCase() === 'true'

/** Delivery & Recovery — paid job marketplace, 9% CarMazium / 91% provider. */
export const deliveryServiceEnabled = on(process.env.NEXT_PUBLIC_FEATURE_DELIVERY)

/** Vehicle Inspections — same paid job/quote/payment engine as Delivery. */
export const inspectionServiceEnabled = on(process.env.NEXT_PUBLIC_FEATURE_INSPECTION)

/** Vehicle Finance — approved-provider enquiry matching; no platform payment. */
export const financeServiceEnabled = on(process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES)

/** Warranty Providers — approved-provider enquiry matching; no platform payment. */
export const warrantyServiceEnabled = on(process.env.NEXT_PUBLIC_FEATURE_WARRANTY)

/** True on a Vercel preview deployment — drives the staging banner. */
export const isPreviewEnvironment =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() === 'preview'
