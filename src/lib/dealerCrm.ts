export interface DealerLead {
    id: string
    buyerName: string
    buyerId?: string | null
    buyerEmail?: string | null
    buyerPhone?: string | null
    listingId?: string | null
    listing?: { id: string; title: string; slug?: string | null; images?: string[]; price?: number | string } | null
    status: string
    source?: string | null
    notes?: string | null
    nextFollowUpAt?: string | null
    lastActivityAt?: string | null
    updatedAt?: string | null
}

export interface DealerLeadPage {
    data: DealerLead[]
    pagination: { total: number; totalPages: number; page: number }
}

/** A board's stage totals must include every page, or explicitly fail. */
export async function loadCompleteDealerLeads(fetchPage: (page: number, limit: number) => Promise<DealerLeadPage>): Promise<DealerLead[]> {
    const found = new Map<string, DealerLead>()
    let expectedTotal: number | undefined
    let expectedPages: number | undefined
    for (let page = 1; page <= 40; page++) {
        const result = await fetchPage(page, 50)
        const { total, totalPages, page: returnedPage } = result.pagination
        if (!Array.isArray(result.data) || !Number.isSafeInteger(total) || total < 0 || total > 2000
            || !Number.isSafeInteger(totalPages) || totalPages < 0 || totalPages > 40 || returnedPage !== page
            || (expectedTotal !== undefined && total !== expectedTotal)
            || (expectedPages !== undefined && totalPages !== expectedPages)) {
            throw new Error('The customer list changed while loading or is too large. Please refresh.')
        }
        expectedTotal = total; expectedPages = totalPages
        for (const lead of result.data) {
            if (!lead?.id || found.has(lead.id)) throw new Error('The customer list changed while loading. Please refresh.')
            found.set(lead.id, lead)
        }
        if (page >= totalPages) {
            if (found.size !== total) throw new Error('The customer list is incomplete. Please refresh.')
            return [...found.values()]
        }
        if (!result.data.length) throw new Error('The customer list is incomplete. Please refresh.')
    }
    throw new Error('The customer list is too large to load safely. Please contact support.')
}

export function rollbackLeadStage(leads: DealerLead[], id: string, previous: string, attempted: string) {
    return leads.map(lead => lead.id === id && lead.status === attempted ? { ...lead, status: previous } : lead)
}
