import { cache } from 'react'
import { serverBackendFetch } from './serverBackendFetch'

export type RetailCollection = { slug: string; label: string; count: number }
export type CollectionKind = 'makes' | 'locations'
export const collectionPath = (kind: CollectionKind, slug: string, page = 1) => `/used-cars/${kind === 'makes' ? 'make' : 'in'}/${slug}${page > 1 ? `?page=${page}` : ''}`
export const getRetailCollections = cache(async (allowBeforeBackendRollout = false): Promise<Record<CollectionKind, RetailCollection[]>> => {
    const response = await serverBackendFetch('/retail-catalogue/collections', { next: { revalidate: 300 } })
    // Only sitemap generation may omit this new route family while the API is
    // being deployed. Never disguise outages (5xx) as zero available vehicles.
    if (response.status === 404 && allowBeforeBackendRollout) return { makes: [], locations: [] }
    if (!response.ok) throw new Error('Vehicle collections are temporarily unavailable')
    const { data } = await response.json()
    for (const key of ['makes', 'locations']) {
        if (!Array.isArray(data?.[key]) || data[key].some((x: RetailCollection) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug) || typeof x.label !== 'string' || !Number.isSafeInteger(x.count) || x.count < 0)) throw new Error('Invalid vehicle collection response')
    }
    return data
})
