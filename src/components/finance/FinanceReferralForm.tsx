"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { apiClient } from "@/lib/apiClient"

export function FinanceReferralForm({ listingId }: { listingId: string }) {
    const [available, setAvailable] = useState<boolean | null>(null)
    const [title, setTitle] = useState("")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const request = useRef<{ key: string; id: string } | null>(null)
    useEffect(() => {
        let active = true
        apiClient<{ data: { enabled: boolean; title: string | null } }>(`/finance/referrals/listing/${encodeURIComponent(listingId)}`)
            .then(r => { if (active) { setAvailable(r.data.enabled); setTitle(r.data.title || "") } })
            .catch(() => { if (active) { setAvailable(false); setError("We could not confirm finance availability. Please return to the listing and try again.") } })
        return () => { active = false }
    }, [listingId])
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        const form = new FormData(event.currentTarget)
        const details = { listingId, fullName: String(form.get("fullName")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), consent: form.get("consent") === "on" }
        const key = JSON.stringify(details)
        if (!request.current || request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
        setBusy(true); setError("")
        try {
            const result = await apiClient<{ data: { redirectUrl: string } }>("/finance/referrals", { method: "POST", body: JSON.stringify({ ...details, requestId: request.current.id }) })
            const expected = "https://applications.jigsawfinance.com/pulse-cars-limited-1787921597855/"
            if (result.data.redirectUrl !== expected) throw new Error("The finance link could not be verified. Please contact the team.")
            window.location.assign(expected)
        } catch (e) { setError(e instanceof Error ? e.message : "Could not save your details. Please try again."); setBusy(false) }
    }
    if (available === null) return <p role="status">Checking this vehicle…</p>
    if (!available) return <div role="status"><p>{error || "Finance has been turned off for this listing, or the vehicle is no longer available."}</p><Link href="/search" className="text-primary underline">Browse available cars</Link></div>
    const input = "mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)]"
    return <form onSubmit={submit} className="space-y-5">
        <h2 className="text-xl font-bold">Apply for Finance</h2>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-[var(--text-muted)]">Enter your contact details below. We will record your interest and notify the CarMazium admin team, then take you to the Pulse Cars Limited application on Jigsaw Finance’s website.</p>
        <label className="block text-sm font-semibold">Full name<input className={input} name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></label>
        <label className="block text-sm font-semibold">Email address<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="block text-sm font-semibold">Phone number<input className={input} name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={30} /></label>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="consent" required /><span>I agree that CarMazium may record these details and email them to its admin team to follow up my finance enquiry. I understand I will complete a separate application with Jigsaw Finance. See the <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.</span></label>
        <p className="text-sm text-[var(--text-muted)]">CarMazium does not provide finance or decide whether you qualify. Jigsaw Finance is a credit broker, not a lender, and handles the application and its disclosures. Finance is subject to status and lender approval. CarMazium charges a fee to its finance partner when an application is successful.</p>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving your details…" : "Apply for Finance — continue to Jigsaw"}</button>
    </form>
}
