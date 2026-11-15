"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { apiClient } from '@/lib/apiClient'
import { money, WarrantyOrder, warrantyHeaders, warrantyInput, warrantyPanel } from '@/components/warranties/types'

function AdminOrders() {
    const [orders, setOrders] = useState<WarrantyOrder[]>([]), [status, setStatus] = useState('PAID_AWAITING_ISSUE')
    const [selected, setSelected] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1), [total, setTotal] = useState(0), [search, setSearch] = useState(''), [searchDraft, setSearchDraft] = useState(''), [sort, setSort] = useState('oldest')
    const generation = useRef(0), mutating = useRef(false)
    const limit = 25
    const clearResults = () => { generation.current++; setLoading(true); setOrders([]); setSelected(''); setNotice('') }
    const load = useCallback(async () => {
        const current = ++generation.current
        setLoading(true); setOrders([]); setSelected(''); setError('')
        try {
            const query = new URLSearchParams({ page: String(page), limit: String(limit), search, sort, ...(status ? { status } : {}) })
            const result = (await apiClient<{ data: { data: WarrantyOrder[]; total: number } }>(`/admin/warranty-orders?${query}`, { cache: 'no-store' })).data
            if (current !== generation.current) return
            if (!Array.isArray(result.data) || !Number.isSafeInteger(result.total)) throw new Error('Could not load the complete order queue. Please retry.')
            setOrders(result.data); setTotal(result.total)
            if (page > 1 && !result.data.length) setPage(Math.max(1, Math.ceil(result.total / limit)))
        } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Could not load orders.') }
        finally { if (current === generation.current) setLoading(false) }
    }, [status, page, search, sort])
    useEffect(() => { void load(); return () => { generation.current++ } }, [load])
    async function issue(event: React.FormEvent<HTMLFormElement>, order: WarrantyOrder) {
        event.preventDefault(); if (mutating.current || loading || error) return; mutating.current = true; setBusy(true); setError(''); setNotice('')
        const form = new FormData(event.currentTarget)
        try {
            await apiClient(`/admin/warranty-orders/${order.id}/issue`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ warrantyReference: form.get('warrantyReference'), coverStart: form.get('coverStart'), coverEnd: form.get('coverEnd'), supplierPaidAndIssued: form.get('confirmed') === 'on' }) })
            setNotice('Warranty recorded as issued. The customer confirmation is queued for email and notification.'); await load()
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not record issuance.') }
        finally { mutating.current = false; setBusy(false) }
    }
    async function refund(event: React.FormEvent<HTMLFormElement>, order: WarrantyOrder) {
        event.preventDefault(); if (mutating.current || loading || error) return; mutating.current = true; setBusy(true); setError(''); setNotice('')
        const form = new FormData(event.currentTarget)
        try {
            const result = await apiClient<{ data: { status: string } }>(`/admin/warranty-orders/${order.id}/refund`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ reason: form.get('reason') }) })
            setNotice(result.data.status === 'REFUNDED' ? 'Stripe confirmed the full refund.' : 'Refund requested. The order will update when Stripe confirms the result.'); await load()
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not request refund.') }
        finally { mutating.current = false; setBusy(false) }
    }
    const order = !loading && !error ? orders.find(o => o.id === selected) : undefined
    return <div className="container mx-auto px-4 pt-28 pb-16"><div className="flex gap-8">
        <DashboardSidebar role="admin" userName="Admin" userType="Administration" />
        <div className="flex-1 min-w-0 space-y-6">
            <h1 className="text-3xl font-bold">Warranty orders</h1>
            <p className="text-[var(--text-muted)]">Customers pay the platform through Stripe. Admin then arranges and pays the supplier separately. No automatic supplier payout or warranty issuance takes place.</p>
            <div className="flex flex-wrap gap-4"><Link href="/dashboard/admin/services?tab=providers&serviceType=WARRANTY" className="underline">Manage warranty partners</Link><a href="https://dealer.warrantywise.co.uk/login" target="_blank" rel="noopener noreferrer" className="underline">Open Warrantywise dealer portal</a></div>
            {error && <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p>}{notice && <p role="status" className="rounded-xl border border-green-500 p-4">{notice}</p>}
            <div className="flex flex-wrap gap-4 items-end"><label className="flex-1">Order status<select className={warrantyInput} value={status} disabled={busy} onChange={e => { clearResults(); setStatus(e.target.value); setPage(1) }}><option value="">All checkout orders</option>{[['PAID_AWAITING_ISSUE', 'Paid — awaiting issue'], ['ISSUED', 'Issued'], ['CHECKOUT_PENDING', 'Awaiting payment'], ['QUOTED', 'Quoted'], ['EXPIRED', 'Expired'], ['PAYMENT_FAILED', 'Payment unsuccessful'], ['REFUND_PENDING', 'Refund in progress'], ['REFUNDED', 'Refunded'], ['PAYMENT_REVIEW', 'Payment needs review']].map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label><button className="p-3 underline" onClick={() => void load()} disabled={busy || loading}>Refresh</button></div>
            <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); if (busy) return; clearResults(); setSearch(searchDraft.trim()); setPage(1); if (search === searchDraft.trim() && page === 1) void load() }}>
                <label className="flex-1 min-w-0">Search registration, customer name, email or order ID<input className={warrantyInput} value={searchDraft} maxLength={100} onChange={e => setSearchDraft(e.target.value)} disabled={busy} /></label>
                <button disabled={busy} className="rounded-xl bg-primary px-4 py-3 text-white font-bold">Search</button>
                <label>Order<select className={warrantyInput} value={sort} disabled={busy} onChange={e => { clearResults(); setSort(e.target.value); setPage(1) }}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>
            </form>
            <p className="text-xs text-[var(--text-muted)]">Opening an order shows the saved customer, vehicle and price details. Oldest first helps you handle waiting customers in order.</p>
            {loading ? <p role="status">Loading orders…</p> : !error && !orders.length && <p>No orders match this status and search.</p>}
            <div className="space-y-3">{orders.map(o => <button key={o.id} disabled={busy || loading} onClick={() => setSelected(o.id === selected ? '' : o.id)} className={`w-full text-left ${warrantyPanel} ${selected === o.id ? 'ring-2 ring-primary' : ''}`}><div className="flex flex-wrap justify-between gap-3"><strong>{String(o.vehicle.vrm)} — {o.customer.firstName} {o.customer.lastName}</strong><strong>{money(o.totalPence)}</strong></div><p className="text-sm mt-2">{o.statusLabel} · {new Date(o.createdAt).toLocaleString('en-GB')}</p></button>)}</div>
            {!loading && !error && <nav aria-label="Warranty order pages" className="flex flex-wrap justify-between items-center gap-3"><span>Page {page} of {Math.max(1, Math.ceil(total / limit))} · {total} orders</span><div className="flex gap-4"><button disabled={busy || page <= 1} className="underline disabled:opacity-40" onClick={() => { clearResults(); setPage(value => value - 1) }}>Previous</button><button disabled={busy || page * limit >= total} className="underline disabled:opacity-40" onClick={() => { clearResults(); setPage(value => value + 1) }}>Next</button></div></nav>}
            {order && <section key={order.id} className={`${warrantyPanel} space-y-6`}>
                <h2 className="text-2xl font-bold">{String(order.vehicle.vrm)} · {order.statusLabel}</h2>
                <p className="text-xs break-all">Order {order.id}</p>
                <div className="grid lg:grid-cols-2 gap-6"><section><h3 className="font-bold mb-3">Customer</h3><dl className="space-y-2">{Object.entries(order.customer).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs text-[var(--text-muted)]">{k.replace(/([A-Z])/g, ' $1')}</dt><dd className="break-words">{v}</dd></div>)}</dl></section><section><h3 className="font-bold mb-3">Vehicle and declarations</h3><dl className="space-y-2">{Object.entries(order.vehicle).map(([k, v]) => <div key={k}><dt className="text-xs text-[var(--text-muted)]">{k.replace(/([A-Z])/g, ' $1')}</dt><dd className="break-words">{k === 'retailValuePence' ? money(Number(v)) : typeof v === 'boolean' ? (v ? 'Confirmed' : 'No') : String(v || 'Not supplied')}</dd></div>)}</dl></section></div>
                <section className="space-y-3"><h3 className="font-bold">Selected cover and payment</h3><p>Category: {order.selection.vehicleCategory}</p>{order.price.lines.map(l => <p key={l.code} className="flex justify-between gap-3"><span>{l.label}</span><strong>{money(l.amountPence)}</strong></p>)}<p className="font-bold">Total including VAT: {money(order.totalPence)}</p><p className="text-xs break-all">Stripe payment: {order.stripePaymentIntentId || 'Not paid'}<br />Checkout: {order.stripeCheckoutSessionId || 'Not created'}</p>{order.paymentReviewReason && <p role="alert">{order.paymentReviewReason}</p>}</section>
                {order.issuedAt && <div><h3 className="font-bold">Issued warranty</h3><p>Reference: {order.warrantyReference}</p><p>{order.coverStart?.slice(0, 10)} to {order.coverEnd?.slice(0, 10)}</p><p>Issued recorded: {new Date(order.issuedAt).toLocaleString('en-GB')}</p></div>}
                {order.status === 'PAID_AWAITING_ISSUE' && <form onSubmit={e => issue(e, order)} className="border-t border-[var(--border-default)] pt-5 space-y-4">
                    <h3 className="text-xl font-bold">Record a warranty already issued by the supplier</h3><p className="text-sm">Arrange the exact selected cover in Warrantywise and pay separately first. If the selected cover cannot be arranged, contact the customer and refund; do not silently reduce it.</p>
                    <label className="block">Warrantywise reference<input required name="warrantyReference" minLength={3} maxLength={120} className={warrantyInput} /></label>
                    <div className="grid sm:grid-cols-2 gap-4"><label>Confirmed cover start<input required name="coverStart" type="date" className={warrantyInput} /></label><label>Confirmed cover end<input required name="coverEnd" type="date" className={warrantyInput} /></label></div>
                    <label className="flex gap-3 text-sm"><input required type="checkbox" name="confirmed" className="mt-1" /><span>I have paid the supplier separately, the warranty has actually been issued with the customer’s selected cover, and its documents have been supplied to the customer.</span></label>
                    <button disabled={busy} className="rounded-xl bg-primary text-white px-5 py-3 font-bold disabled:opacity-50">Record as issued and notify customer</button>
                </form>}
                {['PAID_AWAITING_ISSUE', 'REFUND_PENDING'].includes(order.status) && <details className="border-t border-[var(--border-default)] pt-5"><summary className="font-bold cursor-pointer">Refund this unissued warranty order</summary><form onSubmit={e => refund(e, order)} className="space-y-4 mt-4"><label className="block">Reason<textarea required name="reason" minLength={10} maxLength={500} className={warrantyInput} /></label><label className="flex gap-3 text-sm"><input required type="checkbox" /><span>Refund the full {money(order.totalPence)} to the original payment method. This sends a real refund request to Stripe.</span></label><button disabled={busy} className="rounded-xl border border-red-500 text-red-500 px-5 py-3 font-bold disabled:opacity-50">{order.status === 'REFUND_PENDING' ? 'Check / resume existing refund' : `Refund ${money(order.totalPence)}`}</button></form></details>}
                <section><h3 className="font-bold">Email delivery</h3>{order.messages?.length ? order.messages.map((m, i) => <p key={i} className="text-sm">{m.kind.replaceAll('_', ' ')}: {m.sentAt ? 'Sent' : `Queued for retry (${m.attempts} attempts)`}</p>) : <p className="text-sm">Emails are queued after payment confirmation.</p>}</section>
            </section>}
        </div>
    </div></div>
}
export default function AdminWarrantyOrdersPage() { return <RequireAuth allowedRoles={['ADMIN']} unauthorizedTitle="Administrator access required" unauthorizedMessage="Warranty orders are managed only by CarMazium administrators."><AdminOrders /></RequireAuth> }
