// SEO-only listing quality checks.
// These rules do not hide, delete, reject, or otherwise change marketplace listings.
// They only determine whether a vehicle page should be promoted to search engines.

const PLACEHOLDER_VALUES = new Set([
    "undefined",
    "null",
    "unknown",
    "n/a",
    "na",
    "aaa",
    "qqq",
    "www",
])

function normalise(value: unknown): string {
    return String(value ?? "").trim().toLowerCase()
}

export interface SeoVehicleListing {
    make?: string | null
    model?: string | null
    title?: string | null
    slug?: string | null
}

/**
 * Returns false for clearly incomplete/test vehicle records that should remain
 * usable on CarMazium but should not be submitted for organic indexing.
 */
export function isSeoIndexableVehicleListing(listing: SeoVehicleListing): boolean {
    const make = normalise(listing.make)
    const model = normalise(listing.model)
    const title = normalise(listing.title)
    const slug = normalise(listing.slug)

    if (!make || !model) return false
    if (PLACEHOLDER_VALUES.has(make) || PLACEHOLDER_VALUES.has(model)) return false
    if (/^test\d*$/.test(make) || /^test\d*$/.test(model)) return false

    // Catch records whose generated title/slug still contains a missing-value token.
    if (/\b(undefined|null|unknown)\b/.test(title)) return false
    if (/(^|-)undefined(-|$)|(^|-)null(-|$)|(^|-)unknown(-|$)/.test(slug)) return false

    return true
}
