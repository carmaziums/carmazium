export const TRACKING_CONSENT_STORAGE_KEY = "carmazium_cookie_consent"

/**
 * Returns true only after the visitor has explicitly accepted analytics and
 * marketing tracking. This is intentionally synchronous so low-level event
 * helpers can enforce consent even after a third-party script has already
 * been loaded earlier in the same SPA session.
 */
export function hasTrackingConsent(): boolean {
    if (typeof window === "undefined") return false

    try {
        const raw = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        return parsed?.decision === "accepted"
    } catch {
        return false
    }
}
