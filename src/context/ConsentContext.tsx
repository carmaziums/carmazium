"use client"

import * as React from "react"

/**
 * PECR/GDPR cookie consent.
 *
 * Two different mechanisms hang off this, and the distinction matters:
 *
 *  - Meta Pixel, TikTok Pixel and GTM are hard-gated: their scripts do not
 *    load at all until `granted` is true (they have no consent-signalling
 *    equivalent to Google's).
 *  - Google's tags use Consent Mode v2 instead. gtag.js loads for everyone
 *    with every storage type denied (components/analytics/GoogleConsentMode
 *    .tsx), storing nothing, and `applyGoogleConsent` below sends
 *    `consent: update` once the visitor chooses. This is what makes Google
 *    see an explicit "denied" rather than silence — the previous
 *    load-nothing approach produced "0% consent rate detected" in Ads and
 *    left conversion goals stuck on "Misconfigured".
 *
 * The auth session cookie is strictly necessary for the service to function,
 * so it's never gated by this.
 */

type ConsentDecision = "accepted" | "rejected"
const STORAGE_KEY = "carmazium_cookie_consent"

/**
 * Tells Google the visitor's decision via Consent Mode v2.
 *
 * Sent for BOTH outcomes on purpose: an explicit "denied" is a signal Google
 * can model against, whereas never sending anything is what produced the 0%
 * consent rate in the first place. Denied is also already the default set in
 * GoogleConsentMode.tsx, so a failure here degrades to "nothing stored"
 * rather than to over-collection.
 */
function applyGoogleConsent(decision: ConsentDecision) {
    // `window.gtag` is declared globally in components/analytics/GoogleAnalytics.tsx.
    if (typeof window === "undefined" || typeof window.gtag !== "function") return
    const value = decision === "accepted" ? "granted" : "denied"
    try {
        window.gtag("consent", "update", {
            ad_storage: value,
            ad_user_data: value,
            ad_personalization: value,
            analytics_storage: value,
        })
    } catch {
        // Never let consent plumbing break the page.
    }
}

interface ConsentContextValue {
    /** Whether analytics/marketing scripts are allowed to load. */
    granted: boolean
    bannerOpen: boolean
    acceptAll: () => void
    rejectAll: () => void
    openPreferences: () => void
}

const ConsentContext = React.createContext<ConsentContextValue | null>(null)

export function useConsent() {
    const ctx = React.useContext(ConsentContext)
    if (!ctx) throw new Error("useConsent must be used within ConsentProvider")
    return ctx
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
    const [decision, setDecision] = React.useState<ConsentDecision | null>(null)
    const [hydrated, setHydrated] = React.useState(false)
    const [bannerOpen, setBannerOpen] = React.useState(false)

    React.useEffect(() => {
        let stored: ConsentDecision | null = null
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed?.decision === "accepted" || parsed?.decision === "rejected") {
                stored = parsed.decision
            }
        } catch {
            // Corrupt or blocked storage — treat as undecided, banner shows.
        }
        setDecision(stored)
        setBannerOpen(stored === null)
        setHydrated(true)
        // A returning visitor's stored choice has to reach Google too,
        // inside the `wait_for_update` window set with the defaults —
        // otherwise every repeat visit is reported as denied.
        if (stored) applyGoogleConsent(stored)
    }, [])

    const decide = React.useCallback((next: ConsentDecision) => {
        setDecision(next)
        setBannerOpen(false)
        applyGoogleConsent(next)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ decision: next, decidedAt: new Date().toISOString() }))
        } catch {
            // Storage unavailable — the choice still applies for this page load.
        }
    }, [])

    const value = React.useMemo<ConsentContextValue>(() => ({
        // Stays false until localStorage has been read client-side, so
        // tracking scripts never mount for a split second on the server
        // render or the first paint before we know the real answer.
        granted: hydrated && decision === "accepted",
        bannerOpen: hydrated && bannerOpen,
        acceptAll: () => decide("accepted"),
        rejectAll: () => decide("rejected"),
        openPreferences: () => setBannerOpen(true),
    }), [decision, hydrated, bannerOpen, decide])

    return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
