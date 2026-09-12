/**
 * Build-time feature flags for the Trade Exchange service marketplace.
 *
 * The four completed service areas are ON by default after their backend,
 * database migration and production checks. Set the relevant environment
 * variable explicitly to "false" for an emergency/customer-facing kill switch.
 */
const enabledUnlessDisabled = (v?: string) => v?.trim().toLowerCase() !== 'false'

/** Delivery & Recovery — paid job marketplace, 9% CarMazium / 91% provider. */
export const deliveryServiceEnabled = enabledUnlessDisabled(process.env.NEXT_PUBLIC_FEATURE_DELIVERY)

/** Vehicle Inspections — same paid job/quote/payment engine as Delivery. */
export const inspectionServiceEnabled = enabledUnlessDisabled(process.env.NEXT_PUBLIC_FEATURE_INSPECTION)

/** Vehicle Finance — approved-provider enquiry matching; no platform payment. */
export const financeServiceEnabled = enabledUnlessDisabled(process.env.NEXT_PUBLIC_FEATURE_FINANCE_SERVICES)

/** Warranty Providers — approved-provider enquiry matching; no platform payment. */
export const warrantyServiceEnabled = enabledUnlessDisabled(process.env.NEXT_PUBLIC_FEATURE_WARRANTY)

/** True on a Vercel preview deployment — drives the staging banner. */
export const isPreviewEnvironment =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() === 'preview'
