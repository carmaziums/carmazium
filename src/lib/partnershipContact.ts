export const PARTNERSHIP_SUBJECTS: Readonly<Record<string, string>> = {
    'finance-partnership': 'Finance provider integration and partnership',
    'warranty-partnership': 'Warranty provider integration and partnership',
    'insurance-partnership': 'Insurance provider integration and partnership',
}

export function partnershipSubject(topic: string | null): string {
    return topic && Object.prototype.hasOwnProperty.call(PARTNERSHIP_SUBJECTS, topic) ? PARTNERSHIP_SUBJECTS[topic] : ''
}
