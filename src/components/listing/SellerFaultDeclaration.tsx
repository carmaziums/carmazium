"use client"

import * as React from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { faultDeclarationError, isNoKnownFaults, isUndeclaredFaults, NO_KNOWN_FAULTS } from '@/lib/sellerFaultDeclaration'

/** Keep the existing API text field, but require an explicit No or described Yes. */
export function SellerFaultDeclaration({ kind, value, onChange, attempted, inputClassName }: {
    kind: 'mechanical' | 'electrical'
    value: string
    onChange: (value: string) => void
    attempted: boolean
    inputClassName: string
}) {
    const [detailsRequested, setDetailsRequested] = React.useState(false)
    const noFaults = isNoKnownFaults(value)
    const undeclared = isUndeclaredFaults(value)
    const showDetails = !noFaults && (detailsRequested || (!!value.trim() && !undeclared))
    const error = attempted ? faultDeclarationError(value, kind) : null
    const id = `listing-required-${kind}-faults`
    const label = kind === 'mechanical' ? 'Known Mechanical Problems' : 'Known Electrical Problems'
    return (
        <div id={id} role="group" aria-labelledby={`${id}-label`} aria-invalid={!!error}
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
            className={`space-y-2 md:col-span-2 scroll-mt-28 rounded-xl p-3 border ${error ? 'border-red-500/70 bg-red-500/5' : 'border-transparent'}`}>
            <p id={`${id}-label`} className="text-sm font-bold uppercase text-[var(--text-muted)]">
                {label} <span className="text-red-500">*</span>
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Are you aware of any {kind} faults?</p>
            {undeclared && <p className="text-sm text-amber-600">This older listing says “Not declared by seller”. Please answer the question when updating it.</p>}
            <div className="flex flex-wrap gap-2">
                {([{ label: 'No known faults', selected: noFaults, action: () => { setDetailsRequested(false); onChange(NO_KNOWN_FAULTS) } },
                    { label: 'Yes — describe faults', selected: showDetails, action: () => { setDetailsRequested(true); if (noFaults || undeclared) onChange('') } }]).map(option => (
                    <button key={option.label} type="button" aria-pressed={option.selected} onClick={option.action}
                        className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${option.selected ? 'border-primary bg-primary/10 text-primary' : 'border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30'}`}>
                        {option.label}
                    </button>
                ))}
            </div>
            {showDetails && (
                <Textarea id={`${id}-details`} aria-label={`Describe known ${kind} faults`} required
                    aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-help`}
                    value={value} onChange={event => { setDetailsRequested(true); onChange(event.target.value) }}
                    maxLength={2000} rows={3} className={inputClassName}
                    placeholder={kind === 'mechanical'
                        ? 'Describe the fault, e.g. clutch judder when cold, suspension knock, oil leak or gearbox noise.'
                        : 'Describe the fault, e.g. warning light, parking sensor fault, battery, window or infotainment problem.'} />
            )}
            <p id={`${id}-help`} className="text-xs text-[var(--text-secondary)]">
                {kind === 'mechanical'
                    ? 'Declare any known engine, gearbox, clutch, brake, steering, suspension or other mechanical faults.'
                    : 'Declare any known warning lights, battery/charging, sensor, lighting, infotainment or other electrical faults.'}
            </p>
            {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-400 font-medium">{error}</p>}
        </div>
    )
}
