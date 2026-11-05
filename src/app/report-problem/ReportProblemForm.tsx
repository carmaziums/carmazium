"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { useAuth } from "@/context/AuthContext"

const CATEGORIES = [
  { id: "not_working", label: "Something isn’t working" },
  { id: "sign_in", label: "Signing in / account" },
  { id: "payments", label: "Payments" },
  { id: "listings", label: "Listings / selling" },
  { id: "auctions", label: "Auctions / bids" },
  { id: "messages", label: "Messages / notifications" },
  { id: "other", label: "Something else" },
] as const

export function ReportProblemForm() {
  const { user } = useAuth()
  const [category, setCategory] = React.useState<string>("")
  const [message, setMessage] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  React.useEffect(() => { if (user?.email && !email) setEmail(user.email) }, [user, email])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setError("Choose what the problem is about."); return }
    if (message.trim().length < 10) { setError("Please describe the problem in a little more detail."); return }
    setSending(true)
    setError(null)
    try {
      await apiClient("/analytics/problem-report", {
        method: "POST",
        body: JSON.stringify({
          category, message: message.trim(), contactEmail: email.trim() || undefined,
          platform: "web", device: navigator.userAgent.slice(0, 120), screen: document.referrer ? new URL(document.referrer).pathname : undefined,
        }),
      })
      setSent(true)
    } catch (err: any) {
      setError(err?.message || "Could not send your report. Please try again.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <p className="flex items-center gap-2 text-lg font-black"><CheckCircle2 className="text-emerald-500" /> Thank you — report sent</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Our team will look into it{email.trim() ? " and reply by email if we need more details" : ""}.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
      <fieldset>
        <legend className="mb-3 text-sm font-bold">What is it about?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map(c => (
            <label key={c.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-semibold ${category === c.id ? "border-primary bg-primary/10 text-primary" : "border-[var(--border-default)]"}`}>
              <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => { setCategory(c.id); setError(null) }} className="accent-[var(--color-primary,#ed1c24)]" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block text-sm font-bold">What happened?</span>
        <textarea value={message} onChange={e => { setMessage(e.target.value); setError(null) }} rows={6} maxLength={2000}
          placeholder="What were you doing, and what went wrong?"
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 outline-none focus:border-primary" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold">Your email (optional)</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="So we can reply to you"
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 outline-none focus:border-primary" />
      </label>
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
      <button type="submit" disabled={sending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60">
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send report
      </button>
    </form>
  )
}
