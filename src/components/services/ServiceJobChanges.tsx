"use client"

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { acceptServiceReschedule, addServiceCaseNote, requestServiceJobChange, uploadServiceCaseEvidence, type ServiceJob, type ServiceJobChange } from '@/lib/servicesApi'
import { serviceJobChangeOptions, validServiceJobChangeKind } from '@/lib/serviceJobJourney'
import { parseUkServiceDateTime, formatUkServiceDateTime } from '@/lib/ukServiceDateTime'

export function ServiceJobChanges({job, role, onChange, disabled = false, onBusyChange}: {job: ServiceJob; role: 'customer' | 'provider'; onChange: () => void | Promise<unknown>; disabled?: boolean; onBusyChange?: (busy: boolean) => void}) {
    const [kind, setKind] = React.useState<ServiceJobChange['kind']>(job.status === 'ACCEPTED' ? 'CANCEL' : 'OTHER')
    const [reason, setReason] = React.useState('')
    const [date, setDate] = React.useState('')
    const [file, setFile] = React.useState<File | null>(null)
    const [busy, setBusy] = React.useState(false)
    const pending = React.useRef(false)
    const [expanded, setExpanded] = React.useState(job.status === 'DISPUTED')
    const blocked = busy || disabled
    const choices = serviceJobChangeOptions(job.status, role)
    const [message, setMessage] = React.useState('')
    const canReschedule = job.status === 'PAID' || job.status === 'IN_PROGRESS'
    const proposalPending = job.status === 'DISPUTED' && job.changeRequest?.kind === 'RESCHEDULE' && !job.changeRequest.resolved
    const progress = [
        ['Provider chosen', job.acceptedAt],
        ['Payment confirmed', job.payment?.paidAt],
        ['Work started', job.startedAt],
        ['Work completed', job.completedAt],
        ['Provider payout recorded', job.payment?.releasedAt],
    ] as const
    React.useEffect(() => {
        setKind(current => validServiceJobChangeKind(current, job.status, role))
        if (job.status === 'DISPUTED') setExpanded(true)
    }, [job.status, role])
    if (!['ACCEPTED', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'RELEASED'].includes(job.status)) return null
    const run = async (work: () => Promise<void>) => {
        if (pending.current || disabled) return
        pending.current = true; setBusy(true); onBusyChange?.(true); setMessage('')
        try { await work(); setMessage('Saved.'); setReason(''); setDate(''); setFile(null); await onChange() }
        catch (e: unknown) { setMessage(e instanceof Error ? e.message : 'Could not save. Please try again.') }
        finally { pending.current = false; setBusy(false); onBusyChange?.(false) }
    }
    const input = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm'
    return <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="mb-6 rounded-xl border border-[var(--border-default)] p-4 sm:p-5" aria-label="Job changes and support">
        <summary className="cursor-pointer min-h-8 font-bold">Changes, support and progress</summary>
        <div className="mt-4 space-y-3">
        <p className="text-sm">Report unfinished work, request cancellation or agree a new date. Unreleased payment stays on hold during review. Reporting a problem after payout does not itself recover the money.</p>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 space-y-2">
            <h3 className="font-bold text-sm">Work progress</h3>
            <p className="text-sm">Scheduled: {formatUkServiceDateTime(job.requestedFor)}</p>
            {job.status === 'DISPUTED' && <p role="status" className="text-sm text-amber-600 dark:text-amber-300">Work is paused for review. Do not assume the proposed date is approved.</p>}
            <ol className="space-y-1 text-xs text-[var(--text-muted)]">
                {progress.map(([label, at]) => (
                    <li key={label} className="flex flex-wrap justify-between gap-2"><span>{label}</span>
                        <span>{at ? formatUkServiceDateTime(at) : 'Pending'}</span>
                    </li>
                ))}
            </ol>
        </div>
        {job.payment?.stripeRefundStatus && <p className="text-sm">Refund status: {job.payment.stripeRefundStatus}</p>}
        {job.payment?.externalDisputeStatus && <p className="text-sm">Bank dispute: {job.payment.externalDisputeStatus}. CarMazium must review this before settlement.</p>}
        {job.changeRequest && <p className="text-sm">Request: {job.changeRequest.reason}{job.changeRequest.requestedFor ? ` — proposed ${formatUkServiceDateTime(job.changeRequest.requestedFor)}` : ''}{job.changeRequest.resolved ? ' (resolved)' : ' (awaiting review)'}</p>}
        {job.status === 'DISPUTED' ? <>
            {proposalPending && job.changeRequest?.requestedByRole !== role &&
                <Button disabled={blocked} onClick={() => {
                    const suggested = formatUkServiceDateTime(job.changeRequest?.requestedFor)
                    if (!window.confirm(`Agree to the proposed date ${suggested}? This reopens the existing paid job without changing the price.`)) return
                    void run(() => acceptServiceReschedule(job.id))
                }}>Agree to the new date</Button>}
            <label className="block text-sm">Add information for CarMazium<textarea disabled={blocked} className={input} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></label>
            <Button disabled={blocked || reason.trim().length < 3} onClick={() => run(() => addServiceCaseNote(job.id, reason.trim()))}>Send case note</Button>
            <label className="block text-sm">Private evidence (image or PDF, up to 10 MB)<input disabled={blocked} className={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label>
            <Button disabled={blocked || !file} onClick={() => run(async () => {
                if (!file || file.size > 10 * 1024 * 1024) throw new Error('Choose a file no larger than 10 MB.')
                const body = new FormData(); body.append('file', file); body.append('label', file.name)
                await uploadServiceCaseEvidence(job.id, body)
            })}>Upload evidence</Button>
        </> : <>
            <label className="block text-sm">What needs to change?<select disabled={blocked} className={input} value={kind} onChange={e => setKind(e.target.value as ServiceJobChange['kind'])}>
                {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="block text-sm">Explain the request<textarea disabled={blocked} className={input} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></label>
            {kind === 'RESCHEDULE' && canReschedule && <label className="block text-sm">Proposed UK date and time<input disabled={blocked} className={input} type="datetime-local" value={date} onChange={e => setDate(e.target.value)}/><span className="block text-xs mt-1">Interpreted in Europe/London time. Nonexistent clock times during daylight-saving changes are rejected.</span></label>}
            <Button disabled={blocked || reason.trim().length < 3 || (kind === 'RESCHEDULE' && (!canReschedule || !date))} onClick={() => run(async () => {
                if (validServiceJobChangeKind(kind, job.status, role) !== kind) throw new Error('This request changed. Review the available options and try again.')
                if (kind === 'RESCHEDULE') {
                    if (!canReschedule) throw new Error('Only unfinished paid work can be rescheduled.')
                    const requestedFor = parseUkServiceDateTime(date)
                    if (!requestedFor) throw new Error('Choose a valid future UK date and time.')
                    await requestServiceJobChange(job.id, {kind, reason: reason.trim(), requestedFor})
                } else await requestServiceJobChange(job.id, {kind, reason: reason.trim()})
            })}>Submit request</Button>
        </>}
        {message && <p role="status" className="text-sm">{message}</p>}
        </div>
    </details>
}
