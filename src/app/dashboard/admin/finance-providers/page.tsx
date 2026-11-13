"use client"

import { useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/apiClient"

type Provider = { id: string; name: string; applicationUrl: string; disclosure: string; enabled: boolean; isDefault: boolean }
type Referral = { id: string; fullName: string; email: string; phone: string; listingTitle: string; providerName: string | null; createdAt: string; adminNotifiedAt: string | null }
type Listing = { id: string; title: string; vrm: string | null; status: string; financeRouting: { providerId: string | null } | null }
const empty = { name: "", applicationUrl: "", disclosure: "", enabled: false, isDefault: false }
const input = "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm"

export default function AdminFinanceProvidersPage() {
    const [referrals, setReferrals] = useState<Referral[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [listings, setListings] = useState<Listing[]>([])
    const [query, setQuery] = useState("")
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState(empty)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [busy, setBusy] = useState(false)
    const load = useCallback(async () => {
        const [p, l, r] = await Promise.all([
            apiClient<{ data: Provider[] }>("/admin/finance-routing/providers"),
            apiClient<{ data: Listing[] }>("/admin/finance-routing/listings"),
            apiClient<{ data: Referral[] }>("/admin/finance-routing/referrals"),
        ])
        setProviders(p.data); setListings(l.data); setReferrals(r.data)
    }, [])
    useEffect(() => { load().catch(e => setError(e.message)) }, [load])
    async function search(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError("")
        try { setListings((await apiClient<{ data: Listing[] }>(`/admin/finance-routing/listings?q=${encodeURIComponent(query)}`)).data) }
        catch (e) { setError(e instanceof Error ? e.message : "Could not search listings.") }
        finally { setBusy(false) }
    }
    async function save(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError(""); setNotice("")
        try {
            await apiClient(`/admin/finance-routing/providers${editId ? "/" + encodeURIComponent(editId) : ""}`, { method: editId ? "PUT" : "POST", body: JSON.stringify(form) })
            await load(); setEditId(null); setForm(empty); setNotice("Finance provider saved. The seller’s calculator preference still applies.")
        } catch (e) { setError(e instanceof Error ? e.message : "Could not save provider.") }
        finally { setBusy(false) }
    }
    async function assign(listing: Listing, value: string) {
        setBusy(true); setError(""); setNotice("")
        const mode = value === "DEFAULT" || value === "OFF" ? value : "PROVIDER"
        try {
            await apiClient(`/admin/finance-routing/listings/${listing.id}`, { method: "PUT", body: JSON.stringify({ mode, ...(mode === "PROVIDER" ? { providerId: value } : {}) }) })
            setListings(current => current.map(row => row.id === listing.id ? { ...row, financeRouting: mode === "DEFAULT" ? null : { providerId: mode === "OFF" ? null : value } } : row))
            setNotice(`Finance routing saved for ${listing.vrm || listing.title}.`)
        } catch (e) { setError(e instanceof Error ? e.message : "Could not assign provider.") }
        finally { setBusy(false) }
    }
    return <main className="space-y-8 max-w-6xl">
        <header><h1 className="text-3xl font-bold mb-3">Finance providers</h1><p className="text-[var(--text-muted)]">Admin appoints finance partners and selects the application shown for each vehicle. Sellers can turn finance display off; this page does not override their choice.</p></header>
        {error && <p role="alert" className="text-red-500">{error}</p>}
        {notice && <p role="status" className="text-emerald-600 dark:text-emerald-400">{notice}</p>}
        <section className="grid gap-4 sm:grid-cols-2">
            {providers.map(p => <article key={p.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-3">
                <h2 className="text-xl font-bold">{p.name}</h2><p className="text-sm">{p.enabled ? "Enabled" : "Disabled"}{p.isDefault ? " · Default for listings" : ""}</p>
                <p className="text-xs break-all text-[var(--text-muted)]">{p.applicationUrl}</p>
                <button disabled={busy} className="text-primary font-semibold" onClick={() => { setEditId(p.id); setForm({ name: p.name, applicationUrl: p.applicationUrl, disclosure: p.disclosure, enabled: p.enabled, isDefault: p.isDefault }); setNotice("") }}>Edit provider</button>
            </article>)}
        </section>
        <form onSubmit={save} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="text-xl font-bold">{editId ? "Edit finance provider" : "Add finance provider"}</h2>
            <label className="block space-y-1"><span>Customer-facing name</span><input className={input} required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block space-y-1"><span>HTTPS application URL</span><input className={input} type="url" required maxLength={2000} value={form.applicationUrl} onChange={e => setForm({ ...form, applicationUrl: e.target.value })} /></label>
            <label className="block space-y-1"><span>Provider disclosure shown before the customer continues</span><textarea className={input} required minLength={20} maxLength={2000} rows={3} value={form.disclosure} onChange={e => setForm({ ...form, disclosure: e.target.value })} /></label>
            <label className="flex gap-3"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked, isDefault: e.target.checked && form.isDefault })} /><span>Enable this provider after reviewing its agreement, application link and disclosures</span></label>
            <label className="flex gap-3"><input type="checkbox" disabled={!form.enabled} checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /><span>Use as the default for listings without an override</span></label>
            <p className="text-xs text-[var(--text-muted)]">Disabling a provider stops applications to it, including listings assigned specifically to that provider. Those listings do not silently switch to another provider.</p>
            <div className="flex gap-4"><button disabled={busy} className="rounded-xl bg-primary text-white px-5 py-3 font-bold disabled:opacity-50">{busy ? "Saving…" : "Save provider"}</button>{editId && <button type="button" disabled={busy} onClick={() => { setEditId(null); setForm(empty) }}>Cancel edit</button>}</div>
        </form>
        <section className="space-y-4">
            <h2 className="text-xl font-bold">Choose a provider for a vehicle</h2>
            <form onSubmit={search} className="flex gap-3"><input aria-label="Search registration or vehicle title" className={input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Registration or vehicle title" /><button disabled={busy} className="px-4 font-bold text-primary">Search</button></form>
            <p className="text-xs text-[var(--text-muted)]">Showing up to 30 matching retail listings. Search by registration to find a specific vehicle.</p>
            {listings.map(row => <div key={row.id} className="rounded-xl border border-[var(--border-default)] p-4 grid gap-3 md:grid-cols-2 md:items-center">
                <div><p className="font-bold">{row.title}</p><p className="text-sm text-[var(--text-muted)]">{row.vrm || "No registration"} · {row.status}</p></div>
                <select aria-label={`Finance provider for ${row.vrm || row.title}`} className={input} disabled={busy} value={!row.financeRouting ? "DEFAULT" : row.financeRouting.providerId || "OFF"} onChange={e => assign(row, e.target.value)}>
                    <option value="DEFAULT">Use admin default</option><option value="OFF">Turn finance off for this vehicle</option>
                    {providers.map(p => <option key={p.id} value={p.id} disabled={!p.enabled}>{p.name}{p.enabled ? "" : " (disabled)"}</option>)}
                </select>
            </div>)}
        </section>
        <section className="space-y-4">
            <h2 className="text-xl font-bold">Recent finance referrals</h2>
            <p className="text-sm text-[var(--text-muted)]">The latest 50 customers who submitted their contact details before continuing to a provider. These are referrals, not confirmation of completed or approved finance applications.</p>
            {referrals.length === 0 && <p>No referrals yet.</p>}
            {referrals.map(row => <article key={row.id} className="rounded-xl border border-[var(--border-default)] p-4 grid gap-2 md:grid-cols-2">
                <div><p className="font-bold">{row.fullName}</p><p className="text-sm break-all">{row.email}</p><p className="text-sm">{row.phone}</p></div>
                <div><p>{row.listingTitle}</p><p className="text-sm text-[var(--text-muted)]">{row.providerName || "Jigsaw Finance"} · {new Date(row.createdAt).toLocaleString("en-GB")}</p><p className="text-xs">Admin email: {row.adminNotifiedAt ? "sent" : "pending retry"}</p></div>
            </article>)}
        </section>
    </main>
}
