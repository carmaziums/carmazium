"use client"

import * as React from "react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import {
  fetchPartnerAgreement,
  fetchPartnerAgreementStatus,
  signPartnerAgreement,
  type BusinessKind,
  type PartnerAgreementDocument,
  type PartnerAgreementStatus,
} from "@/lib/partnerAgreementApi"
import { Button } from "@/components/ui/Button"

const field = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)]"
const kinds: Array<{ value: BusinessKind; label: string }> = [
  {value: "COMPANY", label: "Registered company"},
  {value: "SOLE_TRADER", label: "Sole trader"},
  {value: "PARTNERSHIP", label: "Partnership"},
  {value: "OTHER_BUSINESS", label: "Other registered business"},
]

function AgreementContent({ text }: {text: string}) {
  return <div className="space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
    {text.split(/\n\s*\n/).map((part, index) => {
      if (part.startsWith("### ")) return <h3 key={index} className="pt-3 font-bold text-[var(--text-primary)]">{part.slice(4)}</h3>
      if (part.startsWith("## ")) return <h2 key={index} className="pt-5 text-lg font-black text-[var(--text-primary)]">{part.slice(3)}</h2>
      if (part.startsWith("# ")) return <h1 key={index} className="text-xl font-black text-[var(--text-primary)]">{part.slice(2)}</h1>
      return <p key={index} className="whitespace-pre-wrap">{part}</p>
    })}
  </div>
}

