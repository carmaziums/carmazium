export const REQUEST_FILTERS = [
    ["all", "All requests"], ["quotes", "Quotes"], ["action", "Action needed"], ["progress", "In progress"], ["past", "Past requests"],
] as const
export type RequestFilter = typeof REQUEST_FILTERS[number][0]
type RequestRow = { status: string; _count?: { quotes?: number } | null }
export function requestMatches(job: RequestRow, filter: RequestFilter): boolean {
    if (filter === "all") return true
    if (filter === "quotes") return job.status === "OPEN"
    if (filter === "action") return ["ACCEPTED", "COMPLETED", "DISPUTED"].includes(job.status) || (job.status === "OPEN" && (job._count?.quotes ?? 0) > 0)
    if (filter === "progress") return ["PAID", "IN_PROGRESS"].includes(job.status)
    return ["RELEASED", "CANCELLED", "EXPIRED"].includes(job.status)
}
export function requestNextStep(job: RequestRow): string {
    switch (job.status) {
        case "OPEN": return (job._count?.quotes ?? 0) > 0 ? "Review quotes" : "Waiting for quotes"
        case "ACCEPTED": return "Continue to payment"
        case "PAID": return "Awaiting provider start"
        case "IN_PROGRESS": return "Track progress"
        case "COMPLETED": return "Review completion"
        case "DISPUTED": return "View dispute"
        default: return "View request"
    }
}
