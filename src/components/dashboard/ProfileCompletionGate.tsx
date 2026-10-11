"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getDashboardAccessDecision } from "@/lib/dashboardAccess"

/**
 * Customer onboarding is enforced for buyer/seller/dealer/contractor profiles.
 * Admins are routed to their own dashboard. A failed /users/me lookup is NOT
 * evidence of an incomplete customer account and must never force onboarding.
 */
export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()
    const pathname = usePathname() || "/dashboard"
    const [retrying, setRetrying] = React.useState(false)
    const decision = getDashboardAccessDecision({
        loading,
        hasUser: Boolean(user),
        profile,
        pathname,
    })

    React.useEffect(() => {
        if (decision === "login") {
            router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`)
        } else if (decision === "onboarding") {
            router.replace("/auth/onboarding")
        } else if (decision === "admin") {
            router.replace("/dashboard/admin")
        }
    }, [decision, pathname, router])

    if (decision === "loading" || decision === "login" ||
        decision === "onboarding" || decision === "admin") {
        return (
            <div role="status" className="flex min-h-[70vh] flex-col items-center justify-center"
                style={{ background: "var(--bg-body)" }}>
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-[var(--text-secondary)]">Checking your account...</p>
            </div>
        )
    }

    if (decision === "profile-unavailable") {
        return (
            <div role="alert" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-20 text-center">
                <ShieldAlert className="mb-4 h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-2xl font-black">Unable to verify your account</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    We couldn&apos;t load your verified account details. Your role has not changed.
                    Please retry the connection; no new account or seller registration is needed.
                </p>
                <button type="button" disabled={retrying}
                    onClick={async () => {
                        setRetrying(true)
                        try { await refreshProfile() } finally { setRetrying(false) }
                    }}
                    className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white disabled:opacity-60">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {retrying ? "Checking..." : "Retry account verification"}
                </button>
                <Link href="/" className="mt-4 text-sm font-semibold underline underline-offset-4">
                    Back to homepage
                </Link>
            </div>
        )
    }

    return <>{children}</>
}
