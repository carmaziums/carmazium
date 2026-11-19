"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

export function GuestEnquiryDialog({ listingId, title, onClose }: { listingId: string; title: string; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [challenge, setChallenge] = useState<string | null>(null)
    const [sent, setSent] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [values, setValues] = useState({ fullName: '', email: '', phone: '', message: `Hello, I am interested in ${title}. Is it still available?`, website: '', code: '' })
    const [consent, setConsent] = useState(false)
    useEffect(() => { dialog.current?.showModal() }, [])
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (busy) return
        setBusy(true); setError('')
        try {
            const headers = { 'X-CSRF-Token': 'public-listing-enquiry' }
            if (challenge) {
                await apiClient('/listing-enquiries/verify', { method: 'POST', headers, body: JSON.stringify({ id: challenge, code: values.code }) })
                setSent(true)
            } else {
                const { data } = await apiClient<{ data: { id: string } }>('/listing-enquiries', { method: 'POST', headers,
                    body: JSON.stringify({ listingId, fullName: values.fullName, email: values.email, phone: values.phone, message: values.message, website: values.website, consent }) })
                setChallenge(data.id)
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your enquiry. Please try again.') }
        finally { setBusy(false) }
    }
    const input = 'mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-base text-[var(--text-primary)]'
    return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="guest-enquiry-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/60">
        <div className="flex items-start justify-between gap-3"><h2 id="guest-enquiry-title" className="text-xl font-bold">{sent ? 'Your enquiry has been sent' : challenge ? 'Confirm your email' : 'Contact the seller'}</h2><button type="button" onClick={onClose} aria-label="Close enquiry" className="rounded p-2"><X size={22} /></button></div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{title}</p>
        {sent ? <div role="status" className="mt-5 space-y-4"><p>The seller can reply directly to your email{values.phone ? ' or call the number you provided' : ''}. No account has been created.</p><button onClick={onClose} className="rounded-lg bg-primary px-5 py-3 font-bold text-white">Done</button></div> : <form onSubmit={submit} className="mt-5 space-y-4">
            {challenge ? <><p>We sent a six-digit code to <strong>{values.email}</strong>. Enter it within 15 minutes to send your message. Check your spam folder if needed.</p><label className="block font-semibold">Email confirmation code<input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className={input} value={values.code} onChange={e => setValues(v => ({ ...v, code: e.target.value }))} /></label><button type="button" disabled={busy} onClick={() => { setChallenge(null); setValues(v => ({ ...v, code: '' })); setError('') }} className="text-primary underline">Change details or request a new code</button></> : <>
                <p className="text-sm text-[var(--text-secondary)]">No account needed. Confirm your email before your message reaches the seller.</p>
                <label className="block font-semibold">Your name<input autoFocus required minLength={2} maxLength={120} autoComplete="name" className={input} value={values.fullName} onChange={e => setValues(v => ({ ...v, fullName: e.target.value }))} /></label>
                <label className="block font-semibold">Email address<input required type="email" maxLength={254} autoComplete="email" className={input} value={values.email} onChange={e => setValues(v => ({ ...v, email: e.target.value }))} /></label>
                <label className="block font-semibold">Phone number <span className="font-normal">(optional)</span><input type="tel" autoComplete="tel" maxLength={30} className={input} value={values.phone} onChange={e => setValues(v => ({ ...v, phone: e.target.value }))} /></label>
                <label className="block font-semibold">Message<textarea required minLength={10} maxLength={2000} rows={4} className={input} value={values.message} onChange={e => setValues(v => ({ ...v, message: e.target.value }))} /></label>
                <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={values.website} onChange={e => setValues(v => ({ ...v, website: e.target.value }))} /></label></div>
                <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>I agree that CarMazium may share my name, contact details and message with this vehicle’s seller so they can reply. See our <Link href="/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</Link>.</span></label>
            </>}
            {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-600 dark:text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary p-3 font-bold text-white disabled:opacity-50">{busy ? 'Please wait…' : challenge ? 'Confirm email and send enquiry' : 'Send confirmation code'}</button>
        </form>}
    </dialog>
}
