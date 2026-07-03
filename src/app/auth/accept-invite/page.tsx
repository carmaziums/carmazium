"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

function AcceptInviteContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user, profile, loading: authLoading } = useAuth()

    const token = searchParams?.get("token") ?? ""

    const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
    const [message, setMessage] = React.useState<string | null>(null)

    // Once auth is resolved, either redirect to login or auto-accept
    React.useEffect(() => {
        if (authLoading) return

        if (!token) {
            setStatus("error")
            setMessage("No invitation token found. Please use the link from your invitation email.")
            return
        }

        if (!user) {
            // Not logged in — send to login, preserving the full accept-invite URL as redirect
            const returnUrl = encodeURIComponent(`/auth/accept-invite?token=${token}`)
            router.replace(`/auth/login?redirect=${returnUrl}`)
            return
        }

        // Logged in — auto-accept the invite
        if (status === "idle") {
            setStatus("loading")
            apiClient<{ data: { message: string } }>("/dealers/invites/accept", {
                method: "POST",
                body: JSON.stringify({ token }),
            })
                .then((res) => {
                    setMessage(res.data?.message ?? "You have successfully joined the dealership.")
                    setStatus("success")
                })
                .catch((err: Error) => {
                    if (err.message === "AUTH_REDIRECT") return
                    setMessage(err.message || "Something went wrong. Please try again.")
                    setStatus("error")
                })
        }
    }, [authLoading, user, token, status, router])

    const handleGoToDashboard = () => {
        router.push("/dashboard/dealer")
    }

    // While auth is resolving or we are about to redirect to login, show a spinner
    if (authLoading || (!user && status === "idle")) {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-sm text-[var(--text-muted)]">Verifying your session…</p>
            </div>
        )
    }

    if (status === "loading") {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-sm text-[var(--text-muted)]">Accepting your invitation…</p>
            </div>
        )
    }

    if (status === "success") {
        return (
            <div className="flex flex-col items-center gap-6 text-center">
                <CheckCircle className="w-14 h-14 text-green-500" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Invitation accepted</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
                </div>
                <Button onClick={handleGoToDashboard} className="w-full">
                    Go to dashboard
                </Button>
            </div>
        )
    }

    // error state
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <XCircle className="w-14 h-14 text-red-500" />
            <div>
                <h2 className="text-xl font-semibold text-gray-900">Invitation failed</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
            </div>
            <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
                Back to login
            </Link>
        </div>
    )
}

export default function AcceptInvitePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900">Staff invitation</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Join your dealership team on Carmazium</p>
                    </div>
                </div>

                <React.Suspense
                    fallback={
                        <div className="flex justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    }
                >
                    <AcceptInviteContent />
                </React.Suspense>
            </div>
        </div>
    )
}
