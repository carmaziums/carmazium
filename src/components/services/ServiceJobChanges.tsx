"use client"

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { acceptServiceReschedule, addServiceCaseNote, requestServiceJobChange, uploadServiceCaseEvidence, type ServiceJob, type ServiceJobChange } from '@/lib/servicesApi'

export function ServiceJobChanges({job, role, onChange}: {job: ServiceJob; role: 'customer' | 'provider'; onChange: () => void}) {
    const [kind, setKind] = React.useState<ServiceJobChange['kind']>(job.status === 'ACCEPTED' ? 'CANCEL' : 'OTHER')
    const [reason, setReason] = React.useState('')
    const [date, setDate] = React.useState('')
    const [file, setFile] = React.useState<File | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [message, setMessage] = React.useState('')
    if (!['ACCEPTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'RELEASED'].includes(job.status)) return null
    const run = async (work: () => Promise<void>) => {
        setBusy(true); setMessage('')
        try { await work(); setMessage('Saved.'); setReason(''); setFile(null); onChange() }
        catch (e: unknown) { setMessage(e instanceof Error ? e.message : 'Could not save. Please try again.') }
        finally { setBusy(false) }
    }
    const input = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm'
    return <section className="mb-6 rounded-xl border border-[var(--border-default)] p-5 space-y-3" aria-label="Job changes and support">
        <h2 className="font-bold">Job changes and support</h2>
        <p className="text-sm">Report unfinished work, request cancellation or agree a new date. Unreleased payment stays on hold during review. Reporting a problem after payout does not itself recover the money.</p>
        {job.payment?.stripeRefundStatus && <p className="text-sm">Refund status: {job.payment.stripeRefundStatus}</p>}
        {job.payment?.externalDisputeStatus && <p className="text-sm">Bank dispute: {job.payment.externalDisputeStatus}. CarMazium must review this before settlement.</p>}
        {job.changeRequest && <p className="text-sm">Request: {job.changeRequest.reason}{job.changeRequest.requestedFor ? ` — ${new Date(job.changeRequest.requestedFor).toLocaleString('en-GB')}` : ''}</p>}
        {job.status === 'DISPUTED' ? <>
            {job.changeRequest?.kind === 'RESCHEDULE' && !job.changeRequest.resolved && job.changeRequest.requestedByRole !== role &&
                <Button disabled={busy} onClick={() => run(() => acceptServiceReschedule(job.id))}>Agree to the new date</Button>}
            <label className="block text-sm">Add information for CarMazium<textarea className={input} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></label>
            <Button disabled={busy || reason.trim().length < 3} onClick={() => run(() => addServiceCaseNote(job.id, reason.trim()))}>Send case note</Button>
            <label className="block text-sm">Private evidence (image or PDF, up to 10 MB)<input className={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label>
            <Button disabled={busy || !file} onClick={() => run(async () => {
                if (!file || file.size > 10 * 1024 * 1024) throw new Error('Choose a file no larger than 10 MB.')
                const body = new FormData(); body.append('file', file); body.append('label', file.name)
                await uploadServiceCaseEvidence(job.id, body)
            })}>Upload evidence</Button>
        </> : <>
            <label className="block text-sm">What needs to change?<select className={input} value={kind} onChange={e => setKind(e.target.value as ServiceJobChange['kind'])}>
                {job.status !== 'ACCEPTED' && <option value="OTHER">Report a problem</option>}
                {role === 'provider' && <option value="CANNOT_ATTEND">I cannot attend or complete this job</option>}
                {job.status !== 'ACCEPTED' && <option value="NOT_COMPLETED">The work was not completed</option>}<option value="CANCEL">Request cancellation</option>
                {job.status !== 'ACCEPTED' && job.status !== 'RELEASED' && <option value="RESCHEDULE">Request a new date</option>}
            </select></label>
            <label className="block text-sm">Explain the request<textarea className={input} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></label>
            {kind === 'RESCHEDULE' && <label className="block text-sm">Proposed date and time<input className={input} type="datetime-local" value={date} onChange={e => setDate(e.target.value)}/></label>}
            <Button disabled={busy || reason.trim().length < 3 || (kind === 'RESCHEDULE' && !date)} onClick={() => run(() => requestServiceJobChange(job.id, {kind, reason: reason.trim(), requestedFor: kind === 'RESCHEDULE' ? new Date(date).toISOString() : undefined}))}>Submit request</Button>
        </>}
        {message && <p role="status" className="text-sm">{message}</p>}
    </section>
}
