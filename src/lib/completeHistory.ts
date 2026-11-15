/** Fetch every page without treating a truncated or failed history as complete. */
export async function collectHistory<T extends { id: string }>(
    fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
): Promise<T[]> {
    const limit = 50
    const items = new Map<string, T>()
    let expected: number | undefined
    for (let page = 1; page <= 200; page++) {
        const result = await fetchPage(page, limit)
        if (!Array.isArray(result.data) || !Number.isSafeInteger(result.total) || result.total < 0 || result.total > 10000) {
            throw new Error("Could not verify the complete history. Please contact support.")
        }
        if (expected !== undefined && result.total !== expected) throw new Error("History changed while loading. Please refresh.")
        expected = result.total
        const before = items.size
        for (const item of result.data) {
            if (!item?.id) throw new Error("Incomplete history received. Please refresh.")
            items.set(item.id, item)
        }
        if (items.size === expected) return [...items.values()]
        if (items.size > expected || items.size === before) throw new Error("Incomplete history received. Please refresh.")
    }
    throw new Error("History could not be fully loaded. Please contact support.")
}
