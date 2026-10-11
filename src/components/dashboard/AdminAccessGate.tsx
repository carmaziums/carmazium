"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getAdminAccessDecision } from "@/lib/dashboardAccess"

/**
 * Dedicated ADMIN role boundary for every /dashboard/admin/** page.
 * Never use Supabase user_metadata to grant admin UI access; API endpoints
 * independently enforce backend permissions.
 */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, refreshProfile } = useAuth()
    const router = useRouter()
    const pathname = usePathname() || "/dashboard/admin"
    const [retrying, setRetrying] = React.useState(false)
    const decision = getAdminAccessDecision({
        loading,
        hasUser: Boolean(user),
        profile,
    })

    React.useEffect(() => {
        if (decision === "login") {
            router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`)
        }
    }, [decision, pathname, router])

    if (decision === "loading" || decision === "login") {
        return (
            <div role="status" className="flex min-h-[70vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <span className="sr-only">Verifying administrator access</span>
            </div>
        )
    }

    if (decision === "profile-unavailable") {
        return (
            <div role="alert" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
                <ShieldAlert className="mb-5 h-12 w-12 text-amber-500" aria-hidden="true" />
                <h1 className="text-2xl font-black">Admin account verification unavailable</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    Your session is signed in, but the server has not confirmed your administrator role.
                    This may be a temporary connection problem. You do not need to register as a seller or dealer.
                </p>
                <button type="button" disabled={retrying}
                    onClick={async () => {
                        setRetrying(true)
                        try { await refreshProfile() } finally { setRetrying(false) }
                    }}
                    className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white disabled:opacity-60">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {retrying ? "Verifying..." : "Retry admin verification"}
                </button>
                <Link className="mt-4 text-sm underline underline-offset-4" href="/">Return to homepage</Link>
            </div>
        )
    }

    if (decision === "denied") {
        return (
            <div role="alert" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
                <LockKeyhole className="mb-5 h-12 w-12 text-rose-500" aria-hidden="true" />
                <h1 className="text-2xl font-black">Administrator access required</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    This account is not assigned the ADMIN role by CarMazium. Admin permissions
                    cannot be gained by completing buyer, seller or dealer onboarding.
                </p>
                <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-6 py-3 font-bold text-white">
                    Go to your dashboard
                </Link>
            </div>
        )
    }

    return <>{children}</>
}
