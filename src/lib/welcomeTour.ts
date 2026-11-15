export const WELCOME_TOUR_VERSION = 2
// Reintroduce this release once to every account, including existing accounts.

export type TourProfile = {
    id: string
    role: string
    createdAt?: string
    preferences?: Record<string, unknown>
    dealerProfile?: unknown
    contractorProfile?: unknown
    dealerStaffMemberships?: unknown[]
}

export function canAutoIntroduce(profile: TourProfile, pathname: string, search: string) {
    const safePages = ["/", "/search", "/buy-cars", "/dashboard", "/dashboard/user", "/dashboard/buyer", "/dashboard/seller", "/dashboard/dealer", "/dashboard/partner", "/dashboard/finance", "/dashboard/insurance", "/dashboard/service", "/dashboard/admin"]
    const acknowledgement = profile.preferences?.websiteIntroductionV2 as { version?: unknown; status?: unknown } | undefined
    const acknowledged = acknowledgement?.version === WELCOME_TOUR_VERSION
        && ["skipped", "completed"].includes(String(acknowledgement?.status))
    return ["BUYER", "SELLER", "DEALER", "CONTRACTOR", "FINANCE_PARTNER", "INSURANCE_PARTNER", "ADMIN"].includes(profile.role)
        && !acknowledged
        && safePages.includes(pathname)
        && !search
}
