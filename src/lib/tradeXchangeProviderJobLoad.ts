/**
 * TradeXchange must not let an expired/unapproved NEW-job capability conceal
 * existing accepted work. The two backend endpoints have different access
 * rules; fetch and report their failures independently.
 */
export type ProviderJobPage<T> = {
    items: T[]
    nextCursor: string | null
}

export type ProviderJobLists<T> = {
    available: ProviderJobPage<T> | null
    assigned: ProviderJobPage<T> | null
    approvalRequired: boolean
    availableError: string | null
    assignedError: string | null
}

function errorText(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason || "Could not load jobs")
}

export async function loadProviderJobLists<T>(
    getAvailable: () => Promise<ProviderJobPage<T>>,
    getAssigned: () => Promise<ProviderJobPage<T>>,
): Promise<ProviderJobLists<T>> {
    const [open, mine] = await Promise.allSettled([getAvailable(), getAssigned()])
    const openFailure = open.status === "rejected" ? errorText(open.reason) : null
    const assignedFailure = mine.status === "rejected" ? errorText(mine.reason) : null
    const approvalRequired = !!openFailure
        && /no approved services|approved service providers|verification (is |has )?(expired|required|incomplete)|not verified/i.test(openFailure)

    return {
        available: open.status === "fulfilled" ? open.value : null,
        assigned: mine.status === "fulfilled" ? mine.value : null,
        approvalRequired,
        availableError: approvalRequired ? null : openFailure,
        assignedError: assignedFailure,
    }
}
