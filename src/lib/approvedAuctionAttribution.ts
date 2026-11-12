import { hasTrackingConsent, TRACKING_CONSENT_STORAGE_KEY } from './trackingConsent'
import { getAccessToken } from './supabase'

const enabled = () => process.env.NEXT_PUBLIC_APPROVED_AUCTION_ATTRIBUTION === 'true'
const API = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev'
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

function googleId(field: 'client_id' | 'session_id'): Promise<string | undefined> {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(undefined), 250)
        if (!measurementId || typeof window.gtag !== 'function') {
            clearTimeout(timer)
            resolve(undefined)
            return
        }
        window.gtag('get', measurementId, field, (value: unknown) => {
            clearTimeout(timer)
            resolve(typeof value === 'string' || typeof value === 'number' ? String(value) : undefined)
        })
    })
}

/** Bounded, optional attribution BEFORE publish; never blocks selling a car. */
export async function captureApprovedAuctionAttribution(listingId: string): Promise<void> {
    if (!enabled() || typeof window === 'undefined' || !hasTrackingConsent()) return
    let finished = false
    const work = async () => {
        try {
            const stored = JSON.parse(localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY) || '{}')
            const [clientId, sessionId, token] = await Promise.all([
                googleId('client_id'), googleId('session_id'), getAccessToken(),
            ])
            if (finished || !hasTrackingConsent() || !token || !clientId || !stored.decidedAt) return
            await fetch(`${API}/analytics/auction-attribution`, {
                method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(500),
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ listingId, clientId, sessionId, consentAt: stored.decidedAt }),
            })
        } catch { /* Analytics must not break the submission flow. */ }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([work(), new Promise<void>(resolve => { timer = setTimeout(resolve, 900) })])
    finished = true
    clearTimeout(timer)
}

/** Revokes queued server sends as well as the browser's Google consent state. */
export async function revokeApprovedAuctionAttribution(): Promise<void> {
    if (!enabled() || typeof window === 'undefined') return
    try {
        const token = await getAccessToken()
        if (!token) return
        await fetch(`${API}/analytics/auction-attribution/revoke`, {
            method: 'POST', credentials: 'omit', keepalive: true,
            headers: { Authorization: `Bearer ${token}` },
        })
    } catch { /* A later rejected-consent page load retries revocation. */ }
}