export function PartnerAgreementPanel({onAccepted}: {onAccepted?: () => void}) {
  const { user, profile, loading: authLoading } = useAuth()
  const [document, setDocument] = React.useState<PartnerAgreementDocument | null>(null)
  const [status, setStatus] = React.useState<PartnerAgreementStatus | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [legalEntityName, setLegalEntityName] = React.useState("")
  const [businessKind, setBusinessKind] = React.useState<BusinessKind>("COMPANY")
  const [registrationNumber, setRegistrationNumber] = React.useState("")
  const [signatoryFullName, setSignatoryFullName] = React.useState("")
  const [signatoryCapacity, setSignatoryCapacity] = React.useState("Director / owner")
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  const [confirmedAuthority, setConfirmedAuthority] = React.useState(false)

  const load = React.useCallback(async () => {
    setError(""); setLoading(true)
    try {
      const doc = await fetchPartnerAgreement()
      setDocument(doc)
      if (user) setStatus(await fetchPartnerAgreementStatus())
      else setStatus(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve the agreement.")
    } finally {setLoading(false)}
  }, [user])

  React.useEffect(() => {
    if (!authLoading) void load()
  }, [authLoading, load])

  React.useEffect(() => {
    if (profile) {
      setSignatoryFullName(old => old || [profile.firstName, profile.lastName].filter(Boolean).join(" "))
      setLegalEntityName(old => old || profile.dealerProfile?.companyName || profile.contractorProfile?.businessName || "")
    }
  }, [profile])

  const download = () => {
    if (!document || typeof window === "undefined") return
    const blob = new Blob([document.text], {type: "text/plain;charset=utf-8"})
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement("a")
    a.href = url; a.download = "CarMazium-Master-Business-Partner-Agreement-" + document.version + ".txt"
    window.document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const sign = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!document || !status?.canSign || busy || !acceptedTerms || !confirmedAuthority) return
    setBusy(true); setError("")
    try {
      await signPartnerAgreement({
        version: document.version,
        sha256: document.sha256,
        businessKind,
        legalEntityName: legalEntityName.trim(),
        registrationNumber: registrationNumber.trim() || undefined,
        signatoryFullName: signatoryFullName.trim(),
        signatoryCapacity: signatoryCapacity.trim(),
        authorityConfirmed: true,
        explicitAcceptance: true,
        channel: "WEB",
      })
      setStatus(await fetchPartnerAgreementStatus())
      onAccepted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record the signature.")
    } finally {setBusy(false)}
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="space-y-2">
      <p className="text-xs font-black uppercase tracking-widest text-primary">CarMazium · Business Account</p>
      <h1 className="text-2xl font-black font-heading sm:text-4xl">Master Business Partner Agreement</h1>
      <p className="text-sm text-[var(--text-muted)]">One agreement covers your business's dealer trading and any services it later activates. Personal buyer/seller accounts use the separate consumer-facing Platform Terms.</p>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</div>}
    {(loading || authLoading) && <p role="status" className="text-sm">Loading the authenticated agreement and signature status…</p>}

    {document && <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">{document.title}</h2><p className="text-xs text-[var(--text-muted)]">Version {document.version} · document SHA-256: {document.sha256.slice(0, 18)}…</p></div>
        <Button type="button" variant="outline" onClick={download}>Download the full agreement</Button>
      </div>
      <div aria-label="Full CarMazium Master Business Partner Agreement" tabIndex={0} className="max-h-[58vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 sm:p-6">
        <AgreementContent text={document.text}/>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">The exact document displayed above is the version your electronic signature will identify. Please read it before agreeing.</p>
    </section>}

    {!user && !authLoading && <p className="rounded-xl border border-[var(--border-default)] p-4 text-sm">To sign on behalf of your business, <Link href="/auth/login?redirect=/business-partner-agreement" className="font-bold text-primary underline">sign in</Link> or <Link href="/auth/signup?role=DEALER" className="font-bold text-primary underline">create a Partner Account</Link>.</p>}

    {user && status && !status.required && <p className="text-sm">Your current account does not require the Business Partner Agreement. It applies to business trading accounts.</p>}
    {user && status?.accepted && status.acceptance && <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5" aria-live="polite">
      <h2 className="text-lg font-bold">Agreement electronically accepted</h2>
      <p className="mt-2 text-sm">Signed by <strong>{status.acceptance.signatoryFullName}</strong> for <strong>{status.acceptance.legalEntityName}</strong> on {new Date(status.acceptance.acceptedAt).toLocaleString("en-GB")}.</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Signed version: {status.acceptance.agreementVersion} · acceptance reference: {status.acceptance.id}</p>
      <p className="mt-3 text-xs text-[var(--text-muted)]">Keep your downloaded copy and account acceptance reference for your records.</p>
    </section>}
    {user && status?.required && !status.accepted && !status.canSign && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">You are using a dealership staff account. An authorised business owner must first accept the agreement under the dealership's Partner Account. Contact your dealership owner; a staff login cannot sign for the business.</div>}

    {user && document && status?.required && !status.accepted && status.canSign && <form onSubmit={sign} className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7">
      <h2 className="text-xl font-bold">Electronically sign for your business</h2>
      <p className="text-sm text-[var(--text-muted)]">Enter the legal entity, not only its trading brand. The signer must be authorised to bind it.</p>
      <label className="block text-sm font-semibold">Legal form of business
        <select className={field} required value={businessKind} onChange={e => setBusinessKind(e.target.value as BusinessKind)}>{kinds.map(kind=><option value={kind.value} key={kind.value}>{kind.label}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Full legal business name
        <input className={field} required minLength={3} maxLength={180} value={legalEntityName} onChange={e=>setLegalEntityName(e.target.value)} placeholder="Full legal name of the company or sole trader"/>
      </label>
      {businessKind === "COMPANY" && <label className="block text-sm font-semibold">Company registration number
        <input className={field} required maxLength={40} value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} placeholder="Companies House number"/>
      </label>}
      <label className="block text-sm font-semibold">Signatory's full legal name
        <input className={field} required minLength={5} maxLength={180} value={signatoryFullName} onChange={e=>setSignatoryFullName(e.target.value)}/>
      </label>
      <label className="block text-sm font-semibold">Position / authority to sign
        <input className={field} required minLength={2} maxLength={120} value={signatoryCapacity} onChange={e=>setSignatoryCapacity(e.target.value)} placeholder="Director, owner, partner or authorised representative"/>
      </label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" required checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)}/> I have read the full Master Business Partner Agreement and applicable schedules, and expressly agree to be bound on behalf of the identified business.</label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" required checked={confirmedAuthority} onChange={e=>setConfirmedAuthority(e.target.checked)}/> I am authorised to sign for this legal entity, the information is accurate, and I intend my typed name and this action to constitute my electronic signature.</label>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !acceptedTerms || !confirmedAuthority || signatoryFullName.trim().length < 5 || legalEntityName.trim().length < 3 || (businessKind === "COMPANY" && !registrationNumber.trim())}>
        {busy ? "Recording your signed agreement…" : "Accept & Electronically Sign Agreement"}
      </Button>
      <p className="text-xs text-[var(--text-muted)]">Your authenticated account, the exact document version and fingerprint, and the server acceptance date are recorded for contractual evidence. The Privacy Policy explains data use and retention.</p>
    </form>}
  </div>
}
