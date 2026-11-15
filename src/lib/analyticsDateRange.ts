export function analyticsRangeIssue(range: string, start: string, end: string): string | null {
    if (range !== "custom") return null
    if (!start || !end) return "Choose both a start date and an end date to view a custom report."
    const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!valid(start) || !valid(end)) return "Enter valid start and end dates."
    if (start > end) return "The end date must be on or after the start date."
    return null
}
