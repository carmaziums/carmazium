"use client"
import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { saveIntroduction } from "@/components/onboarding/WebsiteIntroduction"

export function DealerServicesNotice() {
    const { profile, refreshProfile } = useAuth()
    const [busy, setBusy] = useState(false)
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    const [error, setError] = useState("")
    if (!profile?.dealerProfile || profile.preferences?.dealerServicesNoticeV1 || dismissedFor === profile.id) return null
    async function dismiss() {
        if (!profile) return
        setBusy(true); setError("")
        try {
            await saveIntroduction("services_dismissed")
            setDismissedFor(profile.id)
            await refreshProfile()
        } catch { setError("Could not save your dismissal. Please try again.") }
        finally { setBusy(false) }
    }
    return <aside className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
        <h2 className="font-bold">Manage your dealership services in Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Set your listing badges and complete collection, delivery or inspection setup in Account Settings → Business.</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5">
            <Link href="/profile?section=business" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Open Settings</Link>
            <button type="button" onClick={() => void dismiss()} disabled={busy} className="min-h-11 font-semibold disabled:opacity-50">{busy ? "Saving…" : "Dismiss"}</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </aside>
}
