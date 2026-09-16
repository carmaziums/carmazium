"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

const SELF_SERVICE_ROLES = new Set(["BUYER", "SELLER", "DEALER", "CONTRACTOR"])

function hasRequiredAccountDetails(profile: {
    firstName?: string
    lastName?: string
    phone?: string
    location?: string
    postcode?: string
} | null): boolean {
    if (!profile) return false
    return Boolean(
        profile.firstName?.trim() &&
        profile.lastName?.trim() &&
        profile.phone?.trim() &&
        profile.location?.trim() &&
        profile.postcode?.trim()
    )
}

/**
 * Dashboard access for self-service accounts is blocked until the single
 * onboarding form has been completed. The form itself lives only at
 * /auth/onboarding so users never see a second profile-completion form here.
 */
export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth()
    const router = useRouter()

    const role = String(profile?.role || user?.user_metadata?.role || "").toUpperCase()
    const shouldEnforce = Boolean(user && profile && SELF_SERVICE_ROLES.has(role))
    const isComplete = hasRequiredAccountDetails(profile)
    const shouldRedirect = !loading && shouldEnforce && !isComplete

    React.useEffect(() => {
        if (shouldRedirect) {
            router.replace("/auth/onboarding")
        }
    }, [shouldRedirect, router])

    if (loading || shouldRedirect) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "var(--bg-body)" }}>
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
            </div>
        )
    }

    return <>{children}</>
}
