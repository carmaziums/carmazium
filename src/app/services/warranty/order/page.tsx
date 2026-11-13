"use client"
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/apiClient'
import { money, orderToken, WarrantyOrder, warrantyHeaders, warrantyPanel } from '@/components/warranties/types'

function Order() {
    const params = useSearchParams(), id = params.get('id') || ''
    const [order, setOrder] = useState<WarrantyOrder | null>(null)
    const [error, setError] = useState(''), [busy, setBusy] = useState(false)
    const load = useCallback(async () => {
        if (!id) { setError('No order reference was supplied.'); return }
        try { const { data } = await apiClient<{ data: WarrantyOrder }>(`/warranties/orders/${encodeURIComponent(id)}`, { headers: { 'X-Warranty-Token': orderToken(id) }, cache: 'no-store' }); setOrder(data); setError('') }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to load order.') }
    }, [id])
    useEffect(() => { void load() }, [load])
    useEffect(() => {
        if (order?.status !== 'CHECKOUT_PENDING') return
        let polls = 0
        const timer = setInterval(() => { if (++polls <= 12) void load(); else clearInterval(timer) }, 5000)
        return () => clearInterval(timer)
    }, [order?.status, load])
    async function resume() {
        setBusy(true); setError('')
        try {
            const { data } = await apiClient<{ data: { url: string } }>(`/warranties/orders/${id}/checkout`, { method: 'POST', headers: warrantyHeaders, body: JSON.stringify({ accessToken: orderToken(id) || '0'.repeat(64) }) })
            const url = new URL(data.url)
            if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Could not verify payment link.')
            window.location.assign(data.url)
        } catch (e) { await load(); setError(e instanceof Error ? e.message : 'Could not resume payment.'); setBusy(false) }
    }
    return <main className="container mx-auto max-w-3xl px-5 pt-28 pb-20 space-y-6">
        <h1 className="text-3xl font-bold">Your warranty order</h1>
        {error && <div role="alert" className="p-4 rounded-xl border border-red-500/40"><p>{error}</p><Link className="underline" href={`/auth/login?redirect=${encodeURIComponent(`/services/warranty/order?id=${id}`)}`}>Sign in to the account used to order</Link></div>}
        {!order && !error && <p role="status">Checking your order and payment…</p>}
        {order && <section className={`${warrantyPanel} space-y-5`}>
            <h2 className="text-2xl font-bold" role="status">{order.statusLabel}</h2>
            {order.status === 'PAID_AWAITING_ISSUE' && <p>We have received your payment. Our admin team will now arrange and pay for your warranty separately with the supplier. Cover is not active yet. We will email your warranty reference and confirmed cover dates after issuance.</p>}
            {order.status === 'ISSUED' && <div><p>Warranty reference: <strong>{order.warrantyReference}</strong></p><p>Cover dates: {order.coverStart?.slice(0, 10)} to {order.coverEnd?.slice(0, 10)}. Cover applies from the confirmed start date under your issued plan’s terms.</p><p className="mt-3">Follow the repair authorisation instructions in your Warrantywise documents before arranging repairs. Contact our team if you need a copy of your documents.</p></div>}
            {['QUOTED', 'CHECKOUT_PENDING'].includes(order.status) && <p>{params.get('cancelled') ? 'You returned from checkout. ' : ''}Payment has not yet been confirmed. You can resume the same checkout below; no warranty has been issued.</p>}
            {['EXPIRED', 'PAYMENT_FAILED'].includes(order.status) && <p>This checkout did not complete successfully. No warranty has been issued. Request a fresh quote to try again.</p>}
            {order.status === 'REFUND_PENDING' && <p>Your refund is being processed. We will email you when Stripe confirms it.</p>}
            {order.status === 'REFUNDED' && <p>Your payment has been refunded. It may take several days to appear with your bank. If cover had already been issued, contact the team about the warranty’s cancellation status.</p>}
            {order.status === 'PAYMENT_REVIEW' && <p>Our admin team is reviewing the payment. Please do not pay again. Contact the team using the order reference below if you need help.</p>}
            <div className="border-y border-[var(--border-default)] py-4 space-y-2"><p className="font-bold">{String(order.vehicle.vrm)} — {String(order.vehicle.make)} {String(order.vehicle.model)}</p>{order.price.lines.map(line => <div key={line.code} className="flex justify-between gap-4 text-sm"><span>{line.label}</span><span className="whitespace-nowrap">{money(line.amountPence)}</span></div>)}<p className="pt-3 text-xl font-bold">Total: {money(order.totalPence)} including VAT</p></div>
            <p className="text-sm break-all">Order reference: {order.id}</p>
            {['QUOTED', 'CHECKOUT_PENDING'].includes(order.status) && <button disabled={busy} onClick={resume} className="w-full bg-primary text-white rounded-xl p-4 font-bold disabled:opacity-50">{busy ? 'Opening checkout…' : 'Continue to secure payment'}</button>}
            <button onClick={() => void load()} className="underline text-primary">Refresh payment status</button>
        </section>}
        <div className="flex flex-wrap gap-5"><Link href="/services/warranty" className="underline">Get a new quote</Link><Link href="/dashboard/warranties" className="underline">My warranty orders</Link><Link href="/contact" className="underline">Contact the team</Link></div>
    </main>
}
export default function WarrantyOrderPage() { return <Suspense fallback={<p className="pt-28 text-center">Loading order…</p>}><Order /></Suspense> }
