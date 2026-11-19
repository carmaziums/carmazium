"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { apiClient } from '@/lib/apiClient'

type Enquiry = { id: string; fullName: string; email: string; phone: string | null; message: string; verifiedAt: string; listing: { title: string; slug: string } }
function Inbox() {
    const [rows, setRows] = useState<Enquiry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const load = useCallback(async () => {
        setLoading(true); setError('')
        try { const { data } = await apiClient<{ data: Enquiry[] }>('/listing-enquiries/mine'); setRows(data) }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not load enquiries.') }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { void load() }, [load])
    return <main className="mx-auto max-w-4xl px-5 py-10">
        <Link href="/dashboard" className="text-primary underline">Dashboard</Link>
        <h1 className="mt-4 text-3xl font-bold">Guest vehicle enquiries</h1>
        <p className="mt-3 text-[var(--text-secondary)]">Buyers can contact you without creating an account. Their email address is confirmed before the enquiry arrives. Reply by email or phone. Showing your latest 100 enquiries from the last 90 days.</p>
        <button onClick={load} disabled={loading} className="my-5 rounded-lg border border-[var(--border-default)] px-4 py-2">{loading ? 'Loading…' : 'Refresh enquiries'}</button>
        {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
        {!loading && !error && rows.length === 0 && <p>No confirmed guest enquiries yet. Signed-in conversations remain in Messages.</p>}
        <div className="space-y-5">{rows.map(row => <article key={row.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <h2 className="text-lg font-bold"><Link href={`/buy-cars/${row.listing.slug}`} className="text-primary underline">{row.listing.title}</Link></h2>
            <p className="mt-2 font-semibold">{row.fullName}</p><p className="text-sm text-[var(--text-muted)]">Email confirmed · {new Date(row.verifiedAt).toLocaleString('en-GB')}</p>
            <p className="my-4 whitespace-pre-wrap break-words">{row.message}</p>
            <div className="flex flex-wrap gap-4"><a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Re: ${row.listing.title}`)}`} className="break-all text-primary underline">Reply to {row.email}</a>{row.phone && <a href={`tel:${row.phone.replace(/[^+\d]/g, '')}`} className="text-primary underline">Call {row.phone}</a>}</div>
        </article>)}</div>
    </main>
}
export default function GuestEnquiriesPage() { return <RequireAuth><Inbox /></RequireAuth> }
