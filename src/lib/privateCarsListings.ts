import { getMyListings, type Listing } from "@/lib/listingApi"

/**
 * Fetch every owner-scoped listing before applying My cars status filters.
 * Page-local filters made a car "disappear" whenever it was on a later page.
 * Fail explicitly if a total changes or the result grows beyond our cap.
 */
export async function getCompletePrivateListings(): Promise<Listing[]> {
    const pageSize = 50
    const maxPages = 40
    const found = new Map<string, Listing>()
    let totalPages: number | null = null
    let totalItems: number | null = null
    for (let page = 1; page <= maxPages; page++) {
        const response = await getMyListings({ page, limit: pageSize, includeSold: true })
        const pagination = response.pagination
        const pages = Number(pagination?.totalPages ?? 1)
        const total = Number(pagination?.total ?? response.data?.length ?? 0)
        if (!Number.isSafeInteger(pages) || pages < 0 || pages > maxPages
            || !Number.isSafeInteger(total) || total < 0 || total > maxPages * pageSize
            || (totalPages != null && pages !== totalPages)
            || (totalItems != null && total !== totalItems)) {
            throw new Error("Your car inventory changed while loading or is too large. Refresh the page.")
        }
        totalPages = pages
        totalItems = total
        for (const listing of response.data || []) {
            if (!listing?.id) throw new Error("Invalid listing in private inventory")
            found.set(listing.id, listing)
        }
        if (page >= pages) {
            if (found.size !== total) throw new Error("Incomplete private car inventory. Refresh the page.")
            return [...found.values()]
        }
        if (!response.data?.length) throw new Error("Incomplete private car inventory. Refresh the page.")
    }
    throw new Error("Private car inventory exceeded the safe page limit")
}
