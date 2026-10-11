/**
 * Dashboard routing is based only on the /users/me backend profile.
 * Supabase user_metadata is editable/stale and must not grant ADMIN status.
 */
export type DashboardAccessDecision = "loading" | "login" | "profile-unavailable" | "admin" | "onboarding" | "ready"

type VerifiedProfile = {
    role?: string | null
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
    location?: string | null
    postcode?: string | null
} | null

const SELF_SERVICE_ROLES = new Set(["BUYER", "SELLER", "DEALER", "CONTRACTOR"])

function requiredDetailsComplete(profile: NonNullable<VerifiedProfile>): boolean {
    return Boolean(
        profile.firstName?.trim() &&
        profile.lastName?.trim() &&
        profile.phone?.trim() &&
        profile.location?.trim() &&
        profile.postcode?.trim()
    )
}

/** The admin sub-layout checks ADMIN before rendering any protected content. */
export function getDashboardAccessDecision({
    loading,
    hasUser,
    profile,
    pathname,
}: {
    loading: boolean
    hasUser: boolean
    profile: VerifiedProfile
    pathname: string
}): DashboardAccessDecision {
    if (loading) return "loading"
    if (!hasUser) return "login"

    // Never send anyone trying /dashboard/admin to a *customer* profile form.
    // The dedicated admin layout verifies the backend role and fails closed.
    if (pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")) {
        return "ready"
    }

    // If the backend profile cannot be retrieved, fail closed. Treating this
    // as a buyer onboarding failure caused admin sessions to bounce to /auth/onboarding.
    if (!profile) return "profile-unavailable"

    const role = String(profile.role || "").toUpperCase()
    if (role === "ADMIN") return "admin"
    if (SELF_SERVICE_ROLES.has(role) && !requiredDetailsComplete(profile)) return "onboarding"
    return "ready"
}

/** No fallback to client metadata. Access requires a verified backend ADMIN. */
export function getAdminAccessDecision({
    loading,
    hasUser,
    profile,
}: {
    loading: boolean
    hasUser: boolean
    profile: VerifiedProfile
}): "loading" | "login" | "profile-unavailable" | "denied" | "ready" {
    if (loading) return "loading"
    if (!hasUser) return "login"
    if (!profile) return "profile-unavailable"
    return String(profile.role || "").toUpperCase() === "ADMIN" ? "ready" : "denied"
}
