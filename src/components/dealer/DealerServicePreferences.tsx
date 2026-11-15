"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { saveIntroduction } from "@/components/onboarding/WebsiteIntroduction"

const options = [
    ["financeOffered", "Finance badge", "Show that you can arrange finance on your own listings."],
    ["warrantyOffered", "Warranty badge", "Show that you offer warranties on your own listings."],
    ["deliveryServicesEnabled", "Collection, delivery and recovery", "Complete business verification, payout setup and trade insurance before quoting for jobs."],
    ["inspectionServicesEnabled", "Vehicle inspection", "Complete business verification, payout setup and the declaration. No inspection documents are required."],
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
            setMessage("Service preference saved.")
        } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save. Please try again.") }
        finally { setBusy(false) }
    }
    return <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
        <h2 className="text-xl font-bold">My dealership services</h2>
        <p className="text-sm text-[var(--text-muted)]">New dealer accounts start with all four options on. Turn off any service you do not offer. Badges apply only to your listings; buyers should contact you for details.</p>
        <div className="grid gap-4 sm:grid-cols-2">{options.map(([key, title, description]) => {
            const enabled = dealer[key] !== false
            return <label key={key} data-tour={key} className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] p-4">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={enabled} disabled={busy} onChange={e => toggle(key, e.target.checked)} />
                <span><span className="block font-semibold">{title}</span><span className="block mt-1 text-sm text-[var(--text-muted)]">{description}</span></span>
            </label>
        })}</div>
        <p className="text-sm text-[var(--text-muted)]">Paid jobs reuse your approved dealer KYC and one-time £1 account verification. No additional verification payment is required for services. A verified business payout account is required. Turning a service on does not approve your application.</p>
        <Link className="inline-block font-semibold text-primary underline" href="/dashboard/service/capabilities">Complete service setup</Link>
        {message && <p role="status" className="text-sm">{message}</p>}
    </section>
}
