"use client"

import * as React from "react"

/**
 * PECR/GDPR cookie consent. Analytics/marketing scripts (GTM, GA4, Meta
 * Pixel, TikTok Pixel) must not load until a visitor actively opts in —
 * see the `granted` check each of those components does in
 * src/components/analytics/*.tsx. The auth session cookie is strictly
 * necessary for the service to function, so it's never gated by this.
 */

type ConsentDecision = "accepted" | "rejected"
const STORAGE_KEY = "carmazium_cookie_consent"

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
    }, [])

    const decide = React.useCallback((next: ConsentDecision) => {
        setDecision(next)
        setBannerOpen(false)
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
