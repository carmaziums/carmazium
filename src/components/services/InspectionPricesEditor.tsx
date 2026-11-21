"use client"

import * as React from "react"
import { getMyCapabilities, saveInspectionPrices, type InspectionPrice } from "@/lib/servicesApi"
import { Button } from "@/components/ui/Button"

const input = "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm text-[var(--text-primary)]"
const empty = (): InspectionPrice => ({ name: "", description: "", pricePence: 0, quoteOnly: true, vatIncluded: true })

/** This editor is scoped to the authenticated inspection business. No global tariff. */
export function InspectionPricesEditor() {
    const [items, setItems] = React.useState<InspectionPrice[]>([])
    const [busy, setBusy] = React.useState(false)
    const [loaded, setLoaded] = React.useState(false)
    const [notice, setNotice] = React.useState("")
    React.useEffect(() => {
        let active = true
        getMyCapabilities().then(data => {
            if (active) { setItems(data.profile?.inspectionPrices ?? []); setLoaded(true) }
        }).catch(() => { if (active) { setNotice("Could not load your business price list."); setLoaded(true) } })
        return () => { active = false }
    }, [])
    const update = (index: number, change: Partial<InspectionPrice>) =>
        setItems(previous => previous.map((item, i) => i === index ? { ...item, ...change } : item))
    const save = async () => {
        if (items.some(item => !item.name.trim() || (!item.quoteOnly && (!Number.isSafeInteger(item.pricePence) || item.pricePence < 100)))) {
            setNotice("Enter each service name and a fixed price of at least £1, or choose Quote required.")
            return
        }
        setBusy(true); setNotice("")
        try { const result = await saveInspectionPrices(items); setItems(result.prices); setNotice("Your business's inspection prices have been saved.") }
        catch (err) { setNotice(err instanceof Error ? err.message : "Could not save the price list.") }
        finally { setBusy(false) }
    }
    return <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
        <div><h2 className="text-lg font-bold">My Inspection Services & Prices</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">These prices belong to your business only and appear on your public profile once your inspection capability is approved. Customers accept a final quotation through TradeXchange, including any agreed travel charges.</p></div>
        {!loaded && <p role="status" className="text-sm">Loading your prices…</p>}
        {loaded && items.length === 0 && <p className="text-sm text-[var(--text-muted)]">No inspection prices have been published for your business.</p>}
        {items.map((item, i) => <div key={i} className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2"><span className="font-bold text-sm">Service {i + 1}</span><button type="button" onClick={() => setItems(items.filter((_, j) => i !== j))} className="text-sm text-red-600 dark:text-red-400">Remove</button></div>
            <label className="block text-sm">Service name <input className={input} maxLength={110} value={item.name} onChange={e => update(i, { name: e.target.value })} placeholder="Initial Damage Inspection"/></label>
            <label className="block text-sm">Service description (optional) <input className={input} maxLength={400} value={item.description ?? ""} onChange={e => update(i, { description: e.target.value })}/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.quoteOnly} onChange={e => update(i, { quoteOnly: e.target.checked })}/> Quote required instead of a fixed published price</label>
            {!item.quoteOnly && <label className="block text-sm">Price per vehicle (£) <input className={input} type="number" min="1" max="50000" step="0.01" value={(item.pricePence / 100).toFixed(2)} onChange={e => update(i, { pricePence: Math.round(Number(e.target.value || 0) * 100) })}/></label>}
            {!item.quoteOnly && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.vatIncluded} onChange={e => update(i, { vatIncluded: e.target.checked })}/> Price includes VAT where applicable</label>}
        </div>)}
        {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
        <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" disabled={!loaded || items.length >= 20 || busy} onClick={() => setItems([...items, empty()])}>Add inspection service</Button>
            <Button type="button" disabled={!loaded || busy} onClick={save}>{busy ? "Saving…" : "Save my prices"}</Button>
        </div>
    </section>
}
