"use client"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { saveIntroduction } from "@/components/onboarding/WebsiteIntroduction"

const options = [
    ["financeOffered", "Finance badge", "Show that you can arrange finance on your own listings."],
    ["warrantyOffered", "Warranty badge", "Show that you offer warranties on your own listings."],
] as const

export function DealerServicePreferences() {
    const { profile, refreshProfile } = useAuth()
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    const dealer = profile?.dealerProfile
    const acknowledged = useRef<string | null>(null)
    useEffect(() => {
        if (!profile?.id || !dealer || profile.preferences?.dealerServicesNoticeV1 || acknowledged.current === profile.id) return
        acknowledged.current = profile.id
        void saveIntroduction("services_viewed").then(refreshProfile).catch(() => {
            // A temporary failure must not block editing service preferences.
            acknowledged.current = null
        })
    }, [profile?.id, profile?.preferences?.dealerServicesNoticeV1, dealer, refreshProfile])
    if (!dealer) return null
    async function toggle(key: string, enabled: boolean) {
        setBusy(true); setMessage("")
        try {
            await apiClient("/users/dealer-profile", { method: "PATCH", body: JSON.stringify({ [key]: enabled }) })
            await refreshProfile()
            setMessage(enabled ? "Listing badge enabled. Buyers contact you for details." : "Listing badge disabled.")
        } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save. Please try again.") }
        finally { setBusy(false) }
    }
    return <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
        <h2 className="text-xl font-bold">Listing badges</h2>
        <p className="text-sm text-[var(--text-muted)]">Finance and warranty badges apply only to your listings. Manage collection, delivery, recovery and inspection from TradeXchange instead.</p>
        <div className="grid gap-4 sm:grid-cols-2">{options.map(([key, title, description]) => {
            const enabled = dealer[key] !== false
            return <div key={key} className="rounded-xl border border-[var(--border-default)] p-4"><label data-tour={key} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={enabled} disabled={busy} onChange={e => toggle(key, e.target.checked)} />
                <span><span className="block font-semibold">{title}</span><span className="block mt-1 text-sm text-[var(--text-muted)]">{description}</span></span>
            </label>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{enabled ? 'Badge on — buyers contact you for details.' : 'Badge off — hidden from your listings.'} No provider application is needed.</p>
            </div>
        })}</div>
        <p className="text-sm text-[var(--text-muted)]">TradeXchange service eligibility is managed separately from listing badges.</p>
        {message && <p role="status" className="text-sm">{message}</p>}
    </section>
}
