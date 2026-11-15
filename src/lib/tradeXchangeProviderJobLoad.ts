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

/** Aggregate complete cursor pages, or fail explicitly rather than show false totals. */
export async function loadAllProviderJobs<T extends { id: string }>(
    fetchPage: (cursor?: string) => Promise<ProviderJobPage<T>>,
): Promise<ProviderJobPage<T>> {
    const jobs = new Map<string, T>()
    const cursors = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < 100; page++) {
        const result = await fetchPage(cursor)
        for (const job of result.items) {
            if (!job.id || jobs.has(job.id)) throw new Error('Jobs changed while loading. Please refresh.')
            jobs.set(job.id, job)
        }
        if (!result.nextCursor) return { items: [...jobs.values()], nextCursor: null }
        if (!result.items.length || cursors.has(result.nextCursor)) throw new Error('The job list is incomplete. Please refresh.')
        cursors.add(result.nextCursor)
        cursor = result.nextCursor
    }
    throw new Error('There are too many jobs to calculate totals safely. Please contact support.')
}
