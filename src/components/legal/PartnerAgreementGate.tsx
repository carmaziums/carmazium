"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { fetchPartnerAgreementStatus, type PartnerAgreementStatus } from "@/lib/partnerAgreementApi"
import { PartnerAgreementPanel } from "./PartnerAgreementPanel"

/**
 * Explicitly prompts signed-in Partner accounts at their business workspace.
 * Backend guards independently enforce the agreement before bids, listings,
 * quotes and provider applications. This UI alone is not a security boundary.
 */
export function PartnerAgreementGate({children}: {children: React.ReactNode}) {
  const {user, profile, loading: authLoading} = useAuth()
  const pathname = usePathname()
  const partner = profile?.role === "DEALER" || profile?.role === "CONTRACTOR"
  // Gate business entry points, never existing paid jobs, disputes, refunds or account-deletion pages.
  const inBusinessFlow = /^\/dashboard\/?$/.test(pathname || "")
    || /^\/dashboard\/(?:partner|dealer|service)\/?$/.test(pathname || "")
    || /^\/auctions\/(?:browse|live)(?:\/|$)/.test(pathname || "")
  const [status, setStatus] = React.useState<PartnerAgreementStatus | null>(null)
  const [checkedIdentity, setCheckedIdentity] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const identity = (user?.id || "") + ":" + (profile?.role || "")

  const check = React.useCallback(async () => {
    if (!user || !partner) return
    setBusy(true); setError("")
    try {setStatus(await fetchPartnerAgreementStatus())}
    catch(err){setError(err instanceof Error ? err.message : "The agreement service is unavailable.")}
    finally {setCheckedIdentity(identity); setBusy(false)}
  }, [identity, partner, user])

  React.useEffect(() => {
    if (!partner || !user) {setStatus(null); setCheckedIdentity(""); return}
    if (!inBusinessFlow || authLoading) return
    let alive = true
    setBusy(true); setError(""); setStatus(null); setCheckedIdentity("")
    fetchPartnerAgreementStatus().then(result => {if(alive) setStatus(result)})
      .catch(err => {if(alive) setError(err instanceof Error ? err.message : "The agreement service is unavailable.")})
      .finally(() => {if(alive) {setCheckedIdentity(identity); setBusy(false)}})
    return () => {alive = false}
  }, [identity, inBusinessFlow, partner, user?.id, authLoading])

  if (!inBusinessFlow || authLoading || !user || !partner) return <>{children}</>
  if (!busy && checkedIdentity === identity && status?.accepted) return <>{children}</>
  if (error && checkedIdentity === identity) return <section className="mx-auto max-w-2xl px-5 py-20 space-y-4">
    <h2 className="text-xl font-bold">Business agreement verification unavailable</h2>
    <p className="text-sm text-[var(--text-muted)]">{error}</p>
    <button type="button" onClick={()=>void check()} className="rounded-xl border border-[var(--border-default)] px-4 py-3 font-bold">Retry verification</button>
  </section>
  if (busy || checkedIdentity !== identity) return <p role="status" className="px-5 py-20 text-center text-sm">Checking your business agreement acceptance…</p>
  return <div className="min-h-screen px-5 py-12">
    <PartnerAgreementPanel onAccepted={() => void check()}/>
  </div>
}
