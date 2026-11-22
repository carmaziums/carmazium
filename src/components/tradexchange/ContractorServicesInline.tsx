"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { applyCapability, type ContractorCapability } from "@/lib/servicesApi"

type Profile = { businessName: string | null; phone: string | null; serviceArea: string | null } | null
type Service = "DELIVERY" | "INSPECTION"
const ORDER: Service[] = ["DELIVERY", "INSPECTION"]

export function ContractorServicesInline({
  capabilities, profile, onUpdated,
}: {
  capabilities: ContractorCapability[]
  profile: Profile
  onUpdated: () => Promise<void>
}) {
  const [expanded, setExpanded] = React.useState(true)
  const [name, setName] = React.useState(profile?.businessName || "")
  const [phone, setPhone] = React.useState(profile?.phone || "")
  const [area, setArea] = React.useState(profile?.serviceArea || "")
  const [busy, setBusy] = React.useState<Service | null>(null)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  React.useEffect(() => {
    setName(profile?.businessName || "")
    setPhone(profile?.phone || "")
    setArea(profile?.serviceArea || "")
  }, [profile?.businessName, profile?.phone, profile?.serviceArea])
  React.useEffect(() => {
    const sync = () => { if (window.location.hash === "#provider-services") setExpanded(true) }
    window.addEventListener("hashchange", sync)
    sync()
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  const apply = async (serviceType: Service) => {
    const old = capabilities.find(c => c.serviceType === serviceType)
    if (old && old.status !== "REJECTED") return
    if (!name.trim()) { setError("Enter your business or trading name."); return }
    setBusy(serviceType);setError("");setNotice("")
    try {
      const cap = await applyCapability({
        serviceType,
        businessName: name.trim(),
        phone: phone.trim() || undefined,
        serviceArea: area.trim() || undefined,
      })
      if (!cap?.id || !/^[a-zA-Z0-9_-]+$/.test(cap.id) || cap.serviceType !== serviceType) {
        throw Error("Service setup returned a different application. No navigation was changed.")
      }
      await onUpdated()
      setNotice("Service application saved. Complete your declaration and working areas below.")
      window.location.hash = "provider-business"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to apply for this service.") }
    finally { setBusy(null) }
  }
  return <section id="provider-services" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7">
    <button type="button" className="flex w-full items-center justify-between text-left gap-3" aria-controls="legacy-provider-service-options" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
      <span><strong className="block text-xl">My Services</strong><span className="block mt-1 text-sm text-[var(--text-muted)]">Manage your existing applications without registering again.</span></span>
      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
    {expanded && <div id="legacy-provider-service-options" className="space-y-4 mt-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">Business/trading name<input aria-label="Provider trading name" className="w-full rounded-lg p-3 border border-[var(--border-default)] bg-[var(--bg-input)]" value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label>
        <label className="text-sm">Business phone<input aria-label="Provider phone" className="w-full rounded-lg p-3 border border-[var(--border-default)] bg-[var(--bg-input)]" value={phone} maxLength={30} onChange={e => setPhone(e.target.value)}/></label>
        <label className="text-sm">Existing coverage description<input aria-label="Provider coverage description" className="w-full rounded-lg p-3 border border-[var(--border-default)] bg-[var(--bg-input)]" value={area} maxLength={200} onChange={e => setArea(e.target.value)} placeholder="Optional"/></label>
      </div>
      <p className="text-xs text-[var(--text-muted)]">You may apply for both service types on the same account. Delivery, collection and recovery require Motor Trade and Public Liability Insurance; inspection requires Public Liability Insurance only. Existing applications remain attached to your account. Change working postcodes under Job Preferences.</p>
      {ORDER.map(type => {
        const cap = capabilities.find(c => c.serviceType === type)
        const label = type === "DELIVERY" ? "Collection, delivery & recovery" : "Vehicle inspection"
        const verified = cap?.verificationStatus === "VERIFIED" && !!cap.verificationExpiresAt && Date.parse(cap.verificationExpiresAt) > Date.now()
        const status = cap?.status === "APPROVED" ? (verified ? "Approved" : "Verification required") : cap?.status === "PENDING" ? "Awaiting approval"
          : cap?.status === "SUSPENDED" ? "Suspended" : cap?.status === "REJECTED" ? "Needs attention" : "Not applied"
        return <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-2" key={type}>
          <div className="flex items-center justify-between gap-3"><strong>{label}</strong><span className="text-sm font-semibold">{status}</span></div>
          {cap?.reviewNote && <p className="text-sm text-[var(--text-muted)]">{cap.reviewNote}</p>}
          {(!cap || cap.status === "REJECTED") ? <Button size="sm" disabled={!!busy} onClick={() => void apply(type)}>{busy === type ? "Applying…" : cap ? "Reapply" : "Apply for service"}</Button>
            : cap.status === "SUSPENDED" ? <p className="text-sm text-[var(--text-muted)]">Contact CarMazium to reactivate this service.</p>
            : <p className="text-sm text-[var(--text-muted)]">Continue with the business declaration, documents and job preferences on this screen.</p>}
        </div>
      })}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-300">{notice}</p>}
    </div>}
  </section>
}
