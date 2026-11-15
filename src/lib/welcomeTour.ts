export const WELCOME_TOUR_VERSION = 1
// Existing accounts can replay from Settings without an unexpected full-screen tour.
export const WELCOME_TOUR_LAUNCH = "2026-11-15T14:55:00.000Z"

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
    const safePages = ["/", "/search", "/buy-cars", "/dashboard", "/dashboard/user", "/dashboard/buyer", "/dashboard/seller", "/dashboard/dealer", "/dashboard/partner", "/dashboard/finance", "/dashboard/insurance"]
    return profile.role !== "ADMIN"
        && Number.isFinite(Date.parse(profile.createdAt ?? ""))
        && Date.parse(profile.createdAt!) >= Date.parse(WELCOME_TOUR_LAUNCH)
        && !profile.preferences?.websiteIntroductionV1
        && safePages.includes(pathname)
        && !search
}
