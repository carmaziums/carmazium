/** Explicit seller answers; an empty value never means there are no faults. */
export const NO_KNOWN_FAULTS = 'No known faults'

/** Admin-only disclosure for the audited legacy publication batch; never a seller answer. */
export const LEGACY_UNDECLARED_FAULTS = 'Not declared by seller'

export function isUndeclaredFaults(value: string | null | undefined): boolean {
    return value?.trim().toLowerCase() === LEGACY_UNDECLARED_FAULTS.toLowerCase()
}

export function isNoKnownFaults(value: string | null | undefined): boolean {
    return /^(no|none|nil|no (known )?((mechanical|electrical) )?(faults|issues|problems))[.!]?$/i.test(value?.trim() ?? '')
}

export function faultDeclarationError(value: string | null | undefined, kind: 'mechanical' | 'electrical'): string | null {
    const answer = value?.trim() ?? ''
    if (!answer || isUndeclaredFaults(answer)) return `Please select No known faults or choose Yes and describe the ${kind} faults.`
    if (/^(yes|y|yes[,.:! -]*faults?)[.!]?$/i.test(answer)) {
        return `Please describe the known ${kind} faults. Yes alone is not enough.`
    }
    return null
}
