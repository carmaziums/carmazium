/** Explicit seller answers; an empty value never means there are no faults. */
export const NO_KNOWN_FAULTS = 'No known faults'

export function isNoKnownFaults(value: string | null | undefined): boolean {
    return /^(no|none|nil|no (known )?((mechanical|electrical) )?(faults|issues|problems))[.!]?$/i.test(value?.trim() ?? '')
}

export function faultDeclarationError(value: string | null | undefined, kind: 'mechanical' | 'electrical'): string | null {
    const answer = value?.trim() ?? ''
    if (!answer) return `Please select No known faults or choose Yes and describe the ${kind} faults.`
    if (/^(yes|y|yes[,.:! -]*faults?)[.!]?$/i.test(answer)) {
        return `Please describe the known ${kind} faults. Yes alone is not enough.`
    }
    return null
}
