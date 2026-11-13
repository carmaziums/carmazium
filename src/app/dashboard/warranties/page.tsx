"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { apiClient } from '@/lib/apiClient'
import { money, WarrantyOrder, warrantyPanel } from '@/components/warranties/types'
function Orders() {
    const [orders, setOrders] = useState<WarrantyOrder[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
    useEffect(() => { apiClient<{ data: WarrantyOrder[] }>('/warranties/mine', { cache: 'no-store' }).then(r => setOrders(r.data)).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])
    return <main className="container mx-auto max-w-4xl px-5 pt-28 pb-20 space-y-6"><Link href="/dashboard" className="underline">Back to dashboard</Link><h1 className="text-3xl font-bold">My warranty orders</h1>{error && <p role="alert">{error}</p>}{loading ? <p>Loading orders…</p> : !orders.length && <p>No warranty orders are linked to this account. Guest orders can be opened in the browser used to get the quote.</p>}{orders.map(o => <Link key={o.id} href={`/services/warranty/order?id=${o.id}`} className={`${warrantyPanel} block space-y-2`}><h2 className="font-bold">{String(o.vehicle.vrm)} · {String(o.vehicle.make)} {String(o.vehicle.model)}</h2><p>{o.statusLabel}</p><p>{money(o.totalPence)} including VAT</p><p className="text-xs break-all">{o.id}</p></Link>)}<Link href="/services/warranty" className="inline-block rounded-xl bg-primary text-white p-3 font-bold">Get a warranty quote</Link></main>
}
export default function MyWarrantiesPage() { return <RequireAuth title="Your warranty orders" message="Sign in to view warranties ordered through your account."><Orders /></RequireAuth> }
