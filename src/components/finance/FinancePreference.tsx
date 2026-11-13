"use client"

import { useEffect, useState } from "react"
import { apiClient } from "@/lib/apiClient"

export function FinancePreference() {
    const [enabled, setEnabled] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const load = () => {
        setLoading(true); setError("")
        apiClient<{ data: { enabled: boolean } }>("/finance/referrals/preference")
            .then(r => setEnabled(r.data.enabled))
            .catch(e => setError(e.message || "Could not load your finance setting."))
            .finally(() => setLoading(false))
    }
    useEffect(load, [])
    async function toggle() {
        setSaving(true); setError(""); setMessage("")
        try {
            const r = await apiClient<{ data: { enabled: boolean } }>("/finance/referrals/preference", { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) })
            setEnabled(r.data.enabled)
            setMessage(r.data.enabled ? "Finance calculator added to your retail listings." : "Finance calculator removed from your retail listings.")
        } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again.") }
        finally { setSaving(false) }
    }
    return <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
        <h2 className="text-xl font-bold">Finance calculator on my listings</h2>
        <p className="text-sm text-[var(--text-muted)]">Choose whether the calculator and Apply for Finance button appear on your current and future retail listings. It is on by default. You can turn it off or back on at any time. Buyers enter their name, email and phone number, then continue to the application with the finance provider selected by CarMazium admin.</p>
        <button type="button" role="switch" aria-checked={enabled} aria-label="Show finance calculator on my listings" disabled={loading || saving || (!!error && !message)} onClick={toggle} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] px-4 py-3 font-semibold disabled:opacity-50">
            <span aria-hidden="true" className={`relative h-6 w-11 rounded-full ${enabled ? "bg-primary" : "bg-gray-500"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`} /></span>
            {loading ? "Loading…" : saving ? "Saving…" : enabled ? "On — remove finance calculator from my listings" : "Off — put finance calculator on my listings"}
        </button>
        {message && <p role="status" className="text-sm text-emerald-500">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-500">{error} <button onClick={load} className="underline">Try again</button></p>}
        <p className="text-sm text-[var(--text-muted)]">CarMazium does not provide finance or make lending decisions. Enabling this option does not register you as a finance provider.</p>
    </section>
}
