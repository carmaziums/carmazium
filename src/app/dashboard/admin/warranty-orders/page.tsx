"use client"
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { apiClient } from '@/lib/apiClient'
import { money, WarrantyOrder, warrantyHeaders, warrantyInput, warrantyPanel } from '@/components/warranties/types'

function AdminOrders() {
    const [orders, setOrders] = useState<WarrantyOrder[]>([]), [status, setStatus] = useState('PAID_AWAITING_ISSUE')
    const [selected, setSelected] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
    const load = useCallback(async () => {
        setLoading(true)
        try { setOrders((await apiClient<{ data: WarrantyOrder[] }>(`/admin/warranty-orders${status ? `?status=${status}` : ''}`, { cache: 'no-store' })).data); setError('') }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not load orders.') }
        finally { setLoading(false) }
    }, [status])
    useEffect(() => { void load() }, [load])
    async function issue(event: React.FormEvent<HTMLFormElement>, order: WarrantyOrder) {
        event.preventDefault(); setBusy(true); setError(''); setNotice('')
        const form = new FormData(event.currentTarget)
        try {
            await apiClient(`/admin/warranty-orders/${order.id}/issue`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ warrantyReference: form.get('warrantyReference'), coverStart: form.get('coverStart'), coverEnd: form.get('coverEnd'), supplierPaidAndIssued: form.get('confirmed') === 'on' }) })
            setNotice('Warranty recorded as issued. The customer confirmation is queued for email and notification.'); await load()
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not record issuance.') }
        finally { setBusy(false) }
    }
    async function refund(event: React.FormEvent<HTMLFormElement>, order: WarrantyOrder) {
        event.preventDefault(); setBusy(true); setError(''); setNotice('')
        const form = new FormData(event.currentTarget)
        try {
            const result = await apiClient<{ data: { status: string } }>(`/admin/warranty-orders/${order.id}/refund`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ reason: form.get('reason') }) })
            setNotice(result.data.status === 'REFUNDED' ? 'Stripe confirmed the full refund.' : 'Refund requested. The order will update when Stripe confirms the result.'); await load()
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not request refund.') }
        finally { setBusy(false) }
    }
    const order = orders.find(o => o.id === selected)
    return <div className="container mx-auto px-4 pt-28 pb-16"><div className="flex gap-8">
        <DashboardSidebar role="admin" userName="Admin" userType="Administration" />
        <main className="flex-1 min-w-0 space-y-6">
            <h1 className="text-3xl font-bold">Warranty orders</h1>
            <p className="text-[var(--text-muted)]">Customers pay the platform through Stripe. Admin then arranges and pays the supplier separately. No automatic supplier payout or warranty issuance takes place.</p>
            <div className="flex flex-wrap gap-4"><Link href="/dashboard/admin/services?tab=providers&serviceType=WARRANTY" className="underline">Manage warranty partners</Link><a href="https://dealer.warrantywise.co.uk/login" target="_blank" rel="noopener noreferrer" className="underline">Open Warrantywise dealer portal</a></div>
            {error && <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p>}{notice && <p role="status" className="rounded-xl border border-green-500 p-4">{notice}</p>}
            <div className="flex gap-4 items-end"><label className="flex-1">Order status<select className={warrantyInput} value={status} onChange={e => { setStatus(e.target.value); setSelected('') }}><option value="">All checkout orders</option>{[['PAID_AWAITING_ISSUE', 'Paid — awaiting issue'], ['ISSUED', 'Issued'], ['CHECKOUT_PENDING', 'Awaiting payment'], ['QUOTED', 'Quoted'], ['EXPIRED', 'Expired'], ['PAYMENT_FAILED', 'Payment unsuccessful'], ['REFUND_PENDING', 'Refund in progress'], ['REFUNDED', 'Refunded'], ['PAYMENT_REVIEW', 'Payment needs review']].map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label><button className="p-3 underline" onClick={() => void load()} disabled={busy}>Refresh</button></div>
            <p className="text-xs text-[var(--text-muted)]">Latest 200 orders for the selected status. Opening an order shows the complete saved customer, vehicle and price details.</p>
            {loading ? <p role="status">Loading orders…</p> : !orders.length && <p>No orders with this status.</p>}
            <div className="space-y-3">{orders.map(o => <button key={o.id} onClick={() => setSelected(o.id === selected ? '' : o.id)} className={`w-full text-left ${warrantyPanel} ${selected === o.id ? 'ring-2 ring-primary' : ''}`}><div className="flex flex-wrap justify-between gap-3"><strong>{String(o.vehicle.vrm)} — {o.customer.firstName} {o.customer.lastName}</strong><strong>{money(o.totalPence)}</strong></div><p className="text-sm mt-2">{o.statusLabel} · {new Date(o.createdAt).toLocaleString('en-GB')}</p></button>)}</div>
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
        </main>
    </div></div>
}
export default function AdminWarrantyOrdersPage() { return <RequireAuth allowedRoles={['ADMIN']} unauthorizedTitle="Administrator access required" unauthorizedMessage="Warranty orders are managed only by CarMazium administrators."><AdminOrders /></RequireAuth> }
