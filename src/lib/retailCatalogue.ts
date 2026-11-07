import { cache } from "react"
import type { Listing } from "@/lib/listingApi"
import { serverBackendFetch } from "@/lib/serverBackendFetch"
import { indexableRetail } from "@/components/seo/RetailVehicleJsonLd"

export const RETAIL_CATALOGUE_PAGE_SIZE = 40
export const retailCataloguePath = (page: number) => page === 1 ? "/used-cars" : `/used-cars?page=${page}`

export function parseRetailPage(value: string | string[] | undefined): number | null {
    if (value === undefined) return 1
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null
    const page = Number(value)
    return Number.isSafeInteger(page) ? page : null
}

// A real HTML catalogue complements the interactive search. Every API page is
// reachable by links; an upstream outage must never masquerade as empty stock.
export const getRetailCatalogue = cache(async (page: number) => {
    const query = new URLSearchParams({ page: String(page), limit: String(RETAIL_CATALOGUE_PAGE_SIZE), sortBy: "newest" })
    const response = await serverBackendFetch(`/listings?${query}`, { next: { revalidate: 300 } }, { timeoutMs: 8_000, retries: 1 })
    if (!response.ok) throw new Error(`[retail catalogue] Upstream unavailable (${response.status})`)
    const payload = await response.json()
    const total = payload?.pagination?.total
    const totalPages = payload?.pagination?.totalPages
    if (!Array.isArray(payload?.data) || !Number.isSafeInteger(total) || total < 0 ||
        !Number.isSafeInteger(totalPages) || totalPages < 0 ||
        total < payload.data.length || payload.data.length > RETAIL_CATALOGUE_PAGE_SIZE ||
        totalPages !== Math.ceil(total / RETAIL_CATALOGUE_PAGE_SIZE)) {
        throw new Error("[retail catalogue] Invalid pagination payload")
    }
    const seen = new Set<string>()
    const listings = (payload.data as Listing[]).filter(listing => {
        if (!listing || !indexableRetail(listing) || typeof listing.slug !== "string" ||
            !/^[a-z0-9][a-z0-9-]{0,190}$/i.test(listing.slug) ||
            typeof listing.title !== "string" || !listing.title.trim()) return false
        if (seen.has(listing.slug)) return false
        seen.add(listing.slug)
        return true
    })
    return { listings, total, totalPages, outOfRange: page > 1 && page > totalPages }
})
